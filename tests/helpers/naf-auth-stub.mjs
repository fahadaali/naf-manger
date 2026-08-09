/* بديلُ `naf-auth` في اختبار التكامل.
 *
 * ═══ لماذا يُبدَّل هذا وحده ═══
 *
 * `authenticate` الحقيقية تتحقّق من رمزٍ موقَّع بمفاتيح تُجلب من المركز.
 * وذلك عملُ حزمةٍ أخرى مملوكةٍ ومُختبَرة عندها — والمقصود هنا **هذه
 * المنصة**: مسارُها وحارسُها ومعالجاتُها واستعلاماتُها.
 *
 * فيُبدَّل حدُّ المصادقة وحده، ويبقى كلُّ ما عداه حقيقياً: `worker/index.js`
 * نفسُه بترتيب مساراته، والمعالجاتُ نفسُها، وSQL نفسُه على المخطَّط نفسِه.
 *
 * والعضوُ الحاليّ يُبدَّل من `setUser` — فيُقاس بذلك ما يراه المسؤول وما
 * يُمنع منه الموظّف على المسارات ذاتها.
 */

let current = null;

/** يضبط العضو الذي «سجّل دخوله». و`null` يعني بلا جلسة. */
export function setUser(user) {
  current = user;
}

const PUBLIC_PREFIXES = ['/auth/', '/denied', '/health'];

export async function authenticate(request) {
  const url = new URL(request.url);

  /* المسارات العامة تُعرَّف هنا كما تعرّفها الحزمة: الأصول وما تحت
     `‎/auth/‎`. وما عداها محميّ — وهو ما يجعل ترتيب `worker/index.js`
     قابلاً للقياس. */
  const isApi = url.pathname.startsWith('/api/');
  if (PUBLIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return { public: true };
  }

  if (!current) {
    return {
      response: isApi
        ? Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })
        : Response.redirect('https://center.example/login', 302),
    };
  }

  if (!isApi) return { public: true };

  /* ═══ الشكل هنا هو شكلُ الحزمة حرفاً ═══
     تردّ `{ id, role, perms }` — و`perms` عمودُ الصفّ كما هو، `null` في
     الغالب. ولا `permissions` فيها.

     وهذا ليس تفصيلاً: بديلٌ يردّ `permissions` جاهزةً يجعل كلَّ فحصٍ يمرّ
     في الاختبار ويسقط في الإنتاج — وقد وقع ذلك فعلاً، فبقيت تسعةُ فحوصٍ
     تقرأ اسماً لا وجود له حتى أُمسكت هنا. فالبديل يحاكي الحزمة لا يريحها. */
  return {
    user: { id: current.id, role: current.role, perms: current.perms ?? null },
    claims: { sub: current.id },
    session: { sub: current.id },
  };
}

/* `createConfig` الحقيقية تقرأ `wrangler.toml` وتبني إعداد المصادقة.
   والذي يهمّ هنا منها اسمُ ارتباط القاعدة ومخطَّطُ جدول الأعضاء — لأنّ
   `platformConfig` تستعملهما في إدراج الآدمن الأول. والباقي لا يُنادى. */
export function createConfig(env, options = {}) {
  return {
    dbBinding: 'DB',
    cookieName: 'naf_session',
    schema: {
      table: 'members',
      id: 'user_id',
      name: 'display_name',
      email: 'email',
      role: 'role',
      isActive: 'is_active',
      createdAt: 'created_at',
    },
    kv: (e) => e.AUTH_KV,
    reasons: { notMember: 'not_member', inactive: 'inactive' },
    ...options,
  };
}

export async function handleCallback() {
  return Response.redirect('https://x/', 302);
}

export async function handleLogout() {
  return Response.redirect('https://x/', 302);
}

export async function handleBackchannelLogout() {
  return Response.json({ ok: true });
}
