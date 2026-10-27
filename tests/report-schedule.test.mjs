/* ═══ إرسالُ التقارير المخصّصة دورياً ═══
 *
 * ما يُحرَس هنا: البريدُ الخارجيّ لا يكتبه إلا مسؤول؛ ولا يتلقّى التقريرَ من
 * لا يراه؛ ويُرسل في دورته وحدها، ومرّةً في يومه؛ والرسالةُ تحمل جدولاً
 * مهرَّباً ومرفقاً.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { createReport, updateReport } = await import('../worker/lib/reports.js');
const { scheduledReports } = await import('../worker/lib/report-schedule.js');
const bodyOf = async (response) => (typeof response.json === 'function' ? await response.json() : response.body);
const request = (body) => ({ json: async () => body });

const now = Math.floor(Date.now() / 1000);
const db = freshDatabase();
const env = makeEnv(db, { RESEND_API_KEY: 're_test', MAIL_FROM: 'ناف <no-reply@naflaw.sa>' });

db.prepare(
  `INSERT INTO members (user_id, display_name, email, role, perms, is_active, created_at) VALUES
     ('admin', 'فهد', 'admin@naf.sa', 'admin', NULL, 1, ?),
     ('lawyer', 'سارة', 'lawyer@naf.sa', 'lawyer', NULL, 1, ?),
     ('staff', 'خالد', 'staff@naf.sa', 'staff', NULL, 1, ?)`,
).run(now, now, now);
db.prepare(`INSERT INTO clients (id, full_name, created_at, updated_at) VALUES ('c', '<b>الأفق</b>', ?, ?)`).run(now, now);
db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, created_at, updated_at)
   VALUES ('k', 'ق-1', 'تجارية', 'c', '<b>الأفق</b>', ?, ?)`,
).run(now, now);

const admin = { id: 'admin', role: 'admin', permissions: { analytics: { read: true } } };
const lawyer = { id: 'lawyer', role: 'lawyer', permissions: { analytics: { read: true } } };
const definition = { dataSource: 'cases', fields: ['caseNumber', 'clientName'], filters: [], grouping: [], aggregations: [] };

// ═══════════════════════════════════════════════════════════
group('الحفظ');

let res = await createReport(request({
  ...definition, name: 'قضايا الأسبوع', isPublic: true,
  schedule: { enabled: true, frequency: 'weekly', recipients: ['lawyer', 'staff', 'cfo@example.com'] },
}), env, admin);
const weekly = (await bodyOf(res)).data;
check('المسؤولُ يحفظ مستلماً خارجياً',
  weekly.schedule.enabled && weekly.schedule.recipients.includes('cfo@example.com'), weekly.schedule);

res = await createReport(request({
  ...definition, name: 'تقريري الخاص',
  schedule: { enabled: true, frequency: 'daily', recipients: ['lawyer', 'admin', 'leak@example.com'] },
}), env, lawyer);
const daily = (await bodyOf(res)).data;
check('وغيرُه لا يكتب بريداً خارجياً', !daily.schedule.recipients.some((entry) => entry.includes('@')), daily.schedule);

res = await updateReport(request({
  ...definition, name: 'قضايا الأسبوع', isPublic: true,
  schedule: { enabled: true, frequency: 'weekly', recipients: ['lawyer'] },
}), env, { ...lawyer, id: 'admin-not', role: 'lawyer' }, weekly.id);
check('ومن لا يملك التقريرَ لا يعدّله', res.status === 403);

res = await createReport(request({ ...definition, name: 'بلا إرسال', schedule: { enabled: true, frequency: 'hourly' } }), env, admin);
check('وتكرارٌ مجهولٌ لا يُجدوِل', (await bodyOf(res)).data.schedule.enabled === false);

// ═══════════════════════════════════════════════════════════
group('الإرسال');

let sent = [];
globalThis.fetch = async (url, init) => {
  sent.push(JSON.parse(init.body));
  return { ok: true, status: 200, json: async () => ({ id: 'm' }) };
};

/* الاثنين: اليوميُّ وحده. */
await scheduledReports(env, { day: '2026-11-02', weekday: 1, dayOfMonth: 2 });
check('في غير الأحد يُرسل اليوميُّ وحده', sent.length === 1 && sent[0].subject === 'تقرير: تقريري الخاص', sent.map((mail) => mail.subject));
check('والتقريرُ الخاصُّ لصاحبه وللمسؤول — لا لغيرهما',
  sent[0].to.sort().join() === 'admin@naf.sa,lawyer@naf.sa', sent[0].to);
check('والجدولُ يُهرَّب', sent[0].html.includes('&lt;b&gt;الأفق') && !sent[0].html.includes('<b>الأفق'));
check('والمرفقُ CSV', sent[0].attachments?.[0]?.filename === 'تقريري الخاص.csv' &&
  atob(sent[0].attachments[0].content).length > 0, sent[0].attachments);

sent = [];
await scheduledReports(env, { day: '2026-11-02', weekday: 1, dayOfMonth: 2 });
check('ومرّةً في يومه', sent.length === 0, sent.length);

/* الأحد: الأسبوعيُّ — والموظّفُ لا يملك قراءة التقارير فلا يتلقّاه. */
sent = [];
await scheduledReports(env, { day: '2026-11-08', weekday: 0, dayOfMonth: 8 });
const week = sent.find((mail) => mail.subject === 'تقرير: قضايا الأسبوع');
check('الأحدُ يُرسل الأسبوعيّ', Boolean(week), sent.map((mail) => mail.subject));
check('لمن يملك قراءةَ التقارير وللبريد الخارجيّ',
  week && week.to.includes('lawyer@naf.sa') && week.to.includes('cfo@example.com') && !week.to.includes('staff@naf.sa'),
  week?.to);

/* وبلا Resend لا يُرسل، ولا يُعلَّم مُرسلاً. */
sent = [];
const before = db.prepare(`SELECT last_sent_at FROM custom_reports WHERE name = 'تقريري الخاص'`).get().last_sent_at;
await scheduledReports(makeEnv(db), { day: '2026-11-09', weekday: 1, dayOfMonth: 9 });
check('وبلا بريدٍ مربوط لا يُعلَّم مُرسلاً',
  db.prepare(`SELECT last_sent_at FROM custom_reports WHERE name = 'تقريري الخاص'`).get().last_sent_at === before);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
