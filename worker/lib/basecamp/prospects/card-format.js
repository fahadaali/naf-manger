// بطاقةُ العميل المحتمل في بيسكامب — كتابتُها وقراءتُها.
//
// ═══ صيغةٌ ثابتة تُقرأ بقاعدة ═══
//
// المنصةُ تكتب الوصفَ أسطراً «الحقل: القيمة»، والعنوانُ اسمُ العميل، والعمودُ
// حالتُه. فما كتبته المنصةُ يُقرأ بالقاعدة نفسِها التي تقرأ «بيانات المشروع»
// (`parse.js`) — حرفاً بحرف، بلا طراز.
//
// والملاحظاتُ آخرُ الوصف عمداً: يُؤخذ كلُّ ما بعد عنوانها كما هو. فسطرٌ في
// الملاحظة فيه نقطتان («الموعد: الأحد») لا يُقرأ حقلاً.
//
// ═══ والقيمةُ تُحفظ بصورةٍ واحدة ═══
//
// `canonical` يردّ الحقولَ نصوصاً موحَّدة كما في أعمدة المنصة: نوعُ العميل
// رمزٌ لا لفظ، والقيمةُ بالهللات، والتاريخ `YYYY-MM-DD`. وبها تُقارَن الصورةُ
// المحفوظة بالطرفين — فـ«شركة» في البطاقة و`company` في المنصة لا يُقرآن
// اختلافاً.

import { normalizeArabic } from '../discover.js';
import { CLOSED_CODES, coerceTarget, htmlToText, readLabelledLines } from '../parse.js';
import { normalizeIdNumber, normalizePhone, toLatinDigits } from '../numbers.js';

/** حقولُ الوصف بترتيبها، ووجهُها العربي. والاسمُ عنوانُ البطاقة لا سطرٌ فيها. */
export const CARD_FIELDS = [
  ['phone', 'رقم الجوال'],
  ['email', 'البريد الإلكتروني'],
  ['clientType', 'نوع العميل'],
  ['idType', 'نوع الهوية'],
  ['idNumber', 'رقم الهوية'],
  ['commercialRegister', 'السجل التجاري'],
  ['source', 'المصدر'],
  ['expectedValue', 'القيمة المتوقعة'],
  ['followUpDate', 'موعد المتابعة'],
];

/** كلُّ ما يُزامَن: الاسمُ والحالةُ والحقولُ والملاحظات. */
export const SYNCED_FIELDS = ['fullName', 'prospectStatus', ...CARD_FIELDS.map(([key]) => key), 'notes'];

export const FIELD_LABELS = {
  fullName: 'الاسم',
  prospectStatus: 'الحالة',
  ...Object.fromEntries(CARD_FIELDS),
  notes: 'الملاحظات',
};

const NOTES_LABEL = 'الملاحظات';

/* عناوينُ يكتبها الناس بأيديهم في بطاقةٍ أُنشئت في بيسكامب. والمفتاحُ موحَّدٌ
   بـ`normalizeArabic` — فـ«البريد الالكتروني» و«البريد الإلكتروني» واحد. */
const ALIASES = {
  fullName: ['الاسم', 'اسم العميل', 'العميل', 'اسم الشركة', 'اسم المنشأة', 'الاسم الكامل'],
  phone: ['رقم الجوال', 'الجوال', 'الهاتف', 'رقم الهاتف', 'جوال', 'موبايل', 'رقم التواصل', 'واتساب'],
  email: ['البريد الإلكتروني', 'البريد', 'الايميل', 'الإيميل', 'ايميل', 'email', 'e-mail'],
  clientType: ['نوع العميل', 'تصنيف العميل', 'صفة العميل', 'النوع'],
  idType: ['نوع الهوية'],
  idNumber: ['رقم الهوية', 'الهوية', 'رقم الإقامة', 'الإقامة', 'السجل المدني'],
  commercialRegister: ['السجل التجاري', 'رقم السجل التجاري', 'سجل تجاري'],
  source: ['المصدر', 'مصدر العميل', 'كيف عرفنا', 'طريقة الوصول'],
  expectedValue: ['القيمة المتوقعة', 'قيمة العقد', 'القيمة', 'الأتعاب المتوقعة', 'المبلغ المتوقع'],
  followUpDate: ['موعد المتابعة', 'تاريخ المتابعة', 'المتابعة'],
  notes: ['الملاحظات', 'ملاحظات', 'ملاحظة', 'تفاصيل', 'التفاصيل'],
};

const ALIAS_INDEX = new Map(
  Object.entries(ALIASES).flatMap(([field, labels]) => labels.map((label) => [normalizeArabic(label), field])),
);

/** عنوانٌ مكتوب ← حقلُ المنصة، أو `null`. */
export const fieldOfLabel = (label) => ALIAS_INDEX.get(normalizeArabic(label)) ?? null;

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ═══ القيم ═══ */

/** هللاتٌ ← «١٥٠٠٠» بالريال، وكسرُه إن وُجد. */
function halalasToRiyals(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n % 100 === 0 ? String(n / 100) : (n / 100).toFixed(2);
}

/** «١٥٬٠٠٠ ريال» ← هللات، أو `null`. */
export function riyalsToHalalas(raw) {
  const text = toLatinDigits(String(raw ?? '')).replace(/[,،٬\s]/g, '').replace(/ريال|ر\.?س|sar/gi, '');
  const match = text.match(/\d+(?:\.\d{1,2})?/);
  if (!match) return null;
  return Math.round(Number(match[0]) * 100);
}

/** تاريخٌ مكتوبٌ بإحدى صيغتين ← `YYYY-MM-DD`، أو `null`. */
export function readDate(raw) {
  const text = toLatinDigits(String(raw ?? '')).trim();
  let match = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  match = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return null;
}

/**
 * قيمةٌ خامٌ من البطاقة ← صورتُها الموحَّدة، أو `null` لما لا يصلح للحقل.
 *
 * والجوّالُ والهويةُ ونوعُ العميل تمرّ على مدقّقي `parse.js` نفسِها: ما يدخل
 * عمودَ الهوية من البطاقة هو ما يدخله من ملفّ المشروع.
 */
export function coerceField(field, raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  switch (field) {
    case 'phone':
      /* رقمٌ سعوديٌّ يُوحَّد، وغيرُه — دوليٌّ مثلاً — يُحفظ كما كُتب ما دام رقماً. */
      return normalizePhone(value) ?? (/^\+?[\d\s\-()]{7,20}$/.test(toLatinDigits(value)) ? toLatinDigits(value) : null);
    case 'email': {
      const email = value.match(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/);
      return email ? email[0].toLowerCase() : null;
    }
    case 'clientType': {
      if (CLOSED_CODES['client.clientType'][value]) return value;
      const read = coerceTarget('client.clientType', value);
      return read?.values?.clientType ?? null;
    }
    case 'idNumber':
      return normalizeIdNumber(value);
    case 'expectedValue': {
      const halalas = riyalsToHalalas(value);
      return halalas === null ? null : String(halalas);
    }
    case 'followUpDate':
      return readDate(value);
    default:
      return value;
  }
}

/**
 * صفُّ المنصة ← الصورةُ الموحَّدة التي تُقارَن.
 *
 * يقبل الصفَّ بأعمدته (`full_name`) أو بأسمائه في الواجهة (`fullName`).
 */
export function canonical(row) {
  const pick = (camel, snake) => row?.[camel] ?? row?.[snake];
  const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

  return {
    fullName: text(pick('fullName', 'full_name')),
    prospectStatus: text(pick('prospectStatus', 'prospect_status')),
    phone: text(pick('phone', 'phone')),
    email: text(pick('email', 'email')).toLowerCase(),
    clientType: text(pick('clientType', 'client_type')),
    idType: text(pick('idType', 'id_type')),
    idNumber: text(pick('idNumber', 'id_number')),
    commercialRegister: text(pick('commercialRegister', 'commercial_register')),
    source: text(pick('source', 'source')),
    expectedValue: (() => {
      const value = row?.expected_value ?? (row?.expectedValue !== undefined && row?.expectedValue !== null
        ? Math.round(Number(row.expectedValue) * 100) : null);
      return value ? String(value) : '';
    })(),
    followUpDate: text(pick('followUpDate', 'follow_up_date')).slice(0, 10),
    notes: text(pick('notes', 'notes')),
  };
}

/* ═══ الكتابة ═══ */

/** الصورةُ الموحَّدة ← لفظٌ يُقرأ في البطاقة. */
function display(field, value) {
  if (!value) return '';
  if (field === 'clientType') return CLOSED_CODES['client.clientType'][value] ?? value;
  if (field === 'expectedValue') return halalasToRiyals(value);
  return value;
}

/**
 * الصورةُ الموحَّدة ← `{ title, content, due_on }` لنداء بيسكامب.
 *
 * والحقلُ الفارغ يُكتب بعنوانه وبلا قيمة: من يفتح البطاقة يرى ما ينقص فيملؤه،
 * وما يملؤه يُقرأ بالقاعدة لا بالطراز.
 */
export function renderCard(values) {
  const lines = CARD_FIELDS.map(([field, label]) => {
    const shown = display(field, values[field]);
    return `<div><strong>${label}:</strong> ${escapeHtml(shown)}</div>`;
  });

  const notes = String(values.notes ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
  lines.push(`<div><strong>${NOTES_LABEL}:</strong></div>`);
  for (const line of notes) lines.push(`<div>${escapeHtml(line)}</div>`);

  return {
    title: values.fullName || 'عميل محتمل',
    content: lines.join(''),
    due_on: values.followUpDate || null,
  };
}

/* ═══ القراءة ═══ */

/**
 * وصفُ البطاقة ← `{ values, structured, text }`.
 *
 * `values` ما قُرئ بعنوانٍ معروف وحده، موحَّداً. و`structured` أهذه بطاقةٌ
 * بالصيغة (وُجد فيها عنوانان معروفان فأكثر) — وإلا فهي نصٌّ حرّ كتبه إنسان،
 * ويُسأل عنه الطراز. و`text` النصُّ المجرَّد لمن يسأله.
 */
export function parseCard(html) {
  const text = htmlToText(html ?? '');
  const lines = text.split('\n');

  /* الملاحظاتُ ما بعد عنوانها كلُّه — فيُقصّ قبل أن تُقرأ الأسطر حقولاً. */
  let notes = null;
  let head = lines;
  const notesAt = lines.findIndex((line) => {
    const match = line.match(/^\s*[*_\-•]*\s*([^:：]{1,30}?)\s*[:：]\s*(.*)$/);
    return match && fieldOfLabel(match[1].replace(/[*_]/g, '')) === 'notes';
  });
  if (notesAt >= 0) {
    const first = lines[notesAt].replace(/^[^:：]*[:：]\s*/, '').trim();
    notes = [first, ...lines.slice(notesAt + 1)].map((line) => line.trim()).filter(Boolean).join('\n');
    head = lines.slice(0, notesAt);
  }

  const values = {};
  let known = 0;
  for (const entry of readLabelledLines(head.join('\n'))) {
    const field = fieldOfLabel(entry.label);
    if (!field || field === 'notes') continue;
    known++;
    const coerced = coerceField(field, entry.value);
    if (coerced !== null && values[field] === undefined) values[field] = coerced;
  }
  if (notesAt >= 0) known++;
  if (notes !== null) values.notes = notes;

  return { values, structured: known >= 2, text };
}
