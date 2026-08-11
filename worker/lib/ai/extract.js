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

const CLASSIFY_SYSTEM = `أنت تفهم ألفاظَ محامٍ سعودي وتردّها إلى الرمز الذي يقابلها في منصّة إدارة القضايا.

تُعطى لفظاً كتبه المحامي في حقلٍ ما، وقائمةَ الرموز المقبولة في ذلك الحقل ومعانيها، وقد تُعطى معه ما حوله من ملاحظات القضية وموضوعِها.

القواعد:
- **أجب برمزٍ واحد من القائمة حرفاً بحرف، ولا شيء غيره.**
- **الحكمُ على اللفظ نفسِه، وما حوله يُستعان به على فهمه لا على تجاوزه.** فإن كان اللفظ «تحت الدراسة» وفي الملاحظات «صدر الحكم لصالحنا» فذلك يفسّره؛ وإن لم يكن فيها ما يفسّره فلا تستنبط من عندك.
- إن كان اللفظُ منفيّاً أو مشكوكاً فيه أو لا يقابل رمزاً بيقين، فأجب: لا-أعرف
- **ولا-أعرف جوابٌ صحيح.** الفراغُ الظاهر خيرٌ من رمزٍ مظنون: هذه قضايا موكّلين، ورمزٌ خاطئ يدخل الإحصاء ولا يُرى.
- لا تشرح، ولا تضع علاماتِ ترقيم، ولا تكتب أكثر من كلمة.`;

/**
 * لفظٌ لم يفهمه الجدولُ ولا الجذور — يُردّ إلى رمزٍ من قائمةٍ مغلقة.
 *
 * ═══ واللفظُ لا يُقرأ معزولاً ═══
 *
 * «تحت الدراسة» وحدَها لا تقول شيئاً عن نتيجة القضية. وفي ملاحظات الملفّ
 * ما يفسّرها: «صدر الحكم لصالحنا وننتظر التنفيذ». فيُعطى الطرازُ ما حول
 * اللفظ — الملاحظاتِ والموضوعَ — لا اللفظَ وحده.
 *
 * والسياقُ عونٌ على الفهم لا بديلٌ عن اللفظ: ما زال المحكومُ عليه ما كتبه
 * المحامي في الحقل، والملاحظاتُ تُقرأ لتفسيره.
 *
 * ═══ ولماذا رمزٌ لا نصّ ═══
 *
 * `outcome` و`status` و`client_type` أعمدةٌ تقرؤها اللوحةُ والتقارير
 * رموزاً — «معدّل الربح» يعدّ `outcome = 'won'` وحدها. فلفظٌ حرٌّ يُكتب
 * فيها يُعرض في بطاقة القضية ويغيب عن كل إحصاء.
 *
 * وأسوأُ ما يقع هنا: رمزٌ من القائمة اختير خطأً — يُقال في المعاينة
 * «فُهمت رابحة — راجِعها» فيُرى قبل أن يُكتب. أمّا ما لم يُفهَم فلا يُكتب
 * أصلاً.
 */
export async function classifyValue(env, { phrase, label, codes, context }) {
  const text = String(phrase ?? '').trim();
  const allowed = Object.keys(codes ?? {});
  if (!text || !allowed.length) return null;

  const around = {};
  for (const [key, value] of Object.entries(context ?? {})) {
    const line = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (line) around[key] = line.slice(0, 600);
  }

  const answer = await ask(
    env,
    CLASSIFY_SYSTEM,
    JSON.stringify({
      الحقل: label,
      اللفظ: text,
      ...(Object.keys(around).length ? { ما_حوله: around } : {}),
      الرموز_المقبولة: Object.entries(codes).map(([code, meaning]) => ({ الرمز: code, المعنى: meaning })),
    }),
    30,
  );
  if (typeof answer !== 'string') return null;

  /* والردُّ يُطابَق بالقائمة: كلمةٌ خارجَها — أو «لا-أعرف» — تُردّ `null`. */
  const cleaned = answer.replace(/[`"'.،,\s]/g, '');
  return allowed.find((code) => code.replace(/[-\s]/g, '') === cleaned.replace(/[-\s]/g, '')) ?? null;
}

/* ═══ ومعجمٌ يتعلّم، فلا يُسأل عن لفظٍ مرّتين ═══
 *
 * المزامنة كلَّ ساعة، واللفظُ غيرُ المفهوم يبقى في الملفّ حتى يعدّله
 * إنسان. فبلا ذاكرةٍ يُستدلّ على «تحت الدراسة» أربعاً وعشرين مرّةً في
 * اليوم، وبالجواب نفسِه.
 *
 * فما فُهم يُحفظ في `system_settings` — معجمٌ مكشوفٌ يُقرأ ويُصحَّح، لا
 * خبيئةٌ مخفيّة. ومفتاحُه اللفظُ موحَّداً، فتشكيلُ الكاتب لا يُنشئ مدخلاً
 * ثانياً.
 *
 * **ولا يُخفي المعجمُ شيئاً**: المعاينة تقول «فُهمت رابحة — راجِعها» في
 * كل دورة، جاء الجوابُ من الطراز أو من المعجم. فالمحفوظُ يوفّر الاستدلال
 * ولا يوفّر المراجعة.
 */
const LEXICON_KEY = 'ai_lexicon';
const MAX_LEXICON = 200;

const lexiconKey = (phrase) => normalizeArabic(phrase).slice(0, 80);

export async function readLexicon(env) {
  const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = ?`)
    .bind(LEXICON_KEY)
    .first();
  try {
    const stored = JSON.parse(row?.value ?? '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}

export async function rememberPhrase(env, { target, phrase, code, lexicon }) {
  const bag = lexicon[target] ?? (lexicon[target] = {});
  /* والسقفُ يمنع نموّاً بلا حدّ: ملفّاتٌ فيها ألفاظٌ لا تتكرّر تملأ الصفّ
     بلا فائدة. وأقدمُ المدخلات يخرج — والحديثُ أقربُ إلى ما يُكتب اليوم. */
  const keys = Object.keys(bag);
  if (keys.length >= MAX_LEXICON) delete bag[keys[0]];
  bag[lexiconKey(phrase)] = code;

  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(LEXICON_KEY, JSON.stringify(lexicon), Math.floor(Date.now() / 1000))
    .run();
}

/** ما حُفظ لهذا اللفظ من قبل — أو `null`. */
export function recallPhrase(lexicon, { target, phrase, codes }) {
  const code = lexicon?.[target]?.[lexiconKey(phrase)];
  /* ورمزٌ محفوظٌ لم يعد في القائمة يُطرح: القوائمُ تتبدّل، والمعجمُ لا
     يُفلت رمزاً مهجوراً إلى عمودٍ تقرؤه اللوحة. */
  return code && Object.keys(codes ?? {}).includes(code) ? code : null;
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
