// مسارات لوحة العملاء المحتملين: الإعداد والحالة والمزامنة، والـWebhook،
// والتعليقات، والتحويل.

import { activeConnection } from '../oauth.js';
import { readBoard, setupBoard, webhookUrl } from './board.js';
import { applyCard, fullSync, pushComment, pushConversion, pushProspect, rememberDeleted } from './sync.js';
import { convertProspect } from '../../queries.js';
import { may } from '../../crud.js';
import { RESOURCES } from '../../resources.js';

const fail = (error, status) => Response.json({ ok: false, error }, { status });
const nowSeconds = () => Math.floor(Date.now() / 1000);
const isAdmin = (user) => user.role === 'admin';

/* ═══ الإعداد ═══ */

export async function readProspectBoard(env, user, url) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  const board = await readBoard(env);
  if (!board) return Response.json({ ok: true, data: { configured: false } });

  const linked = await env.DB.prepare(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN bc_card_id IS NOT NULL THEN 1 ELSE 0 END) AS linked
     FROM prospects WHERE archived_at IS NULL`,
  ).first();

  return Response.json({
    ok: true,
    data: {
      configured: true,
      projectId: board.projectId,
      projectName: board.projectName,
      columns: Object.keys(board.columnMap).length,
      webhook: Boolean(board.webhookId),
      webhookUrl: board.webhookId ? null : webhookUrl(url.origin, board.webhookSecret),
      lastSyncAt: board.lastSyncAt,
      lastSyncError: board.lastSyncError,
      prospects: linked?.n ?? 0,
      linked: linked?.linked ?? 0,
    },
  });
}

export async function configureProspectBoard(request, env, user, url) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  const connection = await activeConnection(env);
  if (connection.error) return fail(connection.error, 409);

  try {
    const result = await setupBoard(env, connection, { projectId: body?.projectId, origin: url.origin, userId: user.id });
    if (result.error) return fail(result.error, 400);
    return Response.json({ ok: true, data: result.data });
  } catch (error) {
    return fail(error?.code ?? 'provider_failed', 502);
  }
}

export async function syncProspectBoard(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  const board = await readBoard(env);
  if (!board) return fail('not_configured', 409);
  const connection = await activeConnection(env);
  if (connection.error) return fail(connection.error, 409);

  try {
    return Response.json({ ok: true, data: await fullSync(env, connection, board) });
  } catch (error) {
    return fail(error?.code ?? 'provider_failed', 502);
  }
}

/* ═══ الـWebhook ═══ */

/** مقارنةٌ لا يتسرّب زمنُها — السرُّ هو الحارس الوحيد. */
function sameSecret(one, other) {
  const a = String(one ?? '');
  const b = String(other ?? '');
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * نداءٌ من بيسكامب: «تبدّلت بطاقة» أو «كُتب تعليق».
 *
 * يُردّ ٢٠٠ فوراً والعملُ بعده (`waitUntil`): بيسكامب تُعيد الإرسال إن أبطأ
 * الردّ، والدمجُ يقرأ البطاقة وتعليقاتها. ولا يُوثَق بالجسم: يُؤخذ منه رقمُ
 * البطاقة وحده، والحالُ يُقرأ من الواجهة.
 */
export async function receiveWebhook(request, env, ctx, secret) {
  if (request.method !== 'POST') return fail('method_not_allowed', 405);

  const board = await readBoard(env);
  if (!board || !sameSecret(secret, board.webhookSecret)) return fail('not_found', 404);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  const recording = payload?.recording ?? {};
  if (String(recording.bucket?.id ?? '') !== board.projectId) {
    return Response.json({ ok: true, data: { ignored: 'other_project' } });
  }

  let cardId = null;
  if (recording.type === 'Kanban::Card') cardId = recording.id;
  else if (recording.type === 'Comment' && recording.parent?.type === 'Kanban::Card') cardId = recording.parent.id;
  if (!cardId) return Response.json({ ok: true, data: { ignored: 'type' } });

  const work = (async () => {
    const connection = await activeConnection(env);
    if (connection.error) return;
    try {
      await applyCard(env, connection, board, cardId);
    } catch (error) {
      console.error('Basecamp/prospects/webhook:', error?.code ?? error?.message ?? error);
    }
  })();
  if (ctx?.waitUntil) ctx.waitUntil(work);
  else await work;

  return Response.json({ ok: true });
}

/* ═══ بعد كتابات المنصة ═══ */

/**
 * يلفّ ردَّ المورد: إن نجح إنشاءٌ أو تعديلٌ لعميلٍ محتمل، أُرسل إلى بطاقته
 * بعد الردّ. والردُّ يُستنسخ ليُقرأ معرّفُه ويبقى جسمُه للمتصفّح.
 */
export async function afterProspectWrite(response, env, ctx) {
  if (!response.ok) return response;
  try {
    const body = await response.clone().json();
    const id = body?.data?.id;
    if (id) ctx?.waitUntil?.(pushProspect(env, id));
  } catch { /* ردٌّ بلا جسم — لا شيء يُرسل */ }
  return response;
}

/**
 * حذفُ عميلٍ محتمل — مفرداً أو جملةً — تُحفظ قبله بطاقتُه في قائمة المحذوفين.
 *
 * والتعليمُ يسبق الحذف: بعده لا صفَّ يُقرأ منه رقمُ البطاقة. وحذفٌ رُفض
 * (صلاحيةٌ أو معرّفٌ خاطئ) يترك علامةً لبطاقةٍ عميلُها باقٍ — وذلك لا يضرّ:
 * العميلُ مربوطٌ ببطاقته، والعلامةُ لا تُقرأ إلا لبطاقةٍ بلا عميل.
 */
export async function beforeProspectDelete(request, env, id) {
  if (request.method === 'DELETE' && id) return rememberDeleted(env, [id]);
  if (request.method === 'POST' && id === 'bulk') {
    const body = await request.clone().json().catch(() => null);
    if (body?.action === 'delete' && Array.isArray(body.ids)) await rememberDeleted(env, body.ids);
  }
}

/** تحويلٌ إلى عميل، ومعه رقمُ البطاقة وعمودُ التحويل. */
export async function convertWithCard(env, user, id, ctx) {
  const before = await env.DB.prepare(`SELECT bc_card_id FROM prospects WHERE id = ?`).bind(id).first();
  const response = await convertProspect(env, user, id);
  if (!response.ok || !before?.bc_card_id) return response;

  const body = await response.clone().json().catch(() => null);
  const client = body?.data;
  if (client?.id) {
    await env.DB.prepare(`UPDATE clients SET bc_card_id = ? WHERE id = ?`).bind(before.bc_card_id, client.id).run();
    ctx?.waitUntil?.(pushConversion(env, { cardId: before.bc_card_id, clientName: client.fullName }));
  }
  return response;
}

/* ═══ التعليقات ═══ */

const shapeComment = (row) => ({
  id: row.id,
  prospectId: row.prospect_id,
  body: row.body,
  authorName: row.author_name ?? '',
  authorUserId: row.author_user_id ?? null,
  source: row.source,
  synced: Boolean(row.bc_comment_id),
  createdAt: row.created_at,
});

export async function listProspectComments(env, user, prospectId) {
  if (!may(user, RESOURCES.prospects, 'read')) return fail('forbidden', 403);
  const { results } = await env.DB.prepare(
    `SELECT * FROM prospect_comments WHERE prospect_id = ? ORDER BY created_at ASC`,
  )
    .bind(prospectId)
    .all();
  const prospect = await env.DB.prepare(`SELECT bc_app_url FROM prospects WHERE id = ?`).bind(prospectId).first();
  return Response.json({
    ok: true,
    data: { comments: (results ?? []).map(shapeComment), basecampUrl: prospect?.bc_app_url ?? null },
  });
}

export async function addProspectComment(request, env, user, prospectId, ctx) {
  if (!may(user, RESOURCES.prospects, 'update')) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  const text = String(body?.body ?? '').trim();
  if (!text) return fail('missing_field', 400);
  if (text.length > 5000) return fail('too_long', 400);

  const prospect = await env.DB.prepare(`SELECT id FROM prospects WHERE id = ?`).bind(prospectId).first();
  if (!prospect) return fail('not_found', 404);

  const member = await env.DB.prepare(`SELECT display_name AS name, email FROM members WHERE user_id = ?`).bind(user.id).first().catch(() => null);
  const id = crypto.randomUUID();
  const now = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO prospect_comments (id, prospect_id, body, author_name, author_user_id, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'platform', ?, ?)`,
  )
    .bind(id, prospectId, text, member?.name || user.name || member?.email || '', user.id, now, now)
    .run();

  ctx?.waitUntil?.(pushComment(env, id));

  const row = await env.DB.prepare(`SELECT * FROM prospect_comments WHERE id = ?`).bind(id).first();
  return Response.json({ ok: true, data: shapeComment(row) }, { status: 201 });
}

/** نقلُ الحالة من اللوحة — تعديلٌ لحقلٍ واحد، ثم يُرسل إلى البطاقة. */
export async function moveProspect(request, env, user, prospectId, ctx) {
  if (!may(user, RESOURCES.prospects, 'update')) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  const status = String(body?.status ?? '').trim();
  if (!status) return fail('missing_field', 400);

  const result = await env.DB.prepare(`UPDATE prospects SET prospect_status = ?, updated_at = ? WHERE id = ?`)
    .bind(status, nowSeconds(), prospectId)
    .run();
  if (!result.meta?.changes) return fail('not_found', 404);

  ctx?.waitUntil?.(pushProspect(env, prospectId));
  return Response.json({ ok: true, data: { id: prospectId, prospectStatus: status } });
}
