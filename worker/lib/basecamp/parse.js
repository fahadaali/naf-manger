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
  'رقم الإقامة': 'client.idNumber',
  'نوع الهوية': 'client.idType',
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

/** مفرداتٌ افتراضية — والمعتمَدُ ما في «تكوين النظام». */
export const DEFAULT_RELATIONS = ['أصيل', 'وكيل', 'أب', 'أم', 'أخ', 'ابن', 'زوج', 'أخرى'];
export const DEFAULT_ID_TYPES = ['هوية وطنية', 'إقامة', 'سجل تجاري'];

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
export function parseSummary(html, fieldMap = DEFAULT_FIELD_MAP, vocab = {}) {
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

  for (const line of lines) {
    const target = byKey.get(line.key);
    if (!target) {
      if (line.value) unmapped.push({ label: line.label, value: line.value });
      continue;
    }
    if (!line.value) continue;

    const [entity, field] = target.split('.');

    /* ═══ القيمةُ المعنونة تُوحَّد إن كان هدفُها رقماً ═══
       «الجوال: 050… وجوال أخيه 055…» سطرٌ واحد، وأخذُه كما هو يجعل حقلَ
       الجوّال يحمل جملةً. فيُؤخذ أوّلُ رقمٍ صالحٍ فيه، ويُترك الباقي
       للمسح الديناميكي أدناه يلتقطه بصفته. */
    if (target === 'client.phone') {
      const first = extractPhones(line.value, relations)[0];
      if (first) client.phone = first.number;
      continue;
    }
    if (target === 'client.idNumber') {
      const first = extractIdentities(line.value, idTypes)[0];
      if (first) {
        client.idNumber = first.number;
        if (first.type) client.idType = first.type;
      }
      continue;
    }

    const value = translate(target, line.value);
    if (entity === 'client') client[field] = value;
    else kase[field] = value;
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

  return { client, case: kase, unmapped, labels: lines.map((line) => line.label), phones, identities };
}

/* ما جاء من الخريطة قد يكون «+966 50 …» — فيُوحَّد ليُقارَن بما مُسح. */
function normalizePhoneLike(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('00966')) return `0${digits.slice(5)}`;
  if (digits.startsWith('966')) return `0${digits.slice(3)}`;
  if (digits.length === 9 && digits[0] !== '0') return `0${digits}`;
  return digits;
}
