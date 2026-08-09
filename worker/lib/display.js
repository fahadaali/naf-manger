// شاشات العرض — رمزٌ في الرابط بدل جلسةِ متصفّح.
//
// ═══ السبب ═══
//
// شاشةٌ معلَّقة في ممرّ لا تسجّل دخولاً. وكانت شاشة الإعدادات تنسخ عنوان
// المنصة نفسه — وهو محروس — فأيُّ شاشةٍ تفتحه تُحوَّل إلى المركز وتقف.
//
// ═══ وحدوده أربعة، وكلُّها لازمة ═══
//
// ١) ما يُقرأ به إحصاءاتٌ مجمَّعة وحدها: أعدادٌ ونسب. ولا اسمَ عميلٍ ولا
//    رقمَ قضية ولا مبلغ. الرابط يعيش في شاشةٍ يراها كلُّ من يمرّ.
// ٢) قراءةٌ فقط. لا مسارَ كتابةٍ يقبل هذا الرمز.
// ٣) عشوائيٌّ ٢٥٦ بتّاً من `crypto.getRandomValues` — لا مشتقٌّ من معرّف
//    ولا من وقت. فلا يُخمَّن ولا يُعدّ.
// ٤) يُبطَل بحذف صفّه، فيسري في الطلب التالي.

import { readStats } from './queries.js';

const fail = (error, status) => Response.json({ ok: false, error }, { status });

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** ٣٢ بايتاً عشوائية بترميز base64url — بلا حشوٍ ولا محارف تحتاج ترميزاً في رابط. */
function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* الشكل يُفحص قبل أن تُسأل القاعدة: يردّ المخالفَ بلا استعلام، ويمنع
   طولاً غيرَ محدودٍ من بلوغ الفهرس. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** إحصاءات شاشة العرض — عامٌّ بلا جلسة، محروسٌ بالرمز. */
export async function readDisplayStats(env, token) {
  if (!TOKEN_SHAPE.test(token)) return fail('not_found', 404);

  const row = await env.DB.prepare(`SELECT token FROM display_tokens WHERE token = ?`)
    .bind(token)
    .first();
  if (!row) return fail('not_found', 404);

  /* آخر ظهورٍ يُكتب ولا يُنتظر: تحديثُه ليس شرطاً لصحّة الردّ، وانتظارُه
     يضيف رحلةً إلى كل تحديثِ شاشة. */
  const seen = env.DB.prepare(`UPDATE display_tokens SET last_seen_at = ? WHERE token = ?`)
    .bind(nowSeconds(), token)
    .run();

  const [response] = await Promise.all([readStats(env), seen.catch(() => {})]);

  /* لا يُخبَّأ في وسيطٍ مشترك: الردّ يخصّ منصةً بعينها، ورمزُه في المسار. */
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}

/** رموز العرض القائمة. للمسؤول وحده. */
export async function listDisplayTokens(env, user) {
  if (user.role !== 'admin') return fail('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT token, label, created_at, last_seen_at FROM display_tokens ORDER BY created_at DESC`,
  ).all();

  return Response.json({
    ok: true,
    data: (results ?? []).map((row) => ({
      token: row.token,
      label: row.label ?? '',
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at ?? null,
    })),
  });
}

/** رمزٌ جديد. */
export async function createDisplayToken(request, env, user) {
  if (user.role !== 'admin') return fail('forbidden', 403);

  let body = null;
  try {
    body = await request.json();
  } catch {
    // بلا جسمٍ مقبول: الاسم اختياري.
  }

  const label = String(body?.label ?? '').trim().slice(0, 80);
  const token = newToken();

  await env.DB.prepare(
    `INSERT INTO display_tokens (token, label, created_by, created_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(token, label, user.id, nowSeconds())
    .run();

  return Response.json({ ok: true, data: { token, label, createdAt: nowSeconds(), lastSeenAt: null } }, { status: 201 });
}

/** إبطالُ رمز — حذفُ صفّه. */
export async function deleteDisplayToken(env, user, token) {
  if (user.role !== 'admin') return fail('forbidden', 403);
  if (!TOKEN_SHAPE.test(token)) return fail('not_found', 404);

  const result = await env.DB.prepare(`DELETE FROM display_tokens WHERE token = ?`)
    .bind(token)
    .run();

  if (!result.meta?.changes) return fail('not_found', 404);
  return Response.json({ ok: true });
}
