// مسارات لوحات العملاء في بيسكامب: الإعداد والحالة والمزامنة، والـWebhook،
// والتعليقات، والتحويل — للعملاء المحتملين وللعملاء الفعليين.

import { activeConnection } from '../oauth.js';
import { getJson } from '../api.js';
import { listCardTables, readBoard, readBoards, setupBoard, webhookUrl } from './board.js';
import {
  applyCard,
  carryConversion,
  fullSync,
  pushComment,
  pushConversion,
  pushRecord,
  rememberDeleted,
} from './sync.js';
import { ENTITIES, KINDS, entity } from './entities.js';
import { convertProspect } from '../../queries.js';
import { may } from '../../crud.js';
import { RESOURCES } from '../../resources.js';

const fail = (error, status) => Response.json({ ok: false, error }, { status });
const nowSeconds = () => Math.floor(Date.now() / 1000);
const isAdmin = (user) => user.role === 'admin';

/* ═══ الإعداد ═══ */

async function boardStatus(env, url, kind) {
  const spec = entity(kind);
  const board = await readBoard(env, kind);
  if (!board) return { kind, title: spec.title, configured: false };

  const linked = await env.DB.prepare(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN bc_card_id IS NOT NULL THEN 1 ELSE 0 END) AS linked
     FROM ${spec.table} WHERE archived_at IS NULL`,
  ).first();

  return {
    kind,
    title: spec.title,
    configured: true,
    projectId: board.projectId,
    projectName: board.projectName,
    cardTableId: board.cardTableId,
    cardTableName: board.cardTableName,
    columns: Object.keys(board.columnMap).filter((key) => !key.startsWith('__legacy')).length,
    webhook: Boolean(board.webhookId),
    webhookUrl: board.webhookId ? null : webhookUrl(url.origin, board.webhookSecret),
    lastSyncAt: board.lastSyncAt,
    lastSyncError: board.lastSyncError,
    records: linked?.n ?? 0,
    linked: linked?.linked ?? 0,
  };
}

/** حالةُ اللوحتين. */
export async function readBoardsStatus(env, user, url) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  const data = {};
  for (const kind of KINDS) data[kind] = await boardStatus(env, url, kind);
  return Response.json({ ok: true, data });
}

/** لوحاتُ مشروعٍ ومعها الاقتراح — قبل الإعداد. */
export async function readCardTables(env, user, url) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  const connection = await activeConnection(env);
  if (connection.error) return fail(connection.error, 409);
  try {
    const result = await listCardTables(env, connection, url.searchParams.get('projectId'));
    if (result.error) return fail(result.error, 400);
    return Response.json({ ok: true, data: result.data });
  } catch (error) {
    return fail(error?.code ?? 'provider_failed', 502);
  }
}

/**
 * إعدادُ اللوحتين: `{ projectId, prospectsTableId, clientsTableId }`. وما لم
 * يُعطَ معرّفُه لا يُعدّ — فيُعدّ نوعٌ وحده إن شاء المسؤول.
 */
export async function configureBoards(request, env, user, url) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  const chosen = KINDS.filter((kind) => body?.[`${kind}TableId`]);
  if (!chosen.length) return fail('choose_card_table', 400);
  if (chosen.length === 2 && String(body.prospectsTableId) === String(body.clientsTableId)) {
    return fail('same_card_table', 400);
  }

  const connection = await activeConnection(env);
  if (connection.error) return fail(connection.error, 409);

  const data = {};
  try {
    for (const kind of chosen) {
      const result = await setupBoard(env, connection, {
        kind, projectId: body.projectId, cardTableId: body[`${kind}TableId`], origin: url.origin, userId: user.id,
      });
      if (result.error) return fail(result.error, 400);
      data[kind] = result.data;
    }
  } catch (error) {
    return fail(error?.code ?? 'provider_failed', 502);
  }
  return Response.json({ ok: true, data });
}

/** مزامنةُ اللوحات المضبوطة كلِّها، أو لوحةٍ بعينها (`{ kind }`). */
export async function syncBoards(request, env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  const body = await request.json().catch(() => ({}));
  const boards = (await readBoards(env)).filter((b) => !body?.kind || b.kind === body.kind);
  if (!boards.length) return fail('not_configured', 409);
  const connection = await activeConnection(env);
  if (connection.error) return fail(connection.error, 409);

  const data = {};
  try {
    for (const board of boards) data[board.kind] = await fullSync(env, connection, board);
  } catch (error) {
    return fail(error?.code ?? 'provider_failed', 502);
  }
  return Response.json({ ok: true, data });
}

/* ═══ المساراتُ الأولى — للمحتملين وحدهم، تبقى ولا تنكسر ═══ */

export async function readProspectBoard(env, user, url) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  const status = await boardStatus(env, url, 'prospects');
  return Response.json({ ok: true, data: { ...status, prospects: status.records ?? 0 } });
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
    const result = await setupBoard(env, connection, {
      kind: 'prospects', projectId: body?.projectId, cardTableId: body?.cardTableId, origin: url.origin, userId: user.id,
    });
    if (result.error) return fail(result.error, 400);
    return Response.json({ ok: true, data: result.data });
  } catch (error) {
    return fail(error?.code ?? 'provider_failed', 502);
  }
}

export async function syncProspectBoard(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  const board = await readBoard(env, 'prospects');
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
 * لوحةُ بطاقةٍ في مشروعٍ فيه لوحتان.
 *
 * البطاقةُ المربوطة تُعرف بصفّها. والجديدةُ بعمودها: عمودٌ في خريطة لوحةٍ
 * يكفي، وإلا قُرئ العمود (`parent.url`) فعُرفت لوحتُه — صندوقُ الوارد لا يقع
 * في خريطةٍ ما، وبطاقتُه تُنشأ فيه أوّلَ مرّة.
 */
async function boardForCard(env, connection, boards, cardId) {
  for (const board of boards) {
    const spec = entity(board.kind);
    const linked = await env.DB.prepare(`SELECT id FROM ${spec.table} WHERE bc_card_id = ?`).bind(String(cardId)).first();
    if (linked) return { board };
  }

  const any = boards[0];
  const card = await getJson(connection.accountId, connection.token, `/buckets/${any.projectId}/card_tables/cards/${cardId}.json`);
  const columnId = String(card.parent?.id ?? '');
  const byColumn = boards.find((board) => Object.entries(board.columnMap)
    .some(([key, value]) => !key.startsWith('__legacy') && String(value) === columnId)
    || Object.keys(board.columnMap.__legacy ?? {}).includes(columnId));
  if (byColumn) return { board: byColumn, card };

  if (card.parent?.url) {
    const column = await getJson(connection.accountId, connection.token, card.parent.url).catch(() => null);
    const tableId = String(column?.parent?.id ?? '');
    const byTable = boards.find((board) => board.cardTableId === tableId);
    if (byTable) return { board: byTable, card };
  }
  return { board: null };
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

  const all = await readBoards(env);
  const boards = all.filter((board) => sameSecret(secret, board.webhookSecret));
  if (!boards.length) return fail('not_found', 404);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  const recording = payload?.recording ?? {};
  const inProject = boards.filter((board) => String(recording.bucket?.id ?? '') === board.projectId);
  if (!inProject.length) return Response.json({ ok: true, data: { ignored: 'other_project' } });

  let cardId = null;
  if (recording.type === 'Kanban::Card') cardId = recording.id;
  else if (recording.type === 'Comment' && recording.parent?.type === 'Kanban::Card') cardId = recording.parent.id;
  if (!cardId) return Response.json({ ok: true, data: { ignored: 'type' } });

  const work = (async () => {
    const connection = await activeConnection(env);
    if (connection.error) return;
    try {
      const { board, card } = await boardForCard(env, connection, inProject, cardId);
      if (board) await applyCard(env, connection, board, cardId, card ? { card } : {});
    } catch (error) {
      console.error('Basecamp/boards/webhook:', error?.code ?? error?.message ?? error);
    }
  })();
  if (ctx?.waitUntil) ctx.waitUntil(work);
  else await work;

  return Response.json({ ok: true });
}

/* ═══ بعد كتابات المنصة ═══ */

/**
 * يلفّ ردَّ المورد: إن نجح إنشاءٌ أو تعديلٌ، أُرسل الصفُّ إلى بطاقته بعد
 * الردّ. والردُّ يُستنسخ ليُقرأ معرّفُه ويبقى جسمُه للمتصفّح.
 */
export async function afterRecordWrite(kind, response, env, ctx) {
  if (!response.ok) return response;
  try {
    const body = await response.clone().json();
    const id = body?.data?.id;
    if (id) ctx?.waitUntil?.(pushRecord(env, kind, id));
  } catch { /* ردٌّ بلا جسم — لا شيء يُرسل */ }
  return response;
}

export const afterProspectWrite = (response, env, ctx) => afterRecordWrite('prospects', response, env, ctx);

/**
 * حذفٌ — مفرداً أو جملةً — تُحفظ قبله البطاقةُ في قائمة المحذوفين.
 *
 * والتعليمُ يسبق الحذف: بعده لا صفَّ يُقرأ منه رقمُ البطاقة. وحذفٌ رُفض
 * (صلاحيةٌ أو معرّفٌ خاطئ) يترك علامةً لبطاقةٍ صفُّها باقٍ — وذلك لا يضرّ:
 * الصفُّ مربوطٌ ببطاقته، والعلامةُ لا تُقرأ إلا لبطاقةٍ بلا صفّ.
 */
export async function beforeRecordDelete(kind, request, env, id) {
  if (request.method === 'DELETE' && id) return rememberDeleted(env, [id], kind);
  if (request.method === 'POST' && id === 'bulk') {
    const body = await request.clone().json().catch(() => null);
    if (body?.action === 'delete' && Array.isArray(body.ids)) await rememberDeleted(env, body.ids, kind);
  }
}

export const beforeProspectDelete = (request, env, id) => beforeRecordDelete('prospects', request, env, id);

/**
 * تحويلٌ إلى عميل.
 *
 * ما يُقرأ قبله: بطاقةُ المحتمل وتعليقاتُه — فالتحويلُ يحذف صفَّه وتسقط
 * تعليقاتُه معه. وما يقع بعده: التعليقاتُ تنتقل إلى العميل، وبطاقةٌ جديدةٌ له
 * في لوحة العملاء، والقديمةُ إلى «تحوّل إلى عميل» برابط الجديدة.
 */
export async function convertWithCard(env, user, id, ctx) {
  const before = await env.DB.prepare(`SELECT bc_card_id FROM prospects WHERE id = ?`).bind(id).first();
  const { results: comments } = await env.DB.prepare(
    `SELECT * FROM prospect_comments WHERE prospect_id = ? ORDER BY created_at`,
  )
    .bind(id)
    .all();

  const response = await convertProspect(env, user, id);
  if (!response.ok) return response;

  const body = await response.clone().json().catch(() => null);
  const client = body?.data;
  if (!client?.id) return response;

  await carryConversion(env, { prospectCardId: before?.bc_card_id, comments, clientId: client.id });
  ctx?.waitUntil?.(pushConversion(env, {
    prospectCardId: before?.bc_card_id ?? null,
    clientId: client.id,
    clientName: client.fullName,
  }));
  return response;
}

/* ═══ التعليقات ═══ */

const shapeComment = (spec, row) => ({
  id: row.id,
  [spec.kind === 'prospects' ? 'prospectId' : 'clientId']: row[spec.commentKey],
  body: row.body,
  authorName: row.author_name ?? '',
  authorUserId: row.author_user_id ?? null,
  source: row.source,
  synced: Boolean(row.bc_comment_id),
  createdAt: row.created_at,
});

export async function listComments(env, user, kind, rowId) {
  const spec = entity(kind);
  if (!may(user, RESOURCES[spec.resource], 'read')) return fail('forbidden', 403);
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${spec.commentsTable} WHERE ${spec.commentKey} = ? ORDER BY created_at ASC`,
  )
    .bind(rowId)
    .all();
  const row = await env.DB.prepare(`SELECT bc_app_url FROM ${spec.table} WHERE id = ?`).bind(rowId).first();
  return Response.json({
    ok: true,
    data: { comments: (results ?? []).map((r) => shapeComment(spec, r)), basecampUrl: row?.bc_app_url ?? null },
  });
}

export async function addComment(request, env, user, kind, rowId, ctx) {
  const spec = entity(kind);
  if (!may(user, RESOURCES[spec.resource], 'update')) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  const text = String(body?.body ?? '').trim();
  if (!text) return fail('missing_field', 400);
  if (text.length > 5000) return fail('too_long', 400);

  const row = await env.DB.prepare(`SELECT id FROM ${spec.table} WHERE id = ?`).bind(rowId).first();
  if (!row) return fail('not_found', 404);

  const member = await env.DB.prepare(`SELECT display_name AS name, email FROM members WHERE user_id = ?`).bind(user.id).first().catch(() => null);
  const id = crypto.randomUUID();
  const now = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO ${spec.commentsTable} (id, ${spec.commentKey}, body, author_name, author_user_id, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'platform', ?, ?)`,
  )
    .bind(id, rowId, text, member?.name || user.name || member?.email || '', user.id, now, now)
    .run();

  ctx?.waitUntil?.(pushComment(env, kind, id));

  const created = await env.DB.prepare(`SELECT * FROM ${spec.commentsTable} WHERE id = ?`).bind(id).first();
  return Response.json({ ok: true, data: shapeComment(spec, created) }, { status: 201 });
}

export const listProspectComments = (env, user, id) => listComments(env, user, 'prospects', id);
export const addProspectComment = (request, env, user, id, ctx) => addComment(request, env, user, 'prospects', id, ctx);

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

  ctx?.waitUntil?.(pushRecord(env, 'prospects', prospectId));
  return Response.json({ ok: true, data: { id: prospectId, prospectStatus: status } });
}

export { ENTITIES };
