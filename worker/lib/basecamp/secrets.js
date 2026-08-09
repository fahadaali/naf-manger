// تعميةُ رموز بيسكامب المحفوظة في D1.
//
// ═══ ما تحميه وما لا تحميه ═══
//
// رمزُ التجديد يفتح حسابَ بيسكامب للمكتب كلَّه قراءةً — ومعه سنواتُ
// مراسلاتِ موكّلين. وحفظُه نصّاً صريحاً يجعل نسخةً من القاعدة كافيةً
// لقراءة ذلك كلِّه.
//
// فيُعمَّى بـ AES-GCM بمفتاحٍ في `wrangler secret`، لا في القاعدة.
// **وهذا يحمي من تسرّب نسخةٍ من القاعدة، لا من Workerٍ مخترَق** — من ملك
// تنفيذَ الشيفرة ملك المفتاح معها. والفرقُ يُقال ولا يُدَّعى غيرُه.

/** مفتاحُ AES-256 مشتقٌّ من السرّ النصّي — أيُّ طولٍ يصلح، والاشتقاق يوحّده. */
async function importKey(secret) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

const toBase64 = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (text) => Uint8Array.from(atob(text), (character) => character.charCodeAt(0));

/**
 * يعمّي نصّاً ويردّ `base64(iv ‖ ciphertext)`.
 *
 * والـ`iv` عشوائيٌّ لكل عملية ويُحفظ مع الناتج: إعادةُ استعماله مع المفتاح
 * نفسه في GCM تكسر التعمية، وحفظُه ليس تسريباً — هو ليس سرّاً.
 */
export async function seal(secret, plaintext) {
  const key = await importKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return toBase64(packed);
}

/**
 * يفكّ ما عمّاه `seal`، ويردّ `null` إن تعذّر.
 *
 * والتعذُّر حالةٌ متوقَّعة لا عطل: مفتاحٌ بُدِّل يجعل كلَّ رمزٍ محفوظ غيرَ
 * مقروء. فيُقرأ ذلك «غير مربوط» ويُطلَب ربطٌ جديد — لا خطأَ خادمٍ غامض
 * يبحث صاحبُه عن علّةٍ في الشبكة.
 */
export async function open(secret, packedBase64) {
  try {
    const packed = fromBase64(packedBase64);
    if (packed.length <= 12) return null;

    const key = await importKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packed.slice(0, 12) },
      key,
      packed.slice(12),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
