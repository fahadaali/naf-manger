// محرّكُ المزامنة — يخطّط ثم ينفّذ، والمعاينةُ هي التخطيطُ بلا تنفيذ.
//
// ═══ لماذا خطّةٌ منفصلة عن تنفيذها ═══
//
// «ما الذي سيقع؟» و«أَوقِعْه» سؤالان على المعطيات نفسها. ولو كُتبا مرّتين
// لافترقا: تُعرض معاينةٌ ثم يقع غيرُها. فالخطّة تُبنى مرّةً، وتُعرض كما
// هي، ثم تُنفَّذ كما عُرضت.
//
// ═══ والدمجُ ثلاثيّ ═══
//
// لكل حقلٍ ثلاثُ قيم: ما في المنصة الآن، وما كتبته المزامنة آخرَ مرّة
// (`synced_values`)، وما في بيسكامب الآن. ومنها يُعرف من تحرّك:
//
//   المنصة كما تركناها + بيسكامب تبدّل  →  يُكتب بلا إزعاج
//   المنصة تبدّلت (يدٌ مسّته) + بيسكامب كما هو  →  يُترك، المنصة أحدث
//   تبدّل الطرفان  →  تعارضٌ يُسجَّل بالقيمتين، ولا يُكتب
//
// وهذا ما اختاره صاحبُ المكتب صراحةً على «بيسكامب يفوز دائماً»: تصحيحٌ
// يُمحى صامتاً في بيانات موكّلين أسوأُ من تعارضٍ ينتظر قراراً.

import { BasecampError } from './api.js';
import { readProjectDocument } from './discover.js';
import {
  CLOSED_CODES,
  DEFAULT_FIELD_MAP,
  TARGETS,
  coerceTarget,
  htmlToText,
  parseDocument,
} from './parse.js';
import {
  classifyValue,
  extractFields,
  readLexicon,
  recallPhrase,
  rememberPhrase,
} from '../ai/extract.js';
import { normalizeArabic } from './discover.js';
import { fullerName, nameRelation } from './names.js';
import { openReview } from './reviews.js';
import {
  aiEnabled,
  fingerprint,
  newBudget,
  suggestCaseType,
  summarizeCase,
  summarizeClient,
} from '../ai/summarize.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * لحظةُ إنشاء المشروع عندهم — ثوانيَ.
 *
 * وبيسكامب تردّها ISO بإزاحةِ الحساب («‎2021-04-15T14:22:38.000+03:00‎»)،
 * فتُقرأ لحظةً صحيحة. و`null` لما لا يُقرأ — فلا يُكتب تاريخٌ مفبرك.
 */
function toEpoch(iso) {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? null : Math.floor(at / 1000);
}

const FIELD_MAP_KEY = 'basecamp_field_map';

/** الحقول التي تملكها المزامنة. وما عداها للمنصة وحدها. */
export const CLIENT_FIELDS = [
  'fullName', 'idNumber', 'idType', 'phone', 'contacts', 'email', 'clientType',
  'commercialRegister', 'legalRepresentative', 'notes',
];
export const CASE_FIELDS = ['caseNumber', 'caseType', 'summary', 'status', 'outcome', 'notes'];

/* و`contacts` خارج الدمج: مصفوفةٌ تُضمّ ضمّاً — أرقامٌ تُزاد ولا يُحذف
   منها رقم — فلا معنى لمقارنةِ «قبلُ وبعدُ» فيها ولا لتعارضٍ عليها. */
const CLIENT_MERGE_FIELDS = CLIENT_FIELDS.filter((field) => field !== 'contacts');

/* الأتعاب والعمولات والمسوّق لا تُمسّ: ليست في «بيانات المشروع»، وتُدار في
   المنصة وحدها. وذكرُها هنا صراحةً أوضحُ من أن تُعرف بغيابها. */

const CLIENT_COLUMN = {
  fullName: 'full_name', idNumber: 'id_number', idType: 'id_type', phone: 'phone',
  email: 'email', clientType: 'client_type', commercialRegister: 'commercial_register',
  legalRepresentative: 'legal_representative', notes: 'notes',
};
const CASE_COLUMN = {
  caseNumber: 'case_number', caseType: 'case_type', summary: 'summary',
  status: 'status', outcome: 'outcome', notes: 'notes',
};

/**
 * عمودٌ في المنصة يُقرأ فارغاً وإن كان مملوءاً.
 *
 * `client_type` عمودٌ `NOT NULL DEFAULT 'individual'` — فكلُّ عميلٍ أُنشئ
 * قبل أن يحمل ملفُّه «نوع العميل» يحمل «فرد» لا لأنّ أحداً قرّرها، بل لأنّ
 * العمود لا يقبل الفراغ. ولو عُدَّت قيمةً منطوقة لَما نزل «شركة» من
 * «بيانات المشروع» على عميلٍ قائم أبداً — وهو أوّلُ ما يُنتظر من هذا العمل.
 */
const COLUMN_DEFAULT = { client_type: 'individual' };
const isBlank = (column, value) =>
  value === null || value === undefined || String(value) === '' ||
  String(value) === COLUMN_DEFAULT[column];

export async function readFieldMap(env) {
  const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = ?`)
    .bind(FIELD_MAP_KEY)
    .first();
  if (!row?.value) return { ...DEFAULT_FIELD_MAP };
  try {
    const stored = JSON.parse(row.value);
    return stored && typeof stored === 'object' && Object.keys(stored).length
      ? stored
      : { ...DEFAULT_FIELD_MAP };
  } catch {
    return { ...DEFAULT_FIELD_MAP };
  }
}

export async function writeFieldMap(env, map, userId) {
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                    updated_by = excluded.updated_by,
                                    updated_at = excluded.updated_at`,
  )
    .bind(FIELD_MAP_KEY, JSON.stringify(map), userId, nowSeconds())
    .run();
}

/**
 * مفرداتُ «تكوين النظام» التي يقرؤها القارئ.
 *
 * فصفةُ صاحب الرقم ونوعُ الهوية يحرّرهما المكتب، والقارئُ يطابق ما كُتب في
 * الملفّ بما اختاره المكتب — لا بقائمةٍ مكتوبةٍ في الشيفرة.
 */
async function readVocabulary(env) {
  const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = 'platform'`)
    .first();
  let stored = {};
  try { stored = JSON.parse(row?.value ?? '{}') ?? {}; } catch { stored = {}; }
  return {
    contactRelations: Array.isArray(stored.contactRelations) ? stored.contactRelations : undefined,
    idTypes: Array.isArray(stored.idTypes) ? stored.idTypes : undefined,
    /* وأنواعُ القضايا: منها وحدَها يختار الاقتراحُ الآليّ. فما يقترحه
       الطراز نوعٌ يعرفه المكتب ويراه في منسدلاته، لا مفردةٌ من عنده. */
    caseTypes: Array.isArray(stored.caseTypes) ? stored.caseTypes : undefined,
  };
}

const POLICY_KEY = 'basecamp_conflict_policy';

/**
 * ═══ ماذا يقع حين يتبدّل الطرفان؟ ═══
 *
 * `ask` — يُسجَّل بالقيمتين ولا يُكتب، ويُحسم من الشاشة. وهو الافتراض،
 *         واختاره صاحبُ المكتب صراحةً على «بيسكامب يفوز دائماً»: تصحيحٌ
 *         يُمحى صامتاً في بيانات موكّلين أسوأُ من تعارضٍ ينتظر قراراً.
 *
 * `basecamp` — تُكتب قيمتُهم. لمكتبٍ يحرّر في بيسكامب ويقرأ في المنصة،
 *         فبيسكامب مصدرُه وما في المنصة صورةٌ عنه.
 *
 * `platform` — تُترك قيمةُ المنصة وتُثبَّت الصورة، فلا يُسأل عنها ثانيةً.
 *
 * وليس في الثلاثة ما «يوقف الاستيراد»: التعارضُ حقلٌ واحد لا يُكتب،
 * وبقيةُ الحقول والقضايا والعملاء تُكتب كلُّها. والسياسةُ إنما تُغني عن
 * حسمِ كلِّ حقلٍ بيد لمن استقرّ عنده أيُّ الطرفين أصحّ.
 */
async function readConflictPolicy(env) {
  const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = ?`)
    .bind(POLICY_KEY)
    .first();
  try {
    const stored = JSON.parse(row?.value ?? '{}');
    return ['ask', 'basecamp', 'platform'].includes(stored?.policy) ? stored.policy : 'ask';
  } catch {
    return 'ask';
  }
}

export async function writeConflictPolicy(env, policy, userId) {
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                    updated_by = excluded.updated_by,
                                    updated_at = excluded.updated_at`,
  )
    .bind(POLICY_KEY, JSON.stringify({ policy }), userId, nowSeconds())
    .run();
}

export { readConflictPolicy };

const safeJson = (text) => {
  try { return JSON.parse(text ?? 'null'); } catch { return null; }
};

/**
 * صورةُ آخرِ مزامنة — الطرفُ الثالث في الدمج.
 *
 * وكانت حقولَ القضية مبسوطةً في الجذر، فصارت `{ case, client }` حين دخل
 * العميلُ الدمج. والقديمة تُقرأ كما هي: صفوفُ الإنتاج تحملها، وقراءتُها
 * فارغةً تجعل أوّلَ مزامنةٍ بعد النشر تظنّ أنّ كلَّ حقلٍ جديد.
 */
function readSnapshot(raw) {
  const stored = safeJson(raw) ?? {};
  if (stored && typeof stored === 'object' && ('case' in stored || 'client' in stored)) {
    return { case: stored.case ?? {}, client: stored.client ?? {} };
  }
  return { case: stored ?? {}, client: {} };
}

/**
 * ═══ الدمجُ الثلاثي لحقلٍ واحد ═══
 *
 * ثلاثُ قيم: ما في المنصة، وما كتبته المزامنة آخرَ مرّة، وما في بيسكامب
 * الآن. والناتجُ واحدٌ من ثلاثة: `write` أو `keep` أو `conflict`.
 *
 * و`firstContact` هو الفرق بين العميل والقضية:
 *
 *   القضيةُ تُطابَق برقمها، ورقمُها من الملفّ — فصفٌّ قائمٌ بلا صورةٍ محفوظة
 *   قضيةٌ كتبها استيرادٌ سابق، وبيسكامب مصدرُها.
 *
 *   والعميلُ يُطابَق بهويته أو باسمه، وقد يكون أُنشئ في المنصة يدوياً قبل
 *   بيسكامب بسنة. فالكتابةُ فوق قيمةٍ مكتوبةٍ بلا صورةٍ تشهد لا تجوز:
 *   يُملأ الفارغُ صامتاً، ويُسأل عمّا فيه قيمةٌ تخالف.
 */
const strictly = (one, other) => String(one ?? '') === String(other ?? '');

function mergeField({ current, incoming, lastSynced, blank, firstContact, same = strictly, policy = 'ask' }) {
  if (incoming === undefined || incoming === null || incoming === '') return { action: 'keep' };
  if (same(current, incoming)) return { action: 'keep' };

  /* والسياسةُ تحسم ما كان يُسأل عنه: `basecamp` تكتب قيمتَهم، و`platform`
     تُبقي ما عندنا وتثبّت الصورة فلا يُعاد السؤال. */
  const settle = () => (policy === 'basecamp' ? { action: 'write' }
    : policy === 'platform' ? { action: 'settle' }
      : { action: 'conflict' });

  if (lastSynced === undefined) {
    if (blank) return { action: 'write' };
    return firstContact ? settle() : { action: 'write' };
  }

  const basecampChanged = !same(incoming, lastSynced);
  if (!basecampChanged) return { action: 'keep' };

  const platformTouched = !same(current, lastSynced);
  return platformTouched ? settle() : { action: 'write' };
}

/**
 * رقمُ قضيةٍ بديلٌ ثابت حين لا يحمله الملفّ.
 *
 * والثباتُ شرط: مزامنةٌ ثانية يجب أن تجد الصفَّ نفسه لا أن تُنشئ ثانياً.
 * فيُشتقّ من معرّف المشروع في بيسكامب — وهو لا يتبدّل.
 *
 * **ولا يُولَّد رقمُ هوية بهذا ولا بغيره.** عمودُه يقبل الغياب، ورقمٌ
 * مخترَعٌ في ملفّ موكّل يُقرأ حقيقياً بعد شهر. أمّا رقمُ القضية فهو مفتاحٌ
 * داخليّ لا يدّعي شيئاً عن الخارج، وإسقاطُ القضية بدله يُضيع ما جيء لأجله.
 */
const fallbackNumber = (prefix, projectId) => `${prefix}-${projectId}`;

/**
 * يبحث عن عميلٍ مطابق — بالهوية أوّلاً ثم بالاسم الموحَّد.
 *
 * والاسمُ ثانياً لا أوّلاً: الهويةُ فريدةٌ في المخطَّط، والاسمُ يتشابه.
 * لكنّ ملفّاً بلا رقمِ هوية لا يعني عميلاً جديداً — وهو ما يفعله إنسانٌ
 * حين يقرأ اسماً يعرفه.
 *
 * ═══ والاسمُ المختصر يُقترح ولا يُدمج ═══
 *
 * «محمد خالد عبدالله القحطاني» و«محمد خالد القحطاني»: إن اتّحد رقمُ
 * الهوية فهما واحد — والمطابقةُ بالهوية تكفّلت بذلك قبل أن يُنظر في
 * الاسم أصلاً.
 *
 * أمّا بلا هوية فالاحتواءُ **مرشَّحٌ لا حكم**: «محمد القحطاني» اسمُ عشرة،
 * ودمجُ ملفَّي موكّلين مختلفين خطأٌ لا يُكشف إلا بعد أن يُبنى عليه —
 * توكيلٌ في ملفّ غيره، وقضيةٌ تُنسب إلى من ليس صاحبَها. فيُردّ في
 * `candidate` ليُقال في المعاينة، ويبقى الحكمُ لمن يقرأ.
 */
async function findClient(env, { idNumber, fullName }) {
  if (idNumber) {
    const byId = await env.DB.prepare(`SELECT * FROM clients WHERE id_number = ?`)
      .bind(idNumber)
      .first();
    if (byId) return { row: byId, matchedBy: 'idNumber' };
  }

  const { results } = await env.DB.prepare(`SELECT * FROM clients`).all();
  const target = normalizeArabic(fullName ?? '');
  if (!target) return null;

  const byName = (results ?? []).find((client) => normalizeArabic(client.full_name) === target);
  if (byName) return { row: byName, matchedBy: 'fullName' };

  const similar = (results ?? []).find(
    (client) => nameRelation(client.full_name, fullName) === 'abbreviation',
  );
  return similar ? { row: null, matchedBy: null, candidate: similar } : null;
}

/* ═══ ما يُسأل عنه الطراز، وما لا يُسأل ═══
 *
 * `client.idType` خارجَه: يُرجَّح من رقم الهوية نفسِه، وذلك أوثقُ من سؤال.
 *
 * و**`case.caseNumber` خارجَه بقصد**، وهو الاستثناء الذي يستحقّ سببَه:
 * رقمُ القضية مفتاحُ الربط — تُطابَق به القضيةُ القائمة ثم يُكتب فيها.
 * وملفُّ مشروعٍ قد يذكر رقمَ قضيةٍ أخرى (قضيةٌ مرتبطة، أو حكمٌ سابق)،
 * فينقله الطراز منقولاً صحيحاً من النصّ — ويُربط المشروعُ بقضية موكّلٍ
 * آخر فتُكتب حقولُه فيها.
 *
 * فالشرطُ الثاني (النقلُ الحرفي) يمنع الاختراع ولا يمنع أخذَ الرقم
 * الخطأ من الملفّ. والبديلُ عن ذلك رقمٌ مولَّدٌ يُعلَّم «يحتاج تصحيحاً» —
 * وهو ظاهرٌ يُصحَّح، لا ربطٌ صامتٌ بملفّ غيره.
 */
const RECOVERABLE = Object.keys(TARGETS).filter(
  (key) => key !== 'client.idType' && key !== 'case.caseNumber',
);

/** أهذا الحقلُ مملوءٌ في ما قرأته القاعدة؟ */
const already = (parsed, target) => {
  const [entity, field] = target.split('.');
  const bag = entity === 'client' ? parsed.client : parsed.case;
  return bag[field] !== undefined && bag[field] !== '';
};

/**
 * ═══ القراءةُ الآلية حين يتبدّل شكلُ الملفّ ═══
 *
 * ولا تُنادى في كل مشروع: نداءٌ على حسابٍ فيه ثلاثمئة مشروعٍ سليمِ الشكل
 * ثمنٌ بلا مقابل. فشرطُها أن يدلّ الظاهرُ على أنّ القاعدة عجزت:
 *
 *   • لا اسمَ عميل — وهو ما كان يردّ المشروعَ كلَّه `no_client_name`.
 *   • أو لم يُقرأ سطرٌ معنونٌ واحد — ملفٌّ كُتب فقرةً لا حقولاً.
 *   • أو بقيت حقولٌ فارغة **ومعها عناوينُ بلا ربط** — أي أنّ البنود
 *     تبدّلت أسماؤها، والقيمُ حاضرةٌ تحت عناوينَ لا تعرفها الخريطة.
 *
 * وما عدا ذلك: القاعدةُ قرأت ما في الملفّ، والفارغُ فارغٌ فيه حقّاً.
 */
async function recoverMissing(env, { parsed, text, vocab, ai }) {
  if (!ai?.enabled || !text) return [];

  const missing = RECOVERABLE.filter((target) => !already(parsed, target));
  if (!missing.length) return [];

  const blind = !parsed.client.fullName;
  const noLabels = (parsed.labels ?? []).length === 0;
  const shifted = parsed.unmapped.length > 0;
  if (!blind && !noLabels && !shifted) return [];

  if (!ai.budget.spend()) return [];

  const raw = await extractFields(env, {
    text,
    wanted: missing,
    labels: Object.fromEntries(missing.map((key) => [key, TARGETS[key].label])),
  });
  if (!Object.keys(raw).length) {
    ai.budget.failed++;
    return [];
  }

  /* وما رُدَّ يمرّ على المدقّقين أنفسِهم: `normalizePhone` للجوّال،
     و`normalizeIdNumber` للهوية، وجدولِ المفردات للحالة والنتيجة — كما لو
     جاء من عنوانٍ معروف. فلا يدخل عمودَ الهوية ما ليس هوية. */
  const taken = [];
  for (const [target, value] of Object.entries(raw)) {
    const coerced = coerceTarget(target, value, vocab);
    if (!coerced) continue;

    const bag = coerced.entity === 'client' ? parsed.client : parsed.case;
    for (const [field, coercedValue] of Object.entries(coerced.values)) {
      /* ولا يُدهس شيء: القاعدةُ سيّدة، وقيمةٌ التقطها المسحُ الديناميكي
         (رقمٌ في سطرٍ بلا عنوان) أوثقُ من استخلاص. */
      if (bag[field] !== undefined && bag[field] !== '') continue;
      bag[field] = coercedValue;
      taken.push(`${coerced.entity}.${field}`);
    }
  }
  return taken;
}

/**
 * ═══ الألفاظُ التي لم تُفهَم ═══
 *
 * `outcome` و`status` و`client_type` أعمدةٌ مغلقة تقرؤها اللوحةُ رموزاً:
 * «معدّل الربح» يعدّ `outcome = 'won'` وحدها. فلفظٌ حرٌّ يُكتب فيها يظهر
 * في بطاقة القضية ويغيب عن كل إحصاء — يكتب المحامي «ربحانة» فتُحفظ، ثم
 * لا تُعدّ قضيةً رابحة في اللوحة ولا في تقرير المسوّق ولا يقول أحدٌ لِمَ.
 *
 * والجدولُ والجذورُ يكفيان أكثرَه. وما بقي يُسأل عنه الطراز — من القائمة
 * المغلقة وحدها. وما لم يُفهَم **لا يُكتب**، ويُقال في المعاينة.
 */
async function resolveVocabulary(env, { parsed, plan, ai }) {
  const resolved = [];
  if (!(parsed.unresolved ?? []).length) return resolved;

  /* ═══ واللفظُ يُقرأ في سياقه ═══
     «تحت الدراسة» وحدَها لا تقول شيئاً عن نتيجة القضية، وفي الملاحظات ما
     يفسّرها: «صدر الحكم لصالحنا وننتظر التنفيذ». فيُعطى الطرازُ ما حول
     اللفظ من الملفّ نفسِه. */
  const context = {
    الملاحظات: parsed.case.notes ?? '',
    موضوع_القضية: parsed.case.summary ?? '',
    نوع_القضية: parsed.case.caseType ?? '',
  };

  const lexicon = ai?.enabled ? await readLexicon(env) : {};

  for (const item of parsed.unresolved ?? []) {
    const [entity, field] = item.target.split('.');
    const bag = entity === 'client' ? parsed.client : parsed.case;
    /* وقد يكون مُلئ من سطرٍ آخر بلفظٍ مفهوم — فلا يُسأل عمّا عُرف. */
    if (bag[field] !== undefined && bag[field] !== '') continue;

    const meaning = TARGETS[item.target]?.label ?? item.target;
    const codes = CLOSED_CODES[item.target];
    if (!codes) continue;

    /* وما فُهم مرّةً لا يُستدلّ عليه ثانيةً: اللفظُ يبقى في الملفّ حتى
       يعدّله إنسان، والمزامنةُ كلَّ ساعة. */
    let code = ai?.enabled ? recallPhrase(lexicon, { target: item.target, phrase: item.value, codes }) : null;
    let asked = false;

    if (!code && ai?.enabled && ai.budget.spend()) {
      asked = true;
      code = await classifyValue(env, { phrase: item.value, label: meaning, codes, context });
      if (!code) ai.budget.failed++;
    }

    if (code) {
      bag[field] = code;
      resolved.push(item.target);
      /* ويُقال في كل دورة، جاء من الطراز أو من المعجم: المحفوظُ يوفّر
         الاستدلال ولا يوفّر المراجعة. */
      plan.warnings.push(`«${item.value}» فُهمت ${meaning}: ${codes[code]} — راجِعها`);
      if (asked) await rememberPhrase(env, { target: item.target, phrase: item.value, code, lexicon });
    } else {
      plan.warnings.push(`لفظٌ لم يُفهم في ${meaning}: «${item.value}» — لم يُكتب`);
      /* ويُفتح له صفٌّ فيه القائمةُ المغلقة: يختار منها صاحبُ المكتب مرّةً،
         فتُكتب ويُحفظ اللفظُ في المعجم — ولا يُسأل عنه ثانيةً. */
      plan.reviews.push({
        kind: 'unresolved_value',
        subject: item.value,
        fingerprint: `${item.target}:${item.value}`,
        detail: { target: item.target, field: meaning, value: item.value, codes },
      });
    }
  }

  return resolved;
}

/** خطّةُ مشروعٍ واحد: ماذا سيقع له ولماذا. */
async function planProject(env, connection, row, fieldMap, seen, vocab, ai, policy) {
  const plan = {
    projectId: row.project_id,
    projectName: row.name,
    appUrl: row.app_url,
    /* ═══ تاريخُ المشروع عندهم يخدم أمرين ═══
       `joinDate` — يومُه، ومنه «عميلٌ منذ».
       `createdOn` — لحظتُه، ومنها تاريخُ إنشاء القضية.
       واليومُ يُقتطع من النصّ لا يُشتقّ من `Date`: الاشتقاق يُدخل المنطقة
       الزمنية فينزلق اليوم عن اليوم الذي أنشأه فيه صاحبُ المكتب. */
    joinDate: row.created_on ? String(row.created_on).slice(0, 10) : null,
    createdOn: row.created_on ?? null,
    actions: [],       // create_client | link_client | create_case | update_case | none
    warnings: [],
    /* وما يستحقّ نظرَ إنسان: يُكتب صفّاً بعد التنفيذ ولا يحجب كتابة.
       فالمزامنةُ تمضي، والأسئلةُ تنتظر مجموعةً في شاشتها. */
    reviews: [],
    conflicts: [],
    error: null,
    client: null,
    case: null,
  };

  if (!row.doc_id) {
    plan.error = 'no_document';
    return plan;
  }

  let document;
  try {
    document = await readProjectDocument(connection, row.project_id, row.doc_id);
  } catch (readError) {
    plan.error = readError instanceof BasecampError ? readError.code : 'read_failed';
    return plan;
  }

  const parsed = parseDocument(document.content, fieldMap, vocab);
  plan.unmapped = parsed.unmapped;
  const synced = readSnapshot(row.synced_values);

  /* ═══ وحين تعجز القاعدة يُسأل الطراز ═══
     ما قرأته الخريطةُ سيّدٌ لا يُنقَض — والسؤالُ عمّا بقي فارغاً وحده،
     ولا يُنادى إلا حين يدلّ الظاهرُ على أنّ شكلَ الملفّ تبدّل. */
  const text = htmlToText(document.content ?? '');
  plan.aiFields = await recoverMissing(env, { parsed, text, vocab, ai });

  /* ═══ ولفظٌ لم يفهمه الجدولُ ولا الجذور ═══
     «ربحانة» فهمها الجذر، و«الحمد لله انتهت لصالحنا» قد لا يفهمها. فتُردّ
     إلى رمزٍ من القائمة المغلقة — أو لا تُكتب ويُقال ذلك. */
  plan.aiFields.push(...(await resolveVocabulary(env, { parsed, plan, ai })));

  if (!parsed.client.fullName) {
    plan.error = 'no_client_name';
    return plan;
  }

  // ── العميل ──
  /* ولا يُولَّد رقمُ هوية: العمود يقبل الغياب منذ الهجرة العاشرة، ورقمٌ
     مخترَعٌ في ملفّ موكّل يُقرأ حقيقياً بعد شهر. ويُقال في المعاينة أنه
     ناقص، ويُملأ في الشاشة. */
  const wanted = { ...parsed.client };
  if (!wanted.idNumber) plan.warnings.push('بلا رقم هوية — يُملأ في الشاشة');

  /* مسؤولُ التواصل بنيةٌ، وعمودُه نصُّ JSON. فيُسلسَل هنا — عند حدّ
     القاعدة — لا في القارئ: القارئُ يقرأ ملفّاً، ولا يعرف شكلَ عمود. */
  if (wanted.legalRepresentative && typeof wanted.legalRepresentative === 'object') {
    wanted.legalRepresentative = JSON.stringify(wanted.legalRepresentative);
  }

  /* ═══ ما ستُنشئه خطّةٌ سابقة موجودٌ في حكم هذه ═══

     الخطط تُبنى كلُّها على حالةِ القاعدة قبل أي كتابة. فمشروعان لعميلٍ
     واحد يخطّطان «أنشئ عميلاً» كلاهما — ثم يسقط الثاني بقيد التفرّد على
     رقم الهوية. وتقول المعاينةُ «عميلان جديدان» ويقع عميلٌ واحد وخطأ.

     فما تنوي خطّةٌ سابقة إنشاءه يُحسب موجوداً: يصير الثاني «ربطاً»،
     فتصدق المعاينةُ ويصحّ التنفيذ. وهي حالةُ «قضاياه المتعددة» نفسها. */
  const found = await findClient(env, wanted);
  const match = found?.row ? found : null;
  const pendingKey = normalizeArabic(wanted.fullName);
  const pending = !match && seen.clients.has(pendingKey);

  if (match?.matchedBy === 'fullName') plan.warnings.push('طوبق العميل بالاسم لا بالهوية');
  if (pending) plan.warnings.push('يُربط بعميلٍ يُنشئه مشروعٌ آخر في هذه الدفعة');
  /* مرشَّحٌ بالاسم بلا هوية: يُقال ولا يُدمج. ودمجُ ملفَّي موكّلين
     مختلفين خطأٌ لا يُكشف إلا بعد أن يُبنى عليه. */
  if (found?.candidate) {
    plan.warnings.push(`يشبه عميلاً قائماً: «${found.candidate.full_name}» — راجِعه قبل الإنشاء`);
    plan.reviews.push({
      kind: 'similar_client',
      subject: wanted.fullName,
      fingerprint: `${wanted.fullName}→${found.candidate.id}`,
      detail: { newName: wanted.fullName, existingName: found.candidate.full_name },
      otherClientId: found.candidate.id,
    });
  }

  /* ═══ وعميلٌ قائم يُدمَج لا يُترك ═══

     كان الاستيراد يكتب حقولَ العميل مرّةً — عند إنشائه — ثم لا يعود
     إليها أبداً. فمكتبٌ يضيف اليوم «نوع العميل» و«الملاحظات» إلى ملفّاتِ
     موكّليه القدامى يزامن فلا يقع شيء، ولا يُقال لِمَ.

     فحقولُ العميل تُدمج كحقول القضية: يُملأ الفارغ، ويُكتب ما تبدّل عندهم
     وحدهم، ويقف ما تبدّل عند الطرفين تعارضاً ينتظر قراراً. */
  const clientChanges = {};
  if (match?.row) {
    /* ═══ الاسمُ حالةٌ بذاتها ═══

       طوبق العميلُ بهويته، ثم يُقارن اسمُه حرفاً — فيقف «محمد خالد
       القحطاني» عند «محمد خالد عبدالله القحطاني» اختلافاً في كل مزامنة،
       وهما رجلٌ واحد بيقينِ الهوية.

       فما كان أحدُهما اختصاراً للآخر يُكتب أتمُّهما ولا يُسأل: مكتبُ
       محاماة يريد الاسم الكامل — هو ما يُكتب في الوكالة والصحيفة. وما
       كان اسماً آخر بحقٍّ يمضي إلى الدمج كبقية الحقول. */
    const relation = wanted.fullName
      ? nameRelation(match.row.full_name, wanted.fullName)
      : 'same';

    if (relation === 'abbreviation') {
      const fuller = fullerName(match.row.full_name, wanted.fullName);
      if (fuller !== match.row.full_name) {
        clientChanges.fullName = fuller;
        plan.warnings.push(`اسمُ الملفّ أتمُّ — يُكتب «${fuller}»`);
      }
    }

    for (const field of CLIENT_MERGE_FIELDS) {
      const column = CLIENT_COLUMN[field];
      if (!column) continue;
      /* والاسمُ حُسم فوق — إلا أن يكون اسماً آخر لا اختصاراً. */
      if (field === 'fullName' && relation !== 'different') continue;

      const verdict = mergeField({
        current: match.row[column],
        incoming: wanted[field],
        lastSynced: synced.client[field],
        blank: isBlank(column, match.row[column]),
        firstContact: true,
        policy,
      });

      if (verdict.action === 'write') clientChanges[field] = wanted[field];
      else if (verdict.action === 'conflict') {
        plan.conflicts.push({
          field: `client.${field}`,
          platformValue: String(match.row[column] ?? ''),
          basecampValue: String(wanted[field]),
        });
      }
    }
  }

  plan.client = {
    id: match?.row?.id ?? null,
    values: wanted,
    action: match || pending ? 'link_client' : 'create_client',
    changes: clientChanges,
  };
  plan.actions.push(plan.client.action);
  seen.clients.add(pendingKey);
  if (wanted.idNumber) seen.clients.add(`#${wanted.idNumber}`);

  // ── القضية ──
  const caseValues = { ...parsed.case };
  if (!caseValues.caseNumber) {
    caseValues.caseNumber = fallbackNumber('بيسكامب', row.project_id);
    plan.warnings.push('رقم القضية مولَّد — يحتاج تصحيحاً');
    plan.reviews.push({
      kind: 'generated_number',
      subject: caseValues.caseNumber,
      fingerprint: caseValues.caseNumber,
      detail: { generated: caseValues.caseNumber },
    });
  }
  /* ═══ نوعُ القضية حين يخلو منه الملفّ ═══

     كان يُكتب «غير محدّد» ويبقى كذلك في مئات القضايا المستوردة. والطراز
     يقترح نوعاً **من قائمة المكتب وحدها** — فما ليس في «تكوين النظام»
     يُردّ، وأسوأُ ما يقع أن يبقى الحقلُ كما كان.

     وهو اقتراحٌ يُقال في المعاينة قبل أن يُكتب: يُقرأ في الشاشة ويُصحَّح.
     ولا يُقترح فوق نوعٍ كتبه الملفّ أو كتبته يد — الاقتراحُ لمن لا شيءَ له. */
  if (!caseValues.caseType && ai?.enabled && ai.budget.spend()) {
    const suggestion = await suggestCaseType(env, {
      text: htmlToText(document.content ?? '').slice(0, 2000),
      options: vocab.caseTypes ?? [],
    });
    if (suggestion) {
      caseValues.caseType = suggestion;
      plan.caseTypeSuggested = true;
      plan.warnings.push(`نوعُ القضية مقترحٌ آلياً: «${suggestion}» — راجِعه`);
      plan.reviews.push({
        kind: 'case_type',
        subject: suggestion,
        fingerprint: suggestion,
        detail: { suggestion, options: vocab.caseTypes ?? [] },
      });
    } else {
      ai.budget.failed++;
    }
  }
  if (!caseValues.caseType) caseValues.caseType = 'غير محدّد';

  /* القضيةُ تُطابَق برقمها، ثم بالمشروع المربوط سابقاً — فتغييرُ رقمِ
     القضية في الملفّ يُحدِّث القضيةَ نفسَها ولا يُنشئ ثانية. */
  if (seen.cases.has(caseValues.caseNumber)) {
    /* مشروعان يحملان رقم القضية نفسَه: أحدهما سيدهس الآخر أو يسقط بقيد
       التفرّد. وهو تضاربٌ في ملفّاتهم لا في شيفرتنا — فيُسمّى ويُترك
       لصاحبه، ولا يُحسم بالتخمين. */
    plan.error = 'duplicate_case_number';
    return plan;
  }
  seen.cases.add(caseValues.caseNumber);

  let existingCase = await env.DB.prepare(`SELECT * FROM cases WHERE case_number = ?`)
    .bind(caseValues.caseNumber)
    .first();

  if (!existingCase && row.case_id) {
    existingCase = await env.DB.prepare(`SELECT * FROM cases WHERE id = ?`).bind(row.case_id).first();
    if (existingCase) plan.warnings.push('تبدّل رقم القضية في الملفّ');
  }

  if (!existingCase) {
    plan.case = { id: null, values: caseValues, action: 'create_case', changes: caseValues };
    plan.actions.push('create_case');
    return plan;
  }

  /* ═══ الدمجُ الثلاثي ═══
     والقضيةُ تُطابَق برقمها، ورقمُها من الملفّ — فصفٌّ قائمٌ بلا صورةٍ
     محفوظة كتبه استيرادٌ سابق، وبيسكامب مصدرُه. ولذلك لا `firstContact`
     هنا كما في العميل: تُكتب قيمتُهم ولا يُسأل. */
  const changes = {};

  for (const field of CASE_FIELDS) {
    const column = CASE_COLUMN[field];
    if (!column) continue;

    const verdict = mergeField({
      current: existingCase[column] ?? '',
      incoming: caseValues[field],
      lastSynced: synced.case[field],
      blank: isBlank(column, existingCase[column]),
      firstContact: false,
      policy,
    });

    if (verdict.action === 'write') changes[field] = caseValues[field];
    else if (verdict.action === 'conflict') {
      plan.conflicts.push({
        field,
        platformValue: String(existingCase[column] ?? ''),
        basecampValue: String(caseValues[field]),
      });
    }
  }

  plan.case = {
    id: existingCase.id,
    values: caseValues,
    action: Object.keys(changes).length ? 'update_case' : 'none',
    changes,
  };
  plan.actions.push(plan.case.action);
  return plan;
}

/** خطّةٌ لكل مشروعٍ مصنَّف «عميل». */
export async function buildPlan(env, connection) {
  const fieldMap = await readFieldMap(env);
  const { results } = await env.DB.prepare(
    `SELECT * FROM basecamp_projects WHERE kind = 'client' ORDER BY name`,
  ).all();

  const vocab = await readVocabulary(env);
  /* سياقُ الاستدلال يُبنى مرّةً للدورة كلِّها: السقفُ سقفُ الدورة لا
     سقفُ المشروع الواحد، وإلا استدلّ حسابٌ فيه ثلاثمئة مشروعٍ ثلاثمئة مرّة. */
  const ai = { enabled: await aiEnabled(env), budget: newBudget() };
  const policy = await readConflictPolicy(env);
  const seen = { clients: new Set(), cases: new Set() };
  const plans = [];
  for (const row of results ?? []) {
    plans.push(await planProject(env, connection, row, fieldMap, seen, vocab, ai, policy));
  }

  const summary = {
    projects: plans.length,
    createClients: plans.filter((p) => p.client?.action === 'create_client').length,
    linkClients: plans.filter((p) => p.client?.action === 'link_client').length,
    /* وعملاءُ سيُحدَّثون — عددٌ كان غائباً لأنّ العميل لم يكن يُحدَّث أصلاً. */
    updateClients: plans.filter((p) => Object.keys(p.client?.changes ?? {}).length).length,
    createCases: plans.filter((p) => p.case?.action === 'create_case').length,
    updateCases: plans.filter((p) => p.case?.action === 'update_case').length,
    unchanged: plans.filter((p) => p.case?.action === 'none').length,
    conflicts: plans.reduce((n, p) => n + p.conflicts.length, 0),
    failed: plans.filter((p) => p.error).length,
    warnings: plans.reduce((n, p) => n + p.warnings.length, 0),
    /* والاستدلالُ يُقال عددُه: من يرى «٢٥ استدلالاً و٤٠ مؤجَّلاً» يعرف أنّ
       الدورة بلغت سقفَها وأنّ الباقي في التي تليها — لا يظنّ أنّ الميزة
       عطلت. */
    ai: { enabled: ai.enabled, used: ai.budget.used, deferred: ai.budget.deferred },
    conflictPolicy: policy,
  };

  return { summary, plans, ai };
}

/* ═══ التنفيذ ═══ */

async function applyPlan(env, plan, actorId, ai) {
  const now = nowSeconds();
  /* وما حُدِّث يُفصَل بصاحبه: «حُدِّثت قضية» كان يُعدّ على أي كتابةٍ وقعت
     — ولو كانت رقمَ هاتفِ عميلها. والعميلُ يُحدَّث الآن فعلاً، فخلطُهما
     يجعل العدّادَ في الشاشة يقول ما لم يقع. */
  const result = {
    projectId: plan.projectId,
    /* ومعرّفُ العميل يُردّ: ملخّصُ قضاياه يُكتب بعد أن تُطبَّق الدفعة
       كلُّها — فقضاياه قد تتوزّع على مشاريعَ عدّة، وتلخيصُها بعد كلِّ
       مشروعٍ يلخّص نصفَها ثم يعيد. */
    clientId: null,
    created: [],
    updated: { client: [], case: [] },
    error: plan.error,
  };
  if (plan.error) return result;

  // ── العميل ──
  /* ويُعاد البحث هنا لا يُكتفى بما في الخطّة: خطّةٌ سابقة في هذه الدفعة
     قد أنشأت العميل بعد أن بُنيت هذه. وهذا هو الحارس الأخير قبل قيد
     التفرّد — والخطّةُ تصحّ بلا حاجةٍ إليه، لكنّه أرخصُ من صفٍّ ساقط. */
  const projectStart = toEpoch(plan.createdOn);

  let clientId = plan.client.id;
  let createdNow = false;
  if (!clientId) {
    const late = await findClient(env, plan.client.values);
    /* و`late.row` قد تكون فارغةً: البحثُ يردّ مرشَّحاً بالاسم كذلك، وهو
       اقتراحٌ لا مطابقة — فلا يُربط به موكّل. */
    if (late?.row) clientId = late.row.id;
  }
  if (!clientId) {
    clientId = crypto.randomUUID();
    createdNow = true;
    const values = plan.client.values;
    await env.DB.prepare(
      `INSERT INTO clients (id, full_name, id_number, id_type, phone, contacts, email,
                            client_type, commercial_register, legal_representative, notes,
                            join_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'current', ?, ?)`,
    )
      .bind(
        clientId,
        values.fullName,
        values.idNumber ?? null,
        values.idType ?? null,
        values.phone ?? '',
        JSON.stringify(values.contacts ?? []),
        values.email ?? '',
        values.clientType ?? 'individual',
        values.commercialRegister ?? null,
        /* وهو نصُّ JSON — سُلسِل في الخطّة عند حدّ القاعدة. */
        values.legalRepresentative ?? null,
        /* والعمود `NOT NULL DEFAULT ''` — فالغيابُ نصٌّ فارغ لا `NULL`. */
        values.notes ?? '',
        /* «عميلٌ منذ» تاريخُ إنشاء مشروعه عندهم — لا تاريخُ الاستيراد.
           و`COALESCE` في العمود يعطي اليوم حين يغيب. */
        plan.joinDate ?? new Date(now * 1000).toISOString().slice(0, 10),
        now,
        now,
      )
      .run();
    result.created.push('client');
  }

  /* ═══ عميلٌ قائم: ما حكمت به الخطّة، وما فات الخطّةَ يُملأ فارغُه ═══

     الخطّةُ دمجت حقولَه دمجاً ثلاثياً حين وجدت صفَّه — فيُكتب ما حكمت به.
     أمّا العميلُ الذي وجده البحثُ المتأخّر (أنشأه مشروعٌ آخر في هذه الدفعة
     بعد أن بُنيت هذه الخطّة) فلا حكمَ له، ويُملأ فارغُه وحدَه: أرقامٌ
     وهويةٌ ينقصانه، وما فيه قيمةٌ لا يُمسّ.

     والشرطُ «لم يُنشأ الآن» لا «كان في الخطّة»: مشروعان لعميلٍ واحد في
     دفعةٍ واحدة يُنشئ أوّلُهما العميل، وثانيهما يجده بالبحث المتأخّر —
     فتخطّيه هنا كان يُسقط دمجَ أرقامه **وتصحيحَ تاريخ انضمامه**، وهي
     بعينها حالةُ «العميل له أكثر من قضية». */
  if (!createdNow) {
    const current = await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`)
      .bind(clientId)
      .first();

    const fill = {};
    const values = plan.client.values;

    if (clientId === plan.client.id) {
      for (const [field, value] of Object.entries(plan.client.changes ?? {})) {
        const column = CLIENT_COLUMN[field];
        if (column) fill[column] = value;
      }
    } else {
      if (current && !current.id_number && values.idNumber) fill.id_number = values.idNumber;
      if (current && !current.id_type && values.idType) fill.id_type = values.idType;
      if (current && !current.phone && values.phone) fill.phone = values.phone;
      if (current && !current.notes && values.notes) fill.notes = values.notes;
      if (current && !current.legal_representative && values.legalRepresentative) {
        fill.legal_representative = values.legalRepresentative;
      }
    }

    /* ═══ «عميلٌ منذ» أقدمُ قضاياه ═══
       للموكّل قضايا، ولكلٍّ مشروعُها وتاريخُ إنشائه. وصفتُه عميلاً بدأت
       بأوّلها لا بآخرها ولا بالتي وقعت أن تُقرأ أوّلاً — والمشاريع تُقرأ
       بترتيب الاسم، فلا علاقة لترتيب القراءة بترتيب الزمن.

       والتحريكُ إلى الأقدم وحده: لا يُؤخَّر تاريخُ عميلٍ أبداً. فهو حسابُ
       أدنى القيم — يستوي فيه ترتيبُ المشاريع، ويصحّ مهما أُعيدت المزامنة،
       ويُبقي تاريخاً أقدمَ كتبته يدٌ. */
    if (current && plan.joinDate && (!current.join_date || plan.joinDate < current.join_date)) {
      fill.join_date = plan.joinDate;
    }

    const existingContacts = safeJson(current?.contacts) ?? [];
    const incoming = values.contacts ?? [];
    if (incoming.length) {
      const have = new Set(existingContacts.map((entry) => entry.number));
      const merged = [...existingContacts, ...incoming.filter((entry) => !have.has(entry.number))];
      if (merged.length !== existingContacts.length) fill.contacts = JSON.stringify(merged);
    }

    if (Object.keys(fill).length) {
      const columns = Object.keys(fill);
      await env.DB.prepare(
        `UPDATE clients SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      )
        .bind(...columns.map((c) => fill[c]), now, clientId)
        .run();
      result.updated.client.push(...columns);
    }
  }

  // ── القضية ──
  let caseId = plan.case?.id ?? null;
  if (plan.case?.action === 'create_case') {
    caseId = crypto.randomUUID();
    const values = plan.case.values;
    await env.DB.prepare(
      `INSERT INTO cases (id, case_number, case_type, client_id, client_name, summary, status,
                          outcome, notes, basecamp_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        caseId,
        values.caseNumber,
        values.caseType,
        clientId,
        plan.client.values.fullName,
        values.summary ?? '',
        values.status ?? 'pending',
        values.outcome ?? null,
        values.notes ?? '',
        plan.appUrl,
        /* ═══ القضيةُ أُنشئت يومَ أُنشئ مشروعُها ═══
           كانت تُختم بلحظة الاستيراد، فتظهر قضيةٌ من ٢٠٢١ منشأةً اليوم —
           ويُبنى على ذلك الترتيبُ في الشاشات والعمرُ في التقارير. */
        projectStart ?? now,
        now,
      )
      .run();
    result.created.push('case');
  } else if (plan.case?.action === 'update_case' && caseId) {
    const changes = plan.case.changes;
    const columns = Object.keys(changes).map((field) => CASE_COLUMN[field]);
    /* ورابطُ بيسكامب يُحدَّث دائماً مع أي كتابة: المشروع قد يُنقل فيتبدّل
       عنوانُه، والرابطُ في الشاشة يجب أن يفتح ما يفتحه اليوم. */
    columns.push('basecamp_url', 'updated_at');
    const assignments = columns.map((column) => `${column} = ?`).join(', ');
    await env.DB.prepare(`UPDATE cases SET ${assignments} WHERE id = ?`)
      .bind(...Object.keys(changes).map((f) => changes[f]), plan.appUrl, now, caseId)
      .run();
    result.updated.case.push(...Object.keys(changes));
  } else if (caseId) {
    await env.DB.prepare(`UPDATE cases SET basecamp_url = ? WHERE id = ?`)
      .bind(plan.appUrl, caseId)
      .run();
  }

  /* ═══ وتاريخُ الإنشاء يُصحَّح على مشروعه ═══
     قضايا استُوردت قبل هذا حملت تاريخَ الاستيراد، ولا تُصلحها مزامنةٌ
     تكتب الحقولَ المتبدّلة وحدها — إذ ليس `created_at` منها.

     وهو تصحيحٌ لا دهس: العمود لا تكتبه يدٌ من أي شاشة، فليس فيه ما يُحفظ.
     والشرطُ `<>` يجعل النداء بلا أثرٍ حين يكون صحيحاً أصلاً. */
  if (caseId && projectStart) {
    const fixed = await env.DB.prepare(
      `UPDATE cases SET created_at = ? WHERE id = ? AND created_at <> ?`,
    )
      .bind(projectStart, caseId, projectStart)
      .run();
    if (fixed?.meta?.changes) result.updated.case.push('createdDate');
  }

  result.clientId = clientId;

  /* ═══ ملخّصُ القضية — نصٌّ يُصاغ لا حقلٌ يُملأ ═══

     يُكتب في `ai_summary`، لا في `notes`: الملاحظاتُ يكتبها المحامي ويأتي
     فيها ما في «بيانات المشروع»، ونصٌّ صاغه طرازٌ لو دخلها لاختلط بما
     كتبه إنسان — ودخل الدمجَ الثلاثي، فبدا أنّ «يداً مسّت الحقل» في كل
     دورة.

     والبصمةُ تمنع الإعادة: ما دام المصدرُ هو هو فالملخّصُ هو هو. */
  if (ai?.enabled && caseId) {
    const written = await env.DB.prepare(
      `SELECT case_type, client_name, summary, status, outcome, notes, ai_summary_hash
       FROM cases WHERE id = ?`,
    )
      .bind(caseId)
      .first();

    const facts = {
      clientName: written?.client_name ?? '',
      caseType: written?.case_type ?? '',
      summary: written?.summary ?? '',
      status: written?.status ?? '',
      outcome: written?.outcome ?? '',
      notes: written?.notes ?? '',
    };
    const hash = await fingerprint(facts);

    if (written && written.ai_summary_hash !== hash && ai.budget.spend()) {
      const text = await summarizeCase(env, facts);
      if (text) {
        await env.DB.prepare(
          `UPDATE cases SET ai_summary = ?, ai_summary_hash = ?, ai_summary_at = ? WHERE id = ?`,
        )
          .bind(text, hash, now, caseId)
          .run();
        result.summarized = true;
      } else {
        /* وسقوطُ الاستدلال لا يُثبَّت في البصمة: تُترك فارغةً ليُعاد في
           الدورة القادمة، بدل أن تُقرأ «لُخِّص» وليس فيه ملخّص. */
        ai.budget.failed++;
      }
    }
  }

  /* ═══ وما يستحقّ نظراً يُكتب صفّاً ═══
     بعد الكتابة لا قبلها: الصفُّ يحمل معرّفَ القضية والعميل ليُحسم عليهما،
     وهما لا يُعرفان قبل أن يُكتبا. ولا يحجب شيئاً — الكتابةُ وقعت. */
  for (const review of plan.reviews ?? []) {
    await openReview(env, {
      ...review,
      projectId: plan.projectId,
      caseId,
      /* و`similar_client` سؤالٌ عن عميلين: الباقي في `clientId` والمرشَّح
         في التفصيل، فيُعرضان معاً ويُدمجان بضغطة. */
      clientId: review.otherClientId ?? clientId,
      detail: review.otherClientId
        ? { ...review.detail, createdClientId: clientId }
        : review.detail,
    }).catch((error) => {
      /* وصفُّ مراجعةٍ تعذّر فتحُه لا يُسقط استيراداً وقع. */
      console.error('Basecamp: تعذّر فتح صفّ مراجعة —', error?.message ?? error);
    });
  }

  // ── التعارضات: تُسجَّل ولا تُكتب ──
  for (const conflict of plan.conflicts) {
    /* الصفُّ المفتوح على الحقل نفسه يُحدَّث لا يُكرَّر: مزامنةٌ كلَّ ساعة
       على تعارضٍ لم يُحسم تُنشئ أربعاً وعشرين نسخةً في اليوم. */
    const open = await env.DB.prepare(
      `SELECT id FROM basecamp_conflicts
       WHERE project_id = ? AND field = ? AND resolved_at IS NULL`,
    )
      .bind(plan.projectId, conflict.field)
      .first();

    if (open) {
      await env.DB.prepare(
        `UPDATE basecamp_conflicts SET platform_value = ?, basecamp_value = ?, detected_at = ?
         WHERE id = ?`,
      )
        .bind(conflict.platformValue, conflict.basecampValue, now, open.id)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO basecamp_conflicts
           (id, project_id, case_id, field, platform_value, basecamp_value, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(crypto.randomUUID(), plan.projectId, caseId, conflict.field,
          conflict.platformValue, conflict.basecampValue, now)
        .run();
    }
  }

  /* صورةُ ما كُتب — وهي الطرف الثالث في الدمج القادم. وتُحفظ قيمُ بيسكامب
     كلُّها لا المتبدّلة وحدها: بها يُعرف لاحقاً ما تحرّك عندهم وما سكن.

     وحقولُ العميل معها الآن: بلا صورةٍ له لا يُعرف أنّ «نوع العميل» تبدّل
     عندهم أم أنّ يداً بدّلته عندنا، فتُدهس اليدُ أو يُهمَل تبدُّلُهم. */
  const snapshot = { case: {}, client: {} };
  for (const field of CASE_FIELDS) {
    if (plan.case?.values?.[field] !== undefined) snapshot.case[field] = plan.case.values[field];
  }
  for (const field of CLIENT_MERGE_FIELDS) {
    if (plan.client?.values?.[field] !== undefined) snapshot.client[field] = plan.client.values[field];
  }

  await env.DB.prepare(
    `UPDATE basecamp_projects
     SET client_id = ?, case_id = ?, synced_values = ?, last_synced_at = ?, last_error = NULL,
         updated_at = ?
     WHERE project_id = ?`,
  )
    .bind(clientId, caseId, JSON.stringify(snapshot), now, now, plan.projectId)
    .run();

  return result;
}

/**
 * ملخّصُ قضايا الموكّلين الذين مسّتهم هذه الدفعة.
 *
 * ويُبنى من صفوف قضاياه في المنصة لا من ملفٍّ واحد: «ثلاثُ قضايا تجارية،
 * اثنتان مكتملتان» جملةٌ لا يعرفها مشروعٌ واحد. والبصمةُ على القائمة
 * كلِّها — فقضيةٌ رابعة تبدّلها، وإعادةُ مزامنةٍ بلا تبدّلٍ لا تبدّلها.
 */
async function summarizeClients(env, results, ai) {
  if (!ai?.enabled) return 0;

  const ids = [...new Set(results.map((entry) => entry.clientId).filter(Boolean))];
  let written = 0;

  for (const clientId of ids) {
    const client = await env.DB.prepare(
      `SELECT full_name, client_type, ai_summary_hash FROM clients WHERE id = ?`,
    )
      .bind(clientId)
      .first();
    if (!client) continue;

    const { results: cases } = await env.DB.prepare(
      `SELECT case_type, status, outcome, summary FROM cases
       WHERE client_id = ? AND archived_at IS NULL ORDER BY created_at`,
    )
      .bind(clientId)
      .all();

    const facts = {
      fullName: client.full_name,
      clientType: client.client_type,
      cases: (cases ?? []).map((row) => ({
        caseType: row.case_type,
        status: row.status,
        outcome: row.outcome,
        summary: row.summary,
      })),
    };
    if (!facts.cases.length) continue;

    const hash = await fingerprint(facts);
    if (client.ai_summary_hash === hash) continue;
    if (!ai.budget.spend()) continue;

    const text = await summarizeClient(env, facts);
    if (!text) { ai.budget.failed++; continue; }

    await env.DB.prepare(
      `UPDATE clients SET ai_summary = ?, ai_summary_hash = ?, ai_summary_at = ? WHERE id = ?`,
    )
      .bind(text, hash, nowSeconds(), clientId)
      .run();
    written++;
  }

  return written;
}

/** ينفّذ الخطّة كلَّها. والمشروعُ الساقط لا يوقف من بعده. */
export async function runSync(env, connection, { actorId, actorName, source }) {
  const { summary, plans, ai } = await buildPlan(env, connection);
  const results = [];
  let failed = 0;

  for (const plan of plans) {
    try {
      results.push(await applyPlan(env, plan, actorId, ai));
    } catch (applyError) {
      failed++;
      const reason = applyError?.message ?? String(applyError);
      console.error('Basecamp: تعذّر تطبيق مشروع', plan.projectId, '—', reason);
      await env.DB.prepare(
        `UPDATE basecamp_projects SET last_error = ?, updated_at = ? WHERE project_id = ?`,
      )
        .bind(reason.slice(0, 300), nowSeconds(), plan.projectId)
        .run()
        .catch(() => {});
      results.push({ projectId: plan.projectId, error: 'apply_failed' });
    }
  }

  /* ═══ ثمّ ملخّصُ قضايا كلِّ موكّل ═══
     بعد الدفعة كلِّها لا بعد كل مشروع: للموكّل قضايا موزّعةٌ على مشاريع،
     وتلخيصُها عند أوّلها يلخّص نصفَها ثم يعيد عند ثانيها. */
  const summarizedClients = await summarizeClients(env, results, ai);

  const applied = {
    ...summary,
    failed: summary.failed + failed,
    clientsCreated: results.filter((r) => r.created?.includes('client')).length,
    casesCreated: results.filter((r) => r.created?.includes('case')).length,
    clientsUpdated: results.filter((r) => r.updated?.client?.length).length,
    casesUpdated: results.filter((r) => r.updated?.case?.length).length,
    ai: {
      enabled: ai.enabled,
      cases: results.filter((r) => r.summarized).length,
      clients: summarizedClients,
      deferred: ai.budget.deferred,
      failed: ai.budget.failed,
    },
  };

  await env.DB.prepare(
    `UPDATE basecamp_connection SET last_sync_at = ?, last_sync_error = NULL WHERE id = 1`,
  )
    .bind(nowSeconds())
    .run();

  await env.DB.prepare(
    `INSERT INTO activity_logs (id, type, description, user_id, user_name, entity_type, details, created_at)
     VALUES (?, 'basecamp', ?, ?, ?, 'basecamp', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      `مزامنةُ بيسكامب (${source}): ${applied.clientsCreated} عميلاً و${applied.casesCreated} قضيةً جديدة،` +
        ` و${applied.casesUpdated} قضيةً و${applied.clientsUpdated} عميلاً محدَّثين`,
      actorId,
      actorName ?? '',
      JSON.stringify(applied),
      nowSeconds(),
    )
    .run()
    .catch(() => {});

  return applied;
}
