/* ═══ المحامي المسؤول، وقيمةُ العمل التطوّعي ═══
 *
 * ما يُحرَس هنا:
 *
 * ١) **المحامي عضوٌ لا نصّ.** يُطابَق اسمُه في «بيانات المشروع» بعضوٍ واحد
 *    فيُكتب معرّفُه؛ وما لم يُطابَق لا يُكتب ويُفتح له سؤال.
 * ٢) **دليلُ الأعضاء اسمٌ ودورٌ وحدهما** — لا بريدَ ولا صلاحيات.
 * ٣) **شاشاتُ العرض لا تبلغها أسماءُ الأعضاء ولا المبالغ** — حِملُ المحامين
 *    وقيمةُ التطوّعي للوحة الداخلية وحدها.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { runSync, buildPlan } = await import('../worker/lib/basecamp/sync.js');
const { resolveReview } = await import('../worker/lib/basecamp/handlers.js');
const { readStats, listDirectory } = await import('../worker/lib/queries.js');
const { RESOURCES, toRow, toClient } = await import('../worker/lib/resources.js');

const now = Math.floor(Date.now() / 1000);
const bodyOf = async (response) => (typeof response.json === 'function' ? await response.json() : response.body);

function setup() {
  const db = freshDatabase();
  const env = makeEnv(db);
  db.prepare(
    `INSERT INTO members (user_id, display_name, email, role, is_active, created_at) VALUES
       ('m-sara', 'سارة عبدالله المطيري', 'sara@naf.sa', 'lawyer', 1, ?),
       ('m-khalid', 'خالد الزهراني', 'khalid@naf.sa', 'lawyer', 1, ?),
       ('m-off', 'منى الحربي', 'mona@naf.sa', 'lawyer', 0, ?)`,
  ).run(now, now, now);
  /* المحامون من قائمتهم في الإعدادات (`migrations/0028`) — بمعرّفات الأعضاء كما يزرعها الترحيل. */
  db.prepare(
    `INSERT INTO lawyers (id, name, member_id, is_active, created_at, updated_at) VALUES
       ('m-sara', 'سارة عبدالله المطيري', 'm-sara', 1, ?, ?),
       ('m-khalid', 'خالد الزهراني', 'm-khalid', 1, ?, ?),
       ('m-off', 'منى الحربي', 'm-off', 0, ?, ?)`,
  ).run(now, now, now, now, now, now);
  db.prepare(
    `INSERT INTO basecamp_projects (project_id, name, app_url, status, vault_id, doc_id, kind, created_at, updated_at)
     VALUES ('101', 'م', 'https://3.basecamp.com/1/projects/101', 'active', '11', '901', 'client', ?, ?)`,
  ).run(now, now);
  db.prepare(
    `INSERT INTO basecamp_connection (id, account_id, account_name, access_token, refresh_token, expires_at,
                                      connected_by, connected_at)
     VALUES (1, '9', 'ناف', 'a', 'r', 9999999999, 'u1', ?)`,
  ).run(now);
  return { db, env };
}

let doc = '';
globalThis.fetch = async () => ({
  ok: true, status: 200, headers: new Map(),
  json: async () => ({ id: 901, title: 'بيانات المشروع', content: doc, app_url: 'x', updated_at: 'x' }),
});
const connection = { accountId: '9', token: 't' };
const actor = { actorId: 'u1', actorName: 'فهد', source: 'اختبار' };
const base = '<div>اسم العميل: شركة الأفق</div><div>رقم الهوية: 7001234567</div><div>رقم المشروع: ق-1</div>';

// ═══════════════════════════════════════════════════════════
group('المحامي من «بيانات المشروع»');

let { db, env } = setup();
doc = `${base}<div>المحامي المسؤول: سارة المطيري</div>`;
await runSync(env, connection, actor);
const kase = () => db.prepare(`SELECT * FROM cases`).get();
check('الاسمُ المختصر يُطابَق بعضوٍ واحد فيُكتب معرّفُه', kase().lawyer_id === 'm-sara', kase().lawyer_id);
check('ولا يُفتح سؤال',
  db.prepare(`SELECT COUNT(*) n FROM basecamp_reviews WHERE kind = 'unmatched_lawyer'`).get().n === 0);

/* والمنصةُ المعتمدة: محامٍ بُدِّل بيدٍ لا تدهسه دورة. */
db.prepare(`UPDATE cases SET lawyer_id = 'm-khalid'`).run();
await runSync(env, connection, actor);
check('ومحامٍ بُدِّل في المنصة لا يُدهس', kase().lawyer_id === 'm-khalid', kase().lawyer_id);

({ db, env } = setup());
doc = `${base}<div>المحامي المسؤول: منى الحربي</div>`;
const plan = await buildPlan(env, connection);
check('عضوٌ معطَّل لا يُطابَق', plan.plans[0].warnings.some((line) => line.includes('لم يُعرف')), plan.plans[0].warnings);
await runSync(env, connection, actor);
check('فلا يُكتب', kase().lawyer_id === null, kase().lawyer_id);
const review = db.prepare(`SELECT * FROM basecamp_reviews WHERE kind = 'unmatched_lawyer'`).get();
check('ويُفتح له سؤالٌ باسمه', review?.subject === 'منى الحربي', review);

await runSync(env, connection, actor);
check('ولا يتكرّر السؤال كلَّ دورة',
  db.prepare(`SELECT COUNT(*) n FROM basecamp_reviews WHERE kind = 'unmatched_lawyer'`).get().n === 1);

const admin = { id: 'u1', role: 'admin', name: 'فهد' };
let res = await resolveReview({ json: async () => ({ resolution: 'set', value: 'غير-موجود' }) }, env, admin, review.id);
check('واختيارُ عضوٍ غير موجود يُردّ', res.status === 400);
res = await resolveReview({ json: async () => ({ resolution: 'set', value: 'm-khalid' }) }, env, admin, review.id);
check('واختيارُ العضو يكتبه في القضية', res.status === 200 && kase().lawyer_id === 'm-khalid', kase().lawyer_id);

// ═══════════════════════════════════════════════════════════
group('دليلُ الأعضاء');

res = await listDirectory(env, { permissions: { cases: { read: true } } });
const directory = (await bodyOf(res)).data;
check('المفعَّلون وحدهم، باسمٍ ودور', directory.length === 2 && directory.every((entry) => entry.name && entry.role), directory);
check('ولا بريدَ فيه ولا صلاحيات', !JSON.stringify(directory).includes('@') && !('permissions' in directory[0]));
res = await listDirectory(env, { permissions: {} });
check('ومن لا يقرأ القضايا ولا المحتملين لا يقرؤه', res.status === 403);

// ═══════════════════════════════════════════════════════════
group('الحقولُ والإحصاء');

const row = toRow(RESOURCES.cases, { proBonoHours: '١٢.٥', proBonoValue: 15000, team: ['m-sara'], lawyerId: 'm-khalid' });
check('الساعاتُ عددٌ والقيمةُ هللات',
  row.pro_bono_hours === 12.5 && row.pro_bono_value === 1500000 && row.team === '["m-sara"]', row);
check('وتُقرأ كما كُتبت',
  toClient(RESOURCES.cases, { id: 'x', pro_bono_hours: 12.5, pro_bono_value: 1500000, team: '["m-sara"]' }).proBonoValue === 15000);
check('وساعاتٌ لا تُقرأ عدداً غياب', toRow(RESOURCES.cases, { proBonoHours: 'كثير' }).pro_bono_hours === null);

db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, status, fee_structure, pro_bono_value,
                      pro_bono_hours, lawyer_id, created_at, updated_at)
   VALUES ('free', 'ق-2', 't', ?, 'الأفق', 'in-progress', '{"type":"pro_bono"}', 1200000, 30, NULL, ?, ?)`,
).run(kase().client_id, now, now);

res = await readStats(env);
const stats = (await bodyOf(res)).data;
check('قيمةُ التطوّعي هذا العام', stats.proBonoValue === 12000, stats.proBonoValue);
const load = Object.fromEntries((stats.casesByLawyer ?? []).map((entry) => [entry.lawyerId ?? 'none', entry]));
check('وحِملُ كلّ محامٍ باسمه، و«بلا محامٍ» صفٌّ بذاته',
  load['m-khalid']?.open === 1 && load['m-khalid']?.name === 'خالد الزهراني' && load.none?.open === 1, stats.casesByLawyer);

res = await readStats(env, { publicBoard: true });
const board = JSON.stringify((await bodyOf(res)).data);
check('وشاشةُ العرض لا تحمل أسماءَ أعضاءٍ ولا مبالغ',
  !board.includes('خالد') && !board.includes('casesByLawyer') && !board.includes('proBonoValue'), board.slice(0, 200));

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
