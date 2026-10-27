// لوحاتُ العملاء في بيسكامب — إعدادُها وقراءتُها.
//
// مشروعٌ واحد («إدارة العملاء») فيه لوحتا بطاقات: العملاء المحتملون والعملاء
// الفعليون. والمشروعُ يُعطى بمعرّفه من الشاشة، ولا يُكتب في الشيفرة. وفي «عدّة»
// المشروع (`dock`) أدواتُ اللوحات (`kanban_board`)، ولكلٍّ أعمدتُها `lists`.
//
// ═══ اللوحةُ تُختار بمعرّفها ═══
//
// كان الإعدادُ يأخذ أوّلَ لوحةٍ في المشروع — ومع لوحتين قد يربط المحتملين
// بلوحة العملاء. فصارت كلُّ لوحةٍ تُختار بمعرّفها، ويُقترح الاختيارُ من الاسم.
//
// ═══ العمودُ يُطابَق بالاسم ثم يُحفظ بمعرّفه ═══
//
// كلُّ حالةٍ في «تكوين النظام» عمودٌ باسمها. والعمودُ الموجود يُستعمل، والناقصُ
// يُنشأ، ثم تُحفظ الخريطةُ بالمعرّفات — فتغييرُ اسم عمودٍ في بيسكامب بعدها
// لا يقطع الربط.

import { BasecampError, getJson, sendJson } from '../api.js';
import { normalizeArabic } from '../discover.js';
import { loadSettings } from '../../queries.js';
import { CONVERTED, CONVERTED_TITLE, ENTITIES, KINDS, LEGACY_STATUSES, entity } from './entities.js';

export { CONVERTED, CONVERTED_TITLE, LEGACY_STATUSES };

/* مفتاحُ الأعمدة القديمة في الخريطة: `{ معرّفُ العمود: الحالةُ الجديدة }`. */
const LEGACY = '__legacy';

const nowSeconds = () => Math.floor(Date.now() / 1000);

const parse = (raw, fallback) => {
  try { return JSON.parse(raw ?? '') ?? fallback; } catch { return fallback; }
};

function shapeBoard(row) {
  return {
    kind: row.kind,
    projectId: String(row.project_id),
    projectName: row.project_name ?? '',
    cardTableId: String(row.card_table_id),
    cardTableName: row.card_table_name ?? '',
    columnMap: parse(row.column_map, {}),
    webhookId: row.webhook_id ?? null,
    webhookSecret: row.webhook_secret,
    configuredAt: row.configured_at,
    lastSyncAt: row.last_sync_at ?? null,
    lastSyncError: row.last_sync_error ?? null,
  };
}

/** لوحةُ نوعٍ مضبوطة، أو `null` قبل إعدادها. */
export async function readBoard(env, kind = 'prospects') {
  const row = await env.DB.prepare(`SELECT * FROM basecamp_boards WHERE kind = ?`).bind(kind).first();
  return row ? shapeBoard(row) : null;
}

/** اللوحاتُ المضبوطة كلُّها. */
export async function readBoards(env) {
  const { results } = await env.DB.prepare(`SELECT * FROM basecamp_boards`).all();
  return (results ?? []).map(shapeBoard);
}

/** حالاتُ النوع كما في «تكوين النظام». */
export async function statusesOf(env, kind) {
  const settings = await loadSettings(env);
  const list = settings[entity(kind).statusesKey];
  return Array.isArray(list) ? list.filter(Boolean) : [];
}

/** حالاتُ العميل المحتمل — للمنادين القدامى. */
export const prospectStatuses = (env) => statusesOf(env, 'prospects');

/** حالةٌ ← عمود. */
export const columnForStatus = (board, status) => board.columnMap[status] ?? null;

/**
 * عمود ← حالة. ويردّ `null` لعمودٍ لا يقابل حالة — صندوقُ الوارد (Triage)
 * أو «تمّ» أو عمودٌ أضافه أحدٌ بيده — و`CONVERTED` لعمود التحويل.
 */
export function statusForColumn(board, columnId) {
  const id = String(columnId ?? '');
  for (const [status, column] of Object.entries(board.columnMap)) {
    if (status === LEGACY) continue;
    if (String(column) === id) return status;
  }
  return board.columnMap[LEGACY]?.[id] ?? null;
}

/** يُقيَّد الخطأ في صفّ اللوحة — الجدولة والـWebhook لا مستمعَ لخطئهما. */
export async function recordError(env, kind, error) {
  const reason = error ? String(error?.code ?? error?.message ?? error).slice(0, 300) : null;
  await env.DB.prepare(`UPDATE basecamp_boards SET last_sync_error = ? WHERE kind = ?`)
    .bind(reason, kind)
    .run()
    .catch(() => {});
}

export async function markSynced(env, kind) {
  await env.DB.prepare(`UPDATE basecamp_boards SET last_sync_at = ?, last_sync_error = NULL WHERE kind = ?`)
    .bind(nowSeconds(), kind)
    .run();
}

/** سرٌّ عشوائيٌّ للمسار: اثنان وثلاثون بايتاً ستّ عشرياً. */
function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const webhookUrl = (origin, secret) => `${origin}/api/basecamp/prospects/webhook/${secret}`;

const projectIdOf = (raw) => {
  const text = String(raw ?? '');
  return (text.match(/projects\/(\d+)/)?.[1] ?? text).replace(/\D/g, '');
};

async function readProject(connection, id) {
  try {
    return { project: await getJson(connection.accountId, connection.token, `/projects/${id}.json`) };
  } catch (error) {
    if (error instanceof BasecampError && error.code === 'not_found') return { error: 'project_not_found' };
    throw error;
  }
}

const cardTablesOf = (project) => (project.dock ?? [])
  .filter((item) => item.name === 'kanban_board' && item.enabled !== false)
  .map((item) => ({ id: String(item.id), title: item.title ?? '' }));

/**
 * لوحاتُ المشروع، ومعها اقتراحٌ لكلِّ نوعٍ من الاسم.
 *
 * والاقتراحُ لا يُفرض: الشاشةُ تعرضه مختاراً، ويُغيَّر بيد. ولا يُقترح لنوعين
 * لوحةٌ واحدة.
 */
export async function listCardTables(env, connection, projectId) {
  const id = projectIdOf(projectId);
  if (!id) return { error: 'invalid_project' };
  const read = await readProject(connection, id);
  if (read.error) return read;

  const tables = cardTablesOf(read.project);
  const suggested = {};
  const taken = new Set();
  for (const kind of KINDS) {
    const current = await readBoard(env, kind);
    const kept = current?.projectId === id ? tables.find((t) => t.id === current.cardTableId) : null;
    const named = tables.find((t) => !taken.has(t.id) && ENTITIES[kind].titleHint.test(normalizeArabic(t.title)));
    const choice = kept ?? named ?? null;
    suggested[kind] = choice?.id ?? null;
    if (choice) taken.add(choice.id);
  }

  return { data: { projectId: id, projectName: read.project.name ?? '', tables, suggested } };
}

/**
 * يُعدّ لوحةَ نوعٍ: يطابق أعمدتَها بالحالات أو يُنشئها، ويسجّل الـWebhook.
 *
 * ويُعاد تشغيلُه بأمان: العمودُ الموجود لا يُنشأ ثانيةً، والـWebhook المسجَّل
 * على المشروع — لهذا النوع أو للآخر — لا يُسجَّل مرّتين، والسرُّ يبقى كما هو.
 */
export async function setupBoard(env, connection, { kind = 'prospects', projectId, cardTableId, origin, userId }) {
  const spec = entity(kind);
  const { accountId, token } = connection;
  const id = projectIdOf(projectId);
  if (!id) return { error: 'invalid_project' };

  const read = await readProject(connection, id);
  if (read.error) return read;
  const { project } = read;

  const tables = cardTablesOf(project);
  if (!tables.length) return { error: 'no_card_table' };
  /* بلا معرّفٍ صريح: لوحةٌ واحدةٌ في المشروع تُؤخذ، ولوحتان يُختار منهما بالاسم.
     ولا يُخمَّن بينهما بغير ذلك. */
  const tool = cardTableId
    ? tables.find((t) => t.id === String(cardTableId))
    : tables.length === 1 ? tables[0] : tables.find((t) => spec.titleHint.test(normalizeArabic(t.title)));
  if (!tool) return { error: cardTableId ? 'card_table_not_found' : 'choose_card_table' };

  /* ولوحتان لنوعين لا تكونان واحدة: كلُّ بطاقةٍ فيها كانت ستُقرأ مرّتين. */
  for (const other of KINDS.filter((k) => k !== kind)) {
    const board = await readBoard(env, other);
    if (board?.projectId === id && board.cardTableId === tool.id) return { error: 'same_card_table' };
  }

  const table = await getJson(accountId, token, `/buckets/${id}/card_tables/${tool.id}.json`);
  const lists = table.lists ?? [];

  const statuses = await statusesOf(env, kind);
  const previous = await readBoard(env, kind);
  const samePlace = previous?.projectId === id && previous?.cardTableId === tool.id;
  const columnMap = {};
  const created = [];
  const renamed = [];

  for (const [key, title] of [...statuses.map((s) => [s, spec.columnTitle(s)]), ...spec.extraColumns]) {
    /* الخريطةُ السابقة أوّلاً: عمودٌ أُعيدت تسميتُه في بيسكامب يبقى عمودَ حالته. */
    const kept = samePlace ? previous.columnMap[key] : null;
    const byId = kept ? lists.find((list) => String(list.id) === String(kept)) : null;
    const byName = lists.find((list) => normalizeArabic(list.title) === normalizeArabic(title))
      ?? (title !== key ? lists.find((list) => normalizeArabic(list.title) === normalizeArabic(key)) : null);
    let column = byId ?? byName;

    /* عمودٌ باسمٍ قديم يصير عمودَ الحالة الجديدة بتسميته. */
    if (!column) {
      const legacy = lists.find((list) => Object.entries(spec.legacyStatuses).some(([old, next]) =>
        next === key && normalizeArabic(list.title) === normalizeArabic(old)));
      if (legacy) {
        column = await sendJson(accountId, token, `/buckets/${id}/card_tables/columns/${legacy.id}.json`, {
          method: 'PUT',
          body: { title },
        }) ?? legacy;
        legacy.title = title;
        renamed.push(title);
      }
    }

    if (!column) {
      column = await sendJson(accountId, token, `/buckets/${id}/card_tables/${tool.id}/columns.json`, {
        body: { title },
      });
      created.push(title);
    }
    columnMap[key] = String(column.id);
  }

  /* وما بقي باسمٍ قديم وللجديد عمود: يُقرأ بالحالة الجديدة. */
  const mapped = new Set(Object.values(columnMap));
  const legacyColumns = {};
  for (const list of lists) {
    if (mapped.has(String(list.id))) continue;
    const match = Object.entries(spec.legacyStatuses)
      .find(([old, next]) => normalizeArabic(list.title) === normalizeArabic(old) && columnMap[next]);
    if (match) legacyColumns[String(list.id)] = match[1];
  }
  if (Object.keys(legacyColumns).length) columnMap[LEGACY] = legacyColumns;

  /* ═══ الـWebhook واحدٌ للمشروع ═══
     يُبلغ عن كلِّ بطاقةٍ وتعليقٍ في المشروع — اللوحتان معاً — والتوجيهُ إلى
     النوع في `handlers.js`. فإن سُجّل للنوع الآخر في المشروع نفسه أُخذ هو وسرُّه. */
  const boards = await readBoards(env);
  const sibling = boards.find((b) => b.kind !== kind && b.projectId === id && b.webhookId);
  const secret = sibling?.webhookSecret ?? previous?.webhookSecret ?? boards[0]?.webhookSecret ?? newSecret();
  let webhookId = sibling?.webhookId ?? (previous?.projectId === id ? previous.webhookId : null);
  let webhookError = null;

  /* وتعذُّرُه لا يُسقط الإعداد — المزامنةُ كلَّ ساعة تبقى، وسببُه يُقال في الشاشة. */
  if (!webhookId) {
    try {
      const hook = await sendJson(accountId, token, `/buckets/${id}/webhooks.json`, {
        body: { payload_url: webhookUrl(origin, secret), types: ['Kanban::Card', 'Comment'] },
      });
      webhookId = hook?.id ? String(hook.id) : null;
    } catch (error) {
      webhookError = String(error?.code ?? error?.message ?? error);
    }
  }

  await env.DB.prepare(
    `INSERT INTO basecamp_boards
       (kind, project_id, project_name, card_table_id, card_table_name, column_map, webhook_id,
        webhook_secret, configured_by, configured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(kind) DO UPDATE SET project_id      = excluded.project_id,
                                     project_name    = excluded.project_name,
                                     card_table_id   = excluded.card_table_id,
                                     card_table_name = excluded.card_table_name,
                                     column_map      = excluded.column_map,
                                     webhook_id      = excluded.webhook_id,
                                     webhook_secret  = excluded.webhook_secret,
                                     configured_by   = excluded.configured_by,
                                     configured_at   = excluded.configured_at`,
  )
    .bind(kind, id, project.name ?? '', tool.id, tool.title, JSON.stringify(columnMap), webhookId, secret, userId, nowSeconds())
    .run();

  /* والسرُّ واحدٌ في الصفوف كلِّها، فأيُّها يحرس المسار. */
  await env.DB.prepare(`UPDATE basecamp_boards SET webhook_secret = ? WHERE project_id = ?`).bind(secret, id).run();
  if (webhookId) {
    await env.DB.prepare(`UPDATE basecamp_boards SET webhook_id = ? WHERE project_id = ? AND webhook_id IS NULL`)
      .bind(webhookId, id)
      .run();
  }

  return {
    data: {
      kind,
      projectName: project.name ?? '',
      cardTableName: tool.title,
      columnsCreated: created,
      columnsRenamed: renamed,
      webhook: Boolean(webhookId),
      webhookError,
    },
  };
}
