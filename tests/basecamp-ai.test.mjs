/* ═══ هويّةُ الموكّل، ومسؤولُ التواصل، والتلخيصُ الآليّ ═══
 *
 * ثلاثةٌ تُحرَس هنا:
 *
 * ١) **الموكّلُ واحدٌ وإن اختُصر اسمُه.** «محمد خالد عبدالله القحطاني»
 *    و«محمد خالد القحطاني» برقم هويةٍ واحد رجلٌ واحد — لا موكّلان، ولا
 *    اختلافٌ يقف في كل مزامنة. وبلا هويةٍ يُقترح ولا يُدمج: دمجُ ملفَّي
 *    موكّلين مختلفين خطأٌ لا يُكشف إلا بعد أن يُبنى عليه.
 *
 * ٢) **الطراز لا يخترع حقلاً.** نوعُ القضية يُقترح من قائمة المكتب وحدها،
 *    وما ردَّه خارجَها يُردّ — فيبقى الحقل كما كان لا يحمل مفردةً لا
 *    يعرفها أحد.
 *
 * ٣) **سقوطُ الاستدلال لا يُسقط الاستيراد.** والبصمةُ تمنع إعادته:
 *    مزامنةٌ كلَّ ساعة على قضيةٍ لم تتبدّل لا تدفع ثمنَ تلخيصٍ مكرّر.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

globalThis.Response = globalThis.Response ?? class {
  static json(body, init) { return { body, status: init?.status ?? 200 }; }
};

// ═══════════════════════════════════════════════════════════
group('أسماءُ الموكّلين');

const { nameRelation, nameTokens, fullerName } = await import('../worker/lib/basecamp/names.js');

check('الاسمان سواء', nameRelation('محمد خالد القحطاني', 'محمد خالد القحطاني') === 'same');
check('وأداةُ التعريف لا تفرّق',
  nameRelation('محمد خالد القحطاني', 'محمد خالد قحطاني') === 'same',
  nameRelation('محمد خالد القحطاني', 'محمد خالد قحطاني'));
check('و«بن» لا تفرّق', nameRelation('محمد بن خالد القحطاني', 'محمد خالد القحطاني') === 'same');
check('و«عبد الله» و«عبدالله» واحد',
  nameRelation('عبد الله خالد الحربي', 'عبدالله خالد الحربي') === 'same',
  JSON.stringify([nameTokens('عبد الله خالد الحربي'), nameTokens('عبدالله خالد الحربي')]));

check('والمختصرُ اختصار',
  nameRelation('محمد خالد عبدالله القحطاني', 'محمد خالد القحطاني') === 'abbreviation');
check('ومن أيّ الجهتين',
  nameRelation('محمد خالد القحطاني', 'محمد خالد عبدالله القحطاني') === 'abbreviation');

/* والحدُّ الذي لا يُتجاوز: أخوان يشتركان في اسم الأب والقبيلة. */
check('أخوان ليسا واحداً',
  nameRelation('محمد خالد القحطاني', 'سعد خالد القحطاني') === 'different');
check('واسمٌ أوسطُ مختلف ليس اختصاراً',
  nameRelation('محمد خالد القحطاني', 'محمد سعد القحطاني') === 'different');
check('وقبيلةٌ مختلفة ليست اختصاراً',
  nameRelation('محمد خالد القحطاني', 'محمد خالد الغامدي') === 'different');
/* والابنُ يفترق عن أبيه في أوّل اسمه — ولولا شرطُ الاسم الأول لدُمجا. */
check('والابنُ ليس أباه',
  nameRelation('خالد عبدالله القحطاني', 'محمد خالد عبدالله القحطاني') === 'different');
check('واسمٌ فارغ لا يُطابق شيئاً', nameRelation('', 'محمد القحطاني') === 'different');

check('والأتمُّ هو المكتوب',
  fullerName('محمد خالد القحطاني', 'محمد خالد عبدالله القحطاني') === 'محمد خالد عبدالله القحطاني');
check('ولا يُقصَّر اسمٌ كاملٌ عندنا',
  fullerName('محمد خالد عبدالله القحطاني', 'محمد خالد القحطاني') === 'محمد خالد عبدالله القحطاني');

// ═══════════════════════════════════════════════════════════
group('مسؤولُ التواصل');

const { parseDocument, DEFAULT_FIELD_MAP } = await import('../worker/lib/basecamp/parse.js');

const COMPANY = `<div>
  <div>اسم الشركة: مؤسسة النخبة للمقاولات</div>
  <div>نوع العميل: شركة</div>
  <div>السجل التجاري: 4030123456</div>
  <div>مسؤول التواصل: أحمد الغامدي - 0551234567</div>
  <div>نوع المشروع: قضية عمالية</div>
</div>`;

const company = parseDocument(COMPANY, DEFAULT_FIELD_MAP);
check('اسمُ الشركة اسمُ العميل',
  company.client.fullName === 'مؤسسة النخبة للمقاولات', company.client);
check('ومسؤولُ التواصل اسمٌ ورقم',
  company.client.legalRepresentative?.name === 'أحمد الغامدي'
    && company.client.legalRepresentative?.contact === '0551234567',
  company.client.legalRepresentative);
/* والرقمُ يُقصّ من الاسم: اسمٌ يحمل ذيلَ رقمٍ يُطبع في وكالةٍ كما هو. */
check('ولا يعلق الرقمُ بالاسم',
  !/\d/.test(company.client.legalRepresentative?.name ?? ''),
  company.client.legalRepresentative?.name);

const noName = parseDocument(
  '<div>اسم العميل: شركة</div><div>مسؤول التواصل: 0551234567</div>', DEFAULT_FIELD_MAP);
check('ورقمٌ بلا صاحبٍ لا يصير مسؤولاً',
  noName.client.legalRepresentative === undefined, noName.client.legalRepresentative);

// ═══════════════════════════════════════════════════════════
group('الاستيراد: هويةٌ واحدة واسمان');

const { buildPlan, runSync } = await import('../worker/lib/basecamp/sync.js');

const now = Math.floor(Date.now() / 1000);

/* ═══ طرازٌ مُحاكى ═══
   يُوجَّه بنصّ نظامه: الملخّصُ غيرُ ملخّصِ العميل غيرُ التصنيف. ويُعدّ كم
   نودي، إذ البصمةُ إنما وُضعت لتقليل ذلك. */
let calls = { case: 0, client: 0, type: 0 };
let typeAnswer = 'قضية عمالية';
let broken = false;

const stubAI = {
  async run(model, input) {
    if (broken) throw new Error('inference down');
    const system = input.messages[0].content;
    if (system.includes('مصنِّف')) {
      calls.type++;
      return { response: typeAnswer };
    }
    if (system.includes('قائمةَ قضايا')) {
      calls.client++;
      return { response: 'له قضيتان تجاريتان، إحداهما مكتملة.' };
    }
    calls.case++;
    return { response: '```\nنزاعٌ على عقد توريد، لا تزال قيد المعالجة.\n```' };
  },
};

const setup = (extra = {}) => {
  const db = freshDatabase();
  const env = makeEnv(db, { AI: stubAI, ...extra });
  db.prepare(
    `INSERT INTO basecamp_projects (project_id, name, app_url, status, vault_id, doc_id, kind,
                                    created_at, updated_at)
     VALUES ('101', 'قضية القحطاني', 'https://3.basecamp.com/1/projects/101', 'active', '11', '901',
             'client', ?, ?)`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO basecamp_connection (id, account_id, account_name, access_token, refresh_token,
                                      expires_at, connected_by, connected_at)
     VALUES (1, '9', 'ناف', 'a', 'r', 9999999999, 'u1', ?)`,
  ).run(now);
  return { db, env };
};

let docContent = '';
globalThis.fetch = async () => ({
  ok: true, status: 200, headers: new Map(),
  json: async () => ({ id: 901, title: 'بيانات المشروع', content: docContent, app_url: 'x', updated_at: 'x' }),
});
const connection = { accountId: '9', token: 't' };
const actor = { actorId: 'u1', actorName: 'فهد', source: 'اختبار' };

const FULL_NAME_DOC = `<div>
  <div>اسم العميل: محمد خالد عبدالله القحطاني</div>
  <div>رقم الهوية: 1012345678</div>
  <div>رقم المشروع: ق-2026-100</div>
  <div>نوع المشروع: قضية عمالية</div>
  <div>موضوع المشروع: مطالبةٌ بمستحقّات نهاية الخدمة</div>
</div>`;

let { db, env } = setup();
/* موكّلٌ في المنصة باسمٍ مختصر وبالهوية نفسها. */
db.prepare(
  `INSERT INTO clients (id, full_name, id_number, phone, email, client_type, status, notes,
                        join_date, created_at, updated_at)
   VALUES ('c-1', 'محمد خالد القحطاني', '1012345678', '0501112222', '', 'individual', 'current', '',
           '2021-01-01', ?, ?)`,
).run(now, now);

docContent = FULL_NAME_DOC;
let plan = await buildPlan(env, connection);
check('هويةٌ واحدة → موكّلٌ واحد لا ثانٍ',
  plan.summary.createClients === 0 && plan.summary.linkClients === 1, plan.summary);
check('ولا اختلافَ على الاسم', plan.summary.conflicts === 0, plan.plans[0].conflicts);
check('بل يُكتب الاسمُ الأتمّ',
  plan.plans[0].client.changes.fullName === 'محمد خالد عبدالله القحطاني',
  plan.plans[0].client.changes);
check('ويُقال ذلك في المعاينة',
  plan.plans[0].warnings.some((line) => line.includes('أتمُّ')), plan.plans[0].warnings);

await runSync(env, connection, actor);
const client = () => db.prepare(`SELECT * FROM clients`).get();
check('وفي القاعدة موكّلٌ واحد', db.prepare(`SELECT COUNT(*) n FROM clients`).get().n === 1);
check('باسمه الكامل', client().full_name === 'محمد خالد عبدالله القحطاني', client().full_name);

/* ومزامنةٌ ثانية لا تُحرّك شيئاً: الاسمان صارا واحداً. */
let applied = await runSync(env, connection, actor);
check('ومزامنةٌ ثانيةٌ لا تُعيد شيئاً',
  applied.conflicts === 0 && applied.clientsUpdated === 0, applied);

// ── وبلا هوية: يُقترح ولا يُدمج ──
({ db, env } = setup());
db.prepare(
  `INSERT INTO clients (id, full_name, phone, email, client_type, status, notes,
                        join_date, created_at, updated_at)
   VALUES ('c-2', 'محمد خالد القحطاني', '', '', 'individual', 'current', '', '2021-01-01', ?, ?)`,
).run(now, now);

docContent = FULL_NAME_DOC.replace('<div>رقم الهوية: 1012345678</div>', '');
plan = await buildPlan(env, connection);
check('بلا هويةٍ لا يُدمج بالاسم', plan.summary.createClients === 1, plan.summary);
check('بل يُقترح على من يقرأ',
  plan.plans[0].warnings.some((line) => line.includes('يشبه عميلاً قائماً')),
  plan.plans[0].warnings);

// ═══════════════════════════════════════════════════════════
group('التلخيصُ الآليّ');

({ db, env } = setup());
calls = { case: 0, client: 0, type: 0 };
docContent = FULL_NAME_DOC;
applied = await runSync(env, connection, actor);

const kase = () => db.prepare(`SELECT * FROM cases`).get();
check('يُكتب ملخّصُ القضية', Boolean(kase().ai_summary), kase().ai_summary);
check('والسياجُ يُقصّ من الردّ',
  kase().ai_summary === 'نزاعٌ على عقد توريد، لا تزال قيد المعالجة.', kase().ai_summary);
/* وفي حقله هو: `notes` تبقى لما يكتبه الإنسان وما يأتي من الملفّ. */
check('ولا يُكتب في الملاحظات', !kase().notes, kase().notes);
check('ويُكتب ملخّصُ قضايا الموكّل',
  db.prepare(`SELECT ai_summary FROM clients`).get().ai_summary === 'له قضيتان تجاريتان، إحداهما مكتملة.');
check('وتُقال حصيلتُه', applied.ai?.cases === 1 && applied.ai?.clients === 1, applied.ai);

/* ═══ والبصمةُ تمنع الإعادة ═══
   المزامنة كلَّ ساعة، وتلخيصُ ما لم يتبدّل يدفع ثمناً لنتيجةٍ مكرّرة. */
const before = { ...calls };
await runSync(env, connection, actor);
check('ومزامنةٌ ثانيةٌ لا تستدلّ ثانية',
  calls.case === before.case && calls.client === before.client,
  JSON.stringify({ before, after: calls }));

/* وتبدّلُ المصدر يُعيد التلخيص. */
docContent = FULL_NAME_DOC.replace('مطالبةٌ بمستحقّات نهاية الخدمة', 'مطالبةٌ بأجورٍ متأخّرة');
await runSync(env, connection, actor);
check('وتبدّلُ الموضوع يُعيده', calls.case === before.case + 1, JSON.stringify(calls));

// ── نوعُ القضية: من قائمة المكتب وحدها ──
({ db, env } = setup());
db.prepare(
  `INSERT INTO system_settings (key, value, updated_at)
   VALUES ('platform', ?, 1)`,
).run(JSON.stringify({ caseTypes: ['قضية تجارية', 'قضية عمالية', 'قضية أحوال شخصية'] }));

docContent = FULL_NAME_DOC.replace('<div>نوع المشروع: قضية عمالية</div>', '');
typeAnswer = 'قضية عمالية';
plan = await buildPlan(env, connection);
check('نوعٌ غائبٌ يُقترح من أنواع المكتب',
  plan.plans[0].case.values.caseType === 'قضية عمالية', plan.plans[0].case.values);
check('ويُعلَّم أنّه مقترَح', plan.plans[0].caseTypeSuggested === true);
check('ويُقال في المعاينة',
  plan.plans[0].warnings.some((line) => line.includes('مقترحٌ آلياً')), plan.plans[0].warnings);

/* والردُّ الشاذّ يُردّ: لا تدخل قاعدةَ القضايا مفردةٌ لا يعرفها المكتب. */
typeAnswer = 'قضية فضائية';
plan = await buildPlan(env, connection);
check('ونوعٌ من عند الطراز يُردّ',
  plan.plans[0].case.values.caseType === 'غير محدّد', plan.plans[0].case.values);
check('ولا يُعلَّم مقترَحاً', !plan.plans[0].caseTypeSuggested);

/* وما كتبه الملفّ لا يُقترح فوقه. */
typeAnswer = 'قضية تجارية';
docContent = FULL_NAME_DOC;
plan = await buildPlan(env, connection);
check('ونوعٌ كتبه الملفّ لا يُمسّ',
  plan.plans[0].case.values.caseType === 'قضية عمالية', plan.plans[0].case.values);

// ── وسقوطُ الاستدلال لا يُسقط الاستيراد ──
({ db, env } = setup());
broken = true;
docContent = FULL_NAME_DOC;
applied = await runSync(env, connection, actor);
broken = false;
check('يسقط الاستدلالُ فتُكتب القضية',
  db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 1, applied);
check('بلا ملخّص', !db.prepare(`SELECT ai_summary FROM cases`).get().ai_summary);
/* ولا تُثبَّت بصمةٌ على سقوط: تُعاد المحاولةُ في الدورة القادمة. */
check('ولا بصمةَ تمنع إعادةَ المحاولة',
  !db.prepare(`SELECT ai_summary_hash FROM cases`).get().ai_summary_hash);

// ── ومطفأً: لا يخرج نصٌّ إلى الطراز أصلاً ──
({ db, env } = setup());
const { setAiEnabled } = await import('../worker/lib/ai/summarize.js');
await setAiEnabled(env, false, 'u1');
calls = { case: 0, client: 0, type: 0 };
docContent = FULL_NAME_DOC;
applied = await runSync(env, connection, actor);
check('مطفأً لا يُنادى الطراز',
  calls.case === 0 && calls.client === 0 && calls.type === 0, JSON.stringify(calls));
check('والاستيرادُ يقع كما هو', db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 1);
check('وتُقال حالتُه', applied.ai?.enabled === false, applied.ai);

// ── وبلا ارتباط `[ai]` أصلاً ──
({ db, env } = setup({ AI: undefined }));
docContent = FULL_NAME_DOC;
applied = await runSync(env, connection, actor);
check('وبلا ارتباطٍ يمضي الاستيراد', db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 1, applied);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
