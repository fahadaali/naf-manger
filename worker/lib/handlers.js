// معالجات المسارات — محايدةٌ عن الإطار.
//
// المنصة تُنشر Worker، ويناديها `worker/index.js` وحده. (وكانت هنا أغلفةُ
// Pages في `functions/api/*` تناديها كذلك، وقد حُذفت مع طبقة Pages كلِّها:
// `wrangler.toml` يقول `main = "worker/index.js"` فلم تكن تُقرأ.)

import { permissionsFor } from './roles.js';
import { KINDS, isValidKey, newKey, serveHeaders } from './files.js';

/* الردّ رمزٌ لا جملة — كما تفعل naf-auth في أسباب الرفض. النصّ المعروض
   للمستخدم يأتي من `naf-terms.md`، وترجمتُه عملُ الشاشة لا عمل المسار. */
const fail = (error, status) => Response.json({ ok: false, error }, { status });

/** تفضيلات الإشعارات الافتراضية — `NULL` في العمود يعني هذه لا «لا شيء». */
const DEFAULT_NOTIFICATION_PREFS = {
  newClients: true,
  newCases: true,
  caseUpdates: true,
  newProspects: true,
  followUps: true,
  payments: true,
  userLogin: false,
  backups: true,
  updates: true,
  errors: true,
};

function safeJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // تفضيلٌ تالف يُقرأ غياباً: الشاشة تعمل بالافتراض بدل أن تسقط.
    return null;
  }
}

/**
 * العضو الحالي.
 *
 * الحارس يمرّ قبله، فبلوغُه يعني أن الجلسة قائمة وأن الرمز تُحقّق منه في
 * هذا الطلب نفسه وأن العضو موجودٌ ومفعَّل. ولا فحص هنا يعيد ما فُحص.
 *
 * والحارس يعطي `{ id, role, perms }` وحدها — وهي ما يحتاجه قرار الوصول.
 * أمّا الاسم والبريد فللعرض، فيُقرآن هنا من صفّ العضو.
 *
 * و`center` عنوانُ المركز يُردّ مع العضو: كلمةُ المرور والمصادقة الثنائية
 * والهوية نفسها تعيش هناك لا هنا، وشاشةُ الإعدادات تحتاج أن تقود إليه —
 * ولا يُكتب العنوان في الحزمة، فهو في `wrangler.toml` ويختلف بين نسخة
 * وأخرى.
 */
export async function readMember(env, user) {
  const row = await env.DB.prepare(
    `SELECT display_name, email, created_at, last_seen_at, avatar_key, notification_prefs
     FROM members WHERE user_id = ?`,
  )
    .bind(user.id)
    .first();

  return Response.json({
    ok: true,
    center: env.AUTH_ISSUER ?? null,
    user: {
      id: user.id,
      role: user.role,
      name: row?.display_name ?? null,
      email: row?.email ?? null,
      permissions: permissionsFor(user.role, user.perms),
      createdAt: row?.created_at ?? null,
      lastSeenAt: row?.last_seen_at ?? null,
      avatarKey: row?.avatar_key ?? null,
      notificationPrefs: {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...(safeJson(row?.notification_prefs) ?? {}),
      },
    },
  });
}

/**
 * ما يملك العضو تغييرَه من ملفّه.
 *
 * حقلان لا ثالث: مفتاحُ صورته وتفضيلاتُ إشعاراته. أمّا الاسم والبريد
 * والدور فتكتبها `naf-auth` من رمز المركز عند كل دخول — فقبولُها هنا
 * يَعِد بحفظٍ يُدهس في الدخول التالي، وذاك وعدٌ كاذب لا ميزة.
 *
 * والدور خاصةً لا يُقبل من هنا أبداً: مسارُه `‎/api/members/:id‎` وهو
 * محروسٌ بـ`users.update`، ولو قُبل هنا لرقّى كلُّ عضوٍ نفسه.
 */
export async function updateMe(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  if (!body || typeof body !== 'object') return fail('invalid_body', 400);

  const sets = [];
  const values = [];

  if ('avatarKey' in body) {
    const key = body.avatarKey;
    /* `null` يمحو الصورة، وما عداه يجب أن يكون مفتاحاً كتبناه نحن بالشكل
       المعروف — وإلّا لأمكن توجيهُ الصورة إلى أي كائنٍ في الحاوية. */
    if (key !== null && !(isValidKey(key) && key.startsWith('avatar/'))) {
      return fail('invalid_avatar_key', 400);
    }
    sets.push('avatar_key = ?');
    values.push(key);
  }

  if ('notificationPrefs' in body) {
    const prefs = body.notificationPrefs;
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) {
      return fail('invalid_body', 400);
    }
    /* تُقبل المفاتيح المعروفة وحدها قيمًا منطقية: جسمٌ مفتوح يُخزَّن كما
       ورد يجعل العمود مكبَّ ما يرسله المتصفّح. */
    const clean = {};
    for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
      if (typeof prefs[key] === 'boolean') clean[key] = prefs[key];
    }
    sets.push('notification_prefs = ?');
    values.push(JSON.stringify(clean));
  }

  if (!sets.length) return fail('empty_update', 400);

  values.push(user.id);
  await env.DB.prepare(`UPDATE members SET ${sets.join(', ')} WHERE user_id = ?`)
    .bind(...values)
    .run();

  return readMember(env, user);
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
