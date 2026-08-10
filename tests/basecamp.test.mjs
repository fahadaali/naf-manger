/* ═══ اختبارُ ربط بيسكامب — المرحلة ١ ═══
 *
 * ثلاثةُ أشياء تُختبر هنا، وكلُّها تسقط صامتةً لو لم تُختبر:
 *
 * ١) **توحيدُ العنوان العربي.** «ملخّص القضيّة» و«ملخص القضيه» عنوانٌ واحد
 *    كتبه اثنان. ومقارنةٌ حرفية تُسقط مشروعَ عميلٍ لأنّ كاتبَه شدّد حرفاً —
 *    فتضيع قضيةٌ من النقل ولا يقول أحدٌ لِمَ.
 *
 * ٢) **التصنيف لا ينقض حكمَ اليد.** من صنّف مشروعاً بيده لا يُنقض حكمُه في
 *    مسحٍ لاحق. وبغير ذلك يعود المشروعُ الداخلي «عميلاً» كلَّ ساعة.
 *
 * ٣) **التعمية تفكّ ما عمّت، وتردّ `null` لا تسقط** حين يُبدَّل المفتاح.
 *
 * والقاعدةُ SQLite فعلية من ملفّات الهجرة، وبيسكامب مُحاكاة بـ`fetch`
 * مُستبدَل — لأنّ المقصود منطقُنا لا شبكتُهم.
 *
 * التشغيل: npm test
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

globalThis.Response = class {
  static json(body, init) { return { body, status: init?.status ?? 200 }; }
};

const db = new DatabaseSync(':memory:');
const load = (file) =>
  readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

db.exec(load('0002_platform_tables.sql'));
db.exec(load('0004_case_attachments.sql'));
db.exec(load('0009_basecamp.sql'));

const mkDb = () => ({
  prepare(sql) {
    let bound = [];
    return {
      bind(...params) { bound = params; return this; },
      all() { return { results: db.prepare(sql).all(...bound) }; },
      first() { return db.prepare(sql).get(...bound) ?? null; },
      run() { const r = db.prepare(sql).run(...bound); return { meta: { changes: r.changes } }; },
    };
  },
  async batch(statements) { return statements.map((s) => s.all()); },
});

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('✔', name); }
  else { fail++; console.log('✘', name, extra); }
};

// ═══ ١) توحيد العنوان العربي ═══
const { normalizeArabic, isSummaryTitle, findVault } = await import('../worker/lib/basecamp/discover.js');

for (const variant of [
  'ملخص القضية',
  'ملخّص القضيّة',      // بالشدّة
  'ملخص القضيه',         // بالهاء
  'ملخـص القضية',        // بالتطويل
  '  ملخص   القضية  ',   // بمسافاتٍ زائدة
  'مُلَخَّص القَضِيَّة',        // بالحركات
]) {
  check(`يُعرَف العنوان «${variant.trim()}»`, isSummaryTitle(variant));
}

for (const other of ['ملخص الجلسة', 'القضية', 'ملخص القضية القديمة', '', 'Case Summary']) {
  check(`لا يُخلَط بـ«${other}»`, !isSummaryTitle(other));
}
check('التوحيد يرفع الحركات والتطويل', normalizeArabic('مُلَخَّـص') === 'ملخص', normalizeArabic('مُلَخَّـص'));
check('التوحيد يوحّد صور الألف', normalizeArabic('أحمد إبراهيم آدم') === 'احمد ابراهيم ادم');

// ═══ ٢) قراءة الرصيف ═══
check('تُلتقط خزانة المستندات', findVault({ dock: [
  { id: 1, name: 'message_board', enabled: true },
  { id: 99, name: 'vault', title: 'Docs & Files', enabled: true },
] }) === '99');
check('خزانةٌ معطَّلة لا تُلتقط', findVault({ dock: [{ id: 99, name: 'vault', enabled: false }] }) === null);
check('مشروعٌ بلا رصيف', findVault({}) === null);

// ═══ ٣) التصفّح بترويسة Link ═══
const { nextLink } = await import('../worker/lib/basecamp/api.js');
check('تُقرأ وصلةُ التالي', nextLink('<https://x/p.json?page=2>; rel="next"') === 'https://x/p.json?page=2');
check('تُلتقط من بين وصلات', nextLink('<https://x/1>; rel="prev", <https://x/3>; rel="next"') === 'https://x/3');
check('بلا وصلةِ تالٍ → null', nextLink('<https://x/1>; rel="prev"') === null);
check('بلا ترويسة → null', nextLink(null) === null);

// ═══ ٤) التعمية ═══
const { seal, open } = await import('../worker/lib/basecamp/secrets.js');
const sealed = await seal('مفتاحٌ طويلٌ سرّي', 'refresh-token-xyz');
check('المعمّى لا يحمل النصّ', !sealed.includes('refresh-token-xyz'), sealed);
check('يُفكّ بالمفتاح نفسه', (await open('مفتاحٌ طويلٌ سرّي', sealed)) === 'refresh-token-xyz');
check('مفتاحٌ آخر → null لا سقوط', (await open('مفتاحٌ آخر', sealed)) === null);
check('نصٌّ تالف → null لا سقوط', (await open('مفتاحٌ طويلٌ سرّي', 'ليس base64 صالحاً!!')) === null);
const sealedAgain = await seal('مفتاحٌ طويلٌ سرّي', 'refresh-token-xyz');
check('كلُّ تعميةٍ بمتّجهٍ جديد', sealed !== sealedAgain);

// ═══ ٥) المسح والتصنيف — ببيسكامب مُحاكاة ═══
const PROJECTS = [
  { id: 101, name: 'قضية شركة الأفق', app_url: 'https://3.basecamp.com/1/projects/101',
    dock: [{ id: 11, name: 'vault', enabled: true }] },
  { id: 102, name: 'إدارة المكتب الداخلية', app_url: 'https://3.basecamp.com/1/projects/102',
    dock: [{ id: 12, name: 'vault', enabled: true }] },
  { id: 103, name: 'مشروع بلا مستندات', app_url: 'https://3.basecamp.com/1/projects/103',
    dock: [{ id: 13, name: 'message_board', enabled: true }] },
];

// ١٠١ فيه الملخّص في مجلَّدٍ فرعي — لا في الجذر: بعض المكاتب تفعل ذلك.
const DOCS = {
  '/buckets/101/vaults/11/documents.json': [{ id: 900, title: 'العقد' }],
  '/buckets/101/vaults/11/vaults.json': [{ id: 111, title: 'المستندات' }],
  '/buckets/101/vaults/111/documents.json': [
    { id: 901, title: 'ملخّص القضيّة', updated_at: '2026-03-01T10:00:00.000Z' },
  ],
  '/buckets/102/vaults/12/documents.json': [{ id: 902, title: 'محضر اجتماع' }],
  '/buckets/102/vaults/12/vaults.json': [],
};

let calls = 0;
globalThis.fetch = async (url) => {
  calls++;
  const path = String(url).replace('https://3.basecampapi.com/9', '');
  const body = path === '/projects.json' ? PROJECTS
    : path === '/projects.json?status=archived' ? []
      : DOCS[path] ?? [];
  return {
    ok: true, status: 200,
    headers: new Map([['link', null]]),
    json: async () => body,
  };
};
// `headers.get` على Map يعمل، لكن Map.get يردّ undefined لا null — ولا فرق هنا.

const { scanProjects } = await import('../worker/lib/basecamp/discover.js');
const env = { DB: mkDb() };
const connection = { accountId: '9', token: 't' };

let summary = await scanProjects(env, connection);
check('مُسحت الثلاثة', summary.scanned === 3, JSON.stringify(summary));
check('واحدٌ صُنّف عميلاً', summary.client === 1, JSON.stringify(summary));
check('اثنان داخليّان', summary.internal === 2, JSON.stringify(summary));

const rows = () => db.prepare(`SELECT * FROM basecamp_projects ORDER BY project_id`).all();
let stored = rows();
check('الملخّص وُجد في المجلَّد الفرعي', stored[0].doc_id === '901', JSON.stringify(stored[0]));
check('وحُفظ تاريخُ تعديله', stored[0].doc_updated_at === '2026-03-01T10:00:00.000Z');
check('المشروع الداخلي internal', stored[1].kind === 'internal');
check('مشروعٌ بلا خزانة internal', stored[2].kind === 'internal' && stored[2].vault_id === null);
check('رابط المشروع محفوظ', stored[0].app_url === 'https://3.basecamp.com/1/projects/101');

// ═══ ٦) حكمُ اليد لا يُنقَض ═══
db.prepare(`UPDATE basecamp_projects SET kind = 'client', decided_by = 'u1' WHERE project_id = '102'`).run();
db.prepare(`UPDATE basecamp_projects SET kind = 'internal', decided_by = 'u1' WHERE project_id = '101'`).run();

await scanProjects(env, connection);
stored = rows();
check('مشروعٌ رُفع بيده يبقى client رغم غياب الملخّص', stored[1].kind === 'client', stored[1].kind);
check('مشروعٌ خُفض بيده يبقى internal رغم وجود الملخّص', stored[0].kind === 'internal', stored[0].kind);
check('والملخّص ما زال مقروءاً', stored[0].doc_id === '901');

// ═══ ٧) `created_at` لا يُداس في المسح الثاني ═══
const firstSeen = stored[0].created_at;
await scanProjects(env, connection);
check('تاريخُ أوّل رؤية ثابت', rows()[0].created_at === firstSeen);

// ═══ ٨) الحراسة: غيرُ المسؤول لا يمرّ ═══
const handlers = await import('../worker/lib/basecamp/handlers.js');
const staff = { id: 'u2', role: 'staff', name: 'موظّف', permissions: { settings: { update: true } } };
const url = new URL('https://x/api/basecamp/status');

for (const [name, run] of [
  ['status', () => handlers.readStatus(env, staff)],
  ['projects', () => handlers.listProjects(env, staff)],
  ['scan', () => handlers.rescan(env, staff)],
  ['sample', () => handlers.readSample(env, staff, url)],
  ['disconnect', () => handlers.disconnect(env, staff)],
  ['connect', () => handlers.startConnect({}, env, staff, url)],
  ['classify', () => handlers.classifyProject({}, env, staff, '101')],
]) {
  const r = await run();
  check(`${name} يردّ ٤٠٣ لغير المسؤول`, r.status === 403 && r.body.error === 'forbidden', JSON.stringify(r));
}

// ═══ ٩) بلا أسرارٍ مضبوطة → not_configured لا خطأُ خادم ═══
const admin = { id: 'u1', role: 'admin', name: 'فهد', permissions: {} };
let r = await handlers.readStatus(env, admin);
check('بلا أسرار → not_configured', r.body.data.state === 'not_configured', JSON.stringify(r.body));

// ═══ ١٠) التصنيف باليد عبر المسار ═══
const withKeys = {
  DB: mkDb(),
  BASECAMP_CLIENT_ID: 'id', BASECAMP_CLIENT_SECRET: 'secret', BASECAMP_TOKEN_KEY: 'key',
};
r = await handlers.classifyProject(
  { json: async () => ({ kind: 'client' }) }, withKeys, admin, '103',
);
check('التصنيف باليد يُحفظ', r.body.ok === true && r.body.data.decidedByHand === true, JSON.stringify(r.body));
check('وثُبّت في القاعدة',
  db.prepare(`SELECT kind, decided_by FROM basecamp_projects WHERE project_id='103'`).get().decided_by === 'u1');

r = await handlers.classifyProject({ json: async () => ({ kind: 'شيء' }) }, withKeys, admin, '103');
check('تصنيفٌ مجهول يُردّ ٤٠٠', r.status === 400 && r.body.error === 'invalid_kind');

r = await handlers.classifyProject({ json: async () => ({ kind: 'client' }) }, withKeys, admin, 'لا-وجود-له');
check('مشروعٌ غير موجود يُردّ ٤٠٤', r.status === 404);

// ═══ ١١) حالةٌ مربوطة: العدّ صحيح ═══
db.prepare(
  `INSERT INTO basecamp_connection (id, account_id, account_name, access_token, refresh_token,
     expires_at, connected_by, connected_at) VALUES (1,'9','مكتب ناف','a','r',9999999999,'u1',1)`,
).run();
r = await handlers.readStatus(withKeys, admin);
check('الحالة connected', r.body.data.state === 'connected');
check('اسم الحساب يُقرأ', r.body.data.accountName === 'مكتب ناف');
check('المزامنة مطفأة ابتداءً', r.body.data.syncEnabled === false);
check('العدّ يفصل العملاء عن الداخلي',
  r.body.data.projects.total === 3 && r.body.data.projects.client === 2,
  JSON.stringify(r.body.data.projects));

// ═══ ١٢) مبادلةُ الرمز — الترويسة والسبب ═══
//
// 37signals تشترط `User-Agent`، وكانت ساقطةً من المبادلة والتجديد وحدهما —
// فيقع التصريحُ عندهم ثم تسقط المبادلة، والشاشةُ تقول «تعذّرت» ولا تقول لِمَ.
{
  const seenHeaders = [];
  globalThis.fetch = async (input, init) => {
    seenHeaders.push({ url: String(input), headers: init?.headers ?? {} });
    return { ok: true, status: 200, json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 100 }) };
  };

  const { exchangeCode } = await import('../worker/lib/basecamp/oauth.js');
  const cfg = { BASECAMP_CLIENT_ID: 'id', BASECAMP_CLIENT_SECRET: 'sec', BASECAMP_TOKEN_KEY: 'k' };
  const site = new URL('https://crm.naflaw.sa/api/basecamp/callback?code=abc');

  let out = await exchangeCode(cfg, site, 'abc');
  check('المبادلة تنجح', out.tokens?.access_token === 'a', JSON.stringify(out));
  const sent = seenHeaders[0];
  check('وتحمل User-Agent', String(sent.headers['user-agent'] ?? '').includes('NAF Manager'), JSON.stringify(sent.headers));
  check('وتطلب JSON', sent.headers.accept === 'application/json');
  check('والعنوان سلسلةٌ لا كائن', typeof sent.url === 'string' && sent.url.startsWith('https://launchpad'));
  check('ورابطُ العودة يُشتقّ من أصل الطلب',
    sent.url.includes(encodeURIComponent('https://crm.naflaw.sa/api/basecamp/callback')), sent.url);

  /* والسقوط يحمل سببَه: الحالة ورمزُ 37signals — بهما يُفرَّق بين سرٍّ
     خاطئ ورابطِ عودةٍ لا يطابق، وهما يُصلَحان في مكانين مختلفين. */
  globalThis.fetch = async () => ({
    ok: false, status: 401, json: async () => ({ error: 'invalid_client' }),
  });
  out = await exchangeCode(cfg, site, 'abc');
  check('السقوط يحمل الحالة', out.error?.status === 401, JSON.stringify(out));
  check('ويحمل رمز 37signals', out.error?.code === 'invalid_client', JSON.stringify(out));

  /* ورمزٌ لا يطابق الشكل المسجَّل يُسقَط: جسمُ الردّ قد يحمل صدى ما أُرسل،
     ونقلُه إلى شريط العنوان تسريب. */
  globalThis.fetch = async () => ({
    ok: false, status: 400, json: async () => ({ error: 'secret=abc123 leaked <script>' }),
  });
  out = await exchangeCode(cfg, site, 'abc');
  check('رمزٌ حرٌّ لا يُنقل', out.error?.code === null && out.error?.status === 400, JSON.stringify(out));

  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => { throw new Error('html'); } });
  out = await exchangeCode(cfg, site, 'abc');
  check('ردٌّ ليس JSON لا يُسقط المبادلة', out.error?.status === 500 && out.error?.code === null, JSON.stringify(out));
}

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
