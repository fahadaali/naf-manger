/* ═══ العقدُ السنويّ ═══
 *
 * ما يُحرَس هنا: جدولُ الاستحقاق يُشتقّ من البداية والنهاية والتكرار؛ وتعديلُ
 * المبلغ في أثناء العقد يُبدّل ما بعده وحده؛ والمدفوعُ يُوزَّع على الأقدم أولاً
 * فيُعرف المتأخر؛ والتجديدُ يبدأ في اليوم التالي ويحمل آخرَ مبلغ؛ والعقدان لا
 * يتداخلان؛ وقضايا المتعاقد عملٌ قانونيٌّ بأتعاب «عقد سنوي» من أيّ باب حُفظت؛
 * واللوحةُ تعدّ ما ينتهي خلال ستّين يوماً ومستحقّاتِ العقود.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const contracts = await import('../worker/lib/contracts.js');
const { readStats } = await import('../worker/lib/queries.js');
const { handleResource } = await import('../worker/lib/crud.js');
const bodyOf = async (response) => await response.json();
const request = (body) => ({ json: async () => body });

const now = Math.floor(Date.now() / 1000);
const db = freshDatabase();
const env = makeEnv(db);
const admin = {
  id: 'admin', role: 'admin',
  permissions: { clients: { read: true, update: true }, cases: { read: true, create: true, update: true } },
};
const reader = { id: 'r', role: 'staff', permissions: { clients: { read: true, update: false } } };

const { addMonths, addDays, yearEnd, scheduleOf, summarize, today } = contracts;
const TODAY = today();

// ═══════════════════════════════════════════════════════════
group('جدولُ الاستحقاق');

check('الشهرُ يُقصّ إلى آخره', addMonths('2026-01-31', 1) === '2026-02-28' && addMonths('2028-01-31', 1) === '2028-02-29');
check('نهايةُ السنة اليومُ الذي يسبق ذكراها', yearEnd('2026-03-01') === '2027-02-28');

let schedule = scheduleOf({ startDate: '2026-01-01', endDate: '2026-12-31', frequency: 'monthly', amount: 100000, rateChanges: [] });
check('شهريٌّ لسنة: اثنتا عشرة دفعة', schedule.length === 12 && schedule[11].dueDate === '2026-12-01', schedule.length);

schedule = scheduleOf({ startDate: '2026-01-01', endDate: '2026-12-31', frequency: 'quarterly', amount: 300000, rateChanges: [] });
check('ربعيٌّ: أربع', schedule.length === 4 && schedule[3].dueDate === '2026-10-01');

schedule = scheduleOf({ startDate: '2026-01-01', endDate: '2026-12-31', frequency: 'annual', amount: 1200000, rateChanges: [] });
check('سنويٌّ: واحدة في البداية', schedule.length === 1 && schedule[0].amount === 1200000);

schedule = scheduleOf({
  startDate: '2026-01-01', endDate: '2026-12-31', frequency: 'monthly', amount: 100000,
  rateChanges: [{ from: '2026-11-01', amount: 1500 }],
});
check('تعديلٌ بعد عشرة أشهر يُبدّل ما بعده وحده',
  schedule[9].amount === 100000 && schedule[10].amount === 150000 && schedule[11].amount === 150000);

let summary = summarize(
  { startDate: '2026-01-01', endDate: '2026-12-31', frequency: 'monthly', amount: 100000,
    rateChanges: [{ from: '2026-11-01', amount: 1500 }] },
  250000, '2026-04-15',
);
check('المستحقُّ حتى اليوم أربعُ دفعات', summary.dueToDate === 400000);
check('والمتأخّرُ ما لم يغطّه المدفوع', summary.overdue === 150000);
check('والقيمةُ الكلّية بالتعديل', summary.totalValue === 1000000 + 300000);
check('والمتبقّي حتى النهاية', summary.remaining === 1300000 - 250000);
check('والمدفوعُ على الأقدم أولاً',
  summary.installments[0].state === 'paid' && summary.installments[1].state === 'paid'
    && summary.installments[2].state === 'overdue' && summary.installments[2].paid === 50000
    && summary.installments[4].state === 'upcoming');
check('والحالة: ينتهي قريباً قبل ستّين يوماً',
  summarize({ startDate: '2026-01-01', endDate: '2026-12-31', frequency: 'monthly', amount: 1, rateChanges: [] }, 0, '2026-11-15').status === 'expiring');

// ═══════════════════════════════════════════════════════════
group('العقدُ على الموكّل');

db.prepare(`INSERT INTO clients (id, full_name, created_at, updated_at) VALUES ('c', 'شركة الأفق', ?, ?), ('d', 'آخر', ?, ?)`)
  .run(now, now, now, now);
db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, status, authority, fee_structure, payment_status, created_at, updated_at)
   VALUES ('k1', '1', 'قضية تجارية', 'c', 'شركة الأفق', 'in-progress', 'المحكمة التجارية',
           '{"type":"advance_only","advance":{"feeType":"fixed_amount","value":5000}}',
           '{"totalAmount":5000,"collectedAmount":0}', ?, ?),
          ('k2', '2', 'استشارة', 'c', 'شركة الأفق', 'in-progress', NULL,
           '{"type":"pro_bono"}', NULL, ?, ?),
          ('k3', '3', 'قضية عمالية', 'd', 'آخر', 'in-progress', 'المحكمة العمالية', NULL, NULL, ?, ?)`,
).run(now, now, now, now, now, now);

const start = addDays(TODAY, -330);
let res = await contracts.createContract(request({ clientId: 'c', startDate: start, frequency: 'monthly', amount: 1000 }), env, admin);
const first = (await bodyOf(res)).data;
check('يُنشأ ونهايتُه سنةٌ من بدايته', res.status === 201 && first.endDate === yearEnd(start), first);
check('وملخّصُه: ينتهي خلال ستّين يوماً', first.summary.status === 'expiring' && first.summary.daysLeft <= 60, first.summary);

const k1 = db.prepare(`SELECT work_kind, fee_structure FROM cases WHERE id = 'k1'`).get();
check('وقضايا الموكّل صارت عملاً قانونياً بأتعاب «عقد سنوي»',
  k1.work_kind === 'legal_work' && JSON.parse(k1.fee_structure).type === 'annual_contract');
check('وما اتُّفق عليه قبله لا يُمحى', JSON.parse(k1.fee_structure).advance?.value === 5000);
check('والتطوّعيةُ تبقى تطوّعية', JSON.parse(db.prepare(`SELECT fee_structure FROM cases WHERE id = 'k2'`).get().fee_structure).type === 'pro_bono');
check('وقضايا غيره لا تُمسّ', db.prepare(`SELECT work_kind FROM cases WHERE id = 'k3'`).get().work_kind === null);

res = await contracts.createContract(request({ clientId: 'c', startDate: addDays(start, 30), amount: 1 }), env, admin);
check('والعقدان لا يتداخلان', res.status === 409 && (await bodyOf(res)).error === 'contract_overlap');

res = await contracts.createContract(request({ clientId: 'c', startDate: TODAY, endDate: addDays(TODAY, -1), amount: 1 }), env, admin);
check('ولا نهايةَ قبل البداية', res.status === 400);

res = await contracts.createContract(request({ clientId: 'c', startDate: TODAY, amount: 1 }), env, reader);
check('ولا ينشئه من لا يعدّل العملاء', res.status === 403);

// ═══════════════════════════════════════════════════════════
group('قضيةٌ جديدة للمتعاقد');

const fakeRequest = (method, body) => ({ method, json: async () => body });
res = await handleResource(fakeRequest('POST', {
  caseNumber: '9', caseType: 'قضية تجارية', clientId: 'c', clientName: 'شركة الأفق',
  authority: 'المحكمة', workKind: 'litigation', feeStructure: { type: 'advance_only' },
}), env, admin, 'cases');
const created = (await bodyOf(res)).data;
check('تُحفظ عملاً قانونياً بأتعاب «عقد سنوي» وإن أُرسل غيرُ ذلك',
  created?.workKind === 'legal_work' && created?.feeStructure?.type === 'annual_contract', created);

// ═══════════════════════════════════════════════════════════
group('تعديلُ المبلغ والدفعات');

res = await contracts.updateContract(request({ rateChanges: [{ from: addDays(start, 300), amount: 1500 }] }), env, admin, first.id);
const updated = (await bodyOf(res)).data;
const last = updated.summary.installments.at(-1);
check('التعديلُ يُبدّل الدفعات من تاريخه', last.amount === 1500 && updated.summary.installments[0].amount === 1000, updated.summary.installments);
check('والبدايةُ والنهايةُ كما هما', updated.startDate === start && updated.endDate === first.endDate);

res = await contracts.addContractPayment(request({ amount: 3000, paymentDate: TODAY, method: 'تحويل' }), env, admin, first.id);
const paid = (await bodyOf(res)).data;
check('الدفعةُ تُسجَّل ويُعاد الحساب', res.status === 201 && paid.summary.paid === 3000 && paid.payments.length === 1, paid.summary);
check('والمتأخّرُ = المستحقُّ − المدفوع', paid.summary.overdue === paid.summary.dueToDate - 3000);

res = await contracts.deleteContractPayment(env, admin, first.id, paid.payments[0].id);
check('وتُحذف', (await bodyOf(res)).data.summary.paid === 0);
await contracts.addContractPayment(request({ amount: 2000 }), env, admin, first.id);

// ═══════════════════════════════════════════════════════════
group('اللوحة');

res = await readStats(env);
let stats = (await bodyOf(res)).data;
check('العقدُ جارٍ وينتهي قريباً',
  stats.contracts.active === 1 && stats.contracts.expiring.length === 1 && stats.contracts.expiring[0].clientName === 'شركة الأفق', stats.contracts);
check('والمتأخّرُ ولم يحلّ بعد', stats.contracts.overdue > 0 && stats.contracts.notYetDue > 0, stats.contracts);
check('والمحصَّلُ هذا العام يحمل دفعاتِ العقود', stats.collectedThisYear.contracts === 2000, stats.collectedThisYear);
check('وقضايا العقد خارج «مستحقّات القضايا»', stats.outstandingAmount === 0, stats.outstandingAmount);

res = await readStats(env, { publicBoard: true });
stats = (await bodyOf(res)).data;
check('وشاشةُ العرض لا تبلغها المبالغ', stats.contracts === undefined && stats.activeContracts === 1);

// ═══════════════════════════════════════════════════════════
group('التجديد');

res = await contracts.renewContract(request({}), env, admin, first.id);
const renewed = (await bodyOf(res)).data;
check('يبدأ في اليوم التالي لنهايته', res.status === 201 && renewed.startDate === addDays(first.endDate, 1), renewed);
check('ويحمل آخرَ مبلغٍ سارٍ', renewed.amount === 1500 && renewed.renewedFrom === first.id);

res = await readStats(env);
stats = (await bodyOf(res)).data;
check('والمجدَّدُ يخرج من «ينتهي قريباً»', stats.contracts.expiring.length === 0, stats.contracts.expiring);

res = await contracts.listContracts(env, reader, new URL('https://x/api/contracts?clientId=c'));
check('ويقرؤها من يقرأ العملاء', (await bodyOf(res)).data.length === 2);

res = await contracts.deleteContract(env, admin, renewed.id);
check('ويُحذف العقد', res.status === 200 && db.prepare(`SELECT COUNT(*) n FROM client_contracts`).get().n === 1);

console.log(`\n${pass} نجح · ${fail} فشل`);
if (fail) process.exit(1);
