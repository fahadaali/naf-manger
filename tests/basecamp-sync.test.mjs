/* ═══ القارئ والدمج الثلاثي ═══
 *
 * ما يُحرَس هنا شيئان:
 *
 * ١) **القارئ يُخطئ ظاهراً أو يصيب.** الملفّ HTML من محرّر بيسكامب —
 *    بوسومٍ ومسافاتٍ غيرِ فاصلة ورموزِ كياناتٍ وتشكيل. وقارئٌ يبتلع سطراً
 *    صامتاً يُسقط حقلاً من قضيةِ موكّل ولا يقول أحدٌ لِمَ.
 *
 * ٢) **الدمج لا يطمس يداً.** حالاتُه الأربع كلُّها مُختبَرة — وأخطرُها
 *    الرابعة: تبدّل الطرفان، فيقف ويسأل ولا يكتب.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { htmlToText, readLabelledLines, parseDocument, DEFAULT_FIELD_MAP } =
  await import('../worker/lib/basecamp/parse.js');

// ═══════════════════════════════════════════════════════════
group('من HTML إلى نصّ');

check('‎<br>‎ يفصل سطراً',
  htmlToText('اسم العميل: أحمد<br>رقم الهوية: 1012') === 'اسم العميل: أحمد\nرقم الهوية: 1012');
/* والأرقام الهندية تصير غربية في التجريد نفسه — «٠٥٠» و«050» رقمٌ واحد،
   وحفظُهما مختلفَين يجعل البحث عن أحدهما لا يجد الآخر. */
check('‎<div>‎ يفصل، والرقم الهندي يُطبَّع',
  htmlToText('<div>أ: ١</div><div>ب: ٢</div>') === 'أ: 1\nب: 2',
  JSON.stringify(htmlToText('<div>أ: ١</div><div>ب: ٢</div>')));
check('القوائم تُفصل',
  htmlToText('<ul><li>أ: ١</li><li>ب: ٢</li></ul>') === 'أ: 1\nب: 2');
check('والأرقام الفارسية كذلك',
  htmlToText('<div>س: ۱۲۳</div>') === 'س: 123',
  JSON.stringify(htmlToText('<div>س: ۱۲۳</div>')));
check('الوسوم الداخلية تُجرَّد بلا فصل',
  htmlToText('<div>اسم العميل: <strong>شركة الأفق</strong></div>') === 'اسم العميل: شركة الأفق');
/* المسافةُ غير الفاصلة تصير مسافةً عادية — واثنتان تبقيان اثنتين هنا،
   لأنّ ما بعد النقطتين يُقصّ في `readLabelledLines` لا في التجريد. */
check('المسافة غير الفاصلة تُقرأ مسافة',
  htmlToText('<div>أ:&nbsp;&nbsp;قيمة</div>') === 'أ:  قيمة',
  JSON.stringify(htmlToText('<div>أ:&nbsp;&nbsp;قيمة</div>')));
check('والقيمة تصل مقصوصة',
  readLabelledLines(htmlToText('<div>أ:&nbsp;&nbsp;قيمة</div>'))[0].value === 'قيمة');
check('رموز الكيانات تُفكّ',
  htmlToText('<div>الشركة: أ &amp; ب</div>') === 'الشركة: أ & ب');
check('الرموز العددية تُفكّ',
  htmlToText('<div>x: &#1571;</div>') === 'x: أ');
check('الأسطر الفارغة تُسقَط',
  htmlToText('<div>أ: ١</div><div></div><div><br></div><div>ب: ٢</div>') === 'أ: 1\nب: 2');
check('الجداول تُقرأ عنواناً وقيمة',
  htmlToText('<tr><td>اسم العميل</td><td>أحمد</td></tr>').includes('اسم العميل: أحمد'),
  htmlToText('<tr><td>اسم العميل</td><td>أحمد</td></tr>'));

// ═══════════════════════════════════════════════════════════
group('أسطرُ «عنوان: قيمة»');

const lines = readLabelledLines(
  'اسم العميل: أحمد\n' +
  '**رقم الهوية**: 1012345678\n' +
  '  نوع القضية  :  قضية تجارية  \n' +
  'رقم الجوال： 0501234567\n' +   // نقطتان عربيتان عريضتان
  'سطرٌ بلا نقطتين\n' +
  'حقلٌ فارغ:\n' +
  '- الحالة: منظورة',
);
const byLabel = Object.fromEntries(lines.map((l) => [l.label, l.value]));
check('يُقرأ العنوان البسيط', byLabel['اسم العميل'] === 'أحمد', byLabel);
check('والنجمتان تُجرَّدان', byLabel['رقم الهوية'] === '1012345678', byLabel);
check('والمسافات الزائدة تُقصّ', byLabel['نوع القضية'] === 'قضية تجارية', byLabel);
check('والنقطتان العريضتان تُقرآن', byLabel['رقم الجوال'] === '0501234567', byLabel);
check('والشرطة تُجرَّد', byLabel['الحالة'] === 'منظورة', byLabel);
check('سطرٌ بلا نقطتين يُتجاوز', !('سطرٌ بلا نقطتين' in byLabel));
check('وحقلٌ فارغ يُقرأ فارغاً', byLabel['حقلٌ فارغ'] === '', byLabel);

// ═══════════════════════════════════════════════════════════
group('الملفّ كاملاً');

const DOC = `<div>
  <div><strong>اسم العميل:</strong> شركة الأفق التجارية</div>
  <div>رقم الهوية: 7001234567</div>
  <div>رقم الجوال: 0501234567</div>
  <div>البريد الإلكتروني: afaq@example.com</div>
  <div>نوع العميل: شركة</div>
  <div>رقم القضية: ق-2026-014</div>
  <div>نوع القضية: قضية تجارية</div>
  <div>حالة القضية: قيد المعالجة</div>
  <div>موضوع القضية: نزاعٌ على عقد توريد</div>
  <div>المحامي المسؤول: سارة المطيري</div>
</div>`;

const parsed = parseDocument(DOC, DEFAULT_FIELD_MAP);
check('اسم العميل', parsed.client.fullName === 'شركة الأفق التجارية', parsed.client);
check('رقم الهوية', parsed.client.idNumber === '7001234567', parsed.client);
check('الجوال والبريد', parsed.client.phone === '0501234567' && parsed.client.email === 'afaq@example.com', parsed.client);
check('«شركة» تُترجَم company', parsed.client.clientType === 'company', parsed.client);
check('رقم القضية ونوعها', parsed.case.caseNumber === 'ق-2026-014' && parsed.case.caseType === 'قضية تجارية', parsed.case);
check('«قيد المعالجة» تُترجَم in-progress', parsed.case.status === 'in-progress', parsed.case);
check('«موضوع القضية» يُربط بالملخّص', parsed.case.summary === 'نزاعٌ على عقد توريد', parsed.case);
check('وحقلٌ لا مقابل له يُعرض لا يُبتلع',
  parsed.unmapped.some((u) => u.label === 'المحامي المسؤول'), parsed.unmapped);

const shaddad = parseDocument(
  '<div>اسمُ العميلِ: أحمد</div><div>رقمُ الهويّة: 1012345678</div>', DEFAULT_FIELD_MAP);
check('العنوان المشكَّل يُطابَق موحَّداً',
  shaddad.client.fullName === 'أحمد' && shaddad.client.idNumber === '1012345678', shaddad.client);

const custom = parseDocument('<div>الموكّل: خالد</div>', { 'الموكّل': 'client.fullName' });
check('خريطةٌ من عند المكتب تُحترم', custom.client.fullName === 'خالد', custom.client);

const bogus = parseDocument('<div>س: ١</div>', { 'س': 'case.لا-يوجد' });
check('هدفٌ مجهول يُهمَل ولا يُكتب', Object.keys(bogus.case).length === 0, bogus.case);

// ═══════════════════════════════════════════════════════════
group('«بيانات المشروع» — العناوين الجديدة والملاحظات');

/* الملفّ الجاري: عناوينُه تقول «المشروع» لا «القضية»، وفيه نتيجةٌ
   وملاحظاتٌ لم يكن يحملها. والقارئُ يقرأ الاثنين — والقديمُ فوق مُختبَرٌ
   أعلاه، فلا يُكسر مكتبٌ لم يُعِد تسمية ملفّاته. */
const PROJECT_DOC = `<div>
  <div><strong>اسم العميل:</strong> مؤسسة النخبة</div>
  <div>رقم الهوية: 7009876543</div>
  <div>نوع العميل: مؤسسة</div>
  <div>رقم المشروع: م-2026-002</div>
  <div>نوع المشروع: استشارة نظامية</div>
  <div>حالة المشروع: منجزة</div>
  <div>نتيجة المشروع: لصالح العميل</div>
  <div>موضوع المشروع: مراجعةُ عقود التوريد</div>
  <div>رقم الجوال: 0559998888</div>
  <div>الملاحظات:</div>
  <div>- العميل يفضّل التواصل مساءً</div>
  <div>- الأوراق الأصلية عند وكيله</div>
  <div>ملاحظات العميل: يُفوتر باسم المؤسسة لا باسم المالك</div>
</div>`;

const project = parseDocument(PROJECT_DOC, DEFAULT_FIELD_MAP);
check('«رقم المشروع» رقمُ القضية', project.case.caseNumber === 'م-2026-002', project.case);
check('و«نوع المشروع» نوعُها', project.case.caseType === 'استشارة نظامية', project.case);
check('و«موضوع المشروع» ملخّصُها', project.case.summary === 'مراجعةُ عقود التوريد', project.case);
check('و«منجزة» تُترجَم completed', project.case.status === 'completed', project.case);
check('و«لصالح العميل» تُترجَم won', project.case.outcome === 'won', project.case);
check('و«مؤسسة» تُترجَم company', project.client.clientType === 'company', project.client);

/* ═══ وعنوانٌ تُرك فارغاً يأخذ ما تحته ═══
   وهكذا تُكتب الملاحظاتُ في ملفّات المكتب: عنوانٌ ثم أسطرٌ تحته. وكانت
   تُطرح كلُّها صامتة. */
check('الملاحظاتُ المسطورةُ تحت عنوانها تُقرأ',
  project.case.notes === '- العميل يفضّل التواصل مساءً\n- الأوراق الأصلية عند وكيله',
  JSON.stringify(project.case.notes));
check('وملاحظاتُ العميل في حقله هو',
  project.client.notes === 'يُفوتر باسم المؤسسة لا باسم المالك', project.client.notes);

/* وعنوانان يشيران إلى الملاحظات: يُجمعان بعنوانيهما ولا يمحو أحدُهما الآخر. */
const twoNotes = parseDocument(
  '<div>اسم العميل: خالد</div><div>الملاحظات: الأولى</div><div>ملاحظات إضافية: الثانية</div>',
  DEFAULT_FIELD_MAP,
);
check('ملاحظتان بعنوانين تُجمعان',
  twoNotes.case.notes === 'الملاحظات: الأولى\nملاحظات إضافية: الثانية',
  JSON.stringify(twoNotes.case.notes));

/* والذيلُ لا يُبتلع: عنوانٌ حمل قيمةً لا يأخذ ما بعده — وإلا دخل توقيعُ
   الملفّ في حقلِ موكّل كأنه منه. */
const tail = parseDocument(
  '<div>اسم العميل: خالد</div><div>سطرٌ حرٌّ في آخر الملفّ</div>',
  DEFAULT_FIELD_MAP,
);
check('سطرٌ بعد عنوانٍ ممتلئ لا يُلحق به',
  tail.client.fullName === 'خالد', tail.client);

// ═══════════════════════════════════════════════════════════
group('الدمج الثلاثي — الحالات الأربع');

const { buildPlan, runSync } = await import('../worker/lib/basecamp/sync.js');

const now = Math.floor(Date.now() / 1000);
const setup = () => {
  const db = freshDatabase();
  const env = makeEnv(db);
  db.prepare(
    `INSERT INTO basecamp_projects (project_id, name, app_url, status, vault_id, doc_id, kind,
                                    created_at, updated_at)
     VALUES ('101', 'قضية الأفق', 'https://3.basecamp.com/1/projects/101', 'active', '11', '901',
             'client', ?, ?)`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO basecamp_connection (id, account_id, account_name, access_token, refresh_token,
                                      expires_at, connected_by, connected_at)
     VALUES (1, '9', 'ناف', 'a', 'r', 9999999999, 'u1', ?)`,
  ).run(now);
  return { db, env };
};

/* بيسكامب مُحاكاة: `content` يُبدَّل بين الجولات لتُقاس كلُّ حالة. */
let docContent = DOC;
globalThis.fetch = async () => ({
  ok: true, status: 200, headers: new Map(),
  json: async () => ({ id: 901, title: 'ملخص القضية', content: docContent, app_url: 'x', updated_at: '2026-01-01' }),
});
const connection = { accountId: '9', token: 't' };
const actor = { actorId: 'u1', actorName: 'فهد', source: 'اختبار' };

// ── الجولة الأولى: إنشاء ──
let { db, env } = setup();
docContent = DOC;
let plan = await buildPlan(env, connection);
check('المعاينة تقول: عميلٌ وقضيةٌ جديدان',
  plan.summary.createClients === 1 && plan.summary.createCases === 1, plan.summary);
check('ولا تكتب شيئاً', db.prepare(`SELECT COUNT(*) n FROM clients`).get().n === 0);

let applied = await runSync(env, connection, actor);
check('التنفيذ ينشئ العميل والقضية',
  applied.clientsCreated === 1 && applied.casesCreated === 1, applied);

const kase = () => db.prepare(`SELECT * FROM cases`).get();
check('ورابطُ بيسكامب مملوءٌ آلياً',
  kase().basecamp_url === 'https://3.basecamp.com/1/projects/101', kase().basecamp_url);
check('والقضية مربوطةٌ بالعميل',
  kase().client_id === db.prepare(`SELECT id FROM clients`).get().id);
check('و«شركة» صارت company',
  db.prepare(`SELECT client_type FROM clients`).get().client_type === 'company');

// ── ٢) لا شيء تبدّل ──
applied = await runSync(env, connection, actor);
check('إعادةُ المزامنة بلا تبدّلٍ لا تُنشئ ولا تُحدّث',
  applied.clientsCreated === 0 && applied.casesCreated === 0 && applied.casesUpdated === 0, applied);
check('ولا تُكرّر القضية', db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 1);

// ── ٣) بيسكامب تبدّل والمنصة كما تركناها → يُكتب ──
docContent = DOC.replace('قيد المعالجة', 'مكتملة');
applied = await runSync(env, connection, actor);
check('تبدّلُ بيسكامب وحده يُكتب بلا إزعاج', kase().status === 'completed', kase().status);
check('ولا تعارض', applied.conflicts === 0, applied);

// ── ٤) المنصة تبدّلت وبيسكامب كما هو → يُترك ──
db.prepare(`UPDATE cases SET summary = 'تصحيحٌ كتبه المحامي'`).run();
applied = await runSync(env, connection, actor);
check('يدٌ مسّت حقلاً وبيسكامب ساكن → يُترك',
  kase().summary === 'تصحيحٌ كتبه المحامي', kase().summary);
check('ولا تعارضَ يُسجَّل', applied.conflicts === 0, applied);

// ── ٥) تبدّل الطرفان → تعارضٌ يُسجَّل ولا يُكتب ──
docContent = DOC.replace('قيد المعالجة', 'مكتملة').replace('نزاعٌ على عقد توريد', 'نصٌّ جديد عندهم');
applied = await runSync(env, connection, actor);
check('تبدّلُ الطرفين → تعارض', applied.conflicts === 1, applied);
check('والقيمة في المنصة لم تُمسّ',
  kase().summary === 'تصحيحٌ كتبه المحامي', kase().summary);

const conflict = db.prepare(`SELECT * FROM basecamp_conflicts WHERE resolved_at IS NULL`).get();
check('والتعارض يحمل القيمتين',
  conflict.platform_value === 'تصحيحٌ كتبه المحامي' && conflict.basecamp_value === 'نصٌّ جديد عندهم',
  conflict);

applied = await runSync(env, connection, actor);
check('ومزامنةٌ ثانيةٌ لا تُكرّر صفَّ التعارض',
  db.prepare(`SELECT COUNT(*) n FROM basecamp_conflicts WHERE resolved_at IS NULL`).get().n === 1);

// ── ٦) الحسم ──
const { resolveConflict } = await import('../worker/lib/basecamp/handlers.js');
globalThis.Response = globalThis.Response ?? class { static json(b, i) { return { body: b, status: i?.status ?? 200 }; } };
const admin = { id: 'u1', role: 'admin', name: 'فهد' };
let res = await resolveConflict({ json: async () => ({ resolution: 'basecamp' }) }, env, admin, conflict.id);
const body = res.body ?? (await res.json?.());
check('حسمٌ لصالح بيسكامب يكتب قيمتَهم', kase().summary === 'نصٌّ جديد عندهم', kase().summary);
check('ويُغلق الصفّ',
  db.prepare(`SELECT COUNT(*) n FROM basecamp_conflicts WHERE resolved_at IS NULL`).get().n === 0, body);

applied = await runSync(env, connection, actor);
check('ولا يعود التعارضُ بعد الحسم', applied.conflicts === 0, applied);

// ── ٧) عميلٌ واحد بقضيتين ──
({ db, env } = setup());
db.prepare(
  `INSERT INTO basecamp_projects (project_id, name, app_url, status, vault_id, doc_id, kind,
                                  created_at, updated_at)
   VALUES ('102', 'قضيةٌ ثانية للأفق', 'https://3.basecamp.com/1/projects/102', 'active', '12', '902',
           'client', ?, ?)`,
).run(now, now);

let call = 0;
globalThis.fetch = async () => {
  call++;
  const content = call % 2 === 1 ? DOC : DOC.replace('ق-2026-014', 'ق-2026-015').replace('قضية تجارية', 'قضية عمالية');
  return { ok: true, status: 200, headers: new Map(),
    json: async () => ({ id: 900 + call, title: 'ملخص القضية', content, app_url: 'x', updated_at: 'x' }) };
};

applied = await runSync(env, connection, actor);
check('مشروعان لعميلٍ واحد → عميلٌ واحد', db.prepare(`SELECT COUNT(*) n FROM clients`).get().n === 1, applied);
check('وقضيتان', db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 2, applied);
const urls = db.prepare(`SELECT basecamp_url FROM cases ORDER BY case_number`).all().map((r) => r.basecamp_url);
check('ولكلٍّ رابطُ مشروعها', new Set(urls).size === 2, urls);

// ── ٧ب) التواريخ: لكلّ قضيةٍ تاريخُ مشروعها، وللعميل أقدمُها ──
/* المشروعان يُقرآن بترتيب الاسم، والأقدمُ زمناً ثانيهما قراءةً — عمداً:
   لو كان «عميلٌ منذ» يُؤخذ من أوّل ما يُقرأ لأخطأ هنا. */
({ db, env } = setup());
db.prepare(`UPDATE basecamp_projects SET name = 'أ-مشروعٌ حديث', created_on = ? WHERE project_id = '101'`)
  .run('2024-03-02T09:00:00.000+03:00');
db.prepare(
  `INSERT INTO basecamp_projects (project_id, name, app_url, status, vault_id, doc_id, kind,
                                  created_on, created_at, updated_at)
   VALUES ('102', 'ب-مشروعٌ قديم', 'https://3.basecamp.com/1/projects/102', 'active', '12', '902',
           'client', '2019-06-11T11:30:00.000+03:00', ?, ?)`,
).run(now, now);

call = 0;
globalThis.fetch = async () => {
  call++;
  const content = call % 2 === 1 ? DOC : DOC.replace('ق-2026-014', 'ق-2026-015');
  return { ok: true, status: 200, headers: new Map(),
    json: async () => ({ id: 900 + call, title: 'ملخص القضية', content, app_url: 'x', updated_at: 'x' }) };
};

await runSync(env, connection, actor);

const dayOf = (seconds) => new Date(Number(seconds) * 1000).toISOString().slice(0, 10);
const dated = db.prepare(`SELECT case_number, created_at FROM cases ORDER BY case_number`).all();
check('لكلّ قضيةٍ تاريخُ إنشاء مشروعها',
  dayOf(dated[0].created_at) === '2024-03-02' && dayOf(dated[1].created_at) === '2019-06-11',
  dated.map((row) => [row.case_number, dayOf(row.created_at)]));

check('و«عميلٌ منذ» أقدمُ قضاياه لا أوّلُ ما قُرئ',
  db.prepare(`SELECT join_date FROM clients`).get().join_date === '2019-06-11',
  db.prepare(`SELECT join_date FROM clients`).get());

/* والمزامنةُ الثانية لا تُحرّك شيئاً: حسابُ أدنى القيم يستقرّ. */
await runSync(env, connection, actor);
check('ومزامنةٌ ثانيةٌ لا تُزحزح التاريخ',
  db.prepare(`SELECT join_date FROM clients`).get().join_date === '2019-06-11');

/* ═══ وما استُورد قبل هذا يُصحَّح ═══
   قضايا الاستيراد الأول حملت تاريخَ الاستيراد. و`created_at` ليس من حقول
   الدمج، فلا تُصلحه كتابةُ المتبدّل — بل نداءٌ صريح. */
db.prepare(`UPDATE cases SET created_at = ? WHERE case_number = 'ق-2026-015'`).run(now);
db.prepare(`UPDATE clients SET join_date = '2026-08-10'`).run();
await runSync(env, connection, actor);
check('تاريخُ قضيةٍ استُوردت خطأً يُصحَّح',
  dayOf(db.prepare(`SELECT created_at FROM cases WHERE case_number = 'ق-2026-015'`).get().created_at)
    === '2019-06-11');
check('و«عميلٌ منذ» يرجع إلى أقدمها',
  db.prepare(`SELECT join_date FROM clients`).get().join_date === '2019-06-11');

/* ولا يُؤخَّر تاريخٌ أقدمُ كتبته يد: الحركةُ إلى الأقدم وحدها. */
db.prepare(`UPDATE clients SET join_date = '2015-01-01'`).run();
await runSync(env, connection, actor);
check('وتاريخٌ أقدمُ بيدٍ يبقى',
  db.prepare(`SELECT join_date FROM clients`).get().join_date === '2015-01-01',
  db.prepare(`SELECT join_date FROM clients`).get());

// ── ٨) ملفٌّ بلا رقمِ هويةٍ ولا رقمِ قضية ──
({ db, env } = setup());
docContent = '<div>اسم العميل: عميلٌ بلا أرقام</div><div>نوع القضية: قضية مدنية</div>';
globalThis.fetch = async () => ({ ok: true, status: 200, headers: new Map(),
  json: async () => ({ id: 901, title: 'ملخص القضية', content: docContent, app_url: 'x', updated_at: 'x' }) });

plan = await buildPlan(env, connection);
check('يُنبَّه على الرقمين المولَّدين', plan.plans[0].warnings.length === 2, plan.plans[0].warnings);
await runSync(env, connection, actor);
check('ولا تُسقَط القضية', db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 1);
check('والرقم المولَّد ثابتٌ من معرّف المشروع',
  db.prepare(`SELECT case_number FROM cases`).get().case_number === 'بيسكامب-101');
await runSync(env, connection, actor);
check('فمزامنةٌ ثانيةٌ تجدها ولا تُنشئ ثانية',
  db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 1);

// ── ٩) ملفٌّ بلا اسمِ عميل ──
({ db, env } = setup());
docContent = '<div>نوع القضية: قضية مدنية</div>';
plan = await buildPlan(env, connection);
check('بلا اسمِ عميلٍ → خطأٌ مسمّى', plan.plans[0].error === 'no_client_name', plan.plans[0]);
await runSync(env, connection, actor);
check('ولا يُكتب شيء', db.prepare(`SELECT COUNT(*) n FROM clients`).get().n === 0);

// ═══════════════════════════════════════════════════════════
group('العميلُ يُدمَج بعد إنشائه — لا يُكتب مرّةً ويُترك');

/* ═══ ما يُحرَس هنا ═══
 *
 * كان الاستيراد يكتب حقولَ العميل عند إنشائه ثم لا يعود إليها. فمكتبٌ
 * يضيف اليوم «نوع العميل» و«الملاحظات» إلى ملفّاتِ موكّليه القدامى
 * يزامن فلا يقع شيء ولا يُقال لِمَ — وهي بعينها الحالُ التي جيء لأجلها.
 *
 * والدمجُ يُملأ فيه الفارغُ صامتاً، ويقف عمّا كتبته يدٌ.
 */
globalThis.fetch = async () => ({
  ok: true, status: 200, headers: new Map(),
  json: async () => ({ id: 901, title: 'بيانات المشروع', content: docContent, app_url: 'x', updated_at: 'x' }),
});

({ db, env } = setup());
docContent = PROJECT_DOC;
await runSync(env, connection, actor);

const client = () => db.prepare(`SELECT * FROM clients`).get();
check('ملاحظاتُ العميل تنزل على ملفّه',
  client().notes === 'يُفوتر باسم المؤسسة لا باسم المالك', client().notes);
check('وملاحظاتُ المشروع على قضيته',
  kase().notes === '- العميل يفضّل التواصل مساءً\n- الأوراق الأصلية عند وكيله', kase().notes);
check('ونتيجةُ المشروع محفوظة', kase().outcome === 'won', kase().outcome);
check('و«مؤسسة» صارت company', client().client_type === 'company', client().client_type);

// ── عميلٌ قائمٌ كُتب بيدٍ قبل بيسكامب ──
/* واسمُه مكتوبٌ بالهاء لا بالتاء المربوطة — كما يكتبه إنسان. فيُطابَق
   بهويته، ويُقارن اسمُه موحَّداً فلا يقف اختلافاً على همزةٍ ولا هاء. */
({ db, env } = setup());
db.prepare(
  `INSERT INTO clients (id, full_name, id_number, phone, email, client_type, status, notes,
                        join_date, created_at, updated_at)
   VALUES ('c-1', 'مؤسسه النخبه', '7009876543', '0500000000', '', 'individual', 'current', '',
           '2020-01-01', ?, ?)`,
).run(now, now);

plan = await buildPlan(env, connection);
check('المعاينة تقول: عميلٌ يُحدَّث', plan.summary.updateClients === 1, plan.summary);
check('وتُسمّي حقولَه', plan.plans[0].client.changes.notes === 'يُفوتر باسم المؤسسة لا باسم المالك',
  plan.plans[0].client.changes);

await runSync(env, connection, actor);
check('«نوع العميل» ينزل على عميلٍ قائم', client().client_type === 'company', client().client_type);
/* و«فرد» ليست قراراً: العمود `NOT NULL DEFAULT 'individual'`، فكلُّ عميلٍ
   أُنشئ قبل أن يحمل ملفُّه نوعَه يحملها. ولو عُدَّت منطوقةً لَما نزل
   «شركة» أبداً. */
check('وملاحظاتُه تُملأ وهي فارغة',
  client().notes === 'يُفوتر باسم المؤسسة لا باسم المالك', client().notes);

/* ورقمٌ مكتوبٌ بيدٍ يخالف ما في الملفّ: لا يُدهس ولا يُهمَل — يقف تعارضاً.
   وهذا هو الفرق بين العميل والقضية: القضيةُ تُطابَق برقمها فمصدرُها
   بيسكامب، والعميلُ قد يكون كُتب في المنصة قبلهم بسنة. */
check('ورقمُه المكتوب بيدٍ لا يُدهس', client().phone === '0500000000', client().phone);
let clientConflict = db.prepare(
  `SELECT * FROM basecamp_conflicts WHERE field = 'client.phone' AND resolved_at IS NULL`,
).get();
check('بل يقف تعارضاً بالقيمتين',
  clientConflict?.platform_value === '0500000000' && clientConflict?.basecamp_value === '0559998888',
  clientConflict);
/* ورقمُهم لا يضيع مع ذلك: يدخل في أرقام العميل الأخرى. */
check('ورقمُهم محفوظٌ في أرقامه الأخرى',
  JSON.parse(client().contacts).some((entry) => entry.number === '0559998888'), client().contacts);

/* والاسمُ لا يقف اختلافاً على همزة: طوبق موحَّداً، فيُقارن موحَّداً. */
check('واسمٌ يختلف في همزةٍ لا يُعدّ اختلافاً',
  !db.prepare(`SELECT COUNT(*) n FROM basecamp_conflicts WHERE field = 'client.fullName'`).get().n,
  db.prepare(`SELECT full_name FROM clients`).get());

// ── الحسمُ لصالح بيسكامب يكتب في جدول العملاء ──
await resolveConflict(
  { json: async () => ({ resolution: 'basecamp' }) },
  env,
  { id: 'u1', role: 'admin', name: 'فهد' },
  clientConflict.id,
);
check('حسمُ تعارضِ عميلٍ يكتب في جدول العملاء', client().phone === '0559998888', client().phone);
applied = await runSync(env, connection, actor);
check('ولا يعود بعد الحسم', applied.conflicts === 0, applied);

// ── وبعد أوّل مزامنة: تبدّلُهم وحدَهم يُكتب بلا إزعاج ──
docContent = PROJECT_DOC.replace('يُفوتر باسم المؤسسة لا باسم المالك', 'يُفوتر على الفرع الشرقي');
applied = await runSync(env, connection, actor);
check('تبدُّلُ ملاحظاتهم وحدَه يُكتب', client().notes === 'يُفوتر على الفرع الشرقي', client().notes);
check('ويُعدّ عميلاً محدَّثاً', applied.clientsUpdated === 1, applied);

// ── ويدٌ مسّته وتبدّل عندهم → تعارضٌ ينتظر ──
db.prepare(`UPDATE clients SET notes = 'تصحيحٌ كتبه المحاسب'`).run();
docContent = PROJECT_DOC.replace('يُفوتر باسم المؤسسة لا باسم المالك', 'يُفوتر على الفرع الغربي');
applied = await runSync(env, connection, actor);
check('تبدّلُ الطرفين في حقلِ عميل → تعارض', applied.conflicts === 1, applied);
check('وما كتبته اليدُ باقٍ', client().notes === 'تصحيحٌ كتبه المحاسب', client().notes);

clientConflict = db.prepare(
  `SELECT * FROM basecamp_conflicts WHERE field = 'client.notes' AND resolved_at IS NULL`,
).get();
check('والتعارضُ مسمّىً بحقله', Boolean(clientConflict), clientConflict);

// ── والصورةُ القديمة تُقرأ ولا تُقلب تعارضاتٍ ──
/* صفوفُ الإنتاج تحمل `synced_values` بحقولِ قضيةٍ مبسوطة — لا
   `{ case, client }`. وقراءتُها فارغةً تجعل أوّلَ مزامنةٍ بعد النشر تظنّ
   أنّ كلَّ حقلٍ تبدّل. */
({ db, env } = setup());
docContent = PROJECT_DOC;
await runSync(env, connection, actor);
const upgraded = JSON.parse(
  db.prepare(`SELECT synced_values FROM basecamp_projects WHERE project_id='101'`).get().synced_values,
);
check('الصورةُ تُحفظ بابين: قضيةً وعميلاً',
  upgraded.case?.caseNumber === 'م-2026-002' && upgraded.client?.clientType === 'company', upgraded);

db.prepare(`UPDATE basecamp_projects SET synced_values = ? WHERE project_id='101'`)
  .run(JSON.stringify({ caseNumber: 'م-2026-002', summary: 'مراجعةُ عقود التوريد', status: 'completed' }));
db.prepare(`UPDATE cases SET summary = 'تصحيحٌ كتبه المحامي'`).run();

applied = await runSync(env, connection, actor);
check('صورةٌ قديمةٌ تُقرأ حقولَ قضية', applied.conflicts === 0, applied);
check('وما مسّته اليدُ يبقى', kase().summary === 'تصحيحٌ كتبه المحامي', kase().summary);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
