/* ═══ المحامون من الإعدادات، ونوعُ العمل، و«جارية» ═══
 *
 * ما يُحرَس هنا: يُضاف محامٍ بلا حساب ويُختار للقضايا؛ والحسابُ لمحامٍ واحد؛
 * ومن عليه قضايا يُوقف ولا يُحذف؛ والترحيلُ يزرع المحامين بمعرّفات الأعضاء؛
 * واللوحةُ تعدّ الجاريَ بنوعه، و«منظورة» القديمة «جارية».
 */
import { readFileSync } from 'node:fs';
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const lawyersApi = await import('../worker/lib/lawyers.js');
const { readStats } = await import('../worker/lib/queries.js');
const { workKindOf } = await import('../worker/lib/work-kind.js');
const bodyOf = async (response) => (typeof response.json === 'function' ? await response.json() : response.body);
const request = (body) => ({ json: async () => body });

const now = Math.floor(Date.now() / 1000);
const db = freshDatabase();
const env = makeEnv(db);
const admin = { id: 'admin', role: 'admin', permissions: { cases: { read: true }, settings: { update: true } } };
const reader = { id: 'r', role: 'staff', permissions: { cases: { read: true } } };

db.prepare(
  `INSERT INTO members (user_id, display_name, email, role, is_active, created_at) VALUES
     ('m-sara', 'سارة', 'sara@naf.sa', 'lawyer', 1, ?), ('m-ali', 'علي', 'ali@naf.sa', 'staff', 1, ?)`,
).run(now, now);
db.prepare(`INSERT INTO clients (id, full_name, created_at, updated_at) VALUES ('c', 'الأفق', ?, ?)`).run(now, now);

// ═══════════════════════════════════════════════════════════
group('المحامون');

let res = await lawyersApi.createLawyer(request({ name: 'خالد المحامي', title: 'مستشار' }), env, admin);
const khalid = (await bodyOf(res)).data;
check('يُضاف محامٍ بلا حسابٍ في المنصة', khalid?.name === 'خالد المحامي' && khalid.memberId === null, khalid);

res = await lawyersApi.createLawyer(request({ name: 'سارة', memberId: 'm-sara' }), env, admin);
const sara = (await bodyOf(res)).data;
res = await lawyersApi.createLawyer(request({ name: 'سارة ثانية', memberId: 'm-sara' }), env, admin);
check('والحسابُ لمحامٍ واحد', res.status === 409);

res = await lawyersApi.createLawyer(request({ name: 'أحد' }), env, reader);
check('ولا يضيف من لا يعدّل الإعدادات', res.status === 403);

res = await lawyersApi.listLawyers(env, reader);
check('ويقرؤهم من يقرأ القضايا', (await bodyOf(res)).data.length === 2);

db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, status, lawyer_id, created_at, updated_at)
   VALUES ('k1', '1', 'قضية تجارية', 'c', 'الأفق', 'in-progress', ?, ?, ?)`,
).run(khalid.id, now, now);
res = await lawyersApi.deleteLawyer(env, admin, khalid.id);
check('ومن عليه قضايا يُوقف ولا يُحذف',
  (await bodyOf(res)).data.deactivated === true && db.prepare(`SELECT is_active FROM lawyers WHERE id = ?`).get(khalid.id).is_active === 0);
res = await lawyersApi.deleteLawyer(env, admin, sara.id);
check('ومن لا قضايا عليه يُحذف', (await bodyOf(res)).data.deleted === true);

// ── والترحيلُ يزرعهم بمعرّفات الأعضاء ──
const seed = readFileSync(new URL('../migrations/0028_lawyers_work_kind.sql', import.meta.url), 'utf8')
  .match(/INSERT OR IGNORE INTO lawyers[\s\S]*?;/)[0];
db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, status, lawyer_id, team, created_at, updated_at)
   VALUES ('k2', '2', 't', 'c', 'الأفق', 'pending', 'm-sara', '["m-ali"]', ?, ?)`,
).run(now, now);
db.exec(seed);
check('الترحيلُ يزرع المحامين بمعرّفات الأعضاء — والفريقَ معهم',
  db.prepare(`SELECT member_id FROM lawyers WHERE id = 'm-sara'`).get()?.member_id === 'm-sara' &&
    Boolean(db.prepare(`SELECT 1 FROM lawyers WHERE id = 'm-ali'`).get()));

// ═══════════════════════════════════════════════════════════
group('نوعُ العمل و«جارية»');

check('جهةٌ مختصة → قضيةٌ منظورة', workKindOf({ case_type: 'استشارة', authority: 'المحكمة التجارية' }) === 'litigation');
check('ونوعٌ يبدأ بـ«قضية» → منظورة', workKindOf({ case_type: 'قضية عمالية' }) === 'litigation');
check('وما سواها عملٌ قانوني', workKindOf({ case_type: 'صياغة عقود' }) === 'legal_work');
check('والمختارُ يغلب الاستنتاج', workKindOf({ case_type: 'قضية عمالية', work_kind: 'legal_work' }) === 'legal_work');

db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, status, created_at, updated_at) VALUES
     ('k3', '3', 'صياغة عقود', 'c', 'الأفق', 'in-progress', ?, ?),
     ('k4', '4', 'استشارة', 'c', 'الأفق', 'completed', ?, ?)`,
).run(now, now, now, now);
const stats = (await bodyOf(await readStats(env))).data;
check('اللوحةُ تعدّ الجاريَ بنوعه — و«منظورة» القديمة منه',
  stats.ongoingByKind.litigation === 1 && stats.ongoingByKind.legalWork === 2 && stats.pendingCases === 3, stats.ongoingByKind);

// ═══════════════════════════════════════════════════════════
group('نسبةُ كسب القضايا');

{
  const db2 = freshDatabase();
  const env2 = makeEnv(db2);
  db2.prepare(`INSERT INTO clients (id, full_name, created_at, updated_at) VALUES ('c', 'س', ?, ?)`).run(now, now);
  const add = db2.prepare(
    `INSERT INTO cases (id, case_number, case_type, client_id, client_name, status, outcome, created_at, updated_at)
     VALUES (?, ?, ?, 'c', 'س', 'completed', ?, ?, ?)`,
  );
  add.run('w1', 'w1', 'قضية تجارية', 'won', now, now);
  add.run('w2', 'w2', 'قضية عمالية', 'won', now, now);
  add.run('l1', 'l1', 'قضية مدنية', 'lost', now, now);
  add.run('s1', 's1', 'قضية تجارية', 'settled', now, now);
  add.run('u1', 'u1', 'قضية تجارية', null, now, now);
  add.run('j1', 'j1', 'صياغة عقود', null, now, now);
  const decided = (await bodyOf(await readStats(env2))).data;
  check('الرابحةُ من المحسومة لا من كلّ المكتملة', decided.winRate === 50, decided.winRate);
  check('ومكوّناتُها، وما انتهى بلا نتيجة — بلا العمل القانوني',
    decided.outcomes.won === 2 && decided.outcomes.lost === 1 && decided.outcomes.settled === 1 &&
      decided.outcomes.decided === 4 && decided.outcomes.undecided === 1, decided.outcomes);
}

const { parseDocument, DEFAULT_FIELD_MAP } = await import('../worker/lib/basecamp/parse.js');
check('و«منظورة» في الملفّ تُقرأ «جارية»',
  parseDocument('<div>حالة القضية: منظورة</div>', DEFAULT_FIELD_MAP).case.status === 'in-progress');

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
