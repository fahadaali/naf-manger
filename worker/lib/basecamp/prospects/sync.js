// العميلُ وبطاقتُه — دمجٌ في الاتّجاهين، للمحتملين وللفعليين.
//
// ═══ دالّةٌ واحدة لا اثنتان ═══
//
// «من المنصة إلى بيسكامب» و«من بيسكامب إلى المنصة» يمرّان بـ`reconcile`
// وحدها: تقرأ الطرفين والصورةَ المحفوظة، وتكتب في كلِّ طرفٍ ما تبدّل في
// الآخر. فحفظٌ في المنصة لا يدهس ما كُتب في البطاقة قبل أن يصل، ونداءُ
// Webhook يعود بما كتبناه نحن فلا يجد ما يكتبه — والحلقةُ تنتهي من نفسها.
//
// والنوعُ (`entities.js`) معاملٌ في كل دالّة: جدولُه وعمودُ حالته وحقولُ وصفه
// وجدولُ تعليقاته. والدمجُ والاستخراجُ واحدٌ للنوعين.
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
  readBoard,
  readBoards,
  recordError,
  statusesOf,
  statusForColumn,
} from './board.js';
import { canonical, FIELD_LABELS, parseCard, renderCard } from './card-format.js';
import { KINDS, entity, syncedFields } from './entities.js';
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

/* أعمدةٌ لا تقبل الفراغ — قيمةٌ فارغةٌ من البطاقة لا تمحو اسماً ولا حالة. */
const NEVER_EMPTY = new Set(['fullName', 'prospectStatus', 'status', 'clientType']);
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
   «أُنشئت بطاقة» — فلا يجد صفّاً يحمل الرقم، فيُنشئ صفّاً ثانياً. فيُعلَّم
   الاسمُ قبل الإنشاء ويُترك الـWebhook له. */
const creatingKey = (kind, title) => `bcp:creating:${kind}:${normalizeArabic(title)}`;

const cardPath = (board, cardId) => `/buckets/${board.projectId}/card_tables/cards/${cardId}.json`;
const commentsPath = (board, cardId) => `/buckets/${board.projectId}/recordings/${cardId}/comments.json`;

async function connectionOrNull(env) {
  const connection = await activeConnection(env);
  return connection.error ? null : connection;
}

async function readRow(env, spec, where, value) {
  return env.DB.prepare(`SELECT * FROM ${spec.table} WHERE ${where} = ?`).bind(value).first();
}

/** قيمُ البطاقة موحَّدةً: الاسمُ من العنوان، والحالةُ من العمود، والباقي من الوصف. */
function cardValues(spec, board, card) {
  const parsed = parseCard(card.content ?? '');
  const values = { ...parsed.values };
  if (card.title?.trim()) values.fullName = card.title.trim();

  /* عمودٌ لا يقابل حالة (صندوقُ الوارد، أو التحويل) لا يقول شيئاً عن الحالة. */
  const status = statusForColumn(board, card.parent?.id);
  if (status && status !== CONVERTED) values[spec.statusField] = status;

  /* و`due_on` موعدُ المتابعة إن لم يُكتب في الوصف — للمحتمل وحده. */
  if (spec.columns.followUpDate && !values.followUpDate && card.due_on) {
    values.followUpDate = String(card.due_on).slice(0, 10);
  }

  return { values, structured: parsed.structured, text: parsed.text };
}

/** يفتح اختلافاً — مرّةً لكلّ (صفٍّ + حقل)، ويُحدّث قيمتيه إن عاد. */
async function openConflict(env, spec, board, rowId, field, platformValue, basecampValue) {
  const name = `${spec.conflictPrefix}${field}`;
  const open = await env.DB.prepare(
    `SELECT id FROM basecamp_conflicts WHERE ${spec.conflictKey} = ? AND field = ? AND resolved_at IS NULL`,
  )
    .bind(rowId, name)
    .first();

  if (open) {
    await env.DB.prepare(`UPDATE basecamp_conflicts SET platform_value = ?, basecamp_value = ? WHERE id = ?`)
      .bind(platformValue, basecampValue, open.id)
      .run();
    return;
  }

  await env.DB.prepare(
    `INSERT INTO basecamp_conflicts
       (id, project_id, case_id, ${spec.conflictKey}, field, platform_value, basecamp_value, detected_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), board.projectId, rowId, name, platformValue, basecampValue, nowSeconds())
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
 * يدمج صفّاً ببطاقته، ويكتب في كلِّ طرفٍ ما تبدّل في الآخر.
 *
 * `card` البطاقةُ كما قُرئت للتوّ. ويردّ ما وقع: `{ platform, basecamp, conflicts }`.
 */
export async function reconcile(env, connection, board, row, card) {
  const spec = entity(board.kind);
  const fields = syncedFields(spec);
  const platform = canonical(row);
  const { values: remote } = cardValues(spec, board, card);
  const base = parse(row.bc_synced_values, null);

  const snapshot = {};
  const platformWrites = {};
  const desired = {};
  let conflicts = 0;

  for (const field of fields) {
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
      await openConflict(env, spec, board, row.id, field, p, r ?? '');
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
  const written = await writeRow(env, spec, row.id, platformWrites);
  /* حقلٌ رفضته القاعدة (هويةٌ لصفٍّ آخر) لا يُحفظ في الصورة — فيُعاد السؤال. */
  for (const field of written.rejected) {
    snapshot[field] = base?.[field] ?? '';
    desired[field] = platform[field] ?? '';
  }

  /* ═══ الكتابةُ في البطاقة ═══
     يُقارَن الوصفُ المطلوب بالوصف القائم بالقيم لا بالنصّ: بيسكامب تُعيد
     صياغةَ HTML بعد الحفظ، ومقارنةُ النصّ تجعل كلَّ دمجٍ يكتب. */
  const remoteNow = cardValues(spec, board, card);
  const cardDiffers = !remoteNow.structured
    || desired.fullName !== (remoteNow.values.fullName ?? '')
    || [...spec.cardFields.map(([field]) => field), 'notes']
      .some((field) => (desired[field] ?? '') !== (remoteNow.values[field] ?? ''));

  let basecampWrites = 0;
  if (cardDiffers) {
    await sendJson(connection.accountId, connection.token, cardPath(board, card.id), {
      method: 'PUT',
      body: renderCard(desired, spec.cardFields, spec.defaultName),
    });
    basecampWrites++;
  }

  const targetColumn = columnForStatus(board, desired[spec.statusField]);
  const currentStatus = statusForColumn(board, card.parent?.id);
  /* البطاقةُ في عمود التحويل لا تُعاد منه. */
  if (targetColumn && String(card.parent?.id) !== String(targetColumn) && currentStatus !== CONVERTED) {
    await sendJson(connection.accountId, connection.token, `/buckets/${board.projectId}/card_tables/cards/${card.id}/moves.json`, {
      body: { column_id: Number(targetColumn) },
    });
    basecampWrites++;
  }

  await env.DB.prepare(
    `UPDATE ${spec.table}
     SET bc_card_id = ?, bc_column_id = ?, bc_app_url = ?, bc_synced_values = ?, bc_updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      String(card.id),
      targetColumn ?? String(card.parent?.id ?? ''),
      card.app_url ?? null,
      JSON.stringify(snapshot),
      card.updated_at ?? null,
      row.id,
    )
    .run();

  return { platform: Object.keys(written.applied).length, basecamp: basecampWrites, conflicts };
}

/** يكتب حقولاً في الصفّ — حقلاً حقلاً، فرفضُ واحدٍ لا يُسقط الباقي. */
async function writeRow(env, spec, id, writes) {
  const applied = {};
  const rejected = [];
  const now = nowSeconds();

  for (const [field, value] of Object.entries(writes)) {
    const column = spec.columns[field];
    if (!column) continue;
    try {
      await env.DB.prepare(`UPDATE ${spec.table} SET ${column} = ?, updated_at = ? WHERE id = ?`)
        .bind(columnValue(field, value), now, id)
        .run();
      applied[field] = value;
    } catch (error) {
      /* `id_number` فريد — هويةٌ قُرئت من البطاقة لصفٍّ آخر لا تُكتب. */
      console.warn(`Basecamp/${spec.kind}: رُفض الحقل`, field, '—', error?.message ?? error);
      rejected.push(field);
    }
  }
  return { applied, rejected };
}

/* ═══ التعليقات ═══ */

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
export async function syncComments(env, connection, board, rowId, cardId) {
  const spec = entity(board.kind);
  const { items } = await listAll(connection.accountId, connection.token, commentsPath(board, cardId));

  const { results } = await env.DB.prepare(`SELECT * FROM ${spec.commentsTable} WHERE ${spec.commentKey} = ?`)
    .bind(rowId)
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
        await env.DB.prepare(`UPDATE ${spec.commentsTable} SET body = ?, updated_at = ? WHERE id = ?`)
          .bind(body, nowSeconds(), known.id)
          .run();
      }
      continue;
    }

    /* تعليقٌ أرسلته المنصة للتوّ ولم يُحفظ رقمُه بعد: يُربط ولا يُنسخ. */
    const pending = local.find((c) => !c.bc_comment_id && c.source === 'platform'
      && body.includes(String(c.body).split('\n')[0].trim()));
    if (pending) {
      await env.DB.prepare(`UPDATE ${spec.commentsTable} SET bc_comment_id = ? WHERE id = ?`).bind(id, pending.id).run();
      pending.bc_comment_id = id;
      continue;
    }

    const at = Math.floor(Date.parse(remote.created_at ?? '') / 1000) || nowSeconds();
    await env.DB.prepare(
      `INSERT INTO ${spec.commentsTable}
         (id, ${spec.commentKey}, body, author_name, author_user_id, source, bc_comment_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, 'basecamp', ?, ?, ?)
       ON CONFLICT(bc_comment_id) DO NOTHING`,
    )
      .bind(crypto.randomUUID(), rowId, body, remote.creator?.name ?? '', id, at, at)
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
  const spec = entity(board.kind);
  const created = await sendJson(connection.accountId, connection.token, commentsPath(board, cardId), {
    body: { content: renderComment(comment) },
  });
  if (created?.id) {
    await env.DB.prepare(`UPDATE ${spec.commentsTable} SET bc_comment_id = ? WHERE id = ? AND bc_comment_id IS NULL`)
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
async function fillFromText(env, spec, row, text) {
  const platform = canonical(row);
  const missing = spec.cardFields.map(([field]) => field)
    .filter((field) => field !== 'clientType' && field !== 'idType' && !platform[field]);
  /* ونوعُ العميل له افتراضٌ في القاعدة (`individual`) — فلا يُعرف أنه «فارغ».
     يُسأل عنه ما دام لم يُكتب في البطاقة صراحةً. */
  if (!row.bc_synced_values) missing.push('clientType');
  if (!missing.length) return {};

  const found = await extractProspect(env, { text, missing });
  if (Object.keys(found).length) await writeRow(env, spec, row.id, found);
  return found;
}

/* ═══ من بيسكامب ═══ */

const isDeleted = async (env, cardId) => Boolean(await env.DB.prepare(
  `SELECT 1 AS x FROM basecamp_prospect_tombstones WHERE card_id = ?`,
).bind(String(cardId)).first());

/**
 * بطاقةٌ تبدّلت في بيسكامب — تُقرأ وتُدمج.
 *
 * والبطاقةُ تُقرأ من الواجهة لا من جسم الـWebhook: الجسمُ يقول «تبدّل شيء»،
 * والحالُ يُعرف من مصدره.
 */
export async function applyCard(env, connection, board, cardId, { card: given } = {}) {
  const spec = entity(board.kind);
  const card = given ?? await getJson(connection.accountId, connection.token, cardPath(board, cardId));
  if (String(card.bucket?.id ?? board.projectId) !== String(board.projectId)) return { skipped: 'other_project' };
  if (card.status && card.status !== 'active') return { skipped: 'inactive' };

  let row = await readRow(env, spec, 'bc_card_id', String(card.id));

  if (!row) {
    /* بطاقةُ من حُذف في المنصة، أو محتملٍ صار عميلاً — لا يُعاد. */
    if (await isDeleted(env, card.id)) return { skipped: 'deleted' };
    /* وبطاقةٌ مربوطةٌ بالنوع الآخر — لوحةٌ رُبطت خطأً ثم صُحّحت — لا تُستورد مرّتين. */
    for (const other of KINDS.filter((kind) => kind !== spec.kind)) {
      if (await readRow(env, entity(other), 'bc_card_id', String(card.id))) return { skipped: 'linked_elsewhere' };
    }
    /* والمنصةُ تُنشئ هذه البطاقة الآن — ويُترك ربطُها لها. */
    if (await env.AUTH_KV?.get(creatingKey(spec.kind, card.title ?? ''))) return { skipped: 'creating' };
    /* وعمودُ التحويل ليس بابَ دخول. */
    if (statusForColumn(board, card.parent?.id) === CONVERTED) return { skipped: 'converted_column' };

    row = await createFromCard(env, connection, board, card);
  }

  const fresh = await syncComments(env, connection, board, row.id, card.id);

  /* تعليقٌ جديدٌ في بيسكامب قد يحمل ما ينقص الملفّ: جوّالاً أو بريداً. */
  if (fresh.length) {
    await fillFromText(env, spec, row, fresh.join('\n\n'));
    row = await readRow(env, spec, 'id', row.id);
  }

  return reconcile(env, connection, board, row, card);
}

/** صفٌّ جديد من بطاقةٍ أُنشئت في بيسكامب. */
async function createFromCard(env, connection, board, card) {
  const spec = entity(board.kind);
  const { values, structured, text } = cardValues(spec, board, card);
  const statuses = await statusesOf(env, spec.kind);
  const id = crypto.randomUUID();
  const now = nowSeconds();

  /* ═══ نصٌّ حرّ ═══
     ما كتبه الإنسانُ يُحفظ كلُّه ملاحظةً — فلا يضيع منه شيءٌ حين تُعاد كتابةُ
     البطاقة بالصيغة. ثم يُسأل الطرازُ عن الحقول في النصّ وتعليقاته. */
  if (!structured && text && !values.notes) values.notes = text;

  const data = {
    id,
    full_name: values.fullName || spec.defaultName,
    [spec.columns[spec.statusField]]: values[spec.statusField] || statuses[0] || spec.fallbackStatus,
    phone: '',
    email: '',
    notes: '',
    client_type: 'individual',
    bc_card_id: String(card.id),
    bc_column_id: String(card.parent?.id ?? ''),
    bc_app_url: card.app_url ?? null,
    created_at: now,
    updated_at: now,
  };
  for (const [field] of spec.cardFields) {
    if (values[field]) data[spec.columns[field]] = columnValue(field, values[field]);
  }
  if (values.notes) data.notes = values.notes;

  const insert = async (row) => {
    const columns = Object.keys(row).filter((column) => row[column] !== null && row[column] !== undefined);
    await env.DB.prepare(
      `INSERT INTO ${spec.table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    )
      .bind(...columns.map((column) => row[column]))
      .run();
  };

  try {
    await insert(data);
  } catch (error) {
    /* هويةٌ مكتوبةٌ في البطاقة لصفٍّ آخر: يُنشأ بدونها. */
    if (!String(error?.message ?? '').includes('id_number')) throw error;
    await insert({ ...data, id_number: null });
  }

  let row = await readRow(env, spec, 'id', id);

  /* الحقولُ تُستخرج من النصّ الحرّ وتعليقاته — والقاعدةُ سبقت، فما قرأته لا يُسأل عنه. */
  const { items } = await listAll(connection.accountId, connection.token, commentsPath(board, card.id)).catch(() => ({ items: [] }));
  const comments = items.map((c) => htmlToText(c.content ?? '')).join('\n\n');
  const textForAi = [structured ? '' : text, comments].filter(Boolean).join('\n\n');
  if (textForAi) {
    await fillFromText(env, spec, { ...row, bc_synced_values: structured ? '{}' : null }, `${card.title ?? ''}\n${textForAi}`);
    row = await readRow(env, spec, 'id', id);
  }

  await logActivity(env, { id: 'basecamp', name: 'بيسكامب' }, {
    resource: spec.resource,
    action: 'create',
    row: { id, fullName: row.full_name },
  }).catch(() => {});

  return row;
}

/* ═══ من المنصة ═══ */

/**
 * صفٌّ حُفظ في المنصة — يُنشأ له بطاقة أو تُدمج بطاقتُه.
 *
 * لا ترمي: تُنادى بعد الردّ (`waitUntil`) ولا مستمعَ لخطئها. فيُقيَّد السبب
 * في صفّ اللوحة، وتُعيد المزامنةُ الساعيةُ المحاولة.
 */
export async function pushRecord(env, kind, rowId) {
  try {
    const board = await readBoard(env, kind);
    if (!board) return null;
    const connection = await connectionOrNull(env);
    if (!connection) return null;

    const row = await readRow(env, entity(kind), 'id', rowId);
    if (!row) return null;
    return await pushRow(env, connection, board, row);
  } catch (error) {
    console.error(`Basecamp/${kind}: تعذّر الإرسال —`, error?.code ?? error?.message ?? error);
    await recordError(env, kind, error);
    return null;
  }
}

export const pushProspect = (env, id) => pushRecord(env, 'prospects', id);
export const pushClient = (env, id) => pushRecord(env, 'clients', id);

async function pushRow(env, connection, board, row) {
  const spec = entity(board.kind);
  if (row.bc_card_id) {
    const card = await getJson(connection.accountId, connection.token, cardPath(board, row.bc_card_id));
    /* بطاقةٌ حُذفت أو أُرشفت في بيسكامب: لا تُكتب، ولا يُحذف الصفّ. */
    if (card.status && card.status !== 'active') return { skipped: 'inactive' };
    await syncComments(env, connection, board, row.id, card.id);
    return reconcile(env, connection, board, row, card);
  }

  /* المؤرشَفُ لا تُنشأ له بطاقة. */
  if (row.archived_at) return null;

  const values = canonical(row);
  const firstColumn = Object.entries(board.columnMap).find(([key]) => !key.startsWith('__'))?.[1];
  const column = columnForStatus(board, values[spec.statusField]) ?? firstColumn;
  if (!column) return null;

  const key = creatingKey(spec.kind, values.fullName || spec.defaultName);
  await env.AUTH_KV?.put(key, '1', { expirationTtl: 120 });
  try {
    const card = await sendJson(connection.accountId, connection.token,
      `/buckets/${board.projectId}/card_tables/lists/${column}/cards.json`,
      { body: renderCard(values, spec.cardFields, spec.defaultName) });

    await env.DB.prepare(
      `UPDATE ${spec.table}
       SET bc_card_id = ?, bc_column_id = ?, bc_app_url = ?, bc_synced_values = ?, bc_updated_at = ?
       WHERE id = ?`,
    )
      .bind(String(card.id), String(column), card.app_url ?? null, JSON.stringify(values), card.updated_at ?? null, row.id)
      .run();

    await syncComments(env, connection, board, row.id, card.id);
    return { created: true, card };
  } finally {
    await env.AUTH_KV?.delete(key);
  }
}

/** تعليقٌ كُتب في المنصة — يُرسل إلى بطاقة صاحبه إن كانت له بطاقة. */
export async function pushComment(env, kind, commentId) {
  const spec = entity(kind);
  try {
    const board = await readBoard(env, kind);
    if (!board) return;
    const connection = await connectionOrNull(env);
    if (!connection) return;

    const comment = await env.DB.prepare(
      `SELECT c.*, p.bc_card_id FROM ${spec.commentsTable} c
       JOIN ${spec.table} p ON p.id = c.${spec.commentKey} WHERE c.id = ?`,
    )
      .bind(commentId)
      .first();
    if (!comment || comment.bc_comment_id) return;
    /* بلا بطاقةٍ بعد: إرسالُ الصفّ نفسِه يُنشئها ويرسل تعليقاتِه معها. */
    if (!comment.bc_card_id) {
      await pushRecord(env, kind, comment[spec.commentKey]);
      return;
    }
    await sendComment(env, connection, board, comment.bc_card_id, comment);
  } catch (error) {
    console.error(`Basecamp/${kind}: تعذّر إرسال التعليق —`, error?.code ?? error?.message ?? error);
    await recordError(env, kind, error);
  }
}

/* ═══ التحويل ═══ */

/**
 * ما يُحفظ قبل حذف المحتمل: تعليقاتُه تنتقل إلى العميل، وبطاقتُه تُعلَّم فلا
 * تُعيدها المزامنةُ عميلاً محتملاً. ويُنادى بعد إنشاء العميل وقبل ردّ التحويل.
 */
export async function carryConversion(env, { prospectCardId, comments, clientId }) {
  for (const comment of comments ?? []) {
    await env.DB.prepare(
      `INSERT INTO client_comments
         (id, client_id, body, author_name, author_user_id, source, bc_comment_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(bc_comment_id) DO NOTHING`,
    )
      /* ورقمُ التعليق في بيسكامب يبقى: هو تعليقٌ على بطاقة المحتمل، ومعه
         يُعرف أنه أُرسل — فلا يُعاد نشرُه على بطاقة العميل. */
      .bind(crypto.randomUUID(), clientId, comment.body, comment.author_name ?? '', comment.author_user_id ?? null,
        comment.source, comment.bc_comment_id ?? null, comment.created_at, comment.updated_at ?? comment.created_at)
      .run();
  }
  if (prospectCardId) {
    await env.DB.prepare(
      `INSERT INTO basecamp_prospect_tombstones (card_id, deleted_at) VALUES (?, ?) ON CONFLICT(card_id) DO NOTHING`,
    )
      .bind(String(prospectCardId), nowSeconds())
      .run();
  }
}

/**
 * محتملٌ صار عميلاً — بطاقةٌ له في لوحة العملاء، وبطاقتُه القديمة إلى عمود
 * التحويل وعليها تعليقٌ برابط الجديدة. والقديمةُ تبقى: سجلُّ رحلته.
 */
export async function pushConversion(env, { prospectCardId, clientId, clientName }) {
  let clientCard = null;
  if (clientId) {
    const pushed = await pushClient(env, clientId);
    clientCard = pushed?.card ?? null;
    if (!clientCard) {
      const client = await env.DB.prepare(`SELECT bc_app_url FROM clients WHERE id = ?`).bind(clientId).first();
      if (client?.bc_app_url) clientCard = { app_url: client.bc_app_url };
    }
  }
  if (!prospectCardId) return;

  try {
    const board = await readBoard(env, 'prospects');
    if (!board) return;
    const connection = await connectionOrNull(env);
    if (!connection) return;

    const column = board.columnMap[CONVERTED];
    if (column) {
      await sendJson(connection.accountId, connection.token,
        `/buckets/${board.projectId}/card_tables/cards/${prospectCardId}/moves.json`, { body: { column_id: Number(column) } });
    }
    const link = clientCard?.app_url
      ? ` — <a href="${escapeHtml(clientCard.app_url)}">بطاقتُه في العملاء الفعليين</a>`
      : '';
    await sendJson(connection.accountId, connection.token, commentsPath(board, prospectCardId), {
      body: { content: `<div>تحوّل <strong>${escapeHtml(clientName ?? '')}</strong> إلى عميل في منصة ناف${link}.</div>` },
    });
  } catch (error) {
    console.error('Basecamp/prospects: تعذّر نقل بطاقة التحويل —', error?.code ?? error?.message ?? error);
    await recordError(env, 'prospects', error);
  }
}

/* ═══ المطابقةُ الكاملة ═══ */

/**
 * يمرّ على لوحةٍ كلِّها وعلى صفوف نوعها كلِّها.
 *
 * تُنادى بعد الإعداد وكلَّ ساعة — احتياطاً لـWebhook سقط أو لم يُسجَّل.
 * والبطاقةُ التي لم تتبدّل ولم يُضف إليها تعليقٌ لا تُقرأ تعليقاتُها:
 * حدُّ النداءات أربعون كلَّ عشر ثوانٍ.
 */
export async function fullSync(env, connection, board) {
  const spec = entity(board.kind);
  const fields = syncedFields(spec);
  const result = { cards: 0, created: 0, pushed: 0, conflicts: 0, errors: 0 };
  const table = await getJson(connection.accountId, connection.token,
    `/buckets/${board.projectId}/card_tables/${board.cardTableId}.json`);

  for (const list of table.lists ?? []) {
    if (!list.cards_url || statusForColumn(board, list.id) === CONVERTED) continue;
    const { items } = await listAll(connection.accountId, connection.token, list.cards_url);

    for (const card of items) {
      result.cards++;
      const row = await readRow(env, spec, 'bc_card_id', String(card.id));
      /* لم يتبدّل شيء: لا نصّ ولا عمود ولا تعليق. */
      if (row && row.bc_updated_at === card.updated_at
        && String(row.bc_column_id) === String(card.parent?.id ?? list.id)) {
        const count = await env.DB.prepare(
          `SELECT COUNT(*) AS n FROM ${spec.commentsTable} WHERE ${spec.commentKey} = ? AND bc_comment_id IS NOT NULL`,
        ).bind(row.id).first();
        const pending = await env.DB.prepare(
          `SELECT COUNT(*) AS n FROM ${spec.commentsTable} WHERE ${spec.commentKey} = ? AND bc_comment_id IS NULL`,
        ).bind(row.id).first();
        /* وما تبدّل في المنصة يُعرف بالصورة لا بالوقت: الدمجُ نفسُه يكتب
           `updated_at`، والوقتُ يجعل كلَّ ساعةٍ تُعيد ما دُمج. */
        const snapshot = parse(row.bc_synced_values, {});
        const now = canonical(row);
        const changedLocally = fields.some((field) => (now[field] ?? '') !== (snapshot[field] ?? ''));
        if ((count?.n ?? 0) === (card.comments_count ?? 0) && !(pending?.n) && !changedLocally) continue;
      }
      try {
        const outcome = await applyCard(env, connection, board, card.id, {
          card: { ...card, parent: card.parent ?? { id: list.id } },
        });
        if (!row && !outcome?.skipped) result.created++;
        result.conflicts += outcome?.conflicts ?? 0;
      } catch (error) {
        result.errors++;
        console.error(`Basecamp/${spec.kind}: تعذّرت بطاقة`, card.id, '—', error?.code ?? error?.message ?? error);
      }
    }
  }

  /* ما في المنصة بلا بطاقة: يُنشأ له. */
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${spec.table} WHERE bc_card_id IS NULL AND archived_at IS NULL`,
  ).all();
  for (const row of results ?? []) {
    try {
      await pushRow(env, connection, board, row);
      result.pushed++;
    } catch (error) {
      result.errors++;
      console.error(`Basecamp/${spec.kind}: تعذّر إنشاء بطاقة —`, error?.code ?? error?.message ?? error);
    }
  }

  await markSynced(env, spec.kind);
  return result;
}

/** يُعلَّم ما سيُحذف قبل حذفه — ليُعرف بعده أنّ بطاقته لا تُعيده. */
export async function rememberDeleted(env, ids, kind = 'prospects') {
  const spec = entity(kind);
  const list = (ids ?? []).filter(Boolean);
  if (!list.length) return;
  const { results } = await env.DB.prepare(
    `SELECT bc_card_id FROM ${spec.table} WHERE bc_card_id IS NOT NULL AND id IN (${list.map(() => '?').join(', ')})`,
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

/** المزامنةُ الساعية — للوحات كلِّها، ولا ترمي. */
export async function scheduledProspectSync(env) {
  let boards = [];
  try {
    boards = await readBoards(env);
    if (!boards.length) return;
  } catch (error) {
    console.error('Basecamp/boards/cron:', error?.message ?? error);
    return;
  }
  const connection = await connectionOrNull(env).catch(() => null);
  if (!connection) return;

  for (const board of boards) {
    try {
      const result = await fullSync(env, connection, board);
      console.log(`Basecamp/${board.kind}:`, JSON.stringify(result));
    } catch (error) {
      console.error(`Basecamp/${board.kind}/cron:`, error?.code ?? error?.message ?? error);
      await recordError(env, board.kind, error);
    }
  }
}

export { FIELD_LABELS };
