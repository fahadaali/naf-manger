/* ═══ إعادةُ استيراد بيسكامب من الصفر ═══
 *
 * ما يُحرَس هنا: المعاينةُ تعدّ ولا تحذف؛ ولا تنفيذَ بلا عبارة التأكيد؛
 * والتنفيذُ يحذف المستوردَ وحده مع دفعاته وعمولاته، ويُبقي العملاءَ والقضايا
 * اليدويةَ وتصنيفَ المشاريع، ويُرجع دفعاتِ وافق «بلا قضية».
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { resetBasecampImport, RESET_PHRASE } = await import('../worker/lib/basecamp/reset.js');
const bodyOf = async (response) => (typeof response.json === 'function' ? await response.json() : response.body);
const request = (body) => ({ json: async () => body });

const now = Math.floor(Date.now() / 1000);
const db = freshDatabase();
const env = makeEnv(db);
const admin = { id: 'u1', name: 'فهد', role: 'admin' };

db.prepare(`INSERT INTO clients (id, full_name, created_at, updated_at) VALUES ('c1', 'الأفق', ?, ?)`).run(now, now);
db.prepare(`INSERT INTO marketers (id, full_name, id_number, created_at, updated_at) VALUES ('m1', 'مسوّق', '1', ?, ?)`).run(now, now);
db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, lawyer_id, fee_structure, created_at, updated_at)
   VALUES ('k-bc', 'ق-2026-014', 't', 'c1', 'الأفق', 'u9', '{"type":"advance_only"}', ?, ?),
          ('k-hand', 'NAF-1', 't', 'c1', 'الأفق', NULL, NULL, ?, ?)`,
).run(now, now, now, now);
db.prepare(
  `INSERT INTO basecamp_projects (project_id, name, app_url, status, kind, decided_by, case_id, client_id, synced_values,
                                  last_synced_at, created_at, updated_at)
   VALUES ('101', 'م', 'https://3.basecamp.com/1/projects/101', 'active', 'client', 'u1', 'k-bc', 'c1', '{}', ?, ?, ?),
          ('102', 'داخلي', 'https://3.basecamp.com/1/projects/102', 'active', 'internal', 'u1', NULL, NULL, NULL, NULL, ?, ?)`,
).run(now, now, now, now, now);
db.prepare(
  `INSERT INTO client_payments (id, case_id, client_id, amount, source, external_id, created_by, created_at) VALUES
     ('pay-1', 'k-bc', 'c1', 100000, 'manual', NULL, 'u1', ?),
     ('pay-2', 'k-bc', 'c1', 50000, 'wafeq', 'wafeq:w1', 'u1', ?),
     ('pay-3', 'k-hand', 'c1', 7000, 'manual', NULL, 'u1', ?)`,
).run(now, now, now);
db.prepare(
  `INSERT INTO commission_payments (id, marketer_id, case_id, amount, created_by, created_at) VALUES ('cm-1', 'm1', 'k-bc', 900, 'u1', ?)`,
).run(now);
db.prepare(
  `INSERT INTO wafeq_payments (external_id, amount, status, case_id, payment_id, match_by, created_at, updated_at) VALUES
     ('w1', 50000, 'linked', 'k-bc', 'pay-2', 'case_number', ?, ?),
     ('w2', 1000, 'suggested', NULL, NULL, 'ai', ?, ?)`,
).run(now, now, now, now);
db.prepare(`UPDATE wafeq_payments SET suggested_case_id = 'k-bc' WHERE external_id = 'w2'`).run();
db.prepare(
  `INSERT INTO basecamp_conflicts (id, project_id, case_id, field, detected_at) VALUES ('x1', '101', 'k-bc', 'summary', ?)`,
).run(now);
db.prepare(
  `INSERT INTO basecamp_reviews (id, kind, project_id, fingerprint, created_at) VALUES
     ('r1', 'generated_number', '101', 'a', ?), ('r2', 'project_kind', '102', 'b', ?)`,
).run(now, now);

const count = (table) => db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;

// ═══════════════════════════════════════════════════════════
group('المعاينة');

let res = await resetBasecampImport(request({ dryRun: true }), env, admin);
const impact = (await bodyOf(res)).data.impact;
check('تعدّ القضايا المستوردة وحدها', impact.cases === 1 && impact.withLawyer === 1 && impact.withFees === 1, impact);
check('ودفعاتِها بمصدرها', impact.payments.manual?.count === 1 && impact.payments.manual?.amount === 1000 &&
  impact.payments.wafeq?.count === 1, impact.payments);
check('وعمولاتِها ودفعاتِ وافق التي ترجع', impact.commissions.count === 1 && impact.wafeqReturned === 2, impact);
check('ولا تحذف شيئاً', count('cases') === 2 && count('client_payments') === 3);

res = await resetBasecampImport(request({ dryRun: false, confirm: 'نعم' }), env, admin);
check('ولا تنفيذَ بلا العبارة', res.status === 400 && count('cases') === 2);

res = await resetBasecampImport(request({ dryRun: false, confirm: RESET_PHRASE }), env, { id: 'u2', role: 'lawyer' });
check('ولا لغير المسؤول', res.status === 403 && count('cases') === 2);

// ═══════════════════════════════════════════════════════════
group('التنفيذ');

res = await resetBasecampImport(request({ dryRun: false, confirm: RESET_PHRASE }), env, admin);
check('يُنفَّذ', (await bodyOf(res)).ok === true);
check('تُحذف المستوردةُ وتبقى اليدوية',
  !db.prepare(`SELECT 1 FROM cases WHERE id = 'k-bc'`).get() && Boolean(db.prepare(`SELECT 1 FROM cases WHERE id = 'k-hand'`).get()));
check('ومعها دفعاتُها وعمولاتُها — لا دفعاتُ غيرها',
  count('client_payments') === 1 && db.prepare(`SELECT id FROM client_payments`).get().id === 'pay-3' &&
    count('commission_payments') === 0);
check('والعملاءُ باقون', count('clients') === 1);

const w1 = db.prepare(`SELECT * FROM wafeq_payments WHERE external_id = 'w1'`).get();
const w2 = db.prepare(`SELECT * FROM wafeq_payments WHERE external_id = 'w2'`).get();
check('ودفعاتُ وافق ترجع بلا قضية',
  w1.status === 'unmatched' && !w1.case_id && !w1.payment_id && w2.status === 'unmatched' && !w2.suggested_case_id,
  { w1, w2 });

const p101 = db.prepare(`SELECT * FROM basecamp_projects WHERE project_id = '101'`).get();
check('والمشروعُ يُفكّ ربطُه ويبقى تصنيفُه',
  !p101.case_id && !p101.client_id && !p101.synced_values && !p101.last_synced_at &&
    p101.kind === 'client' && p101.decided_by === 'u1', p101);
check('والاختلافاتُ والأسئلةُ القديمةُ تُحذف إلا التصنيف',
  count('basecamp_conflicts') === 0 && count('basecamp_reviews') === 1 &&
    db.prepare(`SELECT kind FROM basecamp_reviews`).get().kind === 'project_kind');
check('ويُسجَّل في الأنشطة',
  Boolean(db.prepare(`SELECT 1 FROM activity_logs WHERE type = 'basecamp' AND description LIKE '%من الصفر%'`).get()));

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
