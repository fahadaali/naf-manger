// استخراجُ الأرقام من نصّ الملفّ — جوّالاتٍ وهوياتٍ وصفاتِ أصحابها.
//
// ═══ لماذا لا يكفي «العنوان: القيمة» ═══
//
// كان الرقم يُؤخذ من السطر المعنون وحده. وملفّاتُ المكتب لا تُكتب هكذا:
//
//   جوال العميل ٠٥٠١١١١١١١ وجوال أخيه 0552222222
//   الجوال: +966 50 123 4567
//   للتواصل: 0501234567 (وكيله)
//
// فكان يتجاوز أرقاماً حاضرةً في الملفّ لأنّ عنوانَها ليس في الخريطة، أو
// لأنّ في السطر رقمين لا واحداً. فصار المسحُ على النصّ كلِّه: كلُّ ما
// يشبه رقماً يُلتقط ويُوحَّد شكلُه، ثم يُنسب إلى صاحبه ممّا حوله.

import { normalizeArabic } from './discover.js';
import { toLatinDigits } from '../digits.js';

/* ═══ الأرقام الهندية تصير غربية ═══
   الملفّات تخلط: «٠٥٠» في سطر و«050» في الذي يليه. والتطبيع يقع على النصّ
   كلِّه قبل أيّ قراءة. ودالّتُه في `lib/digits.js` لأنّ الكتابة اليدوية
   ورفعَ CSV يحتاجانها كذلك — ونسختان منها تفترقان بعد شهر. */
export { toLatinDigits };

/* مرشّحٌ لرقم: سلسلةُ أرقامٍ بينها فواصلُ كتابةٍ محتملة. والحدُّ الأدنى
   تسعةُ محارف حتى لا يُلتقط تاريخٌ أو مبلغ. */
const CANDIDATE = /(?:\+|00)?\d[\d\s\-().]{7,24}\d/g;

/**
 * يوحّد رقماً سعودياً إلى `0XXXXXXXXX`.
 *
 * ويردّ `null` لما ليس رقمَ هاتف — ومنه **رقمُ الهوية**: عشرةُ أرقامٍ
 * تبدأ بغير صفر. وهذا هو الفصلُ بين الاثنين، ولولاه لصار رقمُ الهوية
 * جوّالاً والعكس.
 */
export function normalizePhone(raw) {
  /* والتطبيع هنا كذلك لا في المنادي وحده: هذه دالّةٌ مكشوفة، ومن يناديها
     برقمٍ هنديٍّ يستحقّ أن يصحّ لا أن يُردّ صامتاً. */
  let digits = toLatinDigits(raw).replace(/\D/g, '');

  if (digits.startsWith('00966')) digits = digits.slice(5);
  else if (digits.startsWith('966')) digits = digits.slice(3);

  /* تسعةُ أرقامٍ تبدأ بغير صفر: رقمٌ محليٌّ سقط صفرُه — «501234567». */
  if (digits.length === 9 && digits[0] !== '0') digits = `0${digits}`;

  if (!/^0[1-9]\d{8}$/.test(digits)) return null;
  return digits;
}

/** عشرةُ أرقامٍ تبدأ بغير صفر — هويةٌ أو إقامةٌ أو سجلٌّ تجاري. */
export function normalizeIdNumber(raw) {
  const digits = toLatinDigits(raw).replace(/\D/g, '');
  return /^[1-9]\d{9}$/.test(digits) ? digits : null;
}

/* ═══ الصفة تُقرأ ممّا حول الرقم ═══
   والمفرداتُ من «تكوين النظام»، وهذه مرادفاتُها كما تُكتب في الملفّات. */
const HINTS = {
  'وكيل': ['وكيل', 'مفوض', 'ممثل'],
  'أب': ['اب', 'والد'],
  'أم': ['ام', 'والده'],
  'أخ': ['اخ', 'شقيق'],
  'ابن': ['ابن', 'نجل'],
  'زوج': ['زوج'],
  'أصيل': ['اصيل', 'العميل', 'الموكل', 'صاحب'],
};

/* لواحقُ تُقبل بعد المفردة: «أخيه» و«والده» و«وكيلها». وما بعدها حرفٌ
   غيرُها كلمةٌ أخرى — فـ«ابنه» ليست «أب» وإن بدأت بحرفيها. */
const SUFFIX = new Set(['ه', 'ا', 'ي', 'ة', 'م', 'ن', 'ك']);

function mentions(context, hint) {
  let from = 0;
  for (;;) {
    const at = context.indexOf(hint, from);
    if (at < 0) return false;

    const before = context[at - 1];
    const after = context[at + hint.length];
    const startsWord = !before || !/[ء-ي]/.test(before) || 'الوبل'.includes(before);
    const endsWord = !after || !/[ء-ي]/.test(after) || SUFFIX.has(after);

    if (startsWord && endsWord) return true;
    from = at + 1;
  }
}

/**
 * أيُّ صفةٍ من المفردات تذكرها هذه العبارة؟
 *
 * وتُجرَّب الأطولُ أوّلاً: «ابن» تحمل حرفَي «اب»، فترتيبُ الطول يمنع أن
 * يُقرأ ابنُ الموكّل أباه.
 */
export function relationFrom(context, vocabulary) {
  const text = normalizeArabic(context);
  if (!text) return null;

  const candidates = [...(vocabulary ?? [])].sort((a, b) => b.length - a.length);
  for (const relation of candidates) {
    const hints = [normalizeArabic(relation), ...(HINTS[relation] ?? []).map(normalizeArabic)]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (hints.some((hint) => mentions(text, hint))) return relation;
  }
  return null;
}

/**
 * كلُّ جوّالٍ في النصّ، ومعه صفةُ صاحبه.
 *
 * والسياق ما قبل الرقم في سطره — ثم عنوانُ السطر إن خلا ما قبله. فسطرٌ فيه
 * رقمان لصاحبين يُقرأ لكلٍّ صفتُه، وسطرٌ معنونٌ برقمٍ واحد يأخذ صفةَ عنوانه.
 */
export function extractPhones(text, vocabulary = []) {
  const found = [];
  const seen = new Set();

  for (const line of toLatinDigits(text).split('\n')) {
    const colon = line.search(/[:：]/);
    const label = colon >= 0 ? line.slice(0, colon) : '';

    /* السياق يبدأ من نهاية الرقم السابق لا من أول السطر: في «جوال العميل
       050… وجوال أخيه 055…» تقع «أخيه» بين الرقمين، فلو قُرئ السياق من
       أول السطر لوُصف الرقمان كلاهما بها. */
    let from = colon >= 0 ? colon + 1 : 0;

    for (const match of line.matchAll(CANDIDATE)) {
      const number = normalizePhone(match[0]);
      const before = line.slice(from, match.index);
      from = match.index + match[0].length;

      if (!number || seen.has(number)) continue;
      seen.add(number);

      /* وما بعد الرقم لا يُقرأ إلا بين قوسين: «050… (وكيله)» تصفه،
         و«050… وجوال أخيه 055…» تصف الذي يليه لا هو. */
      const parenthetical = line.slice(from).match(/^\s*[({[]([^)}\]]{1,30})[)}\]]/);

      const relation =
        relationFrom(parenthetical?.[1] ?? '', vocabulary) ??
        relationFrom(before, vocabulary) ??
        relationFrom(label, vocabulary) ??
        null;

      found.push({ number, relation });
    }
  }

  return found;
}

/**
 * الهوياتُ في النصّ، ولكلٍّ نوعُها.
 *
 * والنوعُ من عنوان سطره أوّلاً — فهو ما كتبه صاحبُ الملفّ. وحين يغيب
 * يُرجَّح من أول رقم: السعودي يبدأ بـ١ والمقيم بـ٢. ولا يُرجَّح السجلُّ
 * التجاري من رقمه — أوائلُه تشبه الهوية الوطنية، والترجيحُ فيه يخطئ.
 */
export function extractIdentities(text, vocabulary = []) {
  const byLabel = [
    { needles: ['سجل تجاري', 'السجل التجاري', 'سجل'], type: 'سجل تجاري' },
    { needles: ['اقامة', 'الاقامة', 'رقم الاقامة'], type: 'إقامة' },
    { needles: ['هوية', 'الهوية', 'هوية وطنية'], type: 'هوية وطنية' },
  ];

  const known = (wanted) =>
    (vocabulary ?? []).find((entry) => normalizeArabic(entry) === normalizeArabic(wanted)) ?? wanted;

  const found = [];
  const seen = new Set();

  for (const line of toLatinDigits(text).split('\n')) {
    const colon = line.search(/[:：]/);
    const label = normalizeArabic(colon >= 0 ? line.slice(0, colon) : '');

    for (const match of line.matchAll(CANDIDATE)) {
      const number = normalizeIdNumber(match[0]);
      if (!number || seen.has(number)) continue;

      /* رقمٌ في سطرٍ عنوانُه جوّال ليس هوية وإن شابهها طولاً. */
      if (/جوال|هاتف|جوّال|تلفون|رقم التواصل/.test(label)) continue;
      seen.add(number);

      const labelled = byLabel.find((entry) =>
        entry.needles.some((needle) => label.includes(normalizeArabic(needle))),
      );

      const type = labelled
        ? known(labelled.type)
        : number.startsWith('1') ? known('هوية وطنية')
          : number.startsWith('2') ? known('إقامة')
            : null;

      found.push({ number, type });
    }
  }

  return found;
}
