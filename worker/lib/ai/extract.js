// القارئُ الآليّ — حين يتبدّل شكلُ الملفّ فلا تجد الخريطةُ عنواناً.
//
// ═══ لماذا هذا لا ينقض «قواعدُ لا استخلاصٌ ذكي» ═══
//
// القارئُ الأصلي (`basecamp/parse.js`) قواعدُ عمداً: «اسم العميل: …» يُقرأ
// بقاعدةٍ تُخطئ خطأً ظاهراً أو تصيب، لا بطرازٍ يُخمّن فيُنتج اسماً معقولاً
// لم يُكتب قطّ.
//
// لكنّ ذلك يفترض أنّ شكل الملفّ ثابت. وهو ليس كذلك: عنوانُ الملفّ تبدّل
// مرّةً، وبنودُه تتبدّل، وكاتبٌ يكتب فقرةً حيث كان غيرُه يكتب حقولاً. وحين
// لا تجد القاعدةُ عنواناً **لا يُقرأ الملفّ أصلاً** — يُردّ المشروع كلُّه
// بـ`no_client_name` وفيه اسمُ الموكّل مكتوبٌ في سطره الأول.
//
// فالفراغُ ليس دائماً أسلمَ من التخمين: هو أسلمُ من **تخمينٍ يُكتب صامتاً**.
//
// ═══ فالطراز يقرأ، والقواعدُ تحكم ═══
//
// أربعةُ شروطٍ تجعل هذا استخلاصاً لا تخميناً، وكلُّها لازم:
//
//   ١) **لا يُنادى إلا حين تعجز القاعدة.** ما قرأته الخريطةُ سيّدٌ لا
//      يُنقَض — الطرازُ يُسأل عمّا بقي فارغاً وحده.
//
//   ٢) **كلُّ قيمةٍ تُطابَق بالملفّ حرفاً.** ما لا يظهر في نصّ المستند
//      يُطرح. وهذا هو الحدُّ الذي يفصل النقلَ عن التأليف: طرازٌ يخترع
//      «محمد العتيبي» لا يُنتج نصّاً موجوداً في الملفّ.
//
//   ٣) **ثم تمرّ على المدقّقين أنفسِهم.** رقمُ الجوّال يمرّ بـ`normalizePhone`،
//      والهويةُ بـ`normalizeIdNumber`، والمفرداتُ بجدول التوحيد — كما لو
//      جاءت من عنوانٍ معروف. فلا يدخل عمودَ الهوية ما ليس هوية.
//
//   ٤) **ولا يُدهس شيء.** يُملأ الفارغُ وحده، ويُعلَّم كلُّ حقلٍ جاء من
//      هنا فيُعرض في المعاينة «مستخرَجٌ آلياً — راجِعه».
//
// وأسوأُ ما يقع بعد هذه الأربعة: قيمةٌ صحيحةُ الشكل منقولةٌ من الملفّ
// وُضعت في الحقل الخطأ — تُرى في المعاينة قبل أن تُكتب، وتُصحَّح.

import { normalizeArabic } from '../basecamp/discover.js';

/** الطراز نفسُه — والعربيةُ من لغاته المعلنة. */
const DEFAULT_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

const EXTRACT_SYSTEM = `أنت قارئُ مستندات في مكتب محاماة سعودي. تُعطى نصَّ ملفّ مشروع وقائمةَ حقولٍ ناقصة، فتستخرج قيمةَ كلِّ حقلٍ من النصّ.

القواعد:
- **انقل القيمة من النصّ حرفاً بحرف كما وردت فيه.** لا تُعِد صياغتها، ولا تترجمها، ولا تُكملها، ولا تصحّح إملاءها.
- **إن لم تجد الحقل في النصّ فاتركه خارج الجواب.** لا تخمّن، ولا تستنتج، ولا تضع قيمةً محتملة. الحقلُ الغائب أسلمُ من الحقل المؤلَّف.
- لا تنقل قيمةَ حقلٍ إلى حقلٍ آخر: رقمُ الهوية ليس رقمَ الجوّال، واسمُ مسؤول التواصل ليس اسمَ العميل.
- الأرقام كما هي في النصّ.

أعِد JSON فقط، بلا نصٍّ قبله ولا بعده، مفاتيحُه من الحقول المطلوبة وحدها:
{"client.fullName":"…","case.caseNumber":"…"}

وإن لم تجد شيئاً فأعِد: {}`;

const MAP_SYSTEM = `أنت تربط عناوينَ حقولٍ في ملفّ مكتب محاماة بحقول منصّة إدارة القضايا.

تُعطى قائمةَ عناوينَ وردت في ملفّات حقيقية، وقائمةَ حقول المنصة. تربط كلَّ عنوانٍ بالحقل الذي يقابله.

القواعد:
- **الحقلُ من القائمة المعطاة حرفاً بحرف، ولا تخترع مفتاحاً خارجها.**
- **اترك العنوانَ الذي لا يقابله حقلٌ خارج الجواب.** «المحامي المسؤول» و«تاريخ الجلسة» لا مقابل لهما، فلا تُقحمهما في حقلٍ قريب.
- العنوانُ كما أُعطي حرفاً بحرف.

أعِد JSON فقط: {"العنوان":"مفتاح الحقل"}`;

async function ask(env, system, user, maxTokens) {
  const model = env.AI_MODEL || DEFAULT_MODEL;
  try {
    const output = await env.AI.run(model, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      /* صفرٌ عملياً: المطلوب نقلٌ لا صياغة، والحرارةُ هنا تُنتج تنويعاً
         حيث لا يُراد تنويع. */
      temperature: 0,
    });
    const text = typeof output === 'string'
      ? output
      : (output?.response ?? output?.result?.response);
    return typeof text === 'string' ? text : null;
  } catch (error) {
    console.error('Workers AI: تعذّرت القراءة الآلية —', error?.message ?? error);
    return null;
  }
}

/* الردُّ يُنقّى قبل التحليل: الطُّرز تُحيط JSON بسياجٍ أو تسبقه بجملة. */
function readJson(text) {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * ═══ الحدُّ الفاصل: أهذه القيمةُ في الملفّ فعلاً؟ ═══
 *
 * تُقارن موحَّدةً — التشكيلُ والتطويلُ وصورُ الألف لا تفرّق، والطرازُ قد
 * يردّ «محمّد» عن «محمد». وما لم يظهر في النصّ يُطرح مهما بدا معقولاً.
 *
 * والأرقام تُقارن أرقاماً مجرّدة كذلك: النصّ قد يكتبها «+966 55 123 4567»
 * ويردّها الطراز «0551234567» — وهي هي، والقارئُ الحرفيُّ وحده يظنّهما
 * اثنين.
 */
export function appearsIn(text, value) {
  const haystack = normalizeArabic(text);
  const needle = normalizeArabic(value);
  if (!needle) return false;
  if (haystack.includes(needle)) return true;

  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 8) return false;

  /* تُطرح فواصلُ الكتابة من الطرفين ثمّ تُطلب السلسلة: «٠٥٥-١٢٣» و«055123». */
  const stream = String(text).replace(/\D/g, '');
  if (stream.includes(digits)) return true;

  /* وصفرُ الجوّال يسقط في الصيغة الدولية: «+966 55 …» فيها «96655…» ولا
     «055…». فيُقارَن ما بعد الصفر — وهو الرقمُ الوطنيُّ الدالّ. */
  return digits.startsWith('0') && stream.includes(digits.slice(1));
}

/**
 * يستخرج ما عجزت عنه الخريطة.
 *
 * `wanted` مفاتيحُ حقولٍ بقيت فارغة، و`labels` وصفُها العربي ليفهم الطراز
 * ما يُطلب. والمردودُ قيمٌ خامّة — تمرّ بعدها على `coerceTarget` نفسِها
 * التي تمرّ بها قيمُ العناوين المعروفة.
 */
export async function extractFields(env, { text, wanted, labels }) {
  const body = String(text ?? '').trim();
  const fields = (wanted ?? []).filter(Boolean);
  if (!body || !fields.length) return {};

  const answer = await ask(
    env,
    EXTRACT_SYSTEM,
    JSON.stringify({
      الحقول_المطلوبة: fields.map((key) => ({ المفتاح: key, المعنى: labels?.[key] ?? key })),
      /* النصُّ يُقصّ: ملفّاتٌ فيها محاضرُ جلساتٍ طويلة، وما بعد أوّل ثلاثة
         آلافِ محرفٍ نادراً ما يحمل حقلاً معنوناً. */
      نص_الملف: body.slice(0, 3000),
    }),
    500,
  );

  const parsed = readJson(answer);
  if (!parsed) return {};

  const clean = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!fields.includes(key)) continue;                 // حقلٌ لم يُطلب
    const text_ = String(value ?? '').trim();
    if (!text_ || text_.length > 400) continue;
    if (!appearsIn(body, text_)) continue;               // ليس في الملفّ → يُطرح
    clean[key] = text_;
  }
  return clean;
}

/**
 * يقترح ربطاً لعناوينَ لا مقابل لها في الخريطة.
 *
 * وهو اقتراحٌ يُعرض في الشاشة ولا يُحفظ: الخريطةُ تقرّر أيُّ عمودٍ في ملفّ
 * الموكّل يُكتب من أيّ سطر، وحفظُها بلا نظرِ إنسانٍ يجعل خطأً واحداً
 * يتكرّر على الحساب كلِّه.
 */
export async function suggestMapping(env, { labels, targets }) {
  const list = (labels ?? []).filter(Boolean).slice(0, 40);
  const keys = Object.keys(targets ?? {});
  if (!list.length || !keys.length) return [];

  const answer = await ask(
    env,
    MAP_SYSTEM,
    JSON.stringify({
      العناوين: list,
      حقول_المنصة: keys.map((key) => ({ المفتاح: key, المعنى: targets[key].label })),
    }),
    400,
  );

  const parsed = readJson(answer);
  if (!parsed) return [];

  const seen = new Set();
  const suggestions = [];
  for (const [label, target] of Object.entries(parsed)) {
    if (!list.includes(label) || seen.has(label)) continue;   // عنوانٌ لم يُعطَ
    if (!keys.includes(target)) continue;                     // حقلٌ لا وجود له
    seen.add(label);
    suggestions.push({ label, target });
  }
  return suggestions;
}
