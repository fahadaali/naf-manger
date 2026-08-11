// مقارنةُ الأسماء العربية — أهذا الاسمان لرجلٍ واحد؟
//
// ═══ المسألة ═══
//
// «محمد خالد عبدالله القحطاني» و«محمد خالد القحطاني» اسمٌ واحد كُتب مرّةً
// كاملاً ومرّةً مختصراً. ومقارنةٌ حرفية تقول إنهما اثنان: فيُنشأ موكّلٌ
// ثانٍ لرجلٍ واحد، أو يقف اسمُه اختلافاً في كل مزامنة.
//
// ═══ والحكمُ لرقم الهوية لا للاسم ═══
//
// **الهويةُ هي الفصل.** إذا تطابق رقمُها فهو هو، مهما اختلف رسمُ الاسم —
// وهذا ما تفعله `findClient` أصلاً. وما هنا يخدم ما بعد المطابقة: أيُّ
// الاسمين يُكتب، وهل يُسأل عن فرقهما.
//
// وحين لا هويةَ في الملفّ فالاسمُ وحده لا يُدمج به موكّلان: «محمد القحطاني»
// اسمُ عشرة. فيقتصر على **الاقتراح** — يُقال في المعاينة «يشبه فلاناً،
// راجِعه» ولا يُربط بلا قرارِ إنسان. ودمجُ ملفَّي موكّلين مختلفين خطأٌ لا
// يُكشف إلا بعد أن يُبنى عليه.

import { normalizeArabic } from './discover.js';

/* حروفُ الوصل في الأسماء: تُطرح قبل المقارنة. «محمد بن خالد» و«محمد خالد»
   اسمٌ واحد، والفرقُ عادةُ كاتبٍ لا فرقُ شخص. */
const CONNECTORS = new Set(['بن', 'ابن', 'بنت', 'ابنه', 'ال', 'عبد']);

/* أداةُ التعريف تُطرح من أوّل كل كلمة: «القحطاني» و«قحطاني» واحد. و«آل»
   تبقى كلمةً مستقلّة — «آل سعود» ليست «سعود»، وطرحُها يخلط بيتاً ببيت. */
const stripArticle = (token) =>
  token.length > 3 && token.startsWith('ال') ? token.slice(2) : token;

/**
 * كلماتُ الاسم موحَّدةً — بلا حروف وصلٍ ولا أداةِ تعريف.
 *
 * و«عبد» تُطرح كلمةً مستقلّة لا لاصقة: «عبد الله» و«عبدالله» يصيران
 * «الله» و«عبدالله»، وهما مختلفان حرفاً — فتُطرح المستقلّة ويُلصق ما
 * بعدها بما قبلها. وذلك أشيعُ اختلافٍ في رسم الأسماء السعودية.
 */
export function nameTokens(name) {
  const words = normalizeArabic(name)
    .split(/\s+/)
    .filter(Boolean);

  const tokens = [];
  for (let index = 0; index < words.length; index++) {
    const word = words[index];

    /* «عبد» متبوعةً بكلمة: تُلصق بها فتصير كلمةً واحدة كما تُكتب غالباً —
       «عبد الله» و«عبدالله»، و«عبد الرحمن» و«عبدالرحمن». وتُلصق كما هي بلا
       نزعِ «ال»: هي من الاسم لا أداةَ تعريفٍ عليه. */
    if ((word === 'عبد' || word === 'عبدال') && index + 1 < words.length) {
      tokens.push(`${word}${words[index + 1]}`.replace('عبدالال', 'عبدال'));
      index++;
      continue;
    }

    if (CONNECTORS.has(word)) continue;
    const stripped = stripArticle(word);
    if (stripped) tokens.push(stripped);
  }
  return tokens;
}

/**
 * ما صلةُ الاسمين؟ `same` أو `abbreviation` أو `different`.
 *
 * و`abbreviation` شرطُها ثلاثة، وكلُّها لازم:
 *
 *   ١) كلماتُ الأقصر كلُّها في الأطول، **بترتيبها** — فـ«محمد خالد» في
 *      «محمد خالد عبدالله القحطاني»، وليست «خالد محمد» فيه.
 *   ٢) الاسمُ الأول واحد. الابنُ يشارك أباه اسمَ الجدّ والقبيلة، ويفترق
 *      عنه في أوّل اسمه — فإسقاطُ هذا الشرط يدمج ابناً بأبيه.
 *   ٣) الاسمُ الأخير واحد — أي القبيلة أو العائلة.
 *
 * و«محمد خالد القحطاني» مع «محمد سعد القحطاني» → `different`: الأولُ
 * والأخيرُ واحد، لكنّ «سعد» ليست في الأول ولا «خالد» في الثاني، فليس
 * أحدُهما اختصاراً للآخر.
 */
export function nameRelation(one, other) {
  const first = nameTokens(one);
  const second = nameTokens(other);
  if (!first.length || !second.length) return 'different';

  if (first.length === second.length && first.every((token, at) => token === second[at])) {
    return 'same';
  }

  const [short, long] = first.length <= second.length ? [first, second] : [second, first];

  if (short[0] !== long[0]) return 'different';
  if (short[short.length - 1] !== long[long.length - 1]) return 'different';

  /* الاحتواءُ بترتيبه: يُمشى في الأطول مرّةً واحدة. */
  let at = 0;
  for (const token of long) {
    if (token === short[at]) at++;
    if (at === short.length) break;
  }
  return at === short.length ? 'abbreviation' : 'different';
}

/** أهما اسمٌ واحد — تطابقاً أو اختصاراً؟ */
export const sameParty = (one, other) => nameRelation(one, other) !== 'different';

/**
 * أيُّ الاسمين يُكتب حين يكونان لرجلٍ واحد؟ الأتمُّ.
 *
 * ومكتبُ محاماة يريد الاسمَ الكامل: هو ما يُكتب في الوكالة والصحيفة.
 * فإن حمل الملفُّ اسماً أتمَّ ممّا عندنا كُتب — وذلك بعد أن ثبت أنهما
 * واحد، بهويةٍ أو باحتواءِ الاسم.
 */
export const fullerName = (one, other) =>
  nameTokens(other).length > nameTokens(one).length ? other : one;
