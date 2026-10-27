// المحامون — قائمةٌ تُدار من الإعدادات، لا من حسابات المنصة.
//
// كان المحامي المسؤول يُختار من مستخدمي المنصة، ومن المحامين من لا يدخلها. فلهم
// جدولٌ (`migrations/0028`)، ولكلٍّ حسابٌ اختياريّ (`member_id`) تعمل به «قضاياي».
//
// القراءةُ لمن يقرأ القضايا — تُختار منهم في نافذتها. والكتابةُ لمن يعدّل
// الإعدادات. والحذفُ لمن لا قضايا عليه، وإلا أُوقف ولم يُحذف: قضاياه تحمل معرّفَه.

const fail = (error, status) => Response.json({ ok: false, error }, { status });
const ok = (data) => Response.json({ ok: true, data });
const nowSeconds = () => Math.floor(Date.now() / 1000);

const mayManage = (user) => user.role === 'admin' || Boolean(user.permissions?.settings?.update);

const shape = (row) => ({
  id: row.id,
  name: row.name,
  title: row.title ?? '',
  email: row.email ?? '',
  phone: row.phone ?? '',
  memberId: row.member_id ?? null,
  isActive: row.is_active === 1,
  openCases: Number(row.open_cases ?? 0),
});

export async function listLawyers(env, user) {
  if (!user.permissions?.cases?.read && !mayManage(user)) return fail('forbidden', 403);
  const { results } = await env.DB.prepare(
    `SELECT l.*, (SELECT COUNT(*) FROM cases c
                   WHERE c.lawyer_id = l.id AND c.archived_at IS NULL AND c.status <> 'completed') open_cases
       FROM lawyers l ORDER BY l.is_active DESC, l.name`,
  ).all();
  return ok((results ?? []).map(shape));
}

/* الحقولُ المقبولة — والاسمُ لازم، والحسابُ إن سُمّي يجب أن يكون عضواً. */
async function readBody(request, env) {
  let body;
  try { body = await request.json(); } catch { return { error: 'invalid_body' }; }
  const name = String(body?.name ?? '').trim();
  if (!name) return { error: 'missing_field' };
  const memberId = typeof body?.memberId === 'string' && body.memberId ? body.memberId : null;
  if (memberId) {
    const member = await env.DB.prepare(`SELECT user_id FROM members WHERE user_id = ?`).bind(memberId).first();
    if (!member) return { error: 'invalid_reference' };
  }
  return {
    values: {
      name,
      title: String(body?.title ?? '').trim() || null,
      email: String(body?.email ?? '').trim() || null,
      phone: String(body?.phone ?? '').trim() || null,
      memberId,
      isActive: body?.isActive === false ? 0 : 1,
    },
  };
}

export async function createLawyer(request, env, user) {
  if (!mayManage(user)) return fail('forbidden', 403);
  const read = await readBody(request, env);
  if (read.error) return fail(read.error, 400);
  const { values } = read;
  const id = crypto.randomUUID();
  const now = nowSeconds();
  try {
    await env.DB.prepare(
      `INSERT INTO lawyers (id, name, title, email, phone, member_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, values.name, values.title, values.email, values.phone, values.memberId, values.isActive, now, now).run();
  } catch {
    return fail('member_taken', 409);
  }
  const row = await env.DB.prepare(`SELECT * FROM lawyers WHERE id = ?`).bind(id).first();
  return ok(shape(row));
}

export async function updateLawyer(request, env, user, id) {
  if (!mayManage(user)) return fail('forbidden', 403);
  const existing = await env.DB.prepare(`SELECT id FROM lawyers WHERE id = ?`).bind(id).first();
  if (!existing) return fail('not_found', 404);
  const read = await readBody(request, env);
  if (read.error) return fail(read.error, 400);
  const { values } = read;
  try {
    await env.DB.prepare(
      `UPDATE lawyers SET name = ?, title = ?, email = ?, phone = ?, member_id = ?, is_active = ?, updated_at = ?
        WHERE id = ?`,
    ).bind(values.name, values.title, values.email, values.phone, values.memberId, values.isActive, nowSeconds(), id).run();
  } catch {
    /* الحسابُ مربوطٌ بمحامٍ آخر — حسابٌ واحدٌ لمحامٍ واحد. */
    return fail('member_taken', 409);
  }
  const row = await env.DB.prepare(`SELECT * FROM lawyers WHERE id = ?`).bind(id).first();
  return ok(shape(row));
}

export async function deleteLawyer(env, user, id) {
  if (!mayManage(user)) return fail('forbidden', 403);
  const used = await env.DB.prepare(
    `SELECT 1 FROM cases WHERE lawyer_id = ?1
        OR (json_valid(team) AND EXISTS (SELECT 1 FROM json_each(cases.team) WHERE value = ?1)) LIMIT 1`,
  ).bind(id).first();
  if (used) {
    await env.DB.prepare(`UPDATE lawyers SET is_active = 0, updated_at = ? WHERE id = ?`).bind(nowSeconds(), id).run();
    return ok({ id, deactivated: true });
  }
  await env.DB.prepare(`DELETE FROM lawyers WHERE id = ?`).bind(id).run();
  return ok({ id, deleted: true });
}
