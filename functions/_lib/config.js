// إعداد naf-auth لهذه المنصة — موضعٌ واحد يقرؤه الوسيط والاستقبال والخروج.
//
// وما يختلف بين منصة وأخرى يبقى في `wrangler.toml` وحده: لا معرّف منصة
// هنا ولا نطاق ولا سرّ. وما في هذا الملف سلوكٌ يخصّ هذه المنصة لا قيمة.

import { createConfig } from 'naf-auth';

/**
 * الآدمن الأول.
 *
 * العضوية تبدأ من الصفر، وكل داخل جديد يأخذ `DEFAULT_ROLE` أي `staff` —
 * فلو لم يكن ثمّ استثناء لما وُجد في المنصة أحدٌ يملك ترقية أحد، ولبقيت
 * شاشة المستخدمين مغلقة على الجميع إلى الأبد.
 *
 * فصاحب البريد المكتوب في `BOOTSTRAP_ADMIN_EMAIL` يُنشأ صفُّه بدور `admin`،
 * ومن بعده تُدار العضوية من شاشة المستخدمين كبقية المنصات.
 *
 * **وينشئ ولا يرقّي.** الشرط غيابُ الصفّ لا حالتُه: آدمنٌ خُفض دورُه عمداً
 * لا يعود آدمن بمجرّد دخوله ثانيةً — وإلا لما أمكن خفضُه أصلاً. ويلزم من
 * ذلك أن يُضبط المتغيّر **قبل** أول دخول لصاحبه؛ ضبطُه بعده لا يفعل شيئاً،
 * والعلاج حينئذ ترقيةٌ مباشرة في القاعدة.
 *
 * والبريد يأتي من رمزٍ وقّعه المركز وتحقّقنا منه في هذا الطلب — لا من
 * جسم الطلب ولا من معامل في الرابط. فلا يدّعيه أحد.
 */
async function bootstrapAdmin(claims, env, config) {
  const wanted = (env.BOOTSTRAP_ADMIN_EMAIL ?? '').trim().toLowerCase();
  if (!wanted) return;

  const incoming = (claims.email ?? '').trim().toLowerCase();
  if (!incoming || incoming !== wanted) return;

  const s = config.schema;
  const now = Math.floor(Date.now() / 1000);

  /* `DO NOTHING` لا `DO UPDATE`: الشرط غيابُ الصفّ. ودخولان متزامنان
     لنفس الآدمن يبلغان هنا معاً، فيُدرج أحدهما ويجد الآخر تعارضاً —
     وهو سباقٌ لا خطأ.

     ثم يجد `upsertMember` الصفّ فيحدّث الاسم والبريد وآخر ظهور وحدها،
     ولا يمسّ الدور. وهذا هو الموضع المكتوب لهذا العمل في الحزمة. */
  await env[config.dbBinding]
    .prepare(
      `INSERT INTO ${s.table} (${s.id}, ${s.name}, ${s.email}, ${s.role}, ${s.isActive}, ${s.createdAt})
       VALUES (?, ?, ?, 'admin', 1, ?)
       ON CONFLICT(${s.id}) DO NOTHING`,
    )
    .bind(claims.sub, claims.name ?? null, claims.email ?? null, now)
    .run();
}

/** إعداد المنصة. يُبنى في كل طلب — لا حالة فيه تُشارَك بين طلبين. */
export function platformConfig(env) {
  return createConfig(env, { onClaims: bootstrapAdmin });
}
