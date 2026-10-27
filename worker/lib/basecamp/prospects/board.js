// لوحةُ العملاء المحتملين في بيسكامب — إعدادُها وقراءتُها.
//
// المشروعُ يُعطى بمعرّفه من الشاشة، ولا يُكتب في الشيفرة. وفي «عدّة» المشروع
// (`dock`) أداةُ لوحة البطاقات (`kanban_board`)، وأعمدتُها `lists`.
//
// ═══ العمودُ يُطابَق بالاسم ثم يُحفظ بمعرّفه ═══
//
// كلُّ حالةٍ في «تكوين النظام» عمودٌ باسمها. والعمودُ الموجود يُستعمل، والناقصُ
// يُنشأ، ثم تُحفظ الخريطةُ بالمعرّفات — فتغييرُ اسم عمودٍ في بيسكامب بعدها
// لا يقطع الربط.

import { BasecampError, getJson, sendJson } from '../api.js';
import { normalizeArabic } from '../discover.js';
import { loadSettings } from '../../queries.js';

/** مفتاحُ العمود الأخير في الخريطة — ليس حالةً في المنصة. */
export const CONVERTED = '__converted';
export const CONVERTED_TITLE = 'تحوّل إلى عميل';

const nowSeconds = () => Math.floor(Date.now() / 1000);

const parse = (raw, fallback) => {
  try { return JSON.parse(raw ?? '') ?? fallback; } catch { return fallback; }
};

/** اللوحةُ المضبوطة، أو `null` قبل الإعداد. */
export async function readBoard(env) {
  const row = await env.DB.prepare(`SELECT * FROM basecamp_prospect_board WHERE id = 1`).first();
  if (!row) return null;
  return {
    projectId: String(row.project_id),
    projectName: row.project_name ?? '',
    cardTableId: String(row.card_table_id),
    columnMap: parse(row.column_map, {}),
    webhookId: row.webhook_id ?? null,
    webhookSecret: row.webhook_secret,
    configuredAt: row.configured_at,
    lastSyncAt: row.last_sync_at ?? null,
    lastSyncError: row.last_sync_error ?? null,
  };
}

/** حالاتُ العميل المحتمل كما في «تكوين النظام». */
export async function prospectStatuses(env) {
  const settings = await loadSettings(env);
  return Array.isArray(settings.prospectStatuses) ? settings.prospectStatuses.filter(Boolean) : [];
}

/** حالةٌ ← عمود. */
export const columnForStatus = (board, status) => board.columnMap[status] ?? null;

/**
 * عمود ← حالة. ويردّ `null` لعمودٍ لا يقابل حالة — صندوقُ الوارد (Triage)
 * أو «تمّ» أو عمودٌ أضافه أحدٌ بيده — و`CONVERTED` لعمود التحويل.
 */
export function statusForColumn(board, columnId) {
  const id = String(columnId ?? '');
  for (const [status, column] of Object.entries(board.columnMap)) {
    if (String(column) === id) return status;
  }
  return null;
}

/** يُقيَّد الخطأ في صفّ اللوحة — الجدولة والـWebhook لا مستمعَ لخطئهما. */
export async function recordError(env, error) {
  const reason = error ? String(error?.code ?? error?.message ?? error).slice(0, 300) : null;
  await env.DB.prepare(`UPDATE basecamp_prospect_board SET last_sync_error = ? WHERE id = 1`)
    .bind(reason)
    .run()
    .catch(() => {});
}

export async function markSynced(env) {
  await env.DB.prepare(
    `UPDATE basecamp_prospect_board SET last_sync_at = ?, last_sync_error = NULL WHERE id = 1`,
  )
    .bind(nowSeconds())
    .run();
}

/** سرٌّ عشوائيٌّ للمسار: اثنان وثلاثون بايتاً ستّ عشرياً. */
function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const webhookUrl = (origin, secret) => `${origin}/api/basecamp/prospects/webhook/${secret}`;

/**
 * يُعدّ اللوحة: يجد لوحةَ البطاقات، ويطابق الأعمدة أو يُنشئها، ويسجّل الـWebhook.
 *
 * ويُعاد تشغيلُه بأمان: العمودُ الموجود لا يُنشأ ثانيةً، والـWebhook المسجَّل
 * لا يُسجَّل مرّتين، والسرُّ يبقى كما هو.
 */
export async function setupBoard(env, connection, { projectId, origin, userId }) {
  const { accountId, token } = connection;
  const id = String(projectId ?? '').replace(/\D/g, '');
  if (!id) return { error: 'invalid_project' };

  let project;
  try {
    project = await getJson(accountId, token, `/projects/${id}.json`);
  } catch (error) {
    if (error instanceof BasecampError && error.code === 'not_found') return { error: 'project_not_found' };
    throw error;
  }

  const tool = (project.dock ?? []).find((item) => item.name === 'kanban_board' && item.enabled !== false);
  if (!tool) return { error: 'no_card_table' };

  const table = await getJson(accountId, token, `/buckets/${id}/card_tables/${tool.id}.json`);
  const lists = table.lists ?? [];

  const statuses = await prospectStatuses(env);
  const previous = await readBoard(env);
  const columnMap = {};
  const created = [];

  for (const [key, title] of [...statuses.map((s) => [s, s]), [CONVERTED, CONVERTED_TITLE]]) {
    /* الخريطةُ السابقة أوّلاً: عمودٌ أُعيدت تسميتُه في بيسكامب يبقى عمودَ حالته. */
    const kept = previous?.projectId === id ? previous.columnMap[key] : null;
    const byId = kept ? lists.find((list) => String(list.id) === String(kept)) : null;
    const byName = lists.find((list) => normalizeArabic(list.title) === normalizeArabic(title));
    let column = byId ?? byName;

    if (!column) {
      column = await sendJson(accountId, token, `/buckets/${id}/card_tables/${tool.id}/columns.json`, {
        body: { title },
      });
      created.push(title);
    }
    columnMap[key] = String(column.id);
  }

  const secret = previous?.webhookSecret ?? newSecret();
  let webhookId = previous?.projectId === id ? previous.webhookId : null;
  let webhookError = null;

  /* ═══ الـWebhook ═══
     يُسجَّل على المشروع وحده، ولنوعين: البطاقة والتعليق. وتعذُّرُه لا يُسقط
     الإعداد — المزامنةُ كلَّ ساعة تبقى، وسببُه يُقال في الشاشة. */
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
    `INSERT INTO basecamp_prospect_board
       (id, project_id, project_name, card_table_id, column_map, webhook_id, webhook_secret,
        configured_by, configured_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET project_id    = excluded.project_id,
                                   project_name  = excluded.project_name,
                                   card_table_id = excluded.card_table_id,
                                   column_map    = excluded.column_map,
                                   webhook_id    = excluded.webhook_id,
                                   webhook_secret = excluded.webhook_secret,
                                   configured_by = excluded.configured_by,
                                   configured_at = excluded.configured_at`,
  )
    .bind(id, project.name ?? '', String(tool.id), JSON.stringify(columnMap), webhookId, secret, userId, nowSeconds())
    .run();

  return { data: { projectName: project.name ?? '', columnsCreated: created, webhook: Boolean(webhookId), webhookError } };
}
