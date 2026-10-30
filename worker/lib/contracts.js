// العقدُ السنويّ — طريقةُ تعاقدٍ على مستوى الموكّل (`migrations/0032`).
//
// ═══ الجدولُ يُشتقّ ولا يُخزَّن ═══
//
// للعقد بدايةٌ ونهاية وتكرارٌ ومبلغُ دفعة، وتعديلاتٌ على المبلغ من تاريخٍ ما.
// ومنها وحدها يُبنى جدولُ الاستحقاق هنا: دفعةٌ عند البداية ثم كلَّ فترة، ما دام
// موعدُها لا يتجاوز النهاية، ومبلغُها آخرُ تعديلٍ حلّ قبل موعدها أو فيه. فتعديلُ
// المبلغ بعد عشرة أشهر يُبدّل ما بعده وحده، والمستحقّاتُ تتبعه بلا تصحيح صفوف.
//
// ═══ والمتعاقدُ قضاياه عملٌ قانونيّ ═══
//
// موكّلٌ له عقدٌ لم ينتهِ: قضاياه كلُّها «عمل قانوني» ونوعُ أتعابها «عقد سنوي»
// (`applyRetainer`). يُطبَّق عند حفظ العقد، وعند حفظ قضيةٍ أو استيرادها أو
// مزامنتها — فلا تفلت قضيةٌ من أيّ باب. والتطوّعيةُ تبقى تطوّعية.
//
// القراءةُ لمن يقرأ العملاء، والكتابةُ لمن يعدّلهم.

import { logActivity } from './activity.js';
import { toLatinDigits } from './digits.js';

const fail = (error, status) => Response.json({ ok: false, error }, { status });
const ok = (data, status = 200) => Response.json({ ok: true, data }, { status });
const nowSeconds = () => Math.floor(Date.now() / 1000);

/** أشهرُ كلِّ فترة. */
export const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

/** «ينتهي قريباً» — بالأيام. واللوحةُ تعدّ ما ينتهي خلالها. */
export const EXPIRING_DAYS = 60;

const DAY = 86400000;
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export const today = () => new Date().toISOString().slice(0, 10);

const mayRead = (user) => Boolean(user.permissions?.clients?.read);
const mayWrite = (user) => Boolean(user.permissions?.clients?.update);

/* ═══ التواريخ ═══ نصوصٌ `YYYY-MM-DD` وحسابُها بـUTC، فلا ينزلق يومٌ بمنطقة. */
const parseDay = (iso) => Date.parse(`${iso}T00:00:00Z`);
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);

function validDay(value) {
  const text = toLatinDigits(String(value ?? '').trim()).slice(0, 10);
  return DATE_SHAPE.test(text) && Number.isFinite(parseDay(text)) && isoOf(parseDay(text)) === text ? text : null;
}

/** يضيف أشهراً، واليومُ يُقصّ إلى آخر الشهر — ٣١ يناير + شهر = ٢٨ (أو ٢٩) فبراير. */
export function addMonths(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return isoOf(Date.UTC(y, m - 1 + months, Math.min(d, last)));
}

export const addDays = (iso, days) => isoOf(parseDay(iso) + days * DAY);
export const daysBetween = (from, to) => Math.round((parseDay(to) - parseDay(from)) / DAY);

/** نهايةُ سنةٍ من البداية: اليومُ الذي يسبق ذكراها. */
export const yearEnd = (start) => addDays(addMonths(start, 12), -1);

const halalas = (riyals) => Math.round(Number(riyals) * 100);

/* ═══ تعديلاتُ المبلغ ═══ مرتّبةً، وما لا يُقرأ منها يُطرح. وتاريخٌ واحد لا
   يحمل تعديلين: الأخيرُ المرسَل يغلب. */
function readRateChanges(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const byDate = new Map();
  for (const entry of list) {
    const from = validDay(entry?.from);
    const amount = Number(toLatinDigits(String(entry?.amount ?? '')));
    if (!from || !Number.isFinite(amount) || amount < 0) continue;
    byDate.set(from, { from, amount: Math.round(amount * 100) / 100 });
  }
  return [...byDate.values()].sort((a, b) => a.from.localeCompare(b.from));
}

const safeJson = (raw, fallback) => {
  try { return JSON.parse(raw ?? '') ?? fallback; } catch { return fallback; }
};

/**
 * جدولُ الاستحقاق — بالهللات.
 *
 * `contract`: `{ startDate, endDate, frequency, amount (هللات), rateChanges }`.
 */
export function scheduleOf(contract) {
  const step = FREQUENCY_MONTHS[contract.frequency] ?? 1;
  const changes = readRateChanges(contract.rateChanges);
  const out = [];
  /* حدٌّ أعلى يمنع حلقةً بلا نهاية من تاريخٍ تالف: مئةُ سنةٍ شهرياً. */
  for (let k = 0; k < 1200; k++) {
    const dueDate = addMonths(contract.startDate, k * step);
    if (dueDate > contract.endDate) break;
    let amount = contract.amount;
    for (const change of changes) if (change.from <= dueDate) amount = halalas(change.amount);
    out.push({ dueDate, amount });
  }
  return out;
}

/**
 * ملخّصُ عقدٍ في يومٍ ما — بالهللات.
 *
 * والمدفوعُ يُوزَّع على الدفعات بترتيبها: الأقدمُ يُسدَّد أولاً، فيُعرف أيُّها
 * مسدَّد وأيُّها متأخر. و«المتأخر» ما حلّ موعدُه ولم يغطّه المدفوع، و«المتبقّي»
 * ما بقي من قيمة العقد كلِّها حتى نهايته.
 */
export function summarize(contract, paidTotal, on = today()) {
  const schedule = scheduleOf(contract);
  let left = paidTotal;
  const installments = schedule.map((item) => {
    const covered = Math.max(Math.min(left, item.amount), 0);
    left -= covered;
    const state = covered >= item.amount ? 'paid' : item.dueDate <= on ? 'overdue' : covered > 0 ? 'partial' : 'upcoming';
    return { ...item, paid: covered, state };
  });

  const totalValue = schedule.reduce((sum, item) => sum + item.amount, 0);
  const dueToDate = schedule.filter((item) => item.dueDate <= on).reduce((sum, item) => sum + item.amount, 0);
  const daysLeft = daysBetween(on, contract.endDate);

  let status = 'active';
  if (on < contract.startDate) status = 'upcoming';
  else if (on > contract.endDate) status = 'expired';
  else if (daysLeft <= EXPIRING_DAYS) status = 'expiring';

  const next = installments.find((item) => item.dueDate > on);
  return {
    status,
    daysLeft,
    totalValue,
    dueToDate,
    paid: paidTotal,
    overdue: Math.max(dueToDate - paidTotal, 0),
    remaining: Math.max(totalValue - paidTotal, 0),
    currentAmount: [...schedule].reverse().find((item) => item.dueDate <= on)?.amount ?? schedule[0]?.amount ?? contract.amount,
    nextDue: next ? { dueDate: next.dueDate, amount: next.amount } : null,
    installments,
  };
}

/* ═══ من القاعدة إلى الواجهة ═══ المبالغُ ريالاتٌ عند الحدّ وحده. */
const riyals = (value) => Number(value ?? 0) / 100;

function fromRow(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    startDate: row.start_date,
    endDate: row.end_date,
    frequency: row.frequency,
    amount: Number(row.amount ?? 0),
    rateChanges: readRateChanges(safeJson(row.rate_changes, [])),
    notes: row.notes ?? '',
    renewedFrom: row.renewed_from ?? null,
  };
}

function present(row, payments, on) {
  const contract = fromRow(row);
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const summary = summarize(contract, paid, on);
  return {
    ...contract,
    amount: riyals(contract.amount),
    clientName: row.client_name ?? '',
    createdAt: row.created_at ? new Date(row.created_at * 1000).toISOString() : null,
    summary: {
      ...summary,
      totalValue: riyals(summary.totalValue),
      dueToDate: riyals(summary.dueToDate),
      paid: riyals(summary.paid),
      overdue: riyals(summary.overdue),
      remaining: riyals(summary.remaining),
      currentAmount: riyals(summary.currentAmount),
      nextDue: summary.nextDue ? { ...summary.nextDue, amount: riyals(summary.nextDue.amount) } : null,
      installments: summary.installments.map((item) => ({
        ...item, amount: riyals(item.amount), paid: riyals(item.paid),
      })),
    },
    payments: payments.map((payment) => ({
      id: payment.id,
      contractId: payment.contract_id,
      clientId: payment.client_id,
      amount: riyals(payment.amount),
      paymentDate: payment.payment_date,
      method: payment.method ?? '',
      reference: payment.reference ?? '',
      notes: payment.notes ?? '',
    })),
  };
}

/** العقودُ بملخّصاتها — كلُّها، أو عقودُ موكّلٍ واحد. */
export async function loadContracts(env, { clientId = null, on = today() } = {}) {
  const where = clientId ? 'WHERE k.client_id = ?' : '';
  const contracts = env.DB.prepare(
    `SELECT k.*, c.full_name client_name FROM client_contracts k
       LEFT JOIN clients c ON c.id = k.client_id ${where}
      ORDER BY k.start_date DESC`,
  );
  const payments = env.DB.prepare(
    `SELECT p.* FROM contract_payments p
      ${clientId ? 'WHERE p.contract_id IN (SELECT id FROM client_contracts WHERE client_id = ?)' : ''}
      ORDER BY p.payment_date DESC, p.created_at DESC`,
  );
  const [rows, paid] = await env.DB.batch(clientId ? [contracts.bind(clientId), payments.bind(clientId)] : [contracts, payments]);

  const byContract = new Map();
  for (const payment of paid.results ?? []) {
    if (!byContract.has(payment.contract_id)) byContract.set(payment.contract_id, []);
    byContract.get(payment.contract_id).push(payment);
  }
  return (rows.results ?? []).map((row) => present(row, byContract.get(row.id) ?? [], on));
}

/**
 * ═══ قضايا المتعاقد عملٌ قانونيّ ═══
 *
 * كلُّ قضيةٍ لموكّلٍ له عقدٌ لم ينتهِ (جارٍ أو مقبل): نوعُ عملها `legal_work`
 * ونوعُ أتعابها `annual_contract`. وما في بنية الأتعاب غيرُ النوع يبقى كما هو —
 * أتعابٌ اتُّفق عليها قبل العقد لا تُمحى. والتطوّعيةُ لا تُمسّ.
 *
 * وبلا `clientId`: كلُّ المتعاقدين — بعد مزامنةٍ أو استيرادٍ أنشأ قضايا.
 */
export async function applyRetainer(env, clientId = null, on = today()) {
  const FEE = `COALESCE(CASE WHEN json_valid(fee_structure) THEN json_extract(fee_structure, '$.type') END, '')`;
  const result = await env.DB.prepare(
    `UPDATE cases
        SET work_kind = 'legal_work',
            fee_structure = json_set(CASE WHEN json_valid(fee_structure) THEN fee_structure ELSE '{}' END,
                                     '$.type', 'annual_contract'),
            updated_at = ?
      WHERE (? IS NULL OR client_id = ?)
        AND client_id IN (SELECT client_id FROM client_contracts WHERE end_date >= ?)
        AND ${FEE} <> 'pro_bono'
        AND (COALESCE(work_kind, '') <> 'legal_work' OR ${FEE} <> 'annual_contract')`,
  )
    .bind(nowSeconds(), clientId, clientId, on)
    .run();
  return Number(result.meta?.changes ?? 0);
}

/** أللموكّل عقدٌ لم ينتهِ؟ */
export async function hasActiveContract(env, clientId, on = today()) {
  if (!clientId) return false;
  const row = await env.DB.prepare(
    `SELECT 1 FROM client_contracts WHERE client_id = ? AND end_date >= ? LIMIT 1`,
  ).bind(clientId, on).first();
  return Boolean(row);
}

/* ═══ قراءةُ الجسم ═══ والجزئيُّ للتعديل: ما لم يُرسَل يبقى من `base`. */
function readContract(body, base = null) {
  const pick = (key) => (Object.prototype.hasOwnProperty.call(body ?? {}, key) ? body[key] : undefined);

  const startDate = pick('startDate') !== undefined ? validDay(pick('startDate')) : base?.startDate ?? null;
  if (!startDate) return { error: 'invalid_date' };

  /* بلا نهايةٍ مرسَلة: نهايتُه القائمة، وإلا سنةٌ من البداية. */
  const sentEnd = pick('endDate');
  const endDate = sentEnd !== undefined && sentEnd !== '' && sentEnd !== null
    ? validDay(sentEnd)
    : base?.endDate ?? yearEnd(startDate);
  if (!endDate) return { error: 'invalid_date' };
  if (endDate < startDate) return { error: 'end_before_start' };

  const frequency = pick('frequency') ?? base?.frequency ?? 'monthly';
  if (!FREQUENCY_MONTHS[frequency]) return { error: 'invalid_frequency' };

  let amount = base?.amount ?? null;
  if (pick('amount') !== undefined) {
    const value = Number(toLatinDigits(String(pick('amount'))));
    if (!Number.isFinite(value) || value < 0) return { error: 'invalid_amount' };
    amount = halalas(value);
  }
  if (amount === null) return { error: 'invalid_amount' };

  const rateChanges = pick('rateChanges') !== undefined ? readRateChanges(pick('rateChanges')) : base?.rateChanges ?? [];
  const notes = pick('notes') !== undefined ? String(pick('notes') ?? '') : base?.notes ?? '';

  return { values: { startDate, endDate, frequency, amount, rateChanges, notes } };
}

/* عقدان لموكّلٍ واحد لا يتداخلان: دفعتان عن الشهر نفسِه تُضاعفان المستحقّ. */
async function overlaps(env, clientId, values, exceptId = null) {
  const row = await env.DB.prepare(
    `SELECT 1 FROM client_contracts
      WHERE client_id = ? AND id IS NOT ? AND start_date <= ? AND end_date >= ? LIMIT 1`,
  ).bind(clientId, exceptId, values.endDate, values.startDate).first();
  return Boolean(row);
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

async function rowOf(env, id) {
  return env.DB.prepare(
    `SELECT k.*, c.full_name client_name FROM client_contracts k
       LEFT JOIN clients c ON c.id = k.client_id WHERE k.id = ?`,
  ).bind(id).first();
}

async function presentOne(env, id) {
  const row = await rowOf(env, id);
  if (!row) return null;
  const { results } = await env.DB.prepare(
    `SELECT * FROM contract_payments WHERE contract_id = ? ORDER BY payment_date DESC, created_at DESC`,
  ).bind(id).all();
  return present(row, results ?? [], today());
}

/* الأثرُ باسم الموكّل — «العقد السنوي «الأفق»». */
const trace = (env, user, resource, action, contract) =>
  logActivity(env, user, { resource, action, row: { id: contract?.id, fullName: contract?.clientName } });

async function insertContract(env, user, clientId, values, renewedFrom = null) {
  const id = crypto.randomUUID();
  const now = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO client_contracts (id, client_id, start_date, end_date, frequency, amount, rate_changes, notes,
                                   renewed_from, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, clientId, values.startDate, values.endDate, values.frequency, values.amount,
    JSON.stringify(values.rateChanges), values.notes, renewedFrom, user?.id ?? null, now, now).run();
  return id;
}

// ═══════════════════════════════════════════════════════════
// المسارات
// ═══════════════════════════════════════════════════════════

/** `GET /api/contracts?clientId=` */
export async function listContracts(env, user, url) {
  if (!mayRead(user)) return fail('forbidden', 403);
  const clientId = url?.searchParams?.get('clientId') || null;
  return ok(await loadContracts(env, { clientId }));
}

/** `POST /api/contracts` — `{ clientId, startDate, endDate?, frequency, amount, rateChanges?, notes? }` */
export async function createContract(request, env, user) {
  if (!mayWrite(user)) return fail('forbidden', 403);
  const body = await readJson(request);
  if (!body) return fail('invalid_body', 400);

  const clientId = typeof body.clientId === 'string' ? body.clientId : '';
  const client = clientId
    ? await env.DB.prepare(`SELECT id FROM clients WHERE id = ?`).bind(clientId).first()
    : null;
  if (!client) return fail('invalid_reference', 409);

  const read = readContract(body);
  if (read.error) return fail(read.error, 400);
  if (await overlaps(env, clientId, read.values)) return fail('contract_overlap', 409);

  const id = await insertContract(env, user, clientId, read.values);
  await applyRetainer(env, clientId);
  const data = await presentOne(env, id);
  await trace(env, user, 'contracts', 'create', data);
  return ok(data, 201);
}

/** `PUT /api/contracts/:id` — جزئيّ: ما لم يُرسَل يبقى. */
export async function updateContract(request, env, user, id) {
  if (!mayWrite(user)) return fail('forbidden', 403);
  const row = await rowOf(env, id);
  if (!row) return fail('not_found', 404);
  const body = await readJson(request);
  if (!body) return fail('invalid_body', 400);

  const read = readContract(body, fromRow(row));
  if (read.error) return fail(read.error, 400);
  if (await overlaps(env, row.client_id, read.values, id)) return fail('contract_overlap', 409);

  const v = read.values;
  await env.DB.prepare(
    `UPDATE client_contracts SET start_date = ?, end_date = ?, frequency = ?, amount = ?, rate_changes = ?,
                                 notes = ?, updated_at = ? WHERE id = ?`,
  ).bind(v.startDate, v.endDate, v.frequency, v.amount, JSON.stringify(v.rateChanges), v.notes, nowSeconds(), id).run();

  await applyRetainer(env, row.client_id);
  const data = await presentOne(env, id);
  await trace(env, user, 'contracts', 'update', data);
  return ok(data);
}

/**
 * `DELETE /api/contracts/:id` — ودفعاتُه معه.
 *
 * وقضاياه تبقى «عملاً قانونياً» بنوع أتعاب «عقد سنوي»: لا يُعرف ما كانت عليه
 * قبله على اليقين، فتُعدَّل من نافذتها إن لزم.
 */
export async function deleteContract(env, user, id) {
  if (!mayWrite(user)) return fail('forbidden', 403);
  const doomed = await presentOne(env, id);
  if (!doomed) return fail('not_found', 404);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM contract_payments WHERE contract_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM client_contracts WHERE id = ?`).bind(id),
  ]);
  await trace(env, user, 'contracts', 'delete', doomed);
  return ok({ ok: true });
}

/**
 * `POST /api/contracts/:id/renew` — سنةٌ جديدة تبدأ في اليوم التالي لنهايته.
 *
 * والمبلغُ والتكرارُ الجديدان اختياريّان: بلا مبلغٍ يُحمل آخرُ مبلغٍ سارٍ في
 * العقد القديم (بعد تعديلاته)، لا مبلغُ بدايته.
 */
export async function renewContract(request, env, user, id) {
  if (!mayWrite(user)) return fail('forbidden', 403);
  const row = await rowOf(env, id);
  if (!row) return fail('not_found', 404);
  const body = (await readJson(request)) ?? {};
  const old = fromRow(row);

  const lastSchedule = scheduleOf(old);
  const carried = lastSchedule.length ? lastSchedule[lastSchedule.length - 1].amount : old.amount;
  const startDate = addDays(old.endDate, 1);

  const read = readContract({
    startDate: body.startDate ?? startDate,
    endDate: body.endDate || undefined,
    frequency: body.frequency ?? old.frequency,
    amount: body.amount ?? carried / 100,
    rateChanges: [],
    notes: body.notes ?? '',
  });
  if (read.error) return fail(read.error, 400);
  if (await overlaps(env, row.client_id, read.values)) return fail('contract_overlap', 409);

  const newId = await insertContract(env, user, row.client_id, read.values, id);
  await applyRetainer(env, row.client_id);
  const data = await presentOne(env, newId);
  await trace(env, user, 'contracts', 'create', data);
  return ok(data, 201);
}

/** `POST /api/contracts/:id/payments` — `{ amount, paymentDate?, method?, reference?, notes? }` */
export async function addContractPayment(request, env, user, id) {
  if (!mayWrite(user)) return fail('forbidden', 403);
  const row = await rowOf(env, id);
  if (!row) return fail('not_found', 404);
  const body = await readJson(request);
  if (!body) return fail('invalid_body', 400);

  const amount = Number(toLatinDigits(String(body.amount ?? '')));
  if (!Number.isFinite(amount) || amount <= 0) return fail('invalid_amount', 400);
  const paymentDate = body.paymentDate ? validDay(body.paymentDate) : today();
  if (!paymentDate) return fail('invalid_date', 400);

  const text = (value) => (value === undefined || value === null ? null : String(value).trim() || null);
  /* والموكّلُ من العقد لا من الجسم — كما تُنسب دفعةُ القضية إلى قضيتها. */
  await env.DB.prepare(
    `INSERT INTO contract_payments (id, contract_id, client_id, amount, payment_date, method, reference, notes,
                                    created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), id, row.client_id, halalas(amount), paymentDate,
    text(body.method), text(body.reference), text(body.notes), user?.id ?? '', nowSeconds()).run();

  const data = await presentOne(env, id);
  await trace(env, user, 'contractPayments', 'create', data);
  return ok(data, 201);
}

/** `DELETE /api/contracts/:id/payments/:paymentId` — والدفعةُ لا تُعدَّل: تُحذف وتُكتب صحيحة. */
export async function deleteContractPayment(env, user, id, paymentId) {
  if (!mayWrite(user)) return fail('forbidden', 403);
  const result = await env.DB.prepare(`DELETE FROM contract_payments WHERE id = ? AND contract_id = ?`)
    .bind(paymentId, id).run();
  if (!result.meta?.changes) return fail('not_found', 404);
  const data = await presentOne(env, id);
  await trace(env, user, 'contractPayments', 'delete', data);
  return ok(data);
}

/**
 * ═══ العقود في لوحة التحكم ═══ — الآن، بالريالات.
 *
 * الجاريةُ عدداً، وما ينتهي خلال `EXPIRING_DAYS` يوماً بأسمائه (والمنتهيةُ
 * حديثاً بلا تجديد معها: عقدٌ انتهى أمس ولم يُجدَّد أولى بالنظر من الذي
 * ينتهي بعد شهرين)، والمتأخّرُ والمتبقّي حتى نهاية العقود.
 */
export async function contractsDigest(env, on = today()) {
  const all = await loadContracts(env, { on });
  const renewed = new Set(all.map((contract) => contract.renewedFrom).filter(Boolean));
  /* موكّلٌ له عقدٌ لاحق لا يُعدّ عقدُه المنتهي «بلا تجديد» وإن لم يُنشأ اللاحقُ بـ«تجديد». */
  const later = (contract) => all.some((other) => other.clientId === contract.clientId && other.startDate > contract.endDate);

  const live = all.filter((contract) => contract.summary.status !== 'expired' && contract.summary.status !== 'upcoming');
  const expiring = all
    .filter((contract) => !renewed.has(contract.id) && !later(contract))
    .filter((contract) => contract.summary.status === 'expiring'
      || (contract.summary.status === 'expired' && contract.summary.daysLeft >= -EXPIRING_DAYS))
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .map((contract) => ({
      id: contract.id,
      clientId: contract.clientId,
      clientName: contract.clientName,
      endDate: contract.endDate,
      daysLeft: contract.summary.daysLeft,
      currentAmount: contract.summary.currentAmount,
      frequency: contract.frequency,
    }));

  /* «المتأخّر» حلّ ولم يُدفع، و«لم يحلّ بعد» بقيّةُ قيمة العقود حتى نهايتها —
     ومجموعُهما كلُّ ما بقي على المتعاقدين. */
  const sum = (pick) => Math.round(all.reduce((total, contract) => total + pick(contract.summary), 0) * 100) / 100;
  return {
    active: live.length,
    upcoming: all.filter((contract) => contract.summary.status === 'upcoming').length,
    expiring,
    overdue: sum((summary) => summary.overdue),
    notYetDue: sum((summary) => Math.max(summary.remaining - summary.overdue, 0)),
  };
}
