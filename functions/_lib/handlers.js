// معالجات المسارات — محايدةٌ عن الإطار.
//
// المنصة تُنشر Worker، ويناديها `worker/index.js`. وأغلفة Pages في
// `functions/api/*` تناديها كذلك، فتبقى صالحةً لمن نشر بالطريقة الأخرى.
// والمنطق هنا وحده: نسختان منه في مسارين تنحرفان، وأولُ ما ينحرف الحدود.

import { permissionsFor } from './roles.js';
import { KINDS, isValidKey, newKey, serveHeaders } from './files.js';

/* الردّ رمزٌ لا جملة — كما تفعل naf-auth في أسباب الرفض. النصّ المعروض
   للمستخدم يأتي من `naf-terms.md`، وترجمتُه عملُ الشاشة لا عمل المسار. */
const fail = (error, status) => Response.json({ ok: false, error }, { status });

/**
 * العضو الحالي.
 *
 * الحارس يمرّ قبله، فبلوغُه يعني أن الجلسة قائمة وأن الرمز تُحقّق منه في
 * هذا الطلب نفسه وأن العضو موجودٌ ومفعَّل. ولا فحص هنا يعيد ما فُحص.
 *
 * والحارس يعطي `{ id, role, perms }` وحدها — وهي ما يحتاجه قرار الوصول.
 * أمّا الاسم والبريد فللعرض، فيُقرآن هنا من صفّ العضو.
 */
export async function readMember(env, user) {
  const row = await env.DB.prepare(
    `SELECT display_name, email, created_at, last_seen_at
     FROM members WHERE user_id = ?`,
  )
    .bind(user.id)
    .first();

  return Response.json({
    ok: true,
    user: {
      id: user.id,
      role: user.role,
      name: row?.display_name ?? null,
      email: row?.email ?? null,
      permissions: permissionsFor(user.role, user.perms),
      createdAt: row?.created_at ?? null,
      lastSeenAt: row?.last_seen_at ?? null,
    },
  });
}

/** رفع ملفّ إلى الحاوية. */
export async function uploadFile(request, env, user) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return fail('invalid_body', 400);
  }

  const kind = String(form.get('kind') ?? 'attachment');
  if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) return fail('invalid_kind', 400);

  const file = form.get('file');
  if (!file || typeof file === 'string') return fail('invalid_body', 400);

  const rules = KINDS[kind];

  /* الحجم يُفحص قبل القراءة: `file.size` معلومٌ من الترويسة، فالردّ يقع
     قبل أن يُحمَّل الجسم كلُّه في الذاكرة. */
  if (file.size > rules.maxBytes) return fail('file_too_large', 413);
  if (file.size === 0) return fail('invalid_body', 400);

  /* والنوع يُقرأ من الملفّ لا من حقلٍ في النموذج: حقلٌ منفصل يقوله الرافع
     مرّتين، فيُقبل بالأول ويُقدَّم بالثاني. */
  const type = file.type;
  if (!Object.prototype.hasOwnProperty.call(rules.types, type)) {
    return fail('unsupported_type', 415);
  }

  const key = newKey(kind);

  await env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: type },
    /* اسم الملفّ الأصلي بيانٌ مصاحب لا جزءٌ من المفتاح: يُعرض للقارئ عند
       التنزيل، ولا يدخل مساراً ولا يُشتقّ منه شيء. */
    customMetadata: {
      uploadedBy: user.id,
      originalName: typeof file.name === 'string' ? file.name.slice(0, 255) : '',
    },
  });

  return Response.json({ ok: true, key, type, size: file.size }, { status: 201 });
}

/** تقديم ملفّ من الحاوية. */
export async function serveFile(env, key) {
  if (!isValidKey(key)) return fail('not_found', 404);

  const object = await env.FILES.get(key);
  if (!object) return fail('not_found', 404);

  const kind = key.slice(0, key.indexOf('/'));
  const headers = new Headers(serveHeaders(object.httpMetadata?.contentType ?? '', kind));

  /* `etag` يجعل المتصفّح يسأل بدل أن ينزّل ثانيةً. ولا `last-modified`
     معه: واحدُهما يكفي، والزيادة تُكبّر الترويسة بلا أثر. */
  headers.set('etag', object.httpEtag);

  return new Response(object.body, { headers });
}
