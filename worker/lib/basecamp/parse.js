// قراءةُ «ملخص القضية» — من HTML محرّر بيسكامب إلى حقولٍ مفهومة.
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

/** حقول المنصة التي يقبل الربط الكتابةَ فيها. */
export const TARGETS = {
  'client.fullName': { label: 'اسم العميل', entity: 'client', required: true },
  'client.idNumber': { label: 'رقم الهوية', entity: 'client' },
  'client.phone': { label: 'رقم الجوال', entity: 'client' },
  'client.email': { label: 'البريد الإلكتروني', entity: 'client' },
  'client.clientType': { label: 'نوع العميل', entity: 'client' },
  'client.commercialRegister': { label: 'السجل التجاري', entity: 'client' },
  'case.caseNumber': { label: 'رقم القضية', entity: 'case' },
  'case.caseType': { label: 'نوع القضية', entity: 'case' },
  'case.summary': { label: 'ملخص القضية', entity: 'case' },
  'case.status': { label: 'حالة القضية', entity: 'case' },
  'case.outcome': { label: 'نتيجة القضية', entity: 'case' },
};

/** خريطةٌ افتراضية — اقتراحٌ يُصحَّح من الشاشة بعد رؤية ملفٍّ حقيقي. */
export const DEFAULT_FIELD_MAP = {
  'اسم العميل': 'client.fullName',
  'العميل': 'client.fullName',
  'رقم الهوية': 'client.idNumber',
  'الهوية': 'client.idNumber',
  'السجل التجاري': 'client.commercialRegister',
  'رقم الجوال': 'client.phone',
  'الجوال': 'client.phone',
  'الهاتف': 'client.phone',
  'البريد الإلكتروني': 'client.email',
  'البريد': 'client.email',
  'نوع العميل': 'client.clientType',
  'رقم القضية': 'case.caseNumber',
  'نوع القضية': 'case.caseType',
  'موضوع القضية': 'case.summary',
  'ملخص القضية': 'case.summary',
  'حالة القضية': 'case.status',
  'نتيجة القضية': 'case.outcome',
};

const ENTITIES = {
  /* مفرداتُ المنصة كما في `roles.js` و«تكوين النظام» — والملفّ يكتبها
     بالعربية، فتُترجَم إلى ما يقبله العمود. */
  clientType: {
    'فرد': 'individual', 'أفراد': 'individual', 'شخص': 'individual',
    'شركة': 'company', 'مؤسسة': 'company', 'منشأة': 'company',
    'جمعية': 'association',
    'جهة حكومية': 'government', 'حكومي': 'government',
  },
  status: {
    'منظورة': 'pending', 'جديدة': 'pending', 'قيد النظر': 'pending',
    'قيد المعالجة': 'in-progress', 'جارية': 'in-progress', 'قيد العمل': 'in-progress',
    'مكتملة': 'completed', 'منتهية': 'completed', 'مغلقة': 'completed',
    'مؤجلة': 'postponed',
  },
  outcome: {
    'ربح': 'won', 'كسب': 'won', 'رابحة': 'won', 'لصالحنا': 'won',
    'خسارة': 'lost', 'خاسرة': 'lost', 'ضدنا': 'lost',
    'تسوية': 'settled', 'صلح': 'settled',
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
  return String(html ?? '')
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
 */
export function readLabelledLines(text) {
  const found = [];
  for (const line of String(text ?? '').split('\n')) {
    const match = line.match(LINE);
    if (!match) continue;

    const label = match[1].replace(/[*_]/g, '').trim();
    const value = match[2].replace(/[*_]+$/, '').trim();
    if (!label) continue;

    found.push({ label, key: normalizeArabic(label), value });
  }
  return found;
}

/** يوحّد المفردات العربية إلى ما يقبله العمود. */
function translate(target, value) {
  const table =
    target === 'client.clientType' ? ENTITIES.clientType
      : target === 'case.status' ? ENTITIES.status
        : target === 'case.outcome' ? ENTITIES.outcome
          : null;
  if (!table) return value;

  const normalized = normalizeArabic(value);
  for (const [arabic, code] of Object.entries(table)) {
    if (normalizeArabic(arabic) === normalized) return code;
  }
  /* مفردةٌ لا تُعرف تُترك كما هي: «تكوين النظام» يقبل مفرداتٍ يضيفها
     المكتب، وطمسُها إلى الافتراضي يُخفي ما كتبه المحامي. */
  return value;
}

/**
 * يقرأ المستند إلى `{ client, case, unmapped, labels }`.
 *
 * و`unmapped` عناوينُ وُجدت في الملفّ ولا مقابل لها في الخريطة — تُعرض في
 * الشاشة لتُربط، فلا يضيع حقلٌ صامتاً لأنّ أحداً لم يعرف أنه هناك.
 */
export function parseSummary(html, fieldMap = DEFAULT_FIELD_MAP) {
  const lines = readLabelledLines(htmlToText(html));

  /* الخريطة تُطبَّع مرّةً: مفاتيحُها يكتبها إنسانٌ في الشاشة، وقد يشدّد. */
  const byKey = new Map();
  for (const [label, target] of Object.entries(fieldMap ?? {})) {
    if (target && target in TARGETS) byKey.set(normalizeArabic(label), target);
  }

  const client = {};
  const kase = {};
  const unmapped = [];

  for (const line of lines) {
    const target = byKey.get(line.key);
    if (!target) {
      if (line.value) unmapped.push({ label: line.label, value: line.value });
      continue;
    }
    if (!line.value) continue;

    const [entity, field] = target.split('.');
    const value = translate(target, line.value);
    if (entity === 'client') client[field] = value;
    else kase[field] = value;
  }

  return { client, case: kase, unmapped, labels: lines.map((line) => line.label) };
}
