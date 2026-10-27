/* ═══ جرسُ الإشعارات ═══
 *
 * ما يُحرَس هنا: يُكتب البندُ **بلا بريدٍ مربوط**، لمن اشترك ويملك القراءة
 * وحدَه؛ والعضوُ لا يقرأ بنودَ غيره ولا يعلّمها؛ والمتابعاتُ اليومية تبلغ
 * الجرس؛ والقديمُ يُحذف.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { notifyEvent, listNotifications, markNotificationsRead, scheduledNotifications } =
  await import('../worker/lib/notify.js');
const bodyOf = async (response) => (typeof response.json === 'function' ? await response.json() : response.body);

const now = Math.floor(Date.now() / 1000);
const db = freshDatabase();
const env = makeEnv(db); // بلا Resend
let fetched = 0;
globalThis.fetch = async () => { fetched++; return { ok: true, status: 200, json: async () => ({}) }; };

db.prepare(
  `INSERT INTO members (user_id, display_name, email, role, perms, is_active, notification_prefs, created_at) VALUES
     ('admin', 'فهد', 'admin@naf.sa', 'admin', NULL, 1, NULL, ?),
     ('lawyer', 'سارة', NULL, 'lawyer', NULL, 1, NULL, ?),
     ('staff', 'خالد', 'staff@naf.sa', 'staff', '{"cases":{"read":false},"prospects":{"read":true}}', 1, NULL, ?),
     ('quiet', 'منى', 'mona@naf.sa', 'lawyer', NULL, 1, '{"newCases":false}', ?)`,
).run(now, now, now, now);

const count = (userId) => db.prepare(`SELECT COUNT(*) n FROM notifications WHERE user_id = ?`).get(userId).n;

// ═══════════════════════════════════════════════════════════
group('الكتابة');

await notifyEvent(env, { id: 'admin', name: 'فهد' }, {
  resource: 'cases', action: 'create', row: { caseNumber: 'ق-1', caseType: 'تجارية', clientName: 'الأفق' },
});
check('بلا بريدٍ مربوط يُكتب البند', count('lawyer') === 1 && fetched === 0, { lawyer: count('lawyer'), fetched });
check('ولعضوٍ بلا بريد', count('lawyer') === 1);
check('ولا لمن لا يقرأ القضايا', count('staff') === 0);
check('ولا لمن أطفأ نوعَه', count('quiet') === 0);
check('ولا للفاعل', count('admin') === 0);

const row = db.prepare(`SELECT * FROM notifications WHERE user_id = 'lawyer'`).get();
check('والبندُ يحمل عنوانَه وشاشتَه', row.title.includes('ق-1') && row.link === 'cases', row);

// ═══════════════════════════════════════════════════════════
group('القراءة');

let res = await listNotifications(env, { id: 'lawyer' });
let data = (await bodyOf(res)).data;
check('العضوُ يقرأ بنودَه وعددَ غير المقروء', data.unread === 1 && data.items.length === 1 && !data.items[0].read, data);

res = await listNotifications(env, { id: 'admin' });
check('ولا يرى بنودَ غيره', (await bodyOf(res)).data.items.length === 0);

await markNotificationsRead({ json: async () => ({ ids: [row.id] }) }, env, { id: 'admin' });
check('ومعرّفُ بندِ غيره لا يُعلَّم باسمه', db.prepare(`SELECT read_at FROM notifications WHERE id = ?`).get(row.id).read_at === null);

await markNotificationsRead({ json: async () => ({ ids: [row.id] }) }, env, { id: 'lawyer' });
res = await listNotifications(env, { id: 'lawyer' });
data = (await bodyOf(res)).data;
check('وصاحبُه يعلّمه', data.unread === 0 && data.items[0].read === true, data);

await notifyEvent(env, { id: 'staff' }, { resource: 'clients', action: 'create', row: { fullName: 'ع' } });
await notifyEvent(env, { id: 'staff' }, { resource: 'clients', action: 'create', row: { fullName: 'ب' } });
await markNotificationsRead({ json: async () => ({}) }, env, { id: 'lawyer' });
res = await listNotifications(env, { id: 'lawyer' });
check('و«الكلُّ مقروء» يعلّم الكلّ', (await bodyOf(res)).data.unread === 0);

// ═══════════════════════════════════════════════════════════
group('المجدول');

db.prepare(
  `INSERT INTO prospects (id, full_name, follow_up_date, created_at, updated_at) VALUES ('p1', 'محتملٌ اليوم', '2026-11-03', ?, ?)`,
).run(now, now);
db.prepare(
  `INSERT INTO notifications (id, user_id, kind, title, created_at) VALUES ('old', 'lawyer', 'x', 'قديم', ?)`,
).run(now - 100 * 86400);

await scheduledNotifications(env, new Date('2026-11-03T05:15:00Z'));
const follow = db.prepare(`SELECT * FROM notifications WHERE kind = 'followUps' AND user_id = 'staff'`).get();
check('متابعاتُ اليوم تبلغ الجرس بلا بريد', follow?.body.includes('محتملٌ اليوم') && follow.link === 'prospects', follow);
check('والقديمُ يُحذف', !db.prepare(`SELECT 1 FROM notifications WHERE id = 'old'`).get());
check('ولا بريدَ يُطلب', fetched === 0, fetched);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
