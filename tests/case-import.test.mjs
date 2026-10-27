/* ═══ استيرادُ القضايا ═══
 *
 * ما يُحرَس هنا: المعاينةُ لا تكتب؛ والعميلُ يُطابَق بالهوية ثم بالاسم وإلا
 * أُنشئ — مرّةً لقضاياه كلِّها في الملفّ؛ والمكرّرُ يُردّ بسببه؛ ولا يدخل لفظٌ
 * حرٌّ عموداً مغلقاً؛ والمحصَّلُ يصير دفعةً افتتاحية.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { importCases } = await import('../worker/lib/case-import.js');
const bodyOf = async (response) => (typeof response.json === 'function' ? await response.json() : response.body);
const request = (body) => ({ json: async () => body });

const now = Math.floor(Date.now() / 1000);
const db = freshDatabase();
const env = makeEnv(db);
db.prepare(
  `INSERT INTO clients (id, full_name, id_number, created_at, updated_at) VALUES
     ('c-afaq', 'شركة الأفق التجارية', '7001234567', ?, ?),
     ('c-noor', 'مؤسسة النور', NULL, ?, ?)`,
).run(now, now, now, now);
db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, created_at, updated_at)
   VALUES ('k-old', 'ق-0001', 't', 'c-afaq', 'الأفق', ?, ?)`,
).run(now, now);
db.prepare(
  `INSERT INTO members (user_id, display_name, role, is_active, created_at) VALUES ('m-sara', 'سارة المطيري', 'lawyer', 1, ?)`,
).run(now);
db.prepare(
  `INSERT INTO lawyers (id, name, is_active, created_at, updated_at) VALUES ('m-sara', 'سارة المطيري', 1, ?, ?)`,
).run(now, now);

const admin = { id: 'u1', name: 'فهد', role: 'admin', permissions: { cases: { create: true }, clients: { create: true } } };
const ROWS = [
  { line: 2, caseNumber: 'ق-100', clientName: 'اسمٌ آخر', clientIdNumber: '٧٠٠١٢٣٤٥٦٧', status: 'منجزة', outcome: 'لصالحنا',
    feeType: 'مقدم فقط', totalAmount: '50,000', collectedAmount: '20000', createdDate: '2025/03/07', lawyer: 'سارة المطيري' },
  { line: 3, caseNumber: 'ق-101', clientName: 'مؤسسه النور', status: 'تحت الدراسة', outcome: 'ربحانة' },
  { line: 4, caseNumber: 'ق-102', clientName: 'خالد بن سعد الدوسري', clientIdNumber: '1033333333', feeType: 'مجاني — تطوعي',
    collectedAmount: '900', opposingParties: 'شركة الريان، مؤسسة البناء' },
  { line: 5, caseNumber: 'ق-103', clientName: 'خالد سعد الدوسري', clientIdNumber: '1033333333' },
  { line: 6, caseNumber: 'ق-100', clientName: 'أيّ أحد' },
  { line: 7, caseNumber: 'ق-0001', clientName: 'أيّ أحد' },
  { line: 8, caseNumber: '', clientName: 'بلا رقم' },
  { line: 9, caseNumber: 'ق-104', clientName: 'زيد', feeType: 'بالتقسيط', totalAmount: 'كثير' },
];

// ═══════════════════════════════════════════════════════════
group('المعاينة');

let res = await importCases(request({ rows: ROWS, dryRun: true }), env, admin);
const preview = (await bodyOf(res)).data;
check('تُنشأ القضايا الصالحة وتُرفض البقية',
  preview.summary.cases === 5 && preview.summary.rejected === 3, preview.summary);
check('وعميلٌ واحدٌ يُنشأ لقضيتيه في الملفّ',
  preview.summary.clientsCreated === 2 && preview.summary.clientsLinked === 3, preview.summary);
const reasonOf = (line) => preview.rows.find((row) => row.line === line);
check('والمكرّرُ في الملفّ يُردّ بسببه', reasonOf(6).reasons[0].includes('مكرّر في الملفّ'), reasonOf(6));
check('والموجودُ في المنصة يُردّ', reasonOf(7).reasons[0].includes('موجودٌ في المنصة'), reasonOf(7));
check('وبلا رقمٍ يُردّ', reasonOf(8).status === 'rejected');
check('واللفظُ غيرُ المفهوم يُقال ولا يُكتب',
  reasonOf(9).warnings.some((text) => text.includes('بالتقسيط')) && reasonOf(9).warnings.some((text) => text.includes('ليس رقماً')),
  reasonOf(9).warnings);
check('ولا يُكتب شيءٌ في المعاينة',
  db.prepare(`SELECT COUNT(*) n FROM cases`).get().n === 1 && db.prepare(`SELECT COUNT(*) n FROM clients`).get().n === 2);

// ═══════════════════════════════════════════════════════════
group('التنفيذ');

res = await importCases(request({ rows: ROWS, dryRun: false }), env, admin);
const done = (await bodyOf(res)).data.summary;
check('يُكتب ما عُرض', done.written === 5 && done.clientsCreated === 2 && done.failed === 0, done);

const kase = (number) => db.prepare(`SELECT * FROM cases WHERE case_number = ?`).get(number);
check('الهويةُ تُطابَق وإن اختلف الاسم', kase('ق-100').client_id === 'c-afaq');
check('والاسمُ الموحَّد يُطابَق', kase('ق-101').client_id === 'c-noor');
check('والحالةُ والنتيجةُ رموزاً', kase('ق-100').status === 'completed' && kase('ق-100').outcome === 'won');
check('و«ربحانة» تُفهم بالجذر', kase('ق-101').outcome === 'won', kase('ق-101').outcome);
check('و«تحت الدراسة» لا تُكتب حالةً — والافتراضُ «جارية»', kase('ق-101').status === 'in-progress', kase('ق-101').status);
check('والمحامي يُطابَق بعضو', kase('ق-100').lawyer_id === 'm-sara');
check('وتاريخُ الإنشاء من الملفّ',
  new Date(kase('ق-100').created_at * 1000).toISOString().slice(0, 10) === '2025-03-07');

const status = JSON.parse(kase('ق-100').payment_status);
check('والمحصَّلُ دفعةٌ افتتاحية ومجموعُها في القضية',
  status.collectedAmount === 20000 && status.totalAmount === 50000 &&
    db.prepare(`SELECT amount, source FROM client_payments WHERE case_id = ?`).get(kase('ق-100').id)?.source === 'opening',
  status);
check('والتطوّعيةُ بلا دفعة', !db.prepare(`SELECT 1 FROM client_payments WHERE case_id = ?`).get(kase('ق-102').id));
check('والخصومُ تُقرأ', JSON.parse(kase('ق-102').opposing_parties).length === 2);
check('وقضيتا خالد لعميلٍ واحد', kase('ق-102').client_id === kase('ق-103').client_id);

res = await importCases(request({ rows: ROWS, dryRun: true }), { ...env }, { id: 'x', permissions: { cases: { create: true } } });
check('ومن لا يُنشئ العملاء لا يستورد', res.status === 403);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
