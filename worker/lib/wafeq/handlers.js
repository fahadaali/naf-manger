// مسارات `‎/api/wafeq/*‎`.
//
// الربطُ والمزامنةُ للمسؤول وحده، كبيسكامب: يفتحان دفترَ المكتب المحاسبي
// قراءةً. وتأكيدُ ربطِ دفعةٍ بقضية لمن يملك تعديلَ القضايا — هو قرارٌ في
// ماليّة قضية، وشاشتُه شاشتُها.

import { configured, firstPage, WafeqError } from './api.js';
import { linkPayment, rematchWafeq, runWafeqSync, unlinkPayment } from './sync.js';
import { aiEnabled } from '../ai/summarize.js';
import { modelAvailable, modelInfo } from '../ai/model.js';

const fail = (error, status) => Response.json({ ok: false, error }, { status });
const ok = (data) => Response.json({ ok: true, data });

const nowSeconds = () => Math.floor(Date.now() / 1000);

const isAdmin = (user) => user.role === 'admin';
const mayDecide = (user) => isAdmin(user) || Boolean(user.permissions?.cases?.update);

const STATUSES = ['linked', 'suggested', 'unmatched', 'ignored'];

async function logActivity(env, user, description) {
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, type, description, user_id, user_name, entity_type, created_at)
     VALUES (?, 'wafeq', ?, ?, ?, 'wafeq', ?)`,
  )
    .bind(crypto.randomUUID(), description, user.id, user.name ?? '', nowSeconds())
    .run()
    .catch((logError) => console.error('تعذّر تسجيل النشاط:', logError?.message ?? logError));
}

const failure = (error, fallback) =>
  error instanceof WafeqError ? fail(error.code, error.status) : fail(fallback, 502);

/** حالةُ الربط وأعدادُ كلّ حالة. */
export async function readWafeqStatus(env, user) {
  if (!mayDecide(user)) return fail('forbidden', 403);
  if (!configured(env)) return ok({ state: 'not_configured' });

  const [row, counts, ai] = await Promise.all([
    env.DB.prepare(`SELECT * FROM wafeq_connection WHERE id = 1`).first(),
    env.DB.prepare(`SELECT status, COUNT(*) n FROM wafeq_payments GROUP BY status`).all(),
    aiEnabled(env),
  ]);
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const entry of counts.results ?? []) byStatus[entry.status] = entry.n;

  return ok({
    state: 'configured',
    syncEnabled: row?.sync_enabled === 1,
    lastSyncAt: row?.last_sync_at ?? null,
    lastSyncError: row?.last_sync_error ?? null,
    newestPaymentDate: row?.cursor_date ?? null,
    counts: byStatus,
    /* الطرازُ مربوطٌ (`[ai]`) ومشغَّلٌ (مفتاحُ «التلخيص الآليّ» نفسُه). */
    ai: { available: modelAvailable(env), enabled: ai, model: modelInfo(env, 'fast')?.model ?? null },
  });
}

/**
 * «اختبار الاتصال» — صفحةٌ واحدة، وأسماءُ الحقول.
 *
 * والمقصودُ أسماءُ الحقول لا قيمُها: هي ما يُعرف به أنّ القارئ يفهم ردَّهم،
 * فلا يُعاد إلى الشاشة مبلغٌ ولا اسمُ موكّل.
 */
export async function testWafeq(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  if (!configured(env)) return fail('not_configured', 503);
  try {
    const page = await firstPage(env, 'payments/');
    const list = listOf(page);
    const sample = list[0] && typeof list[0] === 'object' ? list[0] : {};
    /* والفاتورةُ والجهةُ تُقرآن كذلك: تفصيلُ الدفعة فيهما لا فيها. وسقوطُ
       إحداهما يُقال ولا يُسقط الاختبار. */
    const [invoice, contact] = await Promise.all([
      firstPage(env, 'invoices/').then((read) => shapeOf(listOf(read)[0])).catch((error) => ({ error: error?.code ?? 'failed' })),
      firstPage(env, 'contacts/').then((read) => shapeOf(listOf(read)[0])).catch((error) => ({ error: error?.code ?? 'failed' })),
    ]);
    return ok({
      reachable: true,
      paginated: !Array.isArray(page) && 'next' in (page ?? {}),
      count: Array.isArray(page) ? page.length : page?.count ?? list.length,
      ...shapeOf(sample),
      invoice,
      contact,
    });
  } catch (error) {
    return failure(error, 'test_failed');
  }
}

/** المعاينة — تقرأ وتقرّر ولا تكتب حرفاً. */
export async function previewWafeq(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  if (!configured(env)) return fail('not_configured', 503);
  try {
    return ok(await runWafeqSync(env, { actorId: user.id, actorName: user.name, dryRun: true }));
  } catch (error) {
    return failure(error, 'preview_failed');
  }
}

export async function syncWafeq(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  if (!configured(env)) return fail('not_configured', 503);
  try {
    const { summary } = await runWafeqSync(env, { actorId: user.id, actorName: user.name, source: 'يدوي' });
    return ok(summary);
  } catch (error) {
    const code = error instanceof WafeqError ? error.code : 'sync_failed';
    await env.DB.prepare(
      `INSERT INTO wafeq_connection (id, last_sync_error, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_sync_error = excluded.last_sync_error, updated_at = excluded.updated_at`,
    )
      .bind(code, nowSeconds())
      .run()
      .catch(() => {});
    return failure(error, 'sync_failed');
  }
}

/** «اربط بالذكاء الاصطناعي الآن» — على المخزَّن «بلا قضية»، بلا قراءة وافق. */
export async function rematchWafeqPayments(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  if (!modelAvailable(env)) return fail('ai_unavailable', 503);
  try {
    return ok(await rematchWafeq(env, { actorId: user.id, actorName: user.name }));
  } catch (error) {
    return failure(error, 'rematch_failed');
  }
}

/** الآلية — ولا تُفتح إلا بعد مزامنةٍ يدويةٍ ناجحة. */
export async function setWafeqAutoSync(request, env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  let body;
  try { body = await request.json(); } catch { return fail('invalid_body', 400); }
  const enabled = body?.enabled === true;

  const row = await env.DB.prepare(`SELECT last_sync_at FROM wafeq_connection WHERE id = 1`).first();
  if (enabled && !row?.last_sync_at) return fail('sync_first', 409);
  if (!row) return ok({ syncEnabled: false });

  await env.DB.prepare(`UPDATE wafeq_connection SET sync_enabled = ?, updated_at = ? WHERE id = 1`)
    .bind(enabled ? 1 : 0, nowSeconds())
    .run();
  await logActivity(env, user, enabled ? 'فُتحت مزامنة وافق الآلية' : 'أُوقفت مزامنة وافق الآلية');
  return ok({ syncEnabled: enabled });
}

const listOf = (page) => (Array.isArray(page) ? page : Array.isArray(page?.results) ? page.results : []);

/* أسماءُ الحقول وما تحتها — لا قيمُها. */
function shapeOf(sample) {
  const value = sample && typeof sample === 'object' ? sample : {};
  return {
    fields: Object.keys(value),
    nested: Object.fromEntries(
      Object.entries(value)
        .filter(([, inner]) => inner && typeof inner === 'object')
        .map(([key, inner]) => [key, Object.keys(Array.isArray(inner) ? inner[0] ?? {} : inner)]),
    ),
  };
}

/** المدفوعاتُ المقروءة — بحالةٍ، والأحدثُ أوّلاً. ومعها أرقامُ القضايا للعرض. */
export async function listWafeqPayments(env, user, url) {
  if (!mayDecide(user)) return fail('forbidden', 403);
  const status = url.searchParams.get('status');
  const filter = STATUSES.includes(status) ? status : null;

  const { results } = await env.DB.prepare(
    `SELECT w.*, c.case_number AS case_number, s.case_number AS suggested_case_number,
            cl.full_name AS client_name
       FROM wafeq_payments w
       LEFT JOIN cases c   ON c.id = w.case_id
       LEFT JOIN cases s   ON s.id = w.suggested_case_id
       LEFT JOIN clients cl ON cl.id = w.client_id
      ${filter ? 'WHERE w.status = ?' : ''}
      ORDER BY w.payment_date DESC, w.updated_at DESC
      LIMIT 300`,
  )
    .bind(...(filter ? [filter] : []))
    .all();

  return ok((results ?? []).map((row) => ({
    externalId: row.external_id,
    paymentDate: row.payment_date,
    amount: Number(row.amount ?? 0) / 100,
    currency: row.currency,
    contactName: row.contact_name ?? '',
    reference: row.reference ?? '',
    description: row.description ?? '',
    /* ما قُرئ من الفاتورة والمشروع — يُعرض ليُرى ما رآه الطراز. */
    invoiceText: row.invoice_text ?? '',
    projectName: row.project_name ?? '',
    status: row.status,
    caseId: row.case_id,
    caseNumber: row.case_number ?? null,
    suggestedCaseId: row.suggested_case_id,
    suggestedCaseNumber: row.suggested_case_number ?? null,
    clientId: row.client_id,
    clientName: row.client_name ?? null,
    matchBy: row.match_by,
    reason: row.reason ?? '',
  })));
}

/**
 * قرارُ إنسانٍ في دفعة: `link` بقضيةٍ (المقترحة إن لم تُسمَّ)، أو `ignore`،
 * أو `unlink` يعيدها تنتظر. والفعلُ في الجسم: `{ action, caseId? }`.
 */
export async function decideWafeqPayment(request, env, user, externalId) {
  if (!mayDecide(user)) return fail('forbidden', 403);
  const row = await env.DB.prepare(`SELECT * FROM wafeq_payments WHERE external_id = ?`)
    .bind(externalId)
    .first();
  if (!row) return fail('not_found', 404);

  let body = {};
  try { body = (await request.json()) ?? {}; } catch { body = {}; }
  const verb = String(body.action ?? '');
  const now = nowSeconds();

  if (verb === 'link') {
    const caseId = typeof body.caseId === 'string' && body.caseId ? body.caseId : row.suggested_case_id;
    if (!caseId) return fail('missing_field', 400);
    const linked = await linkPayment(env, row, caseId, user.id);
    if (linked.error) return fail(linked.error, linked.status);
    await env.DB.prepare(
      `UPDATE wafeq_payments SET status = 'linked', case_id = ?, client_id = ?, payment_id = ?,
              match_by = CASE WHEN ? = suggested_case_id THEN COALESCE(match_by, 'manual') ELSE 'manual' END,
              decided_by = ?, updated_at = ?
        WHERE external_id = ?`,
    )
      .bind(caseId, linked.clientId, linked.paymentId, caseId, user.id, now, externalId)
      .run();
    await logActivity(env, user, `رُبطت دفعةٌ من وافق بقضية`);
    return ok({ status: 'linked', caseId });
  }

  if (verb === 'ignore' || verb === 'unlink') {
    await unlinkPayment(env, row);
    const status = verb === 'ignore' ? 'ignored' : 'unmatched';
    await env.DB.prepare(
      `UPDATE wafeq_payments SET status = ?, case_id = NULL, payment_id = NULL, decided_by = ?, updated_at = ?
        WHERE external_id = ?`,
    )
      .bind(status, user.id, now, externalId)
      .run();
    await logActivity(env, user, verb === 'ignore' ? 'تُجوهلت دفعةٌ من وافق' : 'فُكّ ربطُ دفعةٍ من وافق');
    return ok({ status });
  }

  return fail('unknown_action', 400);
}
