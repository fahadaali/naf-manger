// العميلُ المحتمل وبطاقتُه — دمجٌ في الاتّجاهين.
//
// ═══ دالّةٌ واحدة لا اثنتان ═══
//
// «من المنصة إلى بيسكامب» و«من بيسكامب إلى المنصة» يمرّان بـ`reconcile`
// وحدها: تقرأ الطرفين والصورةَ المحفوظة، وتكتب في كلِّ طرفٍ ما تبدّل في
// الآخر. فحفظٌ في المنصة لا يدهس ما كُتب في البطاقة قبل أن يصل، ونداءُ
// Webhook يعود بما كتبناه نحن فلا يجد ما يكتبه — والحلقةُ تنتهي من نفسها.
//
// ═══ والاختلافُ لا يُكتب ═══
//
// حقلٌ تبدّل في الطرفين معاً يُسجَّل في `basecamp_conflicts` بالقيمتين، ويبقى
// كلُّ طرفٍ على ما فيه حتى يُحسم من شاشة بيسكامب في الإعدادات.

import { getJson, listAll, sendJson } from '../api.js';
import { activeConnection } from '../oauth.js';
import { htmlToText } from '../parse.js';
import { normalizeArabic } from '../discover.js';
import {
  CONVERTED,
  columnForStatus,
  markSynced,
  prospectStatuses,
  readBoard,
  recordError,
  statusForColumn,
} from './board.js';
import { canonical, CARD_FIELDS, FIELD_LABELS, parseCard, renderCard, SYNCED_FIELDS } from './card-format.js';
import { extractProspect } from './extract.js';
import { logActivity } from '../../activity.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

const parse = (raw, fallback) => {
  try { return JSON.parse(raw ?? '') ?? fallback; } catch { return fallback; }
};

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** عمودُ كلِّ حقلٍ في `prospects`. */
const COLUMN = {
  fullName: 'full_name',
  prospectStatus: 'prospect_status',
  phone: 'phone',
  email: 'email',
  clientType: 'client_type',
  idType: 'id_type',
  idNumber: 'id_number',
  commercialRegister: 'commercial_register',
  source: 'source',
  expectedValue: 'expected_value',
  followUpDate: 'follow_up_date',
  notes: 'notes',
};

/* أعمدةٌ لا تقبل الفراغ — قيمةٌ فارغةٌ من البطاقة لا تمحو اسماً ولا حالة. */
const NEVER_EMPTY = new Set(['fullName', 'prospectStatus', 'clientType']);
/* وأعمدةٌ `NOT NULL DEFAULT ''` — الفراغُ فيها نصٌّ فارغ لا `NULL`. */
const EMPTY_TEXT = new Set(['phone', 'email', 'notes']);

/** القيمةُ الموحَّدة ← ما يُكتب في العمود. */
function columnValue(field, value) {
  if (field === 'expectedValue') return value ? Number(value) : null;
  if (EMPTY_TEXT.has(field)) return value ?? '';
  return value || null;
}

/* ═══ قفلُ الإنشاء ═══
   المنصةُ تُنشئ البطاقة ثم تحفظ رقمَها. وبين الاثنين قد يصل Webhook
   «أُنشئت بطاقة» — فلا يجد عميلاً يحمل الرقم، فيُنشئ عميلاً ثانياً. فيُعلَّم
   الاسمُ قبل الإنشاء ويُترك الـWebhook له. */
const creatingKey = (title) => `bcp:creating:${normalizeArabic(title)}`;

async function connectionOrNull(env) {
  const connection = await activeConnection(env);
  return connection.error ? null : connection;
}

/** قيمُ البطاقة موحَّدةً: الاسمُ من العنوان، والحالةُ من العمود، والباقي من الوصف. */
function cardValues(board, card) {
  const parsed = parseCard(card.content ?? '');
  const values = { ...parsed.values };
  if (card.title?.trim()) values.fullName = card.title.trim();

  /* عمودٌ لا يقابل حالة (صندوقُ الوارد، أو التحويل) لا يقول شيئاً عن الحالة. */
  const status = statusForColumn(board, card.parent?.id);
  if (status && status !== CONVERTED) values.prospectStatus = status;

  /* و`due_on` موعدُ المتابعة إن لم يُكتب في الوصف. */
  if (!values.followUpDate && card.due_on) values.followUpDate = String(card.due_on).slice(0, 10);

  return { values, structured: parsed.structured, text: parsed.text };
}

/** يفتح اختلافاً — مرّةً لكلّ (عميلٍ + حقلٍ + قيمتين). */
async function openConflict(env, board, prospectId, field, platformValue, basecampValue) {
  const open = await env.DB.prepare(
    `SELECT id FROM basecamp_conflicts
     WHERE prospect_id = ? AND field = ? AND resolved_at IS NULL`,
  )
    .bind(prospectId, `prospect.${field}`)
    .first();

  if (open) {
    await env.DB.prepare(
      `UPDATE basecamp_conflicts SET platform_value = ?, basecamp_value = ? WHERE id = ?`,
    )
      .bind(platformValue, basecampValue, open.id)
      .run();
    return;
  }

  await env.DB.prepare(
    `INSERT INTO basecamp_conflicts
       (id, project_id, case_id, prospect_id, field, platform_value, basecamp_value, detected_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), board.projectId, prospectId, `prospect.${field}`, platformValue, basecampValue, nowSeconds())
    .run();
}

/**
 * الدمجُ الثلاثيّ لحقلٍ واحد.
 *
 * `remote === undefined` معناه «البطاقةُ لا تقول شيئاً عنه» — نصٌّ حرٌّ لم
 * يُكتب فيه، أو عمودٌ لا يقابل حالة — فيُعامَل كأنه لم يتبدّل.
 */
export function mergeField(platform, remote, base) {
  const r = remote === undefined ? base : remote;
  if (platform === r) return { value: platform };
  if (platform === base) return { value: r, to: 'platform' };
  if (r === base) return { value: platform, to: 'basecamp' };
  return { conflict: true };
}

/**
 * يدمج عميلاً محتملاً ببطاقته، ويكتب في كلِّ طرفٍ ما تبدّل في الآخر.
 *
 * `card` البطاقةُ كما قُرئت للتوّ. ويردّ ما وقع: `{ platform, basecamp, conflicts }`.
 */
export async function reconcile(env, connection, board, prospect, card) {
  const platform = canonical(prospect);
  const { values: remote } = cardValues(board, card);
  const base = parse(prospect.bc_synced_values, null);

  const snapshot = {};
  const platformWrites = {};
  const desired = {};
  let conflicts = 0;

  for (const field of SYNCED_FIELDS) {
    const p = platform[field] ?? '';
    const r = remote[field];

    /* ═══ أوّلُ ربط ═══
       لا صورةَ بعد: المنصةُ أصلٌ لما فيها، والبطاقةُ تملأ ما فرغ فيها. */
    if (!base) {
      const value = p || r || '';
      if (value !== p) platformWrites[field] = value;
      desired[field] = value;
      snapshot[field] = value;
      continue;
    }

    const b = base[field] ?? '';
    const merged = mergeField(p, r, b);

    if (merged.conflict) {
      conflicts++;
      await openConflict(env, board, prospect.id, field, p, r ?? '');
      desired[field] = r ?? b;
      snapshot[field] = b;
      continue;
    }

    /* فراغٌ في البطاقة لا يمحو اسماً ولا حالة في المنصة. */
    if (merged.to === 'platform' && !merged.value && NEVER_EMPTY.has(field)) {
      desired[field] = p;
      snapshot[field] = p;
      continue;
    }

    if (merged.to === 'platform') platformWrites[field] = merged.value;
    desired[field] = merged.value;
    snapshot[field] = merged.value;
  }

  /* ═══ الكتابةُ في المنصة ═══ */
  const written = await writeProspect(env, prospect.id, platformWrites);
  /* حقلٌ رفضته القاعدة (هويةٌ لعميلٍ آخر) لا يُحفظ في الصورة — فيُعاد السؤال. */
  for (const field of written.rejected) {
    snapshot[field] = base?.[field] ?? '';
    desired[field] = platform[field] ?? '';
  }

  /* ═══ الكتابةُ في البطاقة ═══
     يُقارَن الوصفُ المطلوب بالوصف القائم بالقيم لا بالنصّ: بيسكامب تُعيد
     صياغةَ HTML بعد الحفظ، ومقارنةُ النصّ تجعل كلَّ دمجٍ يكتب. */
  const remoteNow = cardValues(board, card);
  const cardDiffers = !remoteNow.structured
    || desired.fullName !== (remoteNow.values.fullName ?? '')
    || [...CARD_FIELDS.map(([field]) => field), 'notes'].some((field) => (desired[field] ?? '') !== (remoteNow.values[field] ?? ''));

  let basecampWrites = 0;
  if (cardDiffers) {
    const rendered = renderCard(desired);
    await sendJson(connection.accountId, connection.token, `/buckets/${board.projectId}/card_tables/cards/${card.id}.json`, {
      method: 'PUT',
      body: rendered,
    });
    basecampWrites++;
  }

  const targetColumn = columnForStatus(board, desired.prospectStatus);
  const currentStatus = statusForColumn(board, card.parent?.id);
  /* البطاقةُ في عمود التحويل لا تُعاد منه. */
  if (targetColumn && String(card.parent?.id) !== String(targetColumn) && currentStatus !== CONVERTED) {
    await sendJson(connection.accountId, connection.token, `/buckets/${board.projectId}/card_tables/cards/${card.id}/moves.json`, {
      body: { column_id: Number(targetColumn) },
    });
    basecampWrites++;
  }

  await env.DB.prepare(
    `UPDATE prospects
     SET bc_card_id = ?, bc_column_id = ?, bc_app_url = ?, bc_synced_values = ?, bc_updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      String(card.id),
      targetColumn ?? String(card.parent?.id ?? ''),
      card.app_url ?? null,
      JSON.stringify(snapshot),
      card.updated_at ?? null,
      prospect.id,
    )
    .run();

  return { platform: Object.keys(written.applied).length, basecamp: basecampWrites, conflicts };
}

/** يكتب حقولاً في صفّ العميل المحتمل — حقلاً حقلاً، فرفضُ واحدٍ لا يُسقط الباقي. */
async function writeProspect(env, id, writes) {
  const applied = {};
  const rejected = [];
  const now = nowSeconds();

  for (const [field, value] of Object.entries(writes)) {
    const column = COLUMN[field];
    if (!column) continue;
    try {
      await env.DB.prepare(`UPDATE prospects SET ${column} = ?, updated_at = ? WHERE id = ?`)
        .bind(columnValue(field, value), now, id)
        .run();
      applied[field] = value;
    } catch (error) {
      /* `id_number` فريد — هويةٌ قُرئت من البطاقة لعميلٍ محتملٍ آخر لا تُكتب. */
      console.warn('Basecamp/prospects: رُفض الحقل', field, '—', error?.message ?? error);
      rejected.push(field);
    }
  }
  return { applied, rejected };
}

/* ═══ التعليقات ═══ */

const commentsPath = (board, cardId) => `/buckets/${board.projectId}/recordings/${cardId}/comments.json`;

function renderComment(comment) {
  const lines = String(comment.body).split('\n').map((line) => line.trim()).filter(Boolean);
  return [
    `<div><strong>${escapeHtml(comment.author_name || 'المنصة')}</strong> — من منصة ناف:</div>`,
    ...lines.map((line) => `<div>${escapeHtml(line)}</div>`),
  ].join('');
}

/**
 * يزامن تعليقاتِ بطاقة: ما في بيسكامب ولم يُنسخ يُنسخ، وما كُتب في المنصة
 * ولم يُرسل يُرسل. ويردّ نصَّ التعليقات الجديدة من بيسكامب لمن يستخرج منها.
 */
export async function syncComments(env, connection, board, prospectId, cardId) {
  const { items } = await listAll(connection.accountId, connection.token, commentsPath(board, cardId));

  const { results } = await env.DB.prepare(
    `SELECT * FROM prospect_comments WHERE prospect_id = ?`,
  )
    .bind(prospectId)
    .all();
  const local = results ?? [];
  const byRemote = new Map(local.filter((c) => c.bc_comment_id).map((c) => [String(c.bc_comment_id), c]));
  const fresh = [];

  for (const remote of items) {
    const id = String(remote.id);
    const body = htmlToText(remote.content ?? '');
    const known = byRemote.get(id);

    if (known) {
      /* تعليقٌ عُدّل في بيسكامب — وما كتبته المنصة لا يُقرأ ثانيةً من هناك. */
      if (known.source === 'basecamp' && known.body !== body) {
        await env.DB.prepare(`UPDATE prospect_comments SET body = ?, updated_at = ? WHERE id = ?`)
          .bind(body, nowSeconds(), known.id)
          .run();
      }
      continue;
    }

    /* تعليقٌ أرسلته المنصة للتوّ ولم يُحفظ رقمُه بعد: يُربط ولا يُنسخ. */
    const pending = local.find((c) => !c.bc_comment_id && c.source === 'platform'
      && body.includes(String(c.body).split('\n')[0].trim()));
    if (pending) {
      await env.DB.prepare(`UPDATE prospect_comments SET bc_comment_id = ? WHERE id = ?`).bind(id, pending.id).run();
      pending.bc_comment_id = id;
      continue;
    }

    const at = Math.floor(Date.parse(remote.created_at ?? '') / 1000) || nowSeconds();
    await env.DB.prepare(
      `INSERT INTO prospect_comments
         (id, prospect_id, body, author_name, author_user_id, source, bc_comment_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 'basecamp', ?, ?, ?)
       ON CONFLICT(bc_comment_id) DO NOTHING`,
    )
      .bind(crypto.randomUUID(), prospectId, body, remote.creator?.name ?? '', id, at, at)
      .run();
    fresh.push(body);
  }

  /* وما كُتب في المنصة ولم يصل — سقط إرسالُه أو كُتب قبل ربط البطاقة. */
  for (const comment of local.filter((c) => c.source === 'platform' && !c.bc_comment_id)) {
    await sendComment(env, connection, board, cardId, comment);
  }

  return fresh;
}

async function sendComment(env, connection, board, cardId, comment) {
  const created = await sendJson(connection.accountId, connection.token, commentsPath(board, cardId), {
    body: { content: renderComment(comment) },
  });
  if (created?.id) {
    await env.DB.prepare(`UPDATE prospect_comments SET bc_comment_id = ? WHERE id = ? AND bc_comment_id IS NULL`)
      .bind(String(created.id), comment.id)
      .run()
      .catch(() => {});
  }
}

/* ═══ الاستخراج ═══ */

/**
 * حقولٌ فارغةٌ في المنصة تُملأ ممّا كُتب نصّاً حرّاً في البطاقة أو تعليقاتها.
 *
 * والفارغُ وحده: ما في المنصة لا يُدهس باستخراجٍ آليّ أبداً.
 */
async function fillFromText(env, prospect, text) {
  const platform = canonical(prospect);
  const missing = ['phone', 'email', 'idNumber', 'commercialRegister', 'source', 'expectedValue', 'followUpDate']
    .filter((field) => !platform[field]);
  /* ونوعُ العميل له افتراضٌ في القاعدة (`individual`) — فلا يُعرف أنه «فارغ».
     يُسأل عنه ما دام لم يُكتب في البطاقة صراحةً. */
  if (!prospect.bc_synced_values) missing.push('clientType');
  if (!missing.length) return {};

  const found = await extractProspect(env, { text, missing });
  if (Object.keys(found).length) await writeProspect(env, prospect.id, found);
  return found;
}

async function readProspect(env, where, value) {
  return env.DB.prepare(`SELECT * FROM prospects WHERE ${where} = ?`).bind(value).first();
}

/* ═══ من بيسكامب ═══ */

/**
 * بطاقةٌ تبدّلت في بيسكامب — تُقرأ وتُدمج.
 *
 * والبطاقةُ تُقرأ من الواجهة لا من جسم الـWebhook: الجسمُ يقول «تبدّل شيء»،
 * والحالُ يُعرف من مصدره.
 */
export async function applyCard(env, connection, board, cardId, { card: given } = {}) {
  const card = given ?? await getJson(connection.accountId, connection.token, `/buckets/${board.projectId}/card_tables/cards/${cardId}.json`);
  if (String(card.bucket?.id ?? board.projectId) !== String(board.projectId)) return { skipped: 'other_project' };
  if (card.status && card.status !== 'active') return { skipped: 'inactive' };

  let prospect = await readProspect(env, 'bc_card_id', String(card.id));

  if (!prospect) {
    /* بطاقةُ عميلٍ حُوِّل — لا تُعاد عميلاً محتملاً. */
    const converted = await env.DB.prepare(`SELECT id FROM clients WHERE bc_card_id = ?`).bind(String(card.id)).first();
    if (converted) return { skipped: 'converted' };
    /* وبطاقةُ من حُذف في المنصة — لا يُعاد. */
    const deleted = await env.DB.prepare(`SELECT 1 AS x FROM basecamp_prospect_tombstones WHERE card_id = ?`)
      .bind(String(card.id)).first();
    if (deleted) return { skipped: 'deleted' };
    /* والمنصةُ تُنشئ هذه البطاقة الآن — ويُترك ربطُها لها. */
    if (await env.AUTH_KV?.get(creatingKey(card.title ?? ''))) return { skipped: 'creating' };
    /* وعمودُ التحويل ليس بابَ دخول. */
    if (statusForColumn(board, card.parent?.id) === CONVERTED) return { skipped: 'converted_column' };

    prospect = await createFromCard(env, connection, board, card);
  }

  const fresh = await syncComments(env, connection, board, prospect.id, card.id);

  /* تعليقٌ جديدٌ في بيسكامب قد يحمل ما ينقص الملفّ: جوّالاً أو بريداً. */
  if (fresh.length) {
    await fillFromText(env, prospect, fresh.join('\n\n'));
    prospect = await readProspect(env, 'id', prospect.id);
  }

  return reconcile(env, connection, board, prospect, card);
}

/** عميلٌ محتملٌ جديد من بطاقةٍ أُنشئت في بيسكامب. */
async function createFromCard(env, connection, board, card) {
  const { values, structured, text } = cardValues(board, card);
  const statuses = await prospectStatuses(env);
  const id = crypto.randomUUID();
  const now = nowSeconds();

  /* ═══ نصٌّ حرّ ═══
     ما كتبه الإنسانُ يُحفظ كلُّه ملاحظةً — فلا يضيع منه شيءٌ حين تُعاد كتابةُ
     البطاقة بالصيغة. ثم يُسأل الطرازُ عن الحقول في النصّ وتعليقاته. */
  if (!structured && text && !values.notes) values.notes = text;

  const row = {
    id,
    full_name: values.fullName || 'عميل محتمل',
    prospect_status: values.prospectStatus || statuses[0] || 'مهتم',
    phone: values.phone ?? '',
    email: values.email ?? '',
    client_type: values.clientType || 'individual',
    id_type: values.idType ?? null,
    id_number: values.idNumber ?? null,
    commercial_register: values.commercialRegister ?? null,
    source: values.source ?? null,
    expected_value: values.expectedValue ? Number(values.expectedValue) : null,
    follow_up_date: values.followUpDate ?? null,
    notes: values.notes ?? '',
    bc_card_id: String(card.id),
    bc_column_id: String(card.parent?.id ?? ''),
    bc_app_url: card.app_url ?? null,
    created_at: now,
    updated_at: now,
  };

  const insert = async (data) => {
    const columns = Object.keys(data).filter((column) => data[column] !== null);
    await env.DB.prepare(
      `INSERT INTO prospects (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    )
      .bind(...columns.map((column) => data[column]))
      .run();
  };

  try {
    await insert(row);
  } catch (error) {
    /* هويةٌ مكتوبةٌ في البطاقة لعميلٍ محتملٍ آخر: يُنشأ بدونها. */
    if (!String(error?.message ?? '').includes('id_number')) throw error;
    await insert({ ...row, id_number: null });
  }

  let prospect = await readProspect(env, 'id', id);

  /* الحقولُ تُستخرج من النصّ الحرّ وتعليقاته — والقاعدةُ سبقت، فما قرأته لا يُسأل عنه. */
  const { items } = await listAll(connection.accountId, connection.token, commentsPath(board, card.id)).catch(() => ({ items: [] }));
  const comments = items.map((c) => htmlToText(c.content ?? '')).join('\n\n');
  const textForAi = [structured ? '' : text, comments].filter(Boolean).join('\n\n');
  if (textForAi) {
    await fillFromText(env, { ...prospect, bc_synced_values: structured ? '{}' : null }, `${card.title ?? ''}\n${textForAi}`);
    prospect = await readProspect(env, 'id', id);
  }

  await logActivity(env, { id: 'basecamp', name: 'بيسكامب' }, {
    resource: 'prospects',
    action: 'create',
    row: { id, fullName: prospect.full_name },
  }).catch(() => {});

  return prospect;
}

/* ═══ من المنصة ═══ */

/**
 * عميلٌ محتملٌ حُفظ في المنصة — يُنشأ له بطاقة أو تُدمج بطاقتُه.
 *
 * لا ترمي: تُنادى بعد الردّ (`waitUntil`) ولا مستمعَ لخطئها. فيُقيَّد السبب
 * في صفّ اللوحة، وتُعيد المزامنةُ الساعيةُ المحاولة.
 */
export async function pushProspect(env, prospectId) {
  try {
    const board = await readBoard(env);
    if (!board) return null;
    const connection = await connectionOrNull(env);
    if (!connection) return null;

    const prospect = await readProspect(env, 'id', prospectId);
    if (!prospect) return null;
    return await pushRow(env, connection, board, prospect);
  } catch (error) {
    console.error('Basecamp/prospects: تعذّر الإرسال —', error?.code ?? error?.message ?? error);
    await recordError(env, error);
    return null;
  }
}

async function pushRow(env, connection, board, prospect) {
  if (prospect.bc_card_id) {
    const card = await getJson(connection.accountId, connection.token,
      `/buckets/${board.projectId}/card_tables/cards/${prospect.bc_card_id}.json`);
    /* بطاقةٌ حُذفت أو أُرشفت في بيسكامب: لا تُكتب، ولا يُحذف العميل. */
    if (card.status && card.status !== 'active') return { skipped: 'inactive' };
    await syncComments(env, connection, board, prospect.id, card.id);
    return reconcile(env, connection, board, prospect, card);
  }

  /* المؤرشَفُ لا تُنشأ له بطاقة. */
  if (prospect.archived_at) return null;

  const values = canonical(prospect);
  const column = columnForStatus(board, values.prospectStatus) ?? Object.values(board.columnMap)[0];
  if (!column) return null;

  const key = creatingKey(values.fullName || 'عميل محتمل');
  await env.AUTH_KV?.put(key, '1', { expirationTtl: 120 });
  try {
    const card = await sendJson(connection.accountId, connection.token,
      `/buckets/${board.projectId}/card_tables/lists/${column}/cards.json`, { body: renderCard(values) });

    await env.DB.prepare(
      `UPDATE prospects
       SET bc_card_id = ?, bc_column_id = ?, bc_app_url = ?, bc_synced_values = ?, bc_updated_at = ?
       WHERE id = ?`,
    )
      .bind(String(card.id), String(column), card.app_url ?? null, JSON.stringify(values), card.updated_at ?? null, prospect.id)
      .run();

    await syncComments(env, connection, board, prospect.id, card.id);
    return { created: true };
  } finally {
    await env.AUTH_KV?.delete(key);
  }
}

/** تعليقٌ كُتب في المنصة — يُرسل إلى بطاقته إن كانت لها بطاقة. */
export async function pushComment(env, commentId) {
  try {
    const board = await readBoard(env);
    if (!board) return;
    const connection = await connectionOrNull(env);
    if (!connection) return;

    const comment = await env.DB.prepare(
      `SELECT c.*, p.bc_card_id FROM prospect_comments c JOIN prospects p ON p.id = c.prospect_id WHERE c.id = ?`,
    )
      .bind(commentId)
      .first();
    if (!comment || comment.bc_comment_id) return;
    /* بلا بطاقةٍ بعد: إرسالُ العميل نفسِه يُنشئها ويرسل تعليقاتِه معها. */
    if (!comment.bc_card_id) {
      await pushProspect(env, comment.prospect_id);
      return;
    }
    await sendComment(env, connection, board, comment.bc_card_id, comment);
  } catch (error) {
    console.error('Basecamp/prospects: تعذّر إرسال التعليق —', error?.code ?? error?.message ?? error);
    await recordError(env, error);
  }
}

/** عميلٌ محتملٌ صار عميلاً — بطاقتُه إلى عمود التحويل، وتعليقٌ يقول ذلك. */
export async function pushConversion(env, { cardId, clientName }) {
  if (!cardId) return;
  try {
    const board = await readBoard(env);
    if (!board) return;
    const connection = await connectionOrNull(env);
    if (!connection) return;

    const column = board.columnMap[CONVERTED];
    if (column) {
      await sendJson(connection.accountId, connection.token,
        `/buckets/${board.projectId}/card_tables/cards/${cardId}/moves.json`, { body: { column_id: Number(column) } });
    }
    await sendJson(connection.accountId, connection.token, commentsPath(board, cardId), {
      body: { content: `<div>تحوّل <strong>${escapeHtml(clientName ?? '')}</strong> إلى عميل في منصة ناف.</div>` },
    });
  } catch (error) {
    console.error('Basecamp/prospects: تعذّر نقل بطاقة التحويل —', error?.code ?? error?.message ?? error);
    await recordError(env, error);
  }
}

/* ═══ المطابقةُ الكاملة ═══ */

/**
 * يمرّ على اللوحة كلِّها وعلى العملاء المحتملين كلِّهم.
 *
 * تُنادى بعد الإعداد وكلَّ ساعة — احتياطاً لـWebhook سقط أو لم يُسجَّل.
 * والبطاقةُ التي لم تتبدّل ولم يُضف إليها تعليقٌ لا تُقرأ تعليقاتُها:
 * حدُّ النداءات أربعون كلَّ عشر ثوانٍ.
 */
export async function fullSync(env, connection, board) {
  const result = { cards: 0, created: 0, pushed: 0, conflicts: 0, errors: 0 };
  const table = await getJson(connection.accountId, connection.token,
    `/buckets/${board.projectId}/card_tables/${board.cardTableId}.json`);

  const seen = new Set();
  for (const list of table.lists ?? []) {
    if (!list.cards_url || statusForColumn(board, list.id) === CONVERTED) continue;
    const { items } = await listAll(connection.accountId, connection.token, list.cards_url);

    for (const card of items) {
      seen.add(String(card.id));
      result.cards++;
      const prospect = await readProspect(env, 'bc_card_id', String(card.id));
      /* لم يتبدّل شيء: لا نصّ ولا عمود ولا تعليق. */
      if (prospect && prospect.bc_updated_at === card.updated_at
        && String(prospect.bc_column_id) === String(card.parent?.id ?? list.id)) {
        const count = await env.DB.prepare(
          `SELECT COUNT(*) AS n FROM prospect_comments WHERE prospect_id = ? AND bc_comment_id IS NOT NULL`,
        ).bind(prospect.id).first();
        const pending = await env.DB.prepare(
          `SELECT COUNT(*) AS n FROM prospect_comments WHERE prospect_id = ? AND bc_comment_id IS NULL`,
        ).bind(prospect.id).first();
        /* وما تبدّل في المنصة يُعرف بالصورة لا بالوقت: الدمجُ نفسُه يكتب
           `updated_at`، والوقتُ يجعل كلَّ ساعةٍ تُعيد ما دُمج. */
        const snapshot = parse(prospect.bc_synced_values, {});
        const now = canonical(prospect);
        const changedLocally = SYNCED_FIELDS.some((field) => (now[field] ?? '') !== (snapshot[field] ?? ''));
        if ((count?.n ?? 0) === (card.comments_count ?? 0) && !(pending?.n) && !changedLocally) continue;
      }
      try {
        const outcome = await applyCard(env, connection, board, card.id, {
          card: { ...card, parent: card.parent ?? { id: list.id } },
        });
        if (!prospect && !outcome?.skipped) result.created++;
        result.conflicts += outcome?.conflicts ?? 0;
      } catch (error) {
        result.errors++;
        console.error('Basecamp/prospects: تعذّرت بطاقة', card.id, '—', error?.code ?? error?.message ?? error);
      }
    }
  }

  /* ما في المنصة بلا بطاقة: يُنشأ له. */
  const { results } = await env.DB.prepare(
    `SELECT * FROM prospects WHERE bc_card_id IS NULL AND archived_at IS NULL`,
  ).all();
  for (const prospect of results ?? []) {
    try {
      await pushRow(env, connection, board, prospect);
      result.pushed++;
    } catch (error) {
      result.errors++;
      console.error('Basecamp/prospects: تعذّر إنشاء بطاقة —', error?.code ?? error?.message ?? error);
    }
  }

  await markSynced(env);
  return result;
}

/** يُعلَّم ما سيُحذف قبل حذفه — ليُعرف بعده أنّ بطاقته لا تُعاد عميلاً. */
export async function rememberDeleted(env, ids) {
  const list = (ids ?? []).filter(Boolean);
  if (!list.length) return;
  const { results } = await env.DB.prepare(
    `SELECT bc_card_id FROM prospects WHERE bc_card_id IS NOT NULL AND id IN (${list.map(() => '?').join(', ')})`,
  )
    .bind(...list)
    .all();
  for (const row of results ?? []) {
    await env.DB.prepare(
      `INSERT INTO basecamp_prospect_tombstones (card_id, deleted_at) VALUES (?, ?) ON CONFLICT(card_id) DO NOTHING`,
    )
      .bind(row.bc_card_id, nowSeconds())
      .run();
  }
}

/** المزامنةُ الساعية — لا ترمي. */
export async function scheduledProspectSync(env) {
  try {
    const board = await readBoard(env);
    if (!board) return;
    const connection = await connectionOrNull(env);
    if (!connection) return;
    const result = await fullSync(env, connection, board);
    console.log('Basecamp/prospects:', JSON.stringify(result));
  } catch (error) {
    console.error('Basecamp/prospects/cron:', error?.code ?? error?.message ?? error);
    await recordError(env, error);
  }
}

export { FIELD_LABELS };
