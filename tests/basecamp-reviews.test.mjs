/* ═══ ما يستحقّ نظرَك — يُجمع ولا يوقف شيئاً ═══
 *
 * ثلاثةٌ تُحرَس هنا:
 *
 * ١) **الاستيرادُ لا ينتظر أحداً.** المزامنةُ تكتب القضيةَ والعميل، ثم
 *    تفتح صفَّ سؤالٍ وتمضي. فمكتبٌ لا يفتح الشاشة شهراً تبقى استيراداتُه
 *    جارية.
 *
 * ٢) **والسؤالُ يُحسم مرّةً.** مزامنةٌ كلَّ ساعة على الحال نفسِه كانت
 *    ستفتح أربعاً وعشرين نسخةً في اليوم — أو تُعيد سؤالاً حُسم بالأمس.
 *    وقيدُ التفرّد على (المشروع + النوع + البصمة) هو الذي يمنع ذلك.
 *
 * ٣) **وسياسةُ الاختلاف تُغني عن حسمِ كلِّ حقلٍ بيد** لمن استقرّ عنده
 *    أيُّ الطرفين أصحّ.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

/* والبديلُ يُثبَّت لا يُشترط: Node يحمل `Response` أصلاً، و`??` تتركه —
   فيصير `response.body` مجرىً لا كائناً، ويُقرأ كلُّ فحصٍ عليه فارغاً. */
globalThis.Response = class {
  static json(body, init) { return { body, status: init?.status ?? 200 }; }
};

const { buildPlan, runSync, writeConflictPolicy } = await import('../worker/lib/basecamp/sync.js');
const { listOpen, countOpen, mergeClients } = await import('../worker/lib/basecamp/reviews.js');
const handlers = await import('../worker/lib/basecamp/handlers.js');

const now = Math.floor(Date.now() / 1000);
const admin = { id: 'u1', role: 'admin', name: 'فهد' };

const setup = () => {
  const db = freshDatabase();
  const env = makeEnv(db);
  db.prepare(
    `INSERT INTO basecamp_projects (project_id, name, app_url, status, vault_id, doc_id, kind,
                                    created_at, updated_at)
     VALUES ('101', 'مشروع الأفق', 'https://3.basecamp.com/1/projects/101', 'active', '11', '901',
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

/* ملفٌّ بلا رقم قضيةٍ وبلفظٍ لا يُفهم — سؤالان في مشروعٍ واحد. */
const DOC = `<div>
  <div>اسم العميل: شركة الأفق</div>
  <div>رقم الهوية: 7001234567</div>
  <div>نوع المشروع: قضية تجارية</div>
  <div>نتيجة المشروع: تحت الدراسة</div>
</div>`;

// ═══════════════════════════════════════════════════════════
group('الاستيرادُ يكتب، والسؤالُ ينتظر');

let { db, env } = setup();
docContent = DOC;
let applied = await runSync(env, connection, actor);

check('القضيةُ كُتبت ولم تنتظر شيئاً',
  db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 1, applied);
check('والعميلُ كذلك', db.prepare(`SELECT COUNT(*) n FROM clients`).get().n === 1);

let open = await listOpen(env);
check('وفُتح صفٌّ لرقمٍ مولَّد',
  open.some((row) => row.kind === 'generated_number'), open.map((r) => r.kind));
check('وصفٌّ للفظٍ لم يُفهم',
  open.some((row) => row.kind === 'unresolved_value'), open.map((r) => r.kind));
check('واللفظُ يحمل قائمتَه ليُختار منها',
  Object.keys(open.find((row) => row.kind === 'unresolved_value')?.detail?.codes ?? {}).includes('won'),
  open.find((row) => row.kind === 'unresolved_value')?.detail);
/* واللفظُ لم يُكتب في العمود: هو مغلقٌ تقرؤه اللوحةُ رمزاً. */
check('واللفظُ لم يدخل العمود',
  !db.prepare(`SELECT outcome FROM cases`).get().outcome);

// ═══════════════════════════════════════════════════════════
group('والسؤالُ يُحسم مرّةً ولا يعود');

const before = await countOpen(env);
await runSync(env, connection, actor);
check('مزامنةٌ ثانيةٌ لا تُكرّر السؤال', (await countOpen(env)) === before, `${before} → ${await countOpen(env)}`);

/* حسمُ اللفظ: يُكتب في العمود **ويُحفظ في المعجم**. */
const puzzle = (await listOpen(env)).find((row) => row.kind === 'unresolved_value');
let response = await handlers.resolveReview(
  { json: async () => ({ resolution: 'set', value: 'won' }) }, env, admin, puzzle.id,
);
check('يُحسم اللفظُ باختيارٍ من القائمة', response.body.ok === true, response.body);
check('فتُكتب القيمةُ رمزاً', db.prepare(`SELECT outcome FROM cases`).get().outcome === 'won');
check('ويُحفظ اللفظُ في المعجم',
  JSON.parse(db.prepare(`SELECT value FROM system_settings WHERE key='ai_lexicon'`).get().value)
    ['case.outcome']?.['تحت الدراسه'] === 'won');
check('ويخرج من القائمة',
  !(await listOpen(env)).some((row) => row.id === puzzle.id));

/* ولا يعود ولو مضت دوراتٌ على الحال نفسِه. */
await runSync(env, connection, actor);
check('ولا يعود في الدورة التالية',
  !(await listOpen(env)).some((row) => row.kind === 'unresolved_value'),
  (await listOpen(env)).map((r) => r.kind));
/* بل يُقرأ من المعجم فيُكتب بلا سؤال — وهو ما يعنيه «انتهينا». */
check('بل يُقرأ من المعجم فيُكتب',
  db.prepare(`SELECT outcome FROM cases`).get().outcome === 'won');

/* ورمزٌ خارج القائمة يُردّ. */
({ db, env } = setup());
docContent = DOC;
await runSync(env, connection, actor);
const another = (await listOpen(env)).find((row) => row.kind === 'unresolved_value');
response = await handlers.resolveReview(
  { json: async () => ({ resolution: 'set', value: 'مؤجلة' }) }, env, admin, another.id,
);
check('ورمزٌ خارج القائمة يُردّ ٤٠٠', response.status === 400, response.body);
check('ويبقى الصفُّ مفتوحاً',
  (await listOpen(env)).some((row) => row.id === another.id));

// ═══════════════════════════════════════════════════════════
group('تصنيفُ المشروع — يُحسم وينتهي');

/* مشروعٌ جديد يُسأل عن تصنيفه مرّةً عند أوّل مسح. */
const PROJECTS = [
  { id: 202, name: 'إدارة المكتب', app_url: 'https://3.basecamp.com/1/projects/202',
    dock: [{ id: 22, name: 'vault', enabled: true }] },
];
const DOCS = {
  '/buckets/202/vaults/22/documents.json': [{ id: 990, title: 'بيانات المشروع' }],
  '/buckets/202/vaults/22/vaults.json': [],
};
globalThis.fetch = async (url) => {
  const path = String(url).replace('https://3.basecampapi.com/9', '');
  const body = path === '/projects.json' ? PROJECTS
    : path === '/projects.json?status=archived' ? []
      : DOCS[path] ?? [];
  return { ok: true, status: 200, headers: new Map([['link', null]]), json: async () => body };
};

({ db, env } = setup());
const { scanProjects } = await import('../worker/lib/basecamp/discover.js');
await scanProjects(env, connection);

let kindReview = (await listOpen(env)).find((row) => row.kind === 'project_kind');
check('مشروعٌ جديد يُسأل عن تصنيفه', Boolean(kindReview), (await listOpen(env)).map((r) => r.kind));
check('ويُقال بمَ رُجّح', kindReview.detail.hasDocument === true, kindReview.detail);

/* والمسحُ الثاني لا يُعيد السؤال — ولا يسأل عن مشروعٍ كان قائماً. */
const openBefore = await countOpen(env);
await scanProjects(env, connection);
check('ومسحٌ ثانٍ لا يُكرّره', (await countOpen(env)) === openBefore);

response = await handlers.resolveReview(
  { json: async () => ({ resolution: 'internal' }) }, env, admin, kindReview.id,
);
check('يُصنَّف داخلياً بضغطة', response.body.ok === true, response.body);
const row = db.prepare(`SELECT kind, decided_by FROM basecamp_projects WHERE project_id='202'`).get();
check('ويثبت القرار', row.kind === 'internal' && row.decided_by === 'u1', row);

/* وحكمُ اليد لا ينقضه مسحٌ لاحق — ولا يُعاد السؤال. */
await scanProjects(env, connection);
check('ولا ينقضه مسحٌ لاحق',
  db.prepare(`SELECT kind FROM basecamp_projects WHERE project_id='202'`).get().kind === 'internal');
check('ولا يُسأل عنه ثانيةً',
  !(await listOpen(env)).some((r) => r.kind === 'project_kind' && r.projectId === '202'));

// ═══════════════════════════════════════════════════════════
group('سياسةُ الاختلاف');

globalThis.fetch = async () => ({
  ok: true, status: 200, headers: new Map(),
  json: async () => ({ id: 901, title: 'بيانات المشروع', content: docContent, app_url: 'x', updated_at: 'x' }),
});

const withPolicy = async (policy) => {
  const fresh = setup();
  docContent = DOC.replace('نتيجة المشروع: تحت الدراسة', 'موضوع المشروع: نزاعُ توريد');
  await runSync(fresh.env, connection, actor);
  /* يدٌ تمسّ الحقل، ثمّ يتبدّل عندهم — تبدّلُ الطرفين. */
  fresh.db.prepare(`UPDATE cases SET summary = 'تصحيحٌ كتبه المحامي'`).run();
  docContent = DOC.replace('نتيجة المشروع: تحت الدراسة', 'موضوع المشروع: نزاعٌ على عقد توريد');
  if (policy !== 'ask') await writeConflictPolicy(fresh.env, policy, 'u1');
  const result = await runSync(fresh.env, connection, actor);
  return { ...fresh, result };
};

let trial = await withPolicy('ask');
check('«اسألني» تُسجّل ولا تكتب',
  trial.result.conflicts === 1 && trial.db.prepare(`SELECT summary FROM cases`).get().summary === 'تصحيحٌ كتبه المحامي',
  trial.result);
/* ومع ذلك لم يقف الاستيراد: القضيةُ قائمةٌ ورابطُها محدَّث. */
check('ولا يقف الاستيراد معها',
  trial.db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 1);

trial = await withPolicy('basecamp');
check('«خذ من بيسكامب» تكتب قيمتَهم',
  trial.db.prepare(`SELECT summary FROM cases`).get().summary === 'نزاعٌ على عقد توريد',
  trial.db.prepare(`SELECT summary FROM cases`).get());
check('ولا تُسجّل اختلافاً', trial.result.conflicts === 0, trial.result);

trial = await withPolicy('platform');
check('«أبقِ ما في المنصة» تُبقي ما كُتب',
  trial.db.prepare(`SELECT summary FROM cases`).get().summary === 'تصحيحٌ كتبه المحامي');
check('ولا تُسجّل اختلافاً', trial.result.conflicts === 0, trial.result);
/* وتُثبَّت الصورة، فلا يُسأل عنها ثانيةً ولا تُكتب. */
const after = await runSync(trial.env, connection, actor);
check('ولا تعود في الدورة التالية', after.conflicts === 0, after);
check('وما كتبته اليدُ باقٍ',
  trial.db.prepare(`SELECT summary FROM cases`).get().summary === 'تصحيحٌ كتبه المحامي');

// ═══════════════════════════════════════════════════════════
group('دمجُ عميلين');

({ db, env } = setup());
db.prepare(
  `INSERT INTO clients (id, full_name, id_number, phone, email, client_type, status, notes,
                        join_date, created_at, updated_at)
   VALUES ('keep', 'محمد خالد القحطاني', '1012345678', '', '', 'individual', 'current', '',
           '2019-01-01', ?, ?)`,
).run(now, now);
db.prepare(
  `INSERT INTO clients (id, full_name, phone, email, client_type, status, notes,
                        join_date, created_at, updated_at)
   VALUES ('dup', 'محمد خالد عبدالله القحطاني', '0551234567', '', 'individual', 'current', '',
           '2021-01-01', ?, ?)`,
).run(now, now);
db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, summary, status,
                      created_at, updated_at)
   VALUES ('k1', 'ق-1', 'تجارية', 'dup', 'محمد خالد عبدالله القحطاني', '', 'pending', ?, ?)`,
).run(now, now);

check('يُدمج المكرَّر في الباقي',
  (await mergeClients(env, { keepId: 'keep', mergeId: 'dup' })) === true);
check('وتنتقل قضاياه',
  db.prepare(`SELECT client_id, client_name FROM cases WHERE id='k1'`).get().client_id === 'keep');
check('ويُملأ فارغُ الباقي',
  db.prepare(`SELECT phone FROM clients WHERE id='keep'`).get().phone === '0551234567');
/* و«عميلٌ منذ» أقدمُ التاريخين — لا يُؤخَّر أبداً. */
check('ويبقى تاريخُه الأقدم',
  db.prepare(`SELECT join_date FROM clients WHERE id='keep'`).get().join_date === '2019-01-01');
/* والمكرَّر يُؤرشف ولا يُحذف: حذفُه يُشعل `ON DELETE CASCADE` على ما بقي. */
check('والمكرَّر يُؤرشف لا يُحذف',
  Boolean(db.prepare(`SELECT archived_at FROM clients WHERE id='dup'`).get()?.archived_at));

// ═══════════════════════════════════════════════════════════
group('الحراسة');

const staff = { id: 'u2', role: 'staff', name: 'موظّف', permissions: { settings: { update: true } } };
for (const [name, run] of [
  ['reviews', () => handlers.listReviews(env, staff)],
  ['resolve', () => handlers.resolveReview({ json: async () => ({}) }, env, staff, 'x')],
  ['policy', () => handlers.setConflictPolicy({ json: async () => ({ policy: 'ask' }) }, env, staff)],
]) {
  const result = await run();
  check(`${name} يردّ ٤٠٣ لغير المسؤول`, result.status === 403, JSON.stringify(result));
}

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
