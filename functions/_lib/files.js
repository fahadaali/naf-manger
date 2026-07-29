// قواعد الملفّات — الأنواع المقبولة وحدودُ الأحجام وشكلُ المفتاح.
//
// موضعٌ واحد يقرؤه الرفع والتقديم معاً: لو تفرّقت القاعدتان لقبِل الرفعُ
// نوعاً يقدّمه التقديمُ بترويسةٍ أخرى، وذلك هو الباب.

/** الصورة الشخصية. الحدّ ٢ ميغابايت — وهو ما تفرضه الواجهة اليوم. */
const AVATAR = {
  prefix: 'avatar',
  maxBytes: 2 * 1024 * 1024,
  types: {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  },
};

/** مرفقات العملاء والقضايا. */
const ATTACHMENT = {
  prefix: 'attachment',
  maxBytes: 10 * 1024 * 1024,
  types: {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  },
};

export const KINDS = { avatar: AVATAR, attachment: ATTACHMENT };

/* ═══ لماذا لا SVG ═══
   SVG صورةٌ في نظر `image/*` ومستندٌ في نظر المتصفّح: يحمل `<script>`،
   ويعمل حين يُفتح في تبويب على أصلنا. فقبولُه في الصور يجعل كل رافعٍ
   قادراً على تنفيذ نصّ على نطاق المنصة بجلسة من يفتحه. وهو مستثنى من
   القائمتين أعلاه قصداً — لا سهواً — فلا يُضاف. */

/** مفتاح عشوائي بالكامل: لا اسم الرافع فيه ولا اسم ملفّه ولا عدّاد. */
export function newKey(kind) {
  return `${KINDS[kind].prefix}/${crypto.randomUUID()}`;
}

/* المفتاح يُفحص بشكله قبل أن يُقرأ: بادئةٌ معروفة ثم `UUID`. ومخازن
   الكائنات لا تعرف `..` أصلاً، لكن الشرط يمنع تخمين مفاتيح خارج ما نكتبه
   نحن، ويردّ الطلبَ قبل أن يبلغ الحاوية. */
const KEY_SHAPE = /^(avatar|attachment)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidKey(key) {
  return typeof key === 'string' && KEY_SHAPE.test(key);
}

/**
 * ترويسات التقديم.
 *
 * النوع يُقرأ من بيانات الكائن ثم يُطابَق بالقائمة ثانيةً — ولا يُقدَّم نوعٌ
 * لا يعرفه هذا الملف حتى لو كُتب في الحاوية بطريق آخر.
 *
 * و`nosniff` لازمة: بدونها يخمّن المتصفّح النوع من المحتوى، فيصير ملفٌّ
 * رُفع صورةً مستنداً يُفسَّر.
 *
 * والمستندات تُنزَّل ولا تُفتح — `attachment` — فلا يُفسَّر شيء منها على
 * أصلنا. والصور وحدها تُعرض في مكانها، وهي أنواعٌ لا تحمل نصّاً.
 */
export function serveHeaders(contentType, kind) {
  const known = Object.prototype.hasOwnProperty.call(KINDS[kind].types, contentType);
  const type = known ? contentType : 'application/octet-stream';
  const inline = known && type.startsWith('image/');

  return {
    'content-type': type,
    'content-disposition': inline ? 'inline' : 'attachment',
    'x-content-type-options': 'nosniff',
    // لا مورد خارجي ولا نصّ: حتى لو أُفلت نوعٌ من القائمتين.
    'content-security-policy': "default-src 'none'; sandbox",
    // خاصّ لا عام: هذه ملفّات عملاء، ولا تُخبَّأ في وسيطٍ مشترك.
    'cache-control': 'private, max-age=3600',
  };
}
