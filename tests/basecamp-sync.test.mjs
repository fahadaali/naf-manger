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

const { htmlToText, readLabelledLines, parseSummary, DEFAULT_FIELD_MAP } =
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

const parsed = parseSummary(DOC, DEFAULT_FIELD_MAP);
check('اسم العميل', parsed.client.fullName === 'شركة الأفق التجارية', parsed.client);
check('رقم الهوية', parsed.client.idNumber === '7001234567', parsed.client);
check('الجوال والبريد', parsed.client.phone === '0501234567' && parsed.client.email === 'afaq@example.com', parsed.client);
check('«شركة» تُترجَم company', parsed.client.clientType === 'company', parsed.client);
check('رقم القضية ونوعها', parsed.case.caseNumber === 'ق-2026-014' && parsed.case.caseType === 'قضية تجارية', parsed.case);
check('«قيد المعالجة» تُترجَم in-progress', parsed.case.status === 'in-progress', parsed.case);
check('«موضوع القضية» يُربط بالملخّص', parsed.case.summary === 'نزاعٌ على عقد توريد', parsed.case);
check('وحقلٌ لا مقابل له يُعرض لا يُبتلع',
  parsed.unmapped.some((u) => u.label === 'المحامي المسؤول'), parsed.unmapped);

const shaddad = parseSummary(
  '<div>اسمُ العميلِ: أحمد</div><div>رقمُ الهويّة: 1012345678</div>', DEFAULT_FIELD_MAP);
check('العنوان المشكَّل يُطابَق موحَّداً',
  shaddad.client.fullName === 'أحمد' && shaddad.client.idNumber === '1012345678', shaddad.client);

const custom = parseSummary('<div>الموكّل: خالد</div>', { 'الموكّل': 'client.fullName' });
check('خريطةٌ من عند المكتب تُحترم', custom.client.fullName === 'خالد', custom.client);

const bogus = parseSummary('<div>س: ١</div>', { 'س': 'case.لا-يوجد' });
check('هدفٌ مجهول يُهمَل ولا يُكتب', Object.keys(bogus.case).length === 0, bogus.case);

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

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
