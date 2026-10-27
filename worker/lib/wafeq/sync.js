// مزامنةُ وافق — تقرأ المدفوعات، وتربطها بالقضايا، وتنزل المربوطَ إلى سجلّ الدفعات.
//
// ═══ ثلاثُ طبقات، الأوثقُ أوّلاً ═══
//
//   ١) **رقمُ القضية حرفاً** في مرجع الدفعة أو وصفها أو فواتيرها، وقضيةٌ
//      واحدةٌ تطابقه → تُربط آلياً. هو ما يكتبه المحاسب قصداً، والخطأُ فيه
//      خطؤه ظاهراً.
//   ٢) **الموكّل** — بالرقم الضريبي أو الهوية، ثم بالاسم الموحَّد. يحصر
//      المرشّحين في قضاياه، ولا يربط وحده.
//   ٣) **الطراز** — يختار من القائمة المغلقة أو يقول «لا أعرف». وجوابُه
//      `suggested` يؤكّده إنسان.
//
// وما لم يُربط لا ينزل إلى `client_payments`: المحصَّلُ لا يتحرّك بترجيح.
//
// ═══ وما حسمه إنسانٌ لا تنقضه دورة ═══
// `linked` و`ignored` يبقيان كما هما. وتبدُّلُ مبلغِ دفعةٍ مربوطة عند وافق
// يُنقل إلى السجلّ — وافق مصدرُها، والدفترُ يتبعه.

import {
  contactFields, invoiceText, listAll, normalizePayment, readContact, readInvoice, WafeqError,
} from './api.js';
import { recomputeCollected } from '../payments.js';
import { toLatinDigits } from '../digits.js';
import { normalizeArabic } from '../basecamp/discover.js';
import { nameRelation } from '../basecamp/names.js';
import { suggestCaseForPayment } from '../ai/payments.js';
import { aiEnabled, fingerprint, newBudget } from '../ai/summarize.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** الدورةُ الآلية تقرأ أحدثَ الصفحات، والأولى اليدوية أوسع. */
const PAGES = { manual: 20, cron: 5 };

/** سقفُ المرشّحين حين لا يُعرف الموكّل — قائمةٌ أطولُ تُضعف الاختيار. */
const MAX_CANDIDATES = 40;

/**
 * سقفُ أسئلة الطراز في دورة وافق — مستقلٌّ عن سقف بيسكامب (٢٥) وأكبر منه:
 * سؤالُ الدفعة قصيرٌ، والدفعاتُ المستوردة أوّلَ مرّةٍ بالمئات. وما بعده
 * يُؤجَّل إلى الدورة التالية أو إلى «اربط بالذكاء الاصطناعي الآن».
 */
export const WAFEQ_AI_BUDGET = 60;

const safeJson = (raw) => {
  try { return JSON.parse(raw ?? 'null'); } catch { return null; }
};

const isProBono = (row) => safeJson(row.fee_structure)?.type === 'pro_bono';

const remainingOf = (row) => {
  const status = safeJson(row.payment_status) ?? {};
  return Math.max(Number(status.totalAmount ?? 0) - Number(status.collectedAmount ?? 0), 0);
};

/* ═══ رقمُ القضية في نصّ ═══
   تُوحَّد الأرقامُ والشرطاتُ والمسافات، ثم يُبحث عن الرقم كاملاً لا جزءاً
   من رقمٍ أطول: «ق-2026-014» ليست في «ق-2026-0145». */
const compact = (value) =>
  toLatinDigits(String(value ?? ''))
    .replace(/[‐-―−_/]/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();

function mentions(haystack, caseNumber) {
  const needle = compact(caseNumber);
  if (!needle) return false;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return false;
    const before = haystack[at - 1] ?? '';
    const after = haystack[at + needle.length] ?? '';
    if (!/\d/.test(before) && !/\d/.test(after)) return true;
    from = at + 1;
  }
}

/* ورقمٌ قصيرٌ أرقاماً وحدها («4421») يظهر في المبالغ والتواريخ — فظهورُه
   قرينةٌ تُعطى الطراز، لا ربطٌ آليّ. */
const distinctive = (caseNumber) => {
  const value = compact(caseNumber);
  return /[^\d]/.test(value) ? value.length >= 4 : value.length >= 6;
};

/** يجهّز سياقَ الدورة: القضايا مرّةً، والعملاء مرّةً. */
async function loadContext(env) {
  const [{ results: cases }, { results: clients }] = await Promise.all([
    env.DB.prepare(
      `SELECT id, case_number, court_case_number, case_type, summary, client_id, client_name, status,
              payment_status, fee_structure, updated_at
         FROM cases WHERE archived_at IS NULL`,
    ).all(),
    env.DB.prepare(
      `SELECT id, full_name, id_number, commercial_register FROM clients WHERE archived_at IS NULL`,
    ).all(),
  ]);
  return {
    cases: (cases ?? []).filter((row) => !isProBono(row)),
    clients: clients ?? [],
  };
}

function findClient(context, payment) {
  const number = compact(payment.contactNumber).replace(/\D/g, '');
  if (number) {
    const byNumber = context.clients.find((client) =>
      [client.id_number, client.commercial_register].some((value) => compact(value).replace(/\D/g, '') === number));
    if (byNumber) return byNumber;
  }
  const name = normalizeArabic(payment.contactName ?? '');
  if (!name) return null;
  return context.clients.find((client) => normalizeArabic(client.full_name) === name)
    ?? context.clients.find((client) => nameRelation(client.full_name, payment.contactName) === 'same')
    ?? null;
}

/**
 * قرارُ دفعةٍ واحدة — بلا كتابة.
 *
 * @returns {{ status, caseId?, suggestedCaseId?, clientId?, matchBy?, reason?, aiFingerprint? }}
 */
export async function decide(env, context, payment, { ai, previousFingerprint } = {}) {
  const haystack = compact([payment.reference, payment.description, payment.invoiceText].join(' '));
  const client = findClient(context, payment);

  // ١) رقمُ المشروع أو رقمُ القضية لدى الجهة حرفاً
  /* والمحاسبُ يكتب أيَّهما: رقمَ المشروع عندنا، أو رقمَ المحكمة الذي يعرفه
     الموكّل. ورقمُ الجهة قد يتكرّر بين قضيتين — فلا يُربط إلا ما انفرد. */
  const numberIn = (row) => [row.case_number, row.court_case_number].find((number) => mentions(haystack, number));
  const named = context.cases.filter((row) => numberIn(row));
  const strong = named.filter((row) => distinctive(numberIn(row)));
  if (strong.length === 1) {
    return {
      status: 'linked',
      caseId: strong[0].id,
      clientId: strong[0].client_id,
      matchBy: 'case_number',
      reason: `رقمُ القضية «${numberIn(strong[0])}» في نصّ الدفعة`,
    };
  }

  // ٢) المرشّحون: قضايا الموكّل، أو ما ذُكر رقمُه، أو أحدثُ القضايا المفتوحة
  /* وكان الأخيرُ «ما بقي عليه شيء» — وأكثرُ القضايا بلا أتعابٍ مكتوبة، فتفرغ
     القائمةُ ولا يُسأل الطرازُ أصلاً، بصمت. والمفتوحةُ كلُّها مرشّحةٌ الآن،
     ومع كلٍّ اسمُ موكّلها: فيطابق الطرازُ اسمَ الدافع به. */
  let candidates = client ? context.cases.filter((row) => row.client_id === client.id) : [];
  if (!candidates.length && named.length) candidates = named;
  if (!candidates.length) {
    candidates = context.cases
      .filter((row) => row.status !== 'completed')
      .sort((one, other) => Number(other.updated_at ?? 0) - Number(one.updated_at ?? 0))
      .slice(0, MAX_CANDIDATES);
  }

  const open = candidates.filter((row) => remainingOf(row) > 0);
  if (client && candidates.length === 1) {
    return {
      status: 'suggested',
      suggestedCaseId: candidates[0].id,
      clientId: client.id,
      matchBy: 'client',
      reason: `الدافعُ «${client.full_name}» وليس له إلا هذه القضية`,
    };
  }

  // ٣) الطراز — مرّةً لكلّ نصٍّ ومرشّحين
  const shaped = candidates.map((row) => ({
    id: row.id,
    caseNumber: row.case_number,
    caseType: row.case_type,
    summary: row.summary,
    clientName: row.client_name ?? '',
    remaining: remainingOf(row),
  }));
  const asked = await fingerprint({
    payment: [payment.reference, payment.description, payment.invoiceText, payment.contactName, payment.amount].join('|'),
    candidates: shaped.map((item) => item.caseNumber).sort().join(','),
  });

  /* ولماذا لم يُسأل — يُقال في الحصيلة لا يُسكت عنه. */
  const aiSkipped = !ai?.enabled ? 'disabled'
    : !shaped.length ? 'noCandidates'
      : asked === previousFingerprint ? 'unchanged'
        : null;

  if (!aiSkipped && ai.budget.spend()) {
    const answer = await suggestCaseForPayment(env, { payment, candidates: shaped });
    if (answer) {
      const chosen = shaped.find((item) => item.caseNumber === answer.caseNumber);
      return {
        status: 'suggested',
        suggestedCaseId: chosen.id,
        clientId: client?.id ?? candidates.find((row) => row.id === chosen.id)?.client_id ?? null,
        matchBy: 'ai',
        reason: answer.reason || 'اقتراحٌ آليّ',
        aiFingerprint: asked,
      };
    }
    return {
      status: 'unmatched',
      clientId: client?.id ?? null,
      reason: 'لم يجد الطرازُ قضيةً بيقين',
      aiFingerprint: asked,
    };
  }

  /* ولموكّلٍ معروفٍ قضيةٌ واحدةٌ مفتوحة: قرينةٌ تُقال، والحكمُ لمن يؤكّد. */
  if (client && open.length === 1) {
    return {
      status: 'suggested',
      suggestedCaseId: open[0].id,
      clientId: client.id,
      matchBy: 'client',
      reason: `الدافعُ «${client.full_name}» وله قضيةٌ واحدةٌ عليها متبقٍّ`,
    };
  }

  return {
    status: 'unmatched',
    clientId: client?.id ?? null,
    reason: client ? `الدافعُ «${client.full_name}» وله أكثرُ من قضية` : 'لم يُعرف الدافع',
    aiSkipped: aiSkipped ?? 'budget',
  };
}

/* ═══ الجهةُ بمعرّفها ═══
   الدفعةُ تحمل الجهةَ معرّفاً في الغالب. فتُقرأ مرّةً لكلّ جهةٍ في الدورة —
   أو تُؤخذ من فاتورةٍ حملتها — ولا يُسقط الدفعةَ سقوطُ قراءتها. */
async function resolveContact(env, payment, cache) {
  if (payment.contactName) return;
  const fromInvoice = (payment.invoices ?? []).map((invoice) => invoice.contact).find((contact) => contact?.name);
  if (fromInvoice) {
    payment.contactName = fromInvoice.name;
    payment.contactNumber ||= fromInvoice.number;
    return;
  }
  if (!payment.contactId) return;
  if (!cache.has(payment.contactId)) {
    cache.set(payment.contactId, await readContact(env, payment.contactId).then(contactFields).catch(() => null));
  }
  const found = cache.get(payment.contactId);
  if (found?.name) {
    payment.contactName = found.name;
    payment.contactNumber ||= found.number;
  }
}

const newAiSummary = (ai) => ({
  enabled: ai.enabled, used: 0, deferred: 0, failed: 0,
  skipped: { disabled: 0, noCandidates: 0 },
});

/** يعدّ سببَ ترك الطراز — و`budget` يُعدّ في `deferred` و`unchanged` لا يُعدّ. */
function countSkip(summary, verdict) {
  if (verdict.aiSkipped === 'disabled' || verdict.aiSkipped === 'noCandidates') summary.ai.skipped[verdict.aiSkipped]++;
}

/**
 * ينزل دفعةً مربوطة إلى سجلّ الدفعات — أو ينقلها إلى قضيةٍ أخرى.
 *
 * و`external_id` فريدٌ في `client_payments`، فإعادةُ الربط تحديثٌ لا تكرار،
 * والمحصَّلُ يُعاد حسابُه للقضيتين: التي خرجت منها والتي دخلتها.
 */
export async function linkPayment(env, wafeqRow, caseId, actorId) {
  const target = await env.DB.prepare(`SELECT id, client_id, fee_structure FROM cases WHERE id = ?`)
    .bind(caseId)
    .first();
  if (!target) return { error: 'invalid_reference', status: 409 };
  if (isProBono(target)) return { error: 'pro_bono_case', status: 409 };

  const externalId = `wafeq:${wafeqRow.external_id}`;
  const existing = await env.DB.prepare(`SELECT id, case_id FROM client_payments WHERE external_id = ?`)
    .bind(externalId)
    .first();

  let paymentId = existing?.id;
  if (existing) {
    await env.DB.prepare(
      `UPDATE client_payments SET case_id = ?, client_id = ?, amount = ?, payment_date = ?, reference = ?
        WHERE id = ?`,
    )
      .bind(caseId, target.client_id, wafeqRow.amount, wafeqRow.payment_date ?? today(),
        wafeqRow.reference ?? null, existing.id)
      .run();
    if (existing.case_id !== caseId) await recomputeCollected(env, existing.case_id);
  } else {
    paymentId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO client_payments
         (id, case_id, client_id, amount, payment_date, method, reference, notes, source, external_id,
          created_by, created_at)
       VALUES (?, ?, ?, ?, ?, 'وافق', ?, ?, 'wafeq', ?, ?, ?)`,
    )
      .bind(paymentId, caseId, target.client_id, wafeqRow.amount, wafeqRow.payment_date ?? today(),
        wafeqRow.reference ?? null, wafeqRow.description || null, externalId, actorId ?? 'wafeq', nowSeconds())
      .run();
  }
  await recomputeCollected(env, caseId);
  return { paymentId, clientId: target.client_id };
}

/** يرفع دفعةً من السجلّ — والمحصَّلُ يُعاد حسابُه. */
export async function unlinkPayment(env, wafeqRow) {
  const existing = await env.DB.prepare(`SELECT id, case_id FROM client_payments WHERE external_id = ?`)
    .bind(`wafeq:${wafeqRow.external_id}`)
    .first();
  if (!existing) return;
  await env.DB.prepare(`DELETE FROM client_payments WHERE id = ?`).bind(existing.id).run();
  await recomputeCollected(env, existing.case_id);
}

const today = () => new Date().toISOString().slice(0, 10);

/* نصُّ الفواتير: ما جاء مع الدفعة، وإلا تُقرأ الفاتورةُ بمعرّفها — مرّةً
   لكلّ فاتورةٍ في الدورة، ولا يُسقط الدفعةَ سقوطُ قراءتها. */
async function invoiceTextOf(env, payment, cache) {
  const parts = [];
  for (const invoice of payment.invoices ?? []) {
    if (invoice.number) parts.push(invoice.number);
    if (invoice.text) { parts.push(invoice.text); continue; }
    if (!invoice.id) continue;
    if (!cache.has(invoice.id)) {
      cache.set(invoice.id, await readInvoice(env, invoice.id).then(invoiceText).catch(() => ''));
    }
    parts.push(cache.get(invoice.id));
  }
  return [...new Set(parts.filter(Boolean))].join(' | ').slice(0, 2000);
}

/**
 * دورةٌ كاملة — أو معاينتُها.
 *
 * `dryRun` يقرأ ويقرّر ويردّ ما سيقع، ولا يكتب حرفاً. وهي الشرطُ قبل أوّل كتابة.
 */
export async function runWafeqSync(env, { actorId, actorName, source = 'يدوي', dryRun = false, mode = 'manual' } = {}) {
  const listing = await listAll(env, 'payments/', { ordering: '-date' }, { maxPages: PAGES[mode] ?? PAGES.manual });
  const context = await loadContext(env);
  const ai = { enabled: await aiEnabled(env), budget: newBudget(WAFEQ_AI_BUDGET) };
  const invoices = new Map();
  const contacts = new Map();
  const now = nowSeconds();

  const summary = {
    read: listing.items.length,
    skipped: 0,
    linked: 0,
    suggested: 0,
    unmatched: 0,
    unchanged: 0,
    updated: 0,
    truncated: listing.truncated,
    ai: newAiSummary(ai),
  };
  const items = [];
  let newest = null;

  for (const raw of listing.items) {
    const payment = normalizePayment(raw);
    if (!payment) { summary.skipped++; continue; }
    if (payment.date && (!newest || payment.date > newest)) newest = payment.date;

    const amount = Math.round(payment.amount * 100);
    const stored = await env.DB.prepare(`SELECT * FROM wafeq_payments WHERE external_id = ?`)
      .bind(payment.externalId)
      .first();

    /* ما حُسم يبقى. ويُنقل تبدُّلُ المبلغ أو التاريخ إلى السجلّ. */
    if (stored && (stored.status === 'linked' || stored.status === 'ignored')) {
      const changed = stored.amount !== amount || (payment.date && stored.payment_date !== payment.date);
      if (!changed) { summary.unchanged++; continue; }
      summary.updated++;
      items.push({ externalId: payment.externalId, status: stored.status, change: 'amount_or_date' });
      if (dryRun) continue;
      await env.DB.prepare(
        `UPDATE wafeq_payments SET amount = ?, payment_date = ?, updated_at = ? WHERE external_id = ?`,
      )
        .bind(amount, payment.date ?? stored.payment_date, now, payment.externalId)
        .run();
      if (stored.status === 'linked' && stored.case_id) {
        await linkPayment(env, { ...stored, amount, payment_date: payment.date ?? stored.payment_date }, stored.case_id, actorId);
      }
      continue;
    }

    payment.invoiceText = await invoiceTextOf(env, payment, invoices);
    await resolveContact(env, payment, contacts);
    const verdict = await decide(env, context, payment, { ai, previousFingerprint: stored?.ai_fingerprint });
    countSkip(summary, verdict);

    /* اقتراحٌ سبق ولم يتبدّل ما سُئل عنه: يبقى على ما كان — لا يُطمس
       باقتراحٍ أضعف لأنّ الطراز لم يُسأل ثانيةً. ورقمُ قضيةٍ ظهر يُقدَّم. */
    const keep = stored && stored.status === 'suggested' && verdict.status !== 'linked' && !verdict.aiFingerprint;
    const final = keep ? { status: stored.status, suggestedCaseId: stored.suggested_case_id, clientId: stored.client_id,
      matchBy: stored.match_by, reason: stored.reason } : verdict;

    summary[final.status]++;
    items.push({
      externalId: payment.externalId,
      date: payment.date,
      amount: payment.amount,
      contactName: payment.contactName,
      reference: payment.reference,
      status: final.status,
      caseId: final.caseId ?? null,
      suggestedCaseId: final.suggestedCaseId ?? null,
      matchBy: final.matchBy ?? null,
      reason: final.reason ?? '',
    });
    if (dryRun) continue;

    await env.DB.prepare(
      `INSERT INTO wafeq_payments
         (external_id, payment_date, amount, currency, contact_name, contact_number, reference, description,
          invoice_text, status, case_id, suggested_case_id, client_id, match_by, reason, ai_fingerprint,
          contact_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(external_id) DO UPDATE SET
         payment_date = excluded.payment_date, amount = excluded.amount, currency = excluded.currency,
         contact_name = excluded.contact_name, contact_number = excluded.contact_number,
         contact_id = excluded.contact_id,
         reference = excluded.reference, description = excluded.description, invoice_text = excluded.invoice_text,
         status = excluded.status, case_id = excluded.case_id, suggested_case_id = excluded.suggested_case_id,
         client_id = excluded.client_id, match_by = excluded.match_by, reason = excluded.reason,
         ai_fingerprint = COALESCE(excluded.ai_fingerprint, wafeq_payments.ai_fingerprint),
         updated_at = excluded.updated_at`,
    )
      .bind(
        payment.externalId, payment.date, amount, payment.currency, payment.contactName || null,
        payment.contactNumber || null, payment.reference || null, payment.description || null,
        payment.invoiceText || null, final.status, final.caseId ?? null, final.suggestedCaseId ?? null,
        final.clientId ?? null, final.matchBy ?? null, final.reason ?? null, verdict.aiFingerprint ?? null,
        payment.contactId || null, stored?.created_at ?? now, now,
      )
      .run();

    if (final.status === 'linked') {
      const linked = await linkPayment(env, {
        external_id: payment.externalId, amount, payment_date: payment.date,
        reference: payment.reference, description: payment.description,
      }, final.caseId, actorId);
      if (linked.paymentId) {
        await env.DB.prepare(`UPDATE wafeq_payments SET payment_id = ? WHERE external_id = ?`)
          .bind(linked.paymentId, payment.externalId)
          .run();
      }
    }
  }

  Object.assign(summary.ai, { used: ai.budget.used, deferred: ai.budget.deferred, failed: ai.budget.failed });
  if (dryRun) return { summary, items };

  await env.DB.prepare(
    `INSERT INTO wafeq_connection (id, last_sync_at, last_sync_error, cursor_date, updated_at)
     VALUES (1, ?, NULL, ?, ?)
     ON CONFLICT(id) DO UPDATE SET last_sync_at = excluded.last_sync_at, last_sync_error = NULL,
       cursor_date = COALESCE(excluded.cursor_date, wafeq_connection.cursor_date),
       updated_at = excluded.updated_at`,
  )
    .bind(now, newest, now)
    .run();

  await env.DB.prepare(
    `INSERT INTO activity_logs (id, type, description, user_id, user_name, entity_type, details, created_at)
     VALUES (?, 'wafeq', ?, ?, ?, 'wafeq', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      `مزامنةُ وافق (${source}): ${summary.linked} دفعةً رُبطت، و${summary.suggested} مقترَحة،` +
        ` و${summary.unmatched} تنتظر قضية`,
      actorId ?? 'wafeq',
      actorName ?? '',
      JSON.stringify(summary),
      now,
    )
    .run()
    .catch(() => {});

  return { summary, items };
}

/**
 * «اربط بالذكاء الاصطناعي الآن» — على الدفعات المخزّنة «بلا قضية».
 *
 * لا تُقرأ الدفعاتُ من وافق ثانيةً: يُبنى السؤالُ ممّا حُفظ، وتُقرأ الجهةُ
 * بمعرّفها إن غاب اسمُها. والبصمةُ تمنع إعادةَ سؤالٍ لم يتبدّل، فضغطةٌ ثانيةٌ
 * تمضي إلى ما بعد السقف — حتى تقول الحصيلةُ «لم يبقَ شيء».
 *
 * والنتيجةُ كالدورة: رقمٌ في النصّ يُربط، وما سواه اقتراحٌ يؤكّده إنسان.
 */
export async function rematchWafeq(env, { actorId, actorName } = {}) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM wafeq_payments WHERE status = 'unmatched' ORDER BY payment_date DESC, updated_at DESC LIMIT 1000`,
  ).all();
  const context = await loadContext(env);
  const ai = { enabled: await aiEnabled(env), budget: newBudget(WAFEQ_AI_BUDGET) };
  const contacts = new Map();
  const now = nowSeconds();
  const summary = { checked: 0, linked: 0, suggested: 0, unmatched: 0, ai: newAiSummary(ai) };

  for (const row of results ?? []) {
    summary.checked++;
    const payment = {
      externalId: row.external_id,
      date: row.payment_date,
      amount: Number(row.amount ?? 0) / 100,
      contactId: row.contact_id,
      contactName: row.contact_name ?? '',
      contactNumber: row.contact_number ?? '',
      reference: row.reference ?? '',
      description: row.description ?? '',
      invoiceText: row.invoice_text ?? '',
    };
    await resolveContact(env, payment, contacts);
    const verdict = await decide(env, context, payment, { ai, previousFingerprint: row.ai_fingerprint });
    countSkip(summary, verdict);
    summary[verdict.status]++;

    const contactFound = payment.contactName && payment.contactName !== (row.contact_name ?? '');
    if (verdict.status === 'unmatched' && !verdict.aiFingerprint && !contactFound) continue;

    await env.DB.prepare(
      `UPDATE wafeq_payments SET status = ?, case_id = ?, suggested_case_id = ?, client_id = ?, match_by = ?,
              reason = ?, ai_fingerprint = COALESCE(?, ai_fingerprint), contact_name = ?, contact_number = ?,
              updated_at = ?
        WHERE external_id = ?`,
    )
      .bind(verdict.status, verdict.caseId ?? null, verdict.suggestedCaseId ?? null, verdict.clientId ?? null,
        verdict.matchBy ?? null, verdict.reason ?? null, verdict.aiFingerprint ?? null,
        payment.contactName || null, payment.contactNumber || null, now, row.external_id)
      .run();

    if (verdict.status === 'linked') {
      const linked = await linkPayment(env, row, verdict.caseId, actorId);
      if (linked.paymentId) {
        await env.DB.prepare(`UPDATE wafeq_payments SET payment_id = ? WHERE external_id = ?`)
          .bind(linked.paymentId, row.external_id)
          .run();
      }
    }
  }

  Object.assign(summary.ai, { used: ai.budget.used, deferred: ai.budget.deferred, failed: ai.budget.failed });

  await env.DB.prepare(
    `INSERT INTO activity_logs (id, type, description, user_id, user_name, entity_type, details, created_at)
     VALUES (?, 'wafeq', ?, ?, ?, 'wafeq', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      `ربطُ وافق بالذكاء الاصطناعي: ${summary.linked} رُبطت، و${summary.suggested} مقترَحة، من ${summary.checked}`,
      actorId ?? 'wafeq',
      actorName ?? '',
      JSON.stringify(summary),
      now,
    )
    .run()
    .catch(() => {});

  return summary;
}

/** الدورةُ المجدولة: لا تعمل إلا بمفتاحٍ، وتفعيلٍ صريح، ومزامنةٍ يدويةٍ سبقت. */
export async function scheduledWafeqSync(env) {
  if (!env?.WAFEQ_API_KEY) return;
  const row = await env.DB.prepare(`SELECT sync_enabled, last_sync_at FROM wafeq_connection WHERE id = 1`)
    .first()
    .catch(() => null);
  if (!row?.sync_enabled || !row.last_sync_at) return;

  try {
    const { summary } = await runWafeqSync(env, { actorId: 'cron', actorName: 'المزامنة الآلية', source: 'آلي', mode: 'cron' });
    console.log('Wafeq/cron:', `${summary.linked} رُبطت، ${summary.suggested} مقترَحة، ${summary.unmatched} بلا قضية`);
  } catch (error) {
    const reason = error instanceof WafeqError ? error.code : error?.message ?? String(error);
    console.error('Wafeq/cron: تعذّرت المزامنة —', reason);
    await env.DB.prepare(`UPDATE wafeq_connection SET last_sync_error = ? WHERE id = 1`)
      .bind(String(reason).slice(0, 300))
      .run()
      .catch(() => {});
  }
}
