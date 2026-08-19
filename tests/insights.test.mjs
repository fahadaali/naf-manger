/* ═══ اختبارُ استبصارات التحليلات ═══
 *
 * الشرطُ الذي يحرسه هذا الملف واحد: **لا يغادر اسمٌ ولا بريدٌ ولا رقمُ
 * قضيةٍ إلى الطراز.** وهو شرطُ مكتبِ محاماة لا تفصيلَ أداء، ودعوى في
 * تعليقٍ لا تُمسك أحداً — فالاختبار يقرأ نصَّ الرسالتين حرفيّاً كما
 * يخرجان إلى `env.AI.run` ويفتّش فيهما عمّا زُرع في القاعدة.
 *
 * والقاعدةُ هنا SQLite فعلية تُحمَّل من ملفّات الهجرة نفسها، فتبدُّلُ
 * عمودٍ يظهر هنا لا في الإنتاج. والارتباطُ `AI` وحده مُحاكى — لأنّ
 * المقصود ما يُرسَل إليه لا ما يردّ به.
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
db.exec(load('0008_ai_insights.sql'));
/* والأرشفةُ معها: `buildDigest` تُصفّي `archived_at IS NULL` كما تفعل
   لوحةُ التحكّم، فمخطَّطٌ ناقصُ العمود يُسقط الخلاصة كلَّها. */
db.exec(load('0011_archive.sql'));

const now = Math.floor(Date.now() / 1000);
const ins = (sql, ...params) => db.prepare(sql).run(...params);

/* بذورٌ بأسماءَ وبُرُدٍ وأرقامِ قضايا صريحة — لأنّ الاختبار يبحث عنها
   فيما يخرج، فلا بدّ أن تكون في القاعدة أوّلاً. */
ins(`INSERT INTO clients (id,full_name,id_number,phone,email,join_date,client_type,status,notes,attachments,created_at,updated_at)
     VALUES ('c1','محمد','1','05','a@x.com','2026-01-05','individual','current','','[]',?,?)`, now, now);
ins(`INSERT INTO clients (id,full_name,id_number,phone,email,join_date,client_type,status,notes,attachments,created_at,updated_at)
     VALUES ('c2','شركة ناف','2','05','b@x.com','2026-02-05','company','current','','[]',?,?)`, now, now);
ins(`INSERT INTO prospects (id,full_name,id_number,phone,email,join_date,client_type,prospect_status,notes,attachments,expected_value,follow_up_date,created_at,updated_at)
     VALUES ('p1','سارة','3','05','c@x.com','2026-03-01','individual','مهتم','','[]',5000000,'2020-01-01',?,?)`, now, now);
ins(`INSERT INTO cases (id,case_number,case_type,client_id,client_name,summary,status,outcome,attachments,created_at,updated_at)
     VALUES ('k1','C-1','قضية تجارية','c1','محمد','','completed','won','[]',?,?)`, now, now);
ins(`INSERT INTO cases (id,case_number,case_type,client_id,client_name,summary,status,outcome,attachments,created_at,updated_at)
     VALUES ('k2','C-2','قضية عمالية','c2','شركة ناف','','pending',NULL,'[]',?,?)`, now, now);
ins(`INSERT INTO marketers (id,full_name,id_number,phone,email,relationship_type,start_date,status,notes,created_at,updated_at)
     VALUES ('m1','عبدالله','9','05','m@x.com','freelancer','2026-01-01','active','',?,?)`, now, now);

/* واجهةُ D1 فوق SQLite: `batch` و`bind` و`results` — بالشكل الذي
   يستعمله `insights.js`، لا بشكلٍ أوسعَ منه. */
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

let seen = null;   // ما وصل الطراز فعلاً
let calls = 0;

const env = {
  DB: mkDb(),
  AI: {
    async run(model, inputs) {
      calls++;
      seen = inputs;
      return {
        response:
          '```json\n{"insights":[' +
          '{"title":"متأخرو المتابعة","body":"محتملٌ واحد تجاوز موعد متابعته.","tone":"warning","action":"راجع قائمة المتابعة"},' +
          '{"title":"x","body":"y","tone":"غريب","action":""}' +
          ']}\n```',
      };
    },
  },
};

const admin = { id: 'u1', role: 'admin', permissions: { analytics: { read: true } } };
const { readInsights } = await import('../worker/lib/insights.js');
const url = (query = '') => new URL('https://x/api/insights' + query);

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('✔', name); }
  else { fail++; console.log('✘', name, extra); }
};

// ─── ١) النداء الأول يستدلّ ويحفظ ───
let r = await readInsights({}, env, admin, url());
check('الاستدلال ينجح', r.body.ok === true, JSON.stringify(r.body).slice(0, 200));
check('غير مأخوذٍ من الخبيئة', r.body.data.cached === false);
check('السياج ```json يُقشَّر', r.body.data.insights[0].title === 'متأخرو المتابعة');
check('نبرةٌ مجهولة تُردّ إلى info', r.body.data.insights[1].tone === 'info');

// ─── ٢) ═══ الخصوصية ═══ ───
// و«ما وصل» هو نصُّ الرسالتين حرفيّاً، لا تمثيلٌ مُهرَّب منه.
const sent = seen.messages.map((m) => m.content).join('\n');
for (const leak of ['محمد', 'شركة ناف', 'سارة', 'a@x.com', 'C-1', '1012', 'عبدالله', '05']) {
  check(`لا يتسرّب «${leak}»`, !sent.includes(leak), sent.slice(-400));
}

// والخلاصة تُقرأ مُحلَّلةً: القيمُ ذاتُها لا وجودُ سلسلةٍ في نصّ.
const digest = JSON.parse(seen.messages[1].content);
check('الخلاصة تحمل الأرقام', 'معدل_الربح' in digest.القضايا && 'الاتجاه_الشهري' in digest);
check('متأخرو المتابعة محسوبون', digest.المحتملون.متأخرو_المتابعة === 1, JSON.stringify(digest.المحتملون));
check('القيمة بالريال لا الهللات', digest.المحتملون.القيمة_المتوقعة_ريال === 50000, JSON.stringify(digest.المحتملون));
check('معدل الربح من المكتملة', digest.القضايا.معدل_الربح === 100, JSON.stringify(digest.القضايا));
check('حسب النوع يحمل نوعاً لا اسماً', digest.القضايا.حسب_النوع.some((t) => t.النوع === 'قضية تجارية'));
check('المسوّقون عددٌ بلا أسماء', digest.المسوّقون.active === 1, JSON.stringify(digest.المسوّقون));

// ─── ٣) الخبيئة: نداءٌ ثانٍ بالأرقام نفسها لا يستدلّ ───
const before = calls;
r = await readInsights({}, env, admin, url());
check('الثاني من الخبيئة', r.body.data.cached === true && calls === before, `calls=${calls}`);

// ─── ٤) refresh=1 يتخطّاها ───
r = await readInsights({}, env, admin, url('?refresh=1'));
check('refresh=1 يعيد الاستدلال', calls === before + 1 && r.body.data.cached === false);

// ─── ٥) تبدّلُ رقمٍ يبدّل البصمة فيُعاد الاستدلال ───
ins(`INSERT INTO clients (id,full_name,id_number,phone,email,join_date,client_type,status,notes,attachments,created_at,updated_at)
     VALUES ('c3','ثالث','7','05','d@x.com','2026-04-01','company','current','','[]',?,?)`, now, now);
const before2 = calls;
r = await readInsights({}, env, admin, url());
check('تبدّلُ الأرقام يُبطل الخبيئة', calls === before2 + 1 && r.body.data.cached === false);

// ─── ٦) بلا ارتباط AI ───
r = await readInsights({}, { DB: mkDb() }, admin, url());
check('بلا ارتباط AI → not_connected', !r.body.ok && r.body.error === 'not_connected' && r.status === 503, JSON.stringify(r));

// ─── ٧) بلا صلاحية ───
r = await readInsights({}, env, { id: 'u2', role: 'staff', permissions: { analytics: { read: false } } }, url());
check('بلا analytics.read → 403', !r.body.ok && r.body.error === 'forbidden' && r.status === 403);

// ─── ٨) ردٌّ لا يُقرأ ───
const unreadable = { ...env, AI: { async run() { return { response: 'عذراً، لا أستطيع.' }; } } };
r = await readInsights({}, unreadable, admin, url('?refresh=1'));
check('ردٌّ لا يُقرأ → unreadable_response', !r.body.ok && r.body.error === 'unreadable_response');

// ─── ٩) سقوط الاستدلال ───
const boom = { ...env, AI: { async run() { throw new Error('502'); } } };
r = await readInsights({}, boom, admin, url('?refresh=1'));
check('سقوط الاستدلال → inference_failed', !r.body.ok && r.body.error === 'inference_failed');

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
