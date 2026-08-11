// قراءةُ «بيانات المشروع» — من HTML محرّر بيسكامب إلى حقولٍ مفهومة.
//
// ═══ لماذا قواعدُ لا استخلاصٌ ذكي ═══
//
// الملفّ حقولٌ معنونة ثابتة: «اسم العميل: …» و«رقم الهوية: …». وهذا يُقرأ
// بقاعدةٍ تُخطئ خطأً ظاهراً أو تصيب — لا بطرازٍ يُخمّن فيُنتج اسماً معقولاً
// لم يُكتب قطّ. وهذه بياناتُ موكّلين، والتخمينُ فيها أسوأُ من الفراغ.
//
// ═══ والخريطة تُعدَّل بلا نشرِ شيفرة ═══
//
// عناوينُ الحقول تختلف بين مكتبٍ وآخر، وقد تتبدّل. فتُحفظ في
// `system_settings` وتُعدَّل من الشاشة — والافتراض أدناه اقتراحٌ يُبنى عليه.

import { normalizeArabic } from './discover.js';
import { extractIdentities, extractPhones, toLatinDigits } from './numbers.js';

/** حقول المنصة التي يقبل الربط الكتابةَ فيها. */
export const TARGETS = {
  'client.fullName': { label: 'اسم العميل', entity: 'client', required: true },
  'client.idNumber': { label: 'رقم الهوية', entity: 'client' },
  'client.idType': { label: 'نوع الهوية', entity: 'client' },
  'client.phone': { label: 'رقم الجوال', entity: 'client' },
  'client.email': { label: 'البريد الإلكتروني', entity: 'client' },
  'client.clientType': { label: 'نوع العميل', entity: 'client' },
  'client.commercialRegister': { label: 'السجل التجاري', entity: 'client' },
  'client.legalRepresentative': { label: 'مسؤول التواصل', entity: 'client' },
  'client.notes': { label: 'ملاحظات العميل', entity: 'client' },
  'case.caseNumber': { label: 'رقم القضية', entity: 'case' },
  'case.caseType': { label: 'نوع القضية', entity: 'case' },
  'case.summary': { label: 'موضوع المشروع', entity: 'case' },
  'case.status': { label: 'حالة المشروع', entity: 'case' },
  'case.outcome': { label: 'نتيجة المشروع', entity: 'case' },
  'case.notes': { label: 'ملاحظات المشروع', entity: 'case' },
};

/**
 * خريطةٌ افتراضية — اقتراحٌ يُصحَّح من الشاشة بعد رؤية ملفٍّ حقيقي.
 *
 * وفيها عناوينُ «المشروع» و«القضية» معاً: الملفّ صار «بيانات المشروع»
 * وعناوينُه تبعته، ومشاريعُ سنينَ ماضية لا تزال تقول «القضية». وخريطةٌ
 * تعرف الاثنين تقرأ القديمَ والجديد بلا أن يُعاد ضبطُها.
 */
export const DEFAULT_FIELD_MAP = {
  'اسم العميل': 'client.fullName',
  'العميل': 'client.fullName',
  'الموكل': 'client.fullName',
  /* والمنشأةُ عميلٌ كالفرد: اسمُها في الحقل نفسه، ويفرّقهما «نوع العميل». */
  'اسم الشركة': 'client.fullName',
  'اسم المنشأة': 'client.fullName',
  'اسم الجهة': 'client.fullName',
  'مسؤول التواصل': 'client.legalRepresentative',
  'مسؤول الاتصال': 'client.legalRepresentative',
  'ممثل الشركة': 'client.legalRepresentative',
  'الممثل النظامي': 'client.legalRepresentative',
  'المفوض بالتوقيع': 'client.legalRepresentative',
  'المفوض': 'client.legalRepresentative',
  'رقم الهوية': 'client.idNumber',
  'الهوية': 'client.idNumber',
  'رقم الإقامة': 'client.idNumber',
  'نوع الهوية': 'client.idType',
  'السجل التجاري': 'client.commercialRegister',
  'رقم الجوال': 'client.phone',
  'الجوال': 'client.phone',
  'الهاتف': 'client.phone',
  'البريد الإلكتروني': 'client.email',
  'البريد': 'client.email',
  'نوع العميل': 'client.clientType',
  'تصنيف العميل': 'client.clientType',
  'صفة العميل': 'client.clientType',
  'ملاحظات العميل': 'client.notes',
  'رقم القضية': 'case.caseNumber',
  'رقم المشروع': 'case.caseNumber',
  'رقم الملف': 'case.caseNumber',
  'نوع القضية': 'case.caseType',
  'نوع المشروع': 'case.caseType',
  'موضوع القضية': 'case.summary',
  'موضوع المشروع': 'case.summary',
  'ملخص القضية': 'case.summary',
  'ملخص المشروع': 'case.summary',
  'وصف المشروع': 'case.summary',
  'حالة القضية': 'case.status',
  'حالة المشروع': 'case.status',
  'نتيجة القضية': 'case.outcome',
  'نتيجة المشروع': 'case.outcome',
  'النتيجة': 'case.outcome',
  'ملاحظات': 'case.notes',
  'الملاحظات': 'case.notes',
  'ملاحظات المشروع': 'case.notes',
  'ملاحظات القضية': 'case.notes',
  'ملاحظات إضافية': 'case.notes',
};

/** مفرداتٌ افتراضية — والمعتمَدُ ما في «تكوين النظام». */
export const DEFAULT_RELATIONS = ['أصيل', 'وكيل', 'أب', 'أم', 'أخ', 'ابن', 'زوج', 'أخرى'];
export const DEFAULT_ID_TYPES = ['هوية وطنية', 'إقامة', 'سجل تجاري'];

const ENTITIES = {
  /* مفرداتُ المنصة كما في `roles.js` و«تكوين النظام» — والملفّ يكتبها
     بالعربية، فتُترجَم إلى ما يقبله العمود.

     والمفرداتُ كثيرةٌ عمداً: من يكتب «بيانات المشروع» يكتب «شركة» مرّةً
     و«مؤسسة» أخرى و«قطاع خاص» ثالثة، وكلُّها واحد. وما لا يُعرف يبقى كما
     كُتب — لا يُطمس إلى الافتراضي. */
  clientType: {
    'فرد': 'individual', 'أفراد': 'individual', 'شخص': 'individual',
    'فردي': 'individual', 'عميل فرد': 'individual', 'شخص طبيعي': 'individual',
    'شركة': 'company', 'مؤسسة': 'company', 'منشأة': 'company',
    'شركات': 'company', 'مؤسسة فردية': 'company', 'قطاع خاص': 'company',
    'شخص اعتباري': 'company',
    'جمعية': 'association', 'جمعية خيرية': 'association', 'جهة غير ربحية': 'association',
    'مؤسسة خيرية': 'association',
    'جهة حكومية': 'government', 'حكومي': 'government', 'حكومية': 'government',
    'قطاع حكومي': 'government', 'جهة رسمية': 'government',
  },
  status: {
    'منظورة': 'pending', 'جديدة': 'pending', 'قيد النظر': 'pending',
    'لم تبدأ': 'pending', 'بانتظار': 'pending',
    'قيد المعالجة': 'in-progress', 'جارية': 'in-progress', 'قيد العمل': 'in-progress',
    'قائمة': 'in-progress', 'تحت الإجراء': 'in-progress', 'مستمرة': 'in-progress',
    'مكتملة': 'completed', 'منتهية': 'completed', 'مغلقة': 'completed',
    'منجزة': 'completed', 'تم': 'completed', 'انتهت': 'completed',
    'مؤجلة': 'postponed', 'متوقفة': 'postponed', 'معلقة': 'postponed',
  },
  outcome: {
    'ربح': 'won', 'كسب': 'won', 'رابحة': 'won', 'لصالحنا': 'won',
    'لصالح العميل': 'won', 'لصالح الموكل': 'won', 'ناجحة': 'won', 'حكم لنا': 'won',
    'مكسوبة': 'won',
    'خسارة': 'lost', 'خاسرة': 'lost', 'ضدنا': 'lost',
    'ضد العميل': 'lost', 'مرفوضة': 'lost', 'حكم علينا': 'lost',
    'تسوية': 'settled', 'صلح': 'settled', 'تصالح': 'settled',
    'اتفاق': 'settled', 'تسوية ودية': 'settled', 'صلح ودي': 'settled',
  },
};

const ENTITY_REFS = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ',
};

/**
 * HTML محرّر بيسكامب إلى نصٍّ بأسطر.
 *
 * والوسومُ التي تفصل سطراً — `br` و`div` و`p` و`li` و`tr` — تصير سطراً
 * جديداً قبل أن تُجرَّد، وإلا التصق «اسم العميل: فلان» بما بعده فصار
 * سطراً واحداً لا يُقرأ منه حقلان.
 */
export function htmlToText(html) {
  /* الأرقام الهندية تصير غربية هنا، مرّةً، قبل أيّ قراءة — فلا يبقى قارئٌ
     يحتاج أن يتذكّرها. و«٠٥٠» و«050» رقمٌ واحد، وحفظُهما مختلفَين يجعل
     البحث عن أحدهما لا يجد الآخر. */
  return toLatinDigits(html)
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p|li|tr|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<(?:div|p|li|tr|h[1-6]|blockquote)\b[^>]*>/gi, '\n')
    .replace(/<\/(?:td|th)\s*>/gi, ': ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&[a-z]+;|&#39;/gi, (entity) => ENTITY_REFS[entity.toLowerCase()] ?? entity)
    .split('\n')
    .map((line) => line.replace(/ /g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/* الفاصلُ بين العنوان وقيمته: نقطتان — عربية أو لاتينية — وقد تسبقهما
   مسافة، وقد يكون العنوان بين نجمتين من محرّرٍ يخطّ العريض. */
const LINE = /^\s*[*_\-•]*\s*([^:：]{1,60}?)\s*[:：]\s*(.*)$/;

/**
 * أسطرُ «عنوان: قيمة» إلى كائن.
 *
 * ويُحتفظ بالعنوان كما كُتب وبصورته الموحَّدة معاً: الأول يُعرض في الشاشة
 * ليتعرّفه صاحبُه، والثاني يُطابَق به فلا يُسقط حقلاً شدّد كاتبُه حرفاً.
 *
 * ═══ وعنوانٌ تُرك فارغاً يأخذ ما تحته ═══
 *
 * الملاحظاتُ تُكتب هكذا في ملفّات المكتب:
 *
 *     الملاحظات:
 *     - العميل يفضّل التواصل مساءً
 *     - الأوراق الأصلية عند وكيله
 *
 * فالسطر الأول عنوانٌ بلا قيمة، وما تحته أسطرٌ بلا نقطتين — وكانت تُطرح
 * كلُّها صامتةً فتصل الملاحظاتُ فارغة. فيُلحَق ما بعد العنوان الفارغ به
 * حتى العنوان التالي.
 *
 * والشرطُ «فارغاً» لا يُتجاوز: عنوانٌ حمل قيمةً قد يتلوه ذيلُ الملفّ أو
 * توقيعٌ أو فقرةٌ لا تخصّه — وابتلاعُها في حقلٍ أسوأُ من إسقاطها، إذ
 * تُكتب في ملفّ موكّلٍ كأنها منه.
 */
export function readLabelledLines(text) {
  const found = [];
  let open = null;

  for (const line of String(text ?? '').split('\n')) {
    const match = line.match(LINE);

    if (!match) {
      const trailing = line.replace(/[*_]/g, '').trim();
      if (open && trailing) open.value = open.value ? `${open.value}\n${trailing}` : trailing;
      continue;
    }

    const label = match[1].replace(/[*_]/g, '').trim();
    const value = match[2].replace(/[*_]+$/, '').trim();
    if (!label) continue;

    const entry = { label, key: normalizeArabic(label), value };
    found.push(entry);
    open = value ? null : entry;
  }
  return found;
}

/**
 * ═══ الجذرُ يُغني عن استقصاء الصيغ ═══
 *
 * «ربحانة» و«ربحناها» و«ربحنا» — ثلاثُ صيغٍ لمعنىً واحد، ولا تنتهي:
 * يكتب المحامي اليوم صيغةً ويكتب غداً أخرى. وجدولُ المفردات فوقُ لا يلحق
 * بها مهما طال.
 *
 * فتُطلب الجذور بعد أن يعجز الجدول. وهي قليلةٌ عمداً — لا تُقبل إلا التي
 * لا تحتمل ضدَّها: «ربح» و«خسر» و«صلح». و«لصالح» ليست منها، إذ «لصالح
 * الخصم» ضدُّ «لصالحنا» ولفظُهما واحد.
 */
const ROOTS = {
  'case.outcome': [
    [/ربح|كسب|فوز|فزن/, 'won'],
    [/خسر/, 'lost'],
    [/صلح|تسوي|تصالح/, 'settled'],
  ],
  'case.status': [
    /* و«غلق» لا «مغلق»: المحامي يكتب «أُغلقت» فعلاً كما يكتبها وصفاً. */
    [/انته|منته|منجز|مكتمل|غلق|قفل/, 'completed'],
    [/قيد|جاري|جاريه|مستمر/, 'in-progress'],
    [/موجل|متوقف|معلق/, 'postponed'],
    [/منظور|بانتظار/, 'pending'],
  ],
  'client.clientType': [
    [/شرك|مؤسس|موسس|منشا/, 'company'],
    [/جمعي|خيري|ربحي/, 'association'],
    [/حكوم|وزار|امار|بلدي/, 'government'],
    [/فرد|شخص/, 'individual'],
  ],
};

/* والنفيُ يُبطل الجذر: «لم نربح» فيها «ربح» ومعناها ضدُّه. وما نُفي لا
   يُخمَّن — يُردّ غيرَ مفهوم فيُسأل عنه. */
const NEGATION = /(^|\s)(لم|لن|غير|ليس|ليست|بدون|بلا)(\s|$)/;

/** أهذا هدفٌ قيمُه مغلقةٌ في المنصة؟ */
const CLOSED = {
  'client.clientType': ENTITIES.clientType,
  'case.status': ENTITIES.status,
  'case.outcome': ENTITIES.outcome,
};

/**
 * يوحّد المفردات العربية إلى ما يقبله العمود.
 *
 * ═══ وما لا يُفهَم لا يُكتب ═══
 *
 * كان ما لا يُعرف يُترك كما هو، وعلّتُه أنّ «تكوين النظام» يقبل مفرداتٍ
 * يضيفها المكتب. وذلك صحيحٌ في **نوع القضية** — قائمةٌ مفتوحة يكتب فيها
 * المكتب ما شاء.
 *
 * وغيرُ صحيحٍ في الثلاثة أدناه: `outcome` و`status` و`client_type` قيمُها
 * رموزٌ مغلقة تقرؤها اللوحةُ والتقارير — «معدّل الربح» يعدّ
 * `outcome = 'won'` وحدها. فقيمةٌ حرّة تُكتب في العمود تُعرض في بطاقة
 * القضية وتغيب عن كل إحصاء: يكتب المحامي «ربحانة» فتُحفظ، ثم لا تُعدّ
 * قضيةً رابحة في اللوحة ولا في تقرير المسوّق ولا يقول أحدٌ لِمَ.
 *
 * فيُردّ `null`، ويُسأل عنه: الطرازُ يُطابقه بالرموز، وإن عجز قيل في
 * المعاينة «نتيجةٌ لم تُفهَم» ولم يُكتب شيء.
 */
function translate(target, value) {
  const table = CLOSED[target];
  if (!table) return value;

  const normalized = normalizeArabic(value);
  for (const [arabic, code] of Object.entries(table)) {
    if (normalizeArabic(arabic) === normalized) return code;
  }

  if (!NEGATION.test(` ${normalized} `)) {
    for (const [pattern, code] of ROOTS[target] ?? []) {
      if (pattern.test(normalized)) return code;
    }
  }

  return null;
}

/**
 * رموزُ حقلٍ مغلق ووجهُها العربي — تُعرض للطراز ليختار منها، ولا يُقبل
 * غيرُها. وهي نسخةٌ من `src/lib/labels.ts`، والمصدرُ سجلُّ المصطلحات.
 */
export const CLOSED_CODES = {
  'client.clientType': {
    individual: 'فرد', company: 'شركة', association: 'جمعية', government: 'جهة حكومية',
  },
  'case.status': {
    pending: 'منظورة', 'in-progress': 'قيد المعالجة', completed: 'مكتملة', postponed: 'مؤجلة',
  },
  'case.outcome': { won: 'رابحة', lost: 'خاسرة', settled: 'تسوية' },
};

/**
 * قيمةٌ خامٌ من الملفّ إلى ما يقبله الحقل.
 *
 * ═══ ولماذا هي دالّةٌ مكشوفة ═══
 *
 * لهذه القراءة طريقان: العنوانُ المعروف في الخريطة، والقارئُ الآليّ حين
 * يتبدّل شكلُ الملفّ فلا تجد الخريطةُ عنواناً. والطريقان يجب أن ينتهيا
 * إلى التوحيد نفسه — «منجزة» تصير `completed` سواءٌ جاءت من عنوانٍ معروف
 * أو من استخلاصٍ آليّ. ونسختان من هذا المنطق تفترقان بعد شهر، فيصير
 * ما يأتي من طريقٍ غيرَ ما يأتي من الآخر وهو هو.
 *
 * وتردّ `null` لقيمةٍ لا تصلح للحقل — رقمُ جوّالٍ ليس رقماً، واسمُ مسؤولٍ
 * ليس إلا رقماً.
 */
export function coerceTarget(target, rawValue, vocab = {}) {
  const relations = vocab.contactRelations ?? DEFAULT_RELATIONS;
  const idTypes = vocab.idTypes ?? DEFAULT_ID_TYPES;

  const [entity, field] = String(target).split('.');
  const value = String(rawValue ?? '').trim();
  if (!entity || !field || !value || !(target in TARGETS)) return null;

  /* ═══ القيمةُ تُوحَّد إن كان هدفُها رقماً ═══
     «الجوال: 050… وجوال أخيه 055…» سطرٌ واحد، وأخذُه كما هو يجعل حقلَ
     الجوّال يحمل جملةً. فيُؤخذ أوّلُ رقمٍ صالحٍ فيه، ويُترك الباقي
     للمسح الديناميكي يلتقطه بصفته. */
  if (target === 'client.phone') {
    const first = extractPhones(value, relations)[0];
    return first ? { entity, values: { phone: first.number } } : null;
  }

  if (target === 'client.idNumber') {
    const first = extractIdentities(value, idTypes)[0];
    if (!first) return null;
    const values = { idNumber: first.number };
    if (first.type) values.idType = first.type;
    return { entity, values };
  }

  /* ═══ مسؤولُ التواصل سطرٌ واحد فيه ثلاثة ═══
     «مسؤول التواصل: أحمد الغامدي - 0551234567» — اسمٌ ورقمٌ وربما هوية.
     فيُقرأ الثلاثةُ إلى العمود الذي يقبلها (`legal_representative`)،
     ولا يُحشر السطرُ كلُّه في خانة الاسم. */
  if (target === 'client.legalRepresentative') {
    const representative = readRepresentative(value, relations, idTypes);
    return representative ? { entity, values: { legalRepresentative: representative } } : null;
  }

  /* والملاحظاتُ تُترك كما كُتبت: لا مفرداتِ توحيدٍ لها، وقصُّها تشويه. */
  if (field === 'notes') return { entity, values: { notes: value } };

  const translated = translate(target, value);
  /* وحقلٌ مغلقٌ لم يُفهَم لفظُه: لا يُكتب، ويُردّ بلفظه ليُسأل عنه. */
  if (translated === null) return { entity, values: {}, unresolved: { target, value } };

  return { entity, values: { [field]: translated } };
}

/**
 * يقرأ المستند إلى `{ client, case, unmapped, labels }`.
 *
 * و`unmapped` عناوينُ وُجدت في الملفّ ولا مقابل لها في الخريطة — تُعرض في
 * الشاشة لتُربط، فلا يضيع حقلٌ صامتاً لأنّ أحداً لم يعرف أنه هناك.
 */
export function parseDocument(html, fieldMap = DEFAULT_FIELD_MAP, vocab = {}) {
  const relations = vocab.contactRelations ?? DEFAULT_RELATIONS;
  const idTypes = vocab.idTypes ?? DEFAULT_ID_TYPES;
  const primaryRelation = relations[0] ?? 'أصيل';

  const lines = readLabelledLines(htmlToText(html));

  /* الخريطة تُطبَّع مرّةً: مفاتيحُها يكتبها إنسانٌ في الشاشة، وقد يشدّد. */
  const byKey = new Map();
  for (const [label, target] of Object.entries(fieldMap ?? {})) {
    if (target && target in TARGETS) byKey.set(normalizeArabic(label), target);
  }

  const client = {};
  const kase = {};
  const unmapped = [];
  /* ألفاظٌ في حقلٍ مغلقٍ لم تُفهَم — «ربحانة» و«خسرناه». تُردّ ليُسأل
     عنها ولا تُكتب حرّةً في عمودٍ تقرؤه اللوحةُ رمزاً. */
  const unresolved = [];
  /* الملاحظاتُ تُجمَع ولا تُدهس: «الملاحظات» و«ملاحظات إضافية» عنوانان
     يشيران إلى حقلٍ واحد، وآخِرُهما كان يمحو أوّلَهما. */
  const notes = { client: [], case: [] };

  for (const line of lines) {
    const target = byKey.get(line.key);
    if (!target) {
      if (line.value) unmapped.push({ label: line.label, value: line.value });
      continue;
    }
    if (!line.value) continue;

    const [entity, field] = target.split('.');

    if (field === 'notes') {
      notes[entity].push({ label: line.label, value: line.value });
      continue;
    }

    const coerced = coerceTarget(target, line.value, { contactRelations: relations, idTypes });
    if (!coerced) continue;
    if (coerced.unresolved) unresolved.push(coerced.unresolved);
    Object.assign(coerced.entity === 'client' ? client : kase, coerced.values);
  }

  /* وملاحظةٌ واحدة تُكتب كما هي، وأكثرُ يُصدَّر كلٌّ منها بعنوانه — وإلا
     التصق كلامان لعنوانين مختلفين فقُرئا واحداً. */
  for (const [entity, entries] of Object.entries(notes)) {
    if (!entries.length) continue;
    const text = entries.length === 1
      ? entries[0].value
      : entries.map((entry) => `${entry.label}: ${entry.value}`).join('\n');
    if (entity === 'client') client.notes = text;
    else kase.notes = text;
  }

  /* ═══ ثمّ المسحُ الديناميكي على النصّ كلِّه ═══

     ما جاء من الخريطة يبقى سيّداً — عنوانٌ كتبه صاحبُ الملفّ أدقُّ من
     ترجيحٍ من شكل رقم. والمسحُ يُكمل ما نقص: أرقاماً في سطورٍ بلا عنوان،
     ورقماً ثانياً في سطرٍ فيه رقمان، ونوعَ هويةٍ يُرجَّح من أول رقمها. */
  const text = htmlToText(html);

  const phones = extractPhones(text, relations);
  const identities = extractIdentities(text, idTypes);

  /* الرقم الأول: ما وُسم «أصيل» إن وُجد، وإلا أولُ ما ظهر. وما جاء من
     الخريطة يسبقهما — فإن كتب صاحبُ الملفّ «رقم الجوال» صراحةً فهو المعنيّ. */
  const primary = phones.find((entry) => entry.relation === primaryRelation) ?? phones[0];
  if (!client.phone && primary) client.phone = primary.number;
  else if (client.phone) {
    const normalized = phones.find((entry) => entry.number === normalizePhoneLike(client.phone));
    if (normalized) client.phone = normalized.number;
  }

  const contacts = [];
  for (const entry of phones) {
    contacts.push({
      number: entry.number,
      relation: entry.relation ?? (entry.number === client.phone ? primaryRelation : null),
    });
  }
  if (contacts.length) client.contacts = contacts;

  const identity = identities[0];
  if (!client.idNumber && identity) client.idNumber = identity.number;
  if (!client.idType && identity?.type) client.idType = identity.type;

  /* وهويةٌ جاءت من الخريطة بلا نوع: يُرجَّح نوعُها من رقمها هي. */
  if (client.idNumber && !client.idType) {
    const matched = identities.find((entry) => entry.number === client.idNumber);
    if (matched?.type) client.idType = matched.type;
  }

  return {
    client, case: kase, unmapped, unresolved,
    labels: lines.map((line) => line.label), phones, identities,
  };
}

/**
 * «أحمد الغامدي - 0551234567» إلى `{ name, contact, idNumber }`.
 *
 * والرقمُ يُقصّ من الاسم بعد التقاطه: اسمٌ يحمل ذيلَ رقمٍ يُطبع في وكالةٍ
 * أو خطابٍ كما هو. ويُردّ `null` لسطرٍ لا اسمَ فيه — «مسؤول التواصل:
 * 0551234567» رقمٌ بلا صاحب، ويلتقطه المسحُ العام أدناه بصفته.
 */
function readRepresentative(value, relations, idTypes) {
  const phone = extractPhones(value, relations)[0];
  const identity = extractIdentities(value, idTypes)[0];

  const name = String(value)
    /* كلُّ ما يشبه رقماً يُقصّ — لا الملتقطُ وحده: الملتقطُ موحَّدُ الشكل
       («0551234567») وفي النصّ قد يكون «+966 55 123 4567». */
    .replace(/(?:\+|00)?\d[\d\s\-().]{5,24}\d/g, ' ')
    .replace(/[-–—:،,(){}[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name) return null;
  return {
    name,
    idNumber: identity?.number ?? '',
    contact: phone?.number ?? '',
  };
}

/* ما جاء من الخريطة قد يكون «+966 50 …» — فيُوحَّد ليُقارَن بما مُسح. */
function normalizePhoneLike(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00966')) return `0${digits.slice(5)}`;
  if (digits.startsWith('966')) return `0${digits.slice(3)}`;
  if (digits.length === 9 && digits[0] !== '0') return `0${digits}`;
  return digits;
}
