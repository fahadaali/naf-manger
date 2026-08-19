// عملياتُ الموارد — قراءةً وكتابةً — ومعها الحارس.
//
// ═══ هذا هو موضع الحراسة كلِّها ═══
//
// D1 لا تحرس صفّاً: تنفّذ ما يصلها ولا تعرف من ناداها. فمن يقرأ ومن يكتب
// ومن يحذف يُقرَّر هنا، في **دالّة واحدة** يمرّ بها كل مسار. ولم
// تُفرَّق على المسارات: مسارٌ يُنسى حارسُه يفتح جدولَه لكل عضو مهما كان
// دورُه، ويفشل فشلاً صامتاً — لا خطأ، ولا سطر في سجلّ، وإنما موظّفٌ يقرأ
// ما ليس له.

import { RESOURCES, orderOf, toClient, toRow } from './resources.js';
import { logActivity } from './activity.js';

const json = (body, status = 200) => Response.json(body, { status });
const fail = (error, status) => json({ ok: false, error }, status);

/** فعلُ كل طريقة. `convert` فعلٌ خاص يُطلب صراحةً. */
const ACTION = { GET: 'read', POST: 'create', PATCH: 'update', PUT: 'update', DELETE: 'delete' };

/**
 * أيملك هذا العضو هذا الفعل على هذا المورد؟
 *
 * `permission: null` يعني «كلُّ عضوٍ مفعَّل» — وهو سجلُّ الأنشطة وحده،
 * لأنه أثرٌ لا محتوى.
 */
export function may(user, resource, action) {
  if (!resource.permission) return true;
  const granted = user.permissions?.[resource.permission];
  return Boolean(granted && granted[action]);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/** معرّفٌ عشوائي بالكامل — لا يُشتقّ من محتوى الصفّ ولا يُعدّ. */
function newId() {
  return crypto.randomUUID();
}

export async function listRows(env, resource) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${resource.table} ORDER BY ${orderOf(resource)}`,
  ).all();
  return (results ?? []).map((row) => toClient(resource, row));
}

export async function getRow(env, resource, id) {
  const row = await env.DB.prepare(`SELECT * FROM ${resource.table} WHERE id = ?`)
    .bind(id)
    .first();
  return toClient(resource, row);
}

export async function createRow(env, resource, body, user) {
  const row = { ...(resource.defaults ?? {}), ...toRow(resource, body) };
  const now = nowSeconds();

  row.id = newId();
  row.created_at = now;
  if (resource.timestamps !== 'created') row.updated_at = now;

  /* ═══ عمودُ الفاعل يُختم من الجلسة لا من الجسم ═══

     `commission_payments.created_by` عمودٌ `NOT NULL` بلا افتراض، ولم يكن
     أحدٌ يملؤه — لا الشاشة ولا هنا. فكان كلُّ تسجيلِ عمولةٍ يسقط بقيدِ
     `NOT NULL`، ويُترجمه `constraintError` إلى `missing_field` — رسالةٌ
     تُرسل صاحبَها يبحث عن حقلٍ ناقصٍ في نموذجٍ ممتلئ. والميزة لم تعمل قطّ.

     ويُختم من `user.id` لا من الجسم حتى لو أرسله: «من سجّل هذه العمولة»
     شهادةٌ على عضو، ومن كتبها بيده نسبها إلى غيره. */
  if (resource.actor) row[resource.actor] = user?.id ?? null;

  for (const column of resource.required ?? []) {
    if (row[column] === undefined || row[column] === null || row[column] === '') {
      return { error: 'missing_field', status: 400 };
    }
  }

  /* ═══ العمودُ الغائب يأخذ افتراضَه ═══

     الإدراجُ يُسقط ما قيمتُه `null` بدل أن يكتبه صراحةً. فعمودٌ له افتراضٌ
     في المخطَّط — `join_date` تاريخُ اليوم، و`attachments` قائمةٌ فارغة —
     يأخذه بدل أن يُدهس بـ`NULL` فيسقط بقيد `NOT NULL`.

     وما كان لازماً فعلاً أُمسك قبل هذا السطر في فحص `required`، برسالةٍ
     تسمّي الحقل. فالإسقاط هنا لا يخفي نقصاً. */
  for (const [column, value] of Object.entries(row)) {
    if (value === null) delete row[column];
  }

  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');

  try {
    await env.DB.prepare(
      `INSERT INTO ${resource.table} (${columns.join(', ')}) VALUES (${placeholders})`,
    )
      .bind(...columns.map((c) => row[c]))
      .run();
  } catch (err) {
    return constraintError(err);
  }

  return { data: await getRow(env, resource, row.id) };
}

export async function updateRow(env, resource, id, body) {
  const row = toRow(resource, body);
  if (resource.timestamps !== 'created') row.updated_at = nowSeconds();

  const columns = Object.keys(row);
  if (!columns.length) return { error: 'empty_update', status: 400 };

  const assignments = columns.map((c) => `${c} = ?`).join(', ');

  let result;
  try {
    result = await env.DB.prepare(`UPDATE ${resource.table} SET ${assignments} WHERE id = ?`)
      .bind(...columns.map((c) => row[c]), id)
      .run();
  } catch (err) {
    return constraintError(err);
  }

  /* صفٌّ لم يُصب يعني معرّفاً لا وجود له — ٤٠٤ لا ٢٠٠ بجسمٍ فارغ، وإلا
     قرأت الشاشةُ نجاحاً حيث لم يقع شيء. */
  if (!result.meta?.changes) return { error: 'not_found', status: 404 };

  return { data: await getRow(env, resource, id) };
}

export async function deleteRow(env, resource, id) {
  const result = await env.DB.prepare(`DELETE FROM ${resource.table} WHERE id = ?`)
    .bind(id)
    .run();
  if (!result.meta?.changes) return { error: 'not_found', status: 404 };
  return { data: { ok: true } };
}

/* ═══ عملياتٌ على جملةِ صفوف ═══
 *
 * خمسون عميلاً يُؤرشفون بخمسين نداءً: بطيءٌ على من ينتظر، وأسوأُ منه أنّ
 * انقطاعاً في المنتصف يترك نصفَهم مؤرشفاً ونصفَهم لا — ولا أحد يعرف أين
 * وقف. فبيانٌ واحد لكلّ فعل، والدفعةُ في معاملةٍ عند D1: تقع كلُّها أو
 * لا يقع منها شيء.
 *
 * والحدُّ خمسُمئة: أطولُ من ذلك يبني نصَّ استعلامٍ بخمسمئة علامة، وليس في
 * شاشةٍ يُحدَّد فيها باليد ما يبلغه.
 */
const BULK_LIMIT = 500;

/** الفعلُ الجماعي وتصريحُه: الحذفُ حذفٌ، والأرشفةُ تعديل. */
const BULK_ACTIONS = {
  delete: 'delete',
  archive: 'update',
  restore: 'update',
};

export async function bulkRows(env, resource, body, user) {
  const action = String(body?.action ?? '');
  const permission = BULK_ACTIONS[action];
  if (!permission) return { error: 'unknown_action', status: 400 };
  if (!may(user, resource, permission)) return { error: 'forbidden', status: 403 };

  /* والأرشفةُ لا تُطلب من موردٍ بلا عمودها — المسوّقون والعمولات. ولولا
     هذا لبنى الاستعلامُ عموداً غيرَ موجود فسقط بخطأ SQL خام. */
  if (action !== 'delete' && !resource.fields.archivedAt) {
    return { error: 'not_archivable', status: 400 };
  }

  /* ما ليس نصّاً يُطرح قبل أن يبلغ الاستعلام: قائمةٌ فيها `null` تبني
     `IN (?, ?)` بربطٍ فارغ فتصيب ما لم يُقصد. */
  const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : []).filter(
    (id) => typeof id === 'string' && id,
  ))];
  if (!ids.length) return { error: 'no_rows', status: 400 };
  if (ids.length > BULK_LIMIT) return { error: 'too_many_rows', status: 400 };

  const holes = ids.map(() => '?').join(', ');
  const now = nowSeconds();

  let statement;
  if (action === 'delete') {
    statement = env.DB.prepare(`DELETE FROM ${resource.table} WHERE id IN (${holes})`).bind(...ids);
  } else {
    const stamp = action === 'archive' ? now : null;
    statement = env.DB.prepare(
      `UPDATE ${resource.table} SET archived_at = ?, updated_at = ? WHERE id IN (${holes})`,
    ).bind(stamp, now, ...ids);
  }

  let result;
  try {
    [result] = await env.DB.batch([statement]);
  } catch (err) {
    return constraintError(err);
  }

  /* ولا ٤٠٤ حين لا يُصاب شيء: الشاشةُ حدّدت صفوفاً حذفها غيرُها قبلها،
     وهذا ليس خطأً — الحالةُ المطلوبة قائمة. يُقال العددُ ويُترك الحكم. */
  return { data: { affected: result?.meta?.changes ?? 0, requested: ids.length } };
}

/* تفرّدُ `id_number` و`case_number` مضمونٌ في المخطّط. ورسالةُ SQLite
   تُترجم رمزاً معروفاً، فتقول الشاشةُ «مسجَّل من قبل» بدل «خطأ في النظام». */
function constraintError(err) {
  const text = String(err?.message ?? '');
  if (/UNIQUE constraint/i.test(text)) return { error: 'duplicate', status: 409 };
  if (/FOREIGN KEY constraint/i.test(text)) return { error: 'invalid_reference', status: 409 };
  if (/NOT NULL constraint/i.test(text)) return { error: 'missing_field', status: 400 };
  throw err;
}

/**
 * موجِّهُ الموارد.
 *
 * `‎/api/{resource}` و`‎/api/{resource}/{id}` لا أكثر. والأفعالُ الخاصة —
 * التحويل والإحصاءات — تُعالَج قبل النداء عليه.
 */
export async function handleResource(request, env, user, name, id) {
  const resource = RESOURCES[name];
  if (!resource) return fail('not_found', 404);

  const action = ACTION[request.method];
  if (!action) return fail('method_not_allowed', 405);

  /* ═══ الدفعةُ تُلتقط قبل الحارس العام ═══
     فعلُها ليس `create` وإن كانت `POST`: أرشفةٌ تعديل، وحذفٌ حذف. ولو مرّت
     على الحارس العام لطُلب لمن يؤرشف تصريحُ الإنشاء — ولمنعتْ من يحذف
     ولا يُنشئ. و`bulkRows` تسأل عن تصريح فعلِها بعينه. */
  if (request.method === 'POST' && id === 'bulk') {
    let body;
    try {
      body = await request.json();
    } catch {
      return fail('invalid_body', 400);
    }
    const bulk = await bulkRows(env, resource, body, user);
    if (!bulk.error && bulk.data?.affected) {
      await logActivity(env, user, {
        resource: name,
        action: String(body?.action ?? ''),
        count: bulk.data.affected,
      });
    }
    return respond(bulk);
  }

  if (!may(user, resource, action)) return fail('forbidden', 403);

  if (request.method === 'GET') {
    if (!id) return json({ ok: true, data: await listRows(env, resource) });
    const row = await getRow(env, resource, id);
    return row ? json({ ok: true, data: row }) : fail('not_found', 404);
  }

  if (request.method === 'DELETE') {
    if (!id) return fail('not_found', 404);
    /* الصفُّ يُقرأ قبل حذفه: بعده لا اسمَ يُذكر في الأثر، ورقمُ معرّفٍ
       وحده لا يقول لقارئ السجلّ من حُذف. */
    const doomed = await getRow(env, resource, id);
    const removed = await deleteRow(env, resource, id);
    if (!removed.error) {
      await logActivity(env, user, { resource: name, action: 'delete', row: doomed });
    }
    return respond(removed);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  if (!body || typeof body !== 'object') return fail('invalid_body', 400);

  if (request.method === 'POST') {
    if (id) return fail('not_found', 404);
    const created = await createRow(env, resource, body, user);
    if (!created.error) {
      await logActivity(env, user, { resource: name, action: 'create', row: created.data });
    }
    return respond(created, 201);
  }

  if (!id) return fail('not_found', 404);
  const updated = await updateRow(env, resource, id, body);
  if (!updated.error) {
    await logActivity(env, user, { resource: name, action: 'update', row: updated.data });
  }
  return respond(updated);
}

function respond(result, okStatus = 200) {
  if (result.error) return fail(result.error, result.status);
  return json({ ok: true, data: result.data }, okStatus);
}
