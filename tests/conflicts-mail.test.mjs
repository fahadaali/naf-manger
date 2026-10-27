/* ═══ تعارضُ المصالح، والبريد ═══
 *
 * ما يُحرَس هنا:
 *
 * ١) **الخصمُ يُقرأ ويُفحص.** من «بيانات المشروع» ومن نافذة القضية، ثم يُسأل
 *    عن كلّ موكّلٍ جديد: أخصمٌ هو؟ — بالهوية قطعاً، وبالاسم ترجيحاً، ولا
 *    يُخلط الأخُ بأخيه.
 * ٢) **البريدُ لا يُسقط شيئاً ولا يبلغ غيرَ أهله.** من لم يشترك لا يتلقّى،
 *    ومن لا يقرأ القضايا لا تبلغه دفعاتُها، والفاعلُ لا يُبلَّغ بما فعل.
 *    واليوميّةُ والأسبوعيّة مرّةً في يومها لا كلَّ ساعة.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { parseDocument, DEFAULT_FIELD_MAP } = await import('../worker/lib/basecamp/parse.js');
const { runSync } = await import('../worker/lib/basecamp/sync.js');
const { checkConflicts, readConflicts } = await import('../worker/lib/conflicts.js');
const { sendMail, renderMail } = await import('../worker/lib/mail.js');
const { notifyEvent, recipientsFor, scheduledNotifications } = await import('../worker/lib/notify.js');

const now = Math.floor(Date.now() / 1000);

// ═══════════════════════════════════════════════════════════
group('الخصمُ من «بيانات المشروع»');

const parsed = parseDocument(
  '<div>اسم العميل: أحمد</div><div>الخصم: شركة الريّان، وليد السبيعي - 1012345678</div>' +
  '<div>الطرف الآخر: مؤسسة النور</div><div>المدعى عليه: أحمد</div>',
  DEFAULT_FIELD_MAP,
);
check('الأطرافُ تُقسَم ويُقرأ رقمُ كلٍّ منها',
  JSON.stringify(parsed.case.opposingParties) === JSON.stringify([
    { name: 'شركة الريّان' }, { name: 'وليد السبيعي', idNumber: '1012345678' }, { name: 'مؤسسة النور' },
  ]), parsed.case.opposingParties);
check('و«وليد» لا يصير «ليد»', parsed.case.opposingParties?.[1]?.name === 'وليد السبيعي');
check('و«المدعى عليه» ليس خصماً بالافتراض',
  parsed.unmapped.some((entry) => entry.label === 'المدعى عليه'), parsed.unmapped);

// ── المزامنة تكتبه، والمنصةُ المعتمدة ──
const db = freshDatabase();
const env = makeEnv(db);
db.prepare(
  `INSERT INTO basecamp_projects (project_id, name, app_url, status, vault_id, doc_id, kind, created_at, updated_at)
   VALUES ('101', 'م', 'https://3.basecamp.com/1/projects/101', 'active', '11', '901', 'client', ?, ?)`,
).run(now, now);
db.prepare(
  `INSERT INTO basecamp_connection (id, account_id, account_name, access_token, refresh_token, expires_at,
                                    connected_by, connected_at)
   VALUES (1, '9', 'ناف', 'a', 'r', 9999999999, 'u1', ?)`,
).run(now);

let doc = '<div>اسم العميل: شركة الأفق</div><div>رقم الهوية: 7001234567</div><div>رقم المشروع: ق-1</div>' +
  '<div>الخصم: مؤسسة الريان - 7009998887</div>';
globalThis.fetch = async () => ({
  ok: true, status: 200, headers: new Map(),
  json: async () => ({ id: 901, title: 'بيانات المشروع', content: doc, app_url: 'x', updated_at: 'x' }),
});
const connection = { accountId: '9', token: 't' };
const actor = { actorId: 'u1', actorName: 'فهد', source: 'اختبار' };

await runSync(env, connection, actor);
const parties = () => JSON.parse(db.prepare(`SELECT opposing_parties FROM cases`).get().opposing_parties);
check('المزامنةُ تكتب الخصمَ في القضية',
  parties().length === 1 && parties()[0].idNumber === '7009998887', parties());

db.prepare(`UPDATE cases SET opposing_parties = ?`).run(JSON.stringify([{ name: 'تصحيحٌ بيد' }]));
doc = doc.replace('مؤسسة الريان - 7009998887', 'جهةٌ أخرى');
await runSync(env, connection, actor);
check('وما عُدِّل في المنصة لا يُدهس', parties()[0].name === 'تصحيحٌ بيد', parties());

// ═══════════════════════════════════════════════════════════
group('فحصُ التعارض');

db.prepare(`DELETE FROM cases`).run();
db.prepare(
  `INSERT INTO clients (id, full_name, id_number, commercial_register, created_at, updated_at) VALUES
     ('c1', 'محمد خالد عبدالله القحطاني', '1011111111', NULL, ?, ?),
     ('c2', 'شركة النخبة', NULL, '7005555555', ?, ?)`,
).run(now, now, now, now);
const insertCase = db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, opposing_parties, archived_at,
                      created_at, updated_at)
   VALUES (?, ?, 't', ?, ?, ?, ?, ?, ?)`,
);
insertCase.run('k1', 'ق-100', 'c2', 'شركة النخبة', JSON.stringify([{ name: 'سعد بن فهد الدوسري', idNumber: '1022222222' }]), null, now, now);
insertCase.run('k2', 'ق-101', 'c2', 'شركة النخبة', JSON.stringify([{ name: 'مؤسسة البناء الحديث' }]), now, now, now);

let found = await checkConflicts(env, { name: 'اسمٌ مختلفٌ تماماً', idNumber: '1022222222' });
check('رقمُ الهوية قاطعٌ وإن اختلف الاسم',
  found.asOpponent.length === 1 && found.asOpponent[0].matchBy === 'idNumber' && found.asOpponent[0].caseNumber === 'ق-100',
  found);

found = await checkConflicts(env, { name: 'سعد الدوسري' });
check('والاسمُ المختصر يُقال «بالاسم»', found.asOpponent[0]?.matchBy === 'name', found);

found = await checkConflicts(env, { name: 'فهد سعد الدوسري' });
check('والابنُ ليس أباه', found.asOpponent.length === 0, found);

found = await checkConflicts(env, { name: 'مؤسسه البناء الحديث' });
check('والمؤرشفُ داخلٌ في الفحص ويُعلَّم',
  found.asOpponent.length === 1 && found.asOpponent[0].archived === true, found);

found = await checkConflicts(env, { name: 'محمد خالد القحطاني' });
check('والخصمُ المسمّى موكّلٌ عندنا يُقال', found.asClient[0]?.clientId === 'c1', found);

found = await checkConflicts(env, { name: '', idNumber: '7005555555' });
check('والسجلُّ التجاريّ هويةُ المنشأة', found.asClient[0]?.clientId === 'c2', found);

found = await checkConflicts(env, { name: 'سعد الدوسري', excludeClientId: 'c2' });
check('وقضايا الموكّل نفسِه لا تُعدّ عليه', found.asOpponent.length === 0, found);

found = await checkConflicts(env, { name: 'سعد' });
check('واسمٌ من كلمةٍ واحدة لا يطابق كلَّ «سعد»', found.asOpponent.length === 0, found);

const res = await readConflicts(env, { id: 'x', permissions: {} }, new URL('https://x/api/conflicts?name=سعد'));
check('ومن لا يقرأ القضايا ولا العملاء لا يسأل', res.status === 403);

// ═══════════════════════════════════════════════════════════
group('البريد');

check('القالبُ يهرّب ما يُدرج فيه', renderMail('<b>', ['<script>x</script>']).includes('&lt;script&gt;') &&
  !renderMail('<b>', ['<script>']).includes('<script>'));

let sent = [];
globalThis.fetch = async (url, init) => {
  sent.push({ url, init, body: JSON.parse(init.body) });
  return { ok: true, status: 200, json: async () => ({ id: 'm1' }) };
};

let result = await sendMail(makeEnv(db), { to: 'a@b.sa', subject: 's' });
check('بلا مفتاحٍ لا يُرسل', result.error === 'not_configured' && sent.length === 0);

const mailEnv = makeEnv(db, { RESEND_API_KEY: 're_test', MAIL_FROM: 'ناف <no-reply@naflaw.sa>' });
result = await sendMail(mailEnv, { to: ['a@b.sa', 'ليس بريداً'], subject: 'تجربة', lines: ['سطر'] });
check('وبه يُرسل بالمفتاح والمُرسِل',
  result.ok && sent[0].url === 'https://api.resend.com/emails' &&
    sent[0].init.headers.Authorization === 'Bearer re_test' &&
    sent[0].body.from === 'ناف <no-reply@naflaw.sa>' && sent[0].body.to.join() === 'a@b.sa',
  sent[0]?.body);

globalThis.fetch = async () => ({ ok: false, status: 422, json: async () => ({}) });
result = await sendMail(mailEnv, { to: 'a@b.sa', subject: 's' });
check('ونطاقٌ غيرُ موثَّق يُردّ «rejected» ولا يرمي', result.error === 'rejected', result);

// ── من يتلقّى ──
const member = db.prepare(
  `INSERT INTO members (user_id, display_name, email, role, perms, is_active, notification_prefs, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);
member.run('admin', 'فهد', 'admin@naf.sa', 'admin', null, 1, null, now);
member.run('lawyer', 'سارة', 'lawyer@naf.sa', 'lawyer', null, 1, JSON.stringify({ payments: false }), now);
member.run('staff', 'خالد', 'staff@naf.sa', 'staff', JSON.stringify({ cases: { read: false } }), 1, null, now);
member.run('off', 'معطّل', 'off@naf.sa', 'admin', null, 0, null, now);
member.run('noemail', 'بلا بريد', null, 'admin', null, 1, null, now);

let to = await recipientsFor(mailEnv, { pref: 'payments', permission: ['cases', 'read'] });
check('الدفعاتُ لمن اشترك ويقرأ القضايا وحده', to.join() === 'admin@naf.sa', to);

to = await recipientsFor(mailEnv, { pref: 'newClients', permission: ['clients', 'read'], excludeUserId: 'admin' });
check('والفاعلُ لا يُبلَّغ بما فعل', !to.includes('admin@naf.sa') && to.includes('lawyer@naf.sa'), to);

sent = [];
globalThis.fetch = async (url, init) => {
  sent.push(JSON.parse(init.body));
  return { ok: true, status: 200, json: async () => ({ id: 'm' }) };
};
await notifyEvent(mailEnv, { id: 'lawyer', name: 'سارة' }, {
  resource: 'cases', action: 'create', row: { caseNumber: 'ق-200', caseType: 'تجارية', clientName: 'شركة النخبة' },
});
check('قضيةٌ جديدة تبلغ المشتركين', sent.length === 1 && sent[0].subject.includes('ق-200') &&
  sent[0].to.includes('admin@naf.sa') && !sent[0].to.includes('lawyer@naf.sa'), sent);

sent = [];
await notifyEvent(mailEnv, { id: 'x' }, { resource: 'marketers', action: 'create', row: { fullName: 'م' } });
check('وما لا إشعارَ له لا يُرسل', sent.length === 0);

globalThis.fetch = async () => { throw new Error('down'); };
let threw = false;
try {
  await notifyEvent(mailEnv, { id: 'x' }, { resource: 'clients', action: 'create', row: { fullName: 'ع' } });
} catch { threw = true; }
check('وسقوطُ البريد لا يرمي', threw === false);

// ── المجدول ──
sent = [];
globalThis.fetch = async (url, init) => {
  sent.push(JSON.parse(init.body));
  return { ok: true, status: 200, json: async () => ({ id: 'm' }) };
};
db.prepare(
  `INSERT INTO prospects (id, full_name, phone, follow_up_date, created_at, updated_at)
   VALUES ('p1', 'عميلٌ محتمل', '0500000000', '2026-11-01', ?, ?)`,
).run(now, now);

/* الأحد ١ نوفمبر ٢٠٢٦، الخامسة بغرينتش = الثامنة بالرياض. */
const sunday8 = new Date('2026-11-01T05:10:00Z');
await scheduledNotifications(mailEnv, new Date('2026-11-01T04:10:00Z'));
check('قبل ساعتها لا يُرسل شيء', sent.length === 0);

await scheduledNotifications(mailEnv, sunday8);
check('في ساعتها: متابعاتُ اليوم', sent.some((mail) => mail.subject.startsWith('متابعاتُ اليوم') &&
  mail.text.includes('عميلٌ محتمل')), sent.map((mail) => mail.subject));
const weekly = sent.find((mail) => mail.subject.startsWith('التقريرُ الأسبوعي'));
check('والأحدُ: التقريرُ الأسبوعيّ للمسؤولين وحدهم',
  weekly && weekly.to.join() === 'admin@naf.sa', weekly?.to);

const count = sent.length;
await scheduledNotifications(mailEnv, new Date('2026-11-01T05:40:00Z'));
check('ودورةٌ ثانيةٌ في اليوم نفسِه لا تُعيد', sent.length === count, sent.length);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
