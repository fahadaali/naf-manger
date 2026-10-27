// قارئُ وافق — قراءةٌ لا كتابة.
//
// ═══ قارئٌ متحمّل، وذلك مقصود ═══
//
// الأساس `https://api.wafeq.com/v1/`، والترويسة `Authorization: Api-Key …`،
// والدفعةُ تربط فواتيرها في `invoice_payments` — هذا ما ثبت عند كتابة الملفّ.
// أمّا أسماءُ الحقول في ردّ القوائم فلم تُقرأ من مرجعٍ يُطمأنّ إليه. فكلُّ
// حقلٍ يُقرأ من أسمائه المحتملة، والموحَّدُ وحدَه يخرج من هذا الملفّ — فإن
// تبيّن من «اختبار الاتصال» اسمٌ آخر عُدِّل هنا وحده، ولا يمسّ الباقي.
//
// ولا يُخترع ما لا يُقرأ: دفعةٌ بلا معرّفٍ أو بلا مبلغٍ يُفهم تُطرح ويُعدّ
// طرحُها، لا تُكتب بصفر.

import { toLatinDigits } from '../digits.js';

const BASE = 'https://api.wafeq.com/v1/';

/** أقصى الصفحات في الدورة — حسابٌ فيه آلافُ الدفعات يُقرأ على دورات. */
const MAX_PAGES = 20;

export class WafeqError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/** المفتاحُ سرٌّ في `wrangler secret`. وغيابُه غيابُ الربط. */
export const configured = (env) => Boolean(env?.WAFEQ_API_KEY);

async function call(env, url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Api-Key ${env.WAFEQ_API_KEY}`,
        Accept: 'application/json',
      },
    });
  } catch {
    throw new WafeqError('unreachable', 502);
  }

  if (response.status === 401 || response.status === 403) throw new WafeqError('unauthorized', 503);
  if (response.status === 429) throw new WafeqError('rate_limited', 503);
  if (response.status === 404) throw new WafeqError('not_found', 502);
  if (!response.ok) throw new WafeqError('request_failed', 502);

  try {
    return await response.json();
  } catch {
    throw new WafeqError('invalid_response', 502);
  }
}

const urlOf = (path, params = {}) => {
  const url = new URL(path.replace(/^\//, ''), BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
};

/* الصفحةُ قائمةٌ مجرّدة، أو `{ results, next }` على نمط DRF. و`next` يُتبع
   إن كان على نطاقهم وحده — رابطٌ إلى نطاقٍ آخر لا يُحمل إليه المفتاح. */
const itemsOf = (page) => (Array.isArray(page) ? page : Array.isArray(page?.results) ? page.results : []);
const nextOf = (page) => {
  const next = Array.isArray(page) ? null : page?.next;
  if (typeof next !== 'string' || !next) return null;
  try {
    return new URL(next).host === new URL(BASE).host ? next : null;
  } catch {
    return null;
  }
};

/** يقرأ القائمة كلَّها صفحةً صفحة، إلى السقف. */
export async function listAll(env, path, params = {}, { maxPages = MAX_PAGES } = {}) {
  const items = [];
  let url = urlOf(path, { page_size: 100, ...params });
  let pages = 0;
  let truncated = false;

  while (url) {
    if (pages >= maxPages) { truncated = true; break; }
    const page = await call(env, url);
    items.push(...itemsOf(page));
    pages++;
    url = nextOf(page);
  }
  return { items, pages, truncated };
}

/** صفحةٌ واحدة كما هي — لـ«اختبار الاتصال». */
export async function firstPage(env, path) {
  return call(env, urlOf(path, { page_size: 5 }));
}

export async function readInvoice(env, id) {
  return call(env, urlOf(`invoices/${encodeURIComponent(id)}/`));
}

export async function readProject(env, id) {
  return call(env, urlOf(`projects/${encodeURIComponent(id)}/`));
}

/* ═══ التوحيد ═══ */

const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

/** مبلغٌ نصّاً أو عدداً — «1,250.50» و1250.5 واحد. وما لا يُفهم `null`. */
export function amountOf(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(toLatinDigits(String(value)).replace(/[,\s٬]/g, ''));
  return Number.isFinite(number) ? number : null;
}

const dayOf = (value) => {
  const raw = text(value);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
};

/**
 * الجهةُ كائناً أو معرّفاً — والمعرّفُ وحده لا اسمَ فيه يُطابَق، فيُحمل
 * `id` لتُقرأ به الجهة (`readContact`).
 */
function contactOf(raw) {
  const contact = raw.contact && typeof raw.contact === 'object' ? raw.contact : {};
  const bareId = typeof raw.contact === 'string' || typeof raw.contact === 'number' ? raw.contact : null;
  const fields = contactFields(contact);
  return {
    id: text(first(contact.id, bareId, raw.contact_id, raw.customer_id)),
    name: fields.name || text(first(raw.contact_name, raw.customer_name)),
    number: fields.number || text(raw.tax_registration_number),
  };
}

/** اسمُ الجهة ورقمُها من كائنها — كما يردّه `GET /contacts/{id}/`. */
export function contactFields(contact) {
  if (!contact || typeof contact !== 'object') return { name: '', number: '' };
  return {
    name: text(first(contact.name, contact.display_name, contact.company_name)),
    number: text(first(
      contact.tax_registration_number, contact.vat_number, contact.tax_number,
      contact.commercial_registration_number, contact.national_id,
    )),
  };
}

export async function readContact(env, id) {
  return call(env, urlOf(`contacts/${encodeURIComponent(id)}/`));
}

/** فواتيرُ الدفعة: أرقامُها ومعرّفاتُها ونصُّ ما فيها إن جاء مع الدفعة. */
function invoicesOf(raw) {
  const list = first(raw.invoice_payments, raw.allocations, raw.invoices) ?? [];
  if (!Array.isArray(list)) return [];
  return list.map((entry) => {
    const invoice = entry?.invoice && typeof entry.invoice === 'object' ? entry.invoice : null;
    return {
      id: text(invoice?.id ?? (typeof entry?.invoice === 'string' || typeof entry?.invoice === 'number' ? entry.invoice : entry?.id)),
      number: text(first(invoice?.invoice_number, invoice?.number, entry?.invoice_number)),
      text: invoice ? invoiceText(invoice) : '',
      contact: invoice ? invoiceContact(invoice) : null,
    };
  });
}

/* قيمةٌ نصّية أو عددية وحدها — كائنٌ لا يُطبع «[object Object]». */
const scalar = (value) => (typeof value === 'string' || typeof value === 'number' ? text(value) : '');

/**
 * الحقولُ المخصّصة «العنوان: القيمة» — وشكلُها عند وافق لم يظهر في الاختبار
 * (فارغةٌ في العيّنة)، فتُقرأ مصفوفةً أو كائناً، وعنوانُها وقيمتُها بصورهما
 * المحتملة. وقد يضع المكتبُ فيها رقمَ القضية.
 */
function customText(fields) {
  if (!fields || typeof fields !== 'object') return [];
  const entries = Array.isArray(fields) ? fields : Object.entries(fields).map(([name, value]) => ({ name, value }));
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object') return scalar(entry);
    const field = entry.field && typeof entry.field === 'object' ? entry.field : {};
    const label = scalar(first(entry.name, entry.label, entry.key, field.name, field.label, scalar(entry.field) || undefined));
    const raw = entry.value;
    const value = raw && typeof raw === 'object' ? scalar(first(raw.name, raw.label, raw.value)) : scalar(raw);
    return value ? (label ? `${label}: ${value}` : value) : '';
  }).filter(Boolean);
}

/* نصُّ بندٍ واحد: وصفُه، وإلا اسمُه، وإلا اسمُ الصنف الذي يحمله — وحقولُه المخصّصة. */
const lineText = (line) => {
  if (!line || typeof line !== 'object') return '';
  const item = line.item && typeof line.item === 'object' ? line.item : {};
  return [
    text(first(line.description, line.item_description, line.name, line.title, item.description, item.name)),
    ...customText(line.custom_fields),
  ].filter(Boolean).join(' — ');
};

/**
 * نصُّ الفاتورة: رقمُها ومرجعُها وملاحظاتُها وشروطُها ووصفُ كلّ بند — وهو
 * ما يكتب فيه المكتبُ تفصيلَ العمل («أتعاب قضية… لدى المحكمة…»).
 *
 * والأسماءُ تُجرَّب على صورها المحتملة: الدفعةُ عند وافق لا تحمل وصفاً
 * (`reference` و`project` وحدهما)، فالفاتورةُ هي ما يقول لمن الدفعة ولأيّ عمل.
 */
export function invoiceText(invoice) {
  if (!invoice || typeof invoice !== 'object') return '';
  const lines = first(invoice.line_items, invoice.items, invoice.lines, invoice.invoice_line_items);
  return [
    invoice.invoice_number, invoice.number, invoice.reference, invoice.notes, invoice.description,
    invoice.terms, invoice.memo, invoice.subject, invoice.title, invoice.purchase_order,
    ...customText(invoice.custom_fields),
    ...(Array.isArray(lines) ? lines.map(lineText) : []),
  ].map(text).filter(Boolean).join(' | ');
}

/** جهةُ الفاتورة: كائناً (اسمُها ورقمُها) أو معرّفاً يُقرأ به. */
export function invoiceContact(invoice) {
  const raw = invoice?.contact;
  if (raw && typeof raw === 'object') return { id: text(raw.id), ...contactFields(raw) };
  if (typeof raw === 'string' || typeof raw === 'number') return { id: text(raw), name: '', number: '' };
  return { id: text(invoice?.contact_id), name: text(invoice?.contact_name), number: '' };
}

/** المشروعُ عند وافق: معرّفاً أو كائناً. وقد يكون اسمُه اسمَ القضية. */
export function projectOf(raw) {
  const project = raw.project;
  if (project && typeof project === 'object') {
    return { id: text(project.id), name: text(first(project.name, project.title)) };
  }
  return { id: text(first(project, raw.project_id)), name: '' };
}

export const projectName = (project) => text(first(project?.name, project?.title));

/**
 * دفعةٌ كما يفهمها هذا الملفّ — أو `null` إن لم تُفهم.
 *
 * ودفعةُ مورّدٍ (فاتورةُ شراء) ليست من موكّل: تُعرف بـ`bill_payments` ولا
 * فواتيرَ بيعٍ معها، فتُطرح هنا ولا تبلغ المطابقة.
 */
export function normalizePayment(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const amount = amountOf(first(raw.amount, raw.total, raw.amount_to_pcy));
  if (!id || amount === null || amount <= 0) return null;

  const invoices = invoicesOf(raw);
  const bills = Array.isArray(raw.bill_payments) ? raw.bill_payments : [];
  if (bills.length && !invoices.length) return null;

  const contact = contactOf(raw);
  const project = projectOf(raw);
  return {
    externalId: id,
    projectId: project.id,
    projectName: project.name,
    date: dayOf(first(raw.date, raw.payment_date, raw.created_ts, raw.created_at)),
    amount,
    currency: text(first(raw.currency, raw.currency_code)) || null,
    contactId: contact.id,
    contactName: contact.name,
    contactNumber: contact.number,
    reference: text(first(raw.reference, raw.payment_reference, raw.number)),
    description: text(first(raw.description, raw.notes, raw.memo)),
    invoices,
  };
}
