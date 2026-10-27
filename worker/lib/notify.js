// الإشعاراتُ بالبريد — ما يقع في المنصة يبلغ من اشترك فيه.
//
// ═══ وجرسٌ في المنصة مع البريد ═══
//
// كلُّ إشعارٍ يُكتب صفّاً في `notifications` لكلّ مستلم (`migrations/0023`)،
// **ربط البريدُ أم لم يُربط** — فالجرسُ في الترويسة يعمل وحدَه. والبريدُ
// يُرسل فوقه إن رُبط Resend.
//
// ═══ ثلاثةُ أبواب ═══
//
//   فوريّة   — عميلٌ جديد، قضيةٌ جديدة، محتملٌ جديد، دفعةٌ سُجّلت. تُرسل من
//              `crud.js` بعد الكتابة، ولا تُسقطها.
//   يوميّة   — متابعاتُ المحتملين التي يومُها اليوم، مرّةً في الصباح.
//   أسبوعيّة — تقريرٌ لصاحب المكتب صباحَ الأحد: أرقامُ اللوحة، وما لم يُحصَّل،
//              وما ينتظر في بيسكامب ووافق.
//
// ═══ ومن يتلقّى ═══
//
// العضوُ المفعَّل ببريده، **إن اشترك** في نوع الإشعار (`notification_prefs`،
// وفراغُها يعني الافتراض في `handlers.js`) — **وإن ملك قراءةَ ما يُبلَّغ عنه**:
// موظّفٌ لا يرى القضايا لا تبلغه دفعاتُها بالبريد. وفاعلُ الحدث لا يُبلَّغ بما فعل.
//
// وكلُّه لا يرمي: بريدٌ تعذّر لا يُسقط حفظاً وقع.

import { sendMail, mailConfigured } from './mail.js';
import { permissionsFor } from './roles.js';
import { DEFAULT_NOTIFICATION_PREFS } from './handlers.js';
import { readStats } from './queries.js';
import { scheduledReports } from './report-schedule.js';

const safeJson = (raw) => {
  try { return JSON.parse(raw ?? 'null'); } catch { return null; }
};

const STATE_KEY = 'notify_state';

/** نوعُ الإشعار، والتصريحُ الذي يلزم لقراءته، ونصُّه، والشاشةُ التي يفتحها. */
const EVENTS = {
  'clients:create': {
    pref: 'newClients', permission: ['clients', 'read'], link: 'clients',
    subject: (row) => `عميلٌ جديد: ${row.fullName ?? ''}`,
    lines: (row, actor) => [`أُضيف العميل «${row.fullName ?? ''}».`, actor ? `أضافه: ${actor}` : ''],
  },
  'cases:create': {
    pref: 'newCases', permission: ['cases', 'read'], link: 'cases',
    subject: (row) => `قضيةٌ جديدة: ${row.caseNumber ?? ''}`,
    lines: (row, actor) => [
      `أُضيفت القضية ${row.caseNumber ?? ''} — ${row.caseType ?? ''}`,
      `الموكّل: ${row.clientName ?? ''}`,
      row.summary ? `الموضوع: ${row.summary}` : '',
      actor ? `أضافها: ${actor}` : '',
    ],
  },
  'prospects:create': {
    pref: 'newProspects', permission: ['prospects', 'read'], link: 'prospects',
    subject: (row) => `عميلٌ محتمل جديد: ${row.fullName ?? ''}`,
    lines: (row, actor) => [`أُضيف العميل المحتمل «${row.fullName ?? ''}».`, actor ? `أضافه: ${actor}` : ''],
  },
  'clientPayments:create': {
    pref: 'payments', permission: ['cases', 'read'], link: 'cases',
    subject: (row) => `دفعةٌ مسجَّلة: ${row.amount ?? ''} ريال`,
    lines: (row, actor) => [
      `سُجّلت دفعةٌ بمبلغ ${row.amount ?? ''} ريال${row.caseNumber ? ` على القضية ${row.caseNumber}` : ''}.`,
      row.method ? `الطريقة: ${row.method}` : '',
      actor ? `سجّلها: ${actor}` : '',
    ],
  },
};

/** الأعضاءُ الذين يتلقّون إشعاراً من هذا النوع — بريدٌ لهم أم لا. */
export async function membersFor(env, { pref, permission, excludeUserId = null, adminsOnly = false }) {
  const { results } = await env.DB.prepare(
    `SELECT user_id, email, role, perms, notification_prefs FROM members WHERE is_active = 1`,
  ).all();

  return (results ?? [])
    .filter((member) => member.user_id !== excludeUserId)
    .filter((member) => !adminsOnly || member.role === 'admin')
    .filter((member) => {
      const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...(safeJson(member.notification_prefs) ?? {}) };
      return prefs[pref] === true;
    })
    .filter((member) => {
      if (!permission) return true;
      const [resource, action] = permission;
      return Boolean(permissionsFor(member.role, safeJson(member.perms))?.[resource]?.[action]);
    });
}

/** بريدُ من يتلقّى — من له بريدٌ منهم. */
export async function recipientsFor(env, options) {
  return (await membersFor(env, options))
    .map((member) => member.email)
    .filter((email) => email && String(email).trim());
}

/** يكتب البندَ في جرس كلّ مستلم. ولا يرمي. */
export async function writeInApp(env, members, { kind, title, body = '', link = null }) {
  if (!members.length) return;
  const now = Math.floor(Date.now() / 1000);
  const statements = members.map((member) =>
    env.DB.prepare(
      `INSERT INTO notifications (id, user_id, kind, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), member.user_id, kind, title, body, link, now));
  await env.DB.batch(statements).catch((error) => {
    console.error('Notify: تعذّرت كتابة الجرس —', error?.message ?? error);
  });
}

/** إشعارُ حدثٍ وقع على مورد. ولا يرمي. */
export async function notifyEvent(env, user, { resource, action, row }) {
  const event = EVENTS[`${resource}:${action}`];
  if (!event || !row) return;
  try {
    const members = await membersFor(env, { pref: event.pref, permission: event.permission, excludeUserId: user?.id });
    if (!members.length) return;

    /* الدفعةُ لا تحمل رقمَ قضيتها — يُقرأ ليُقال في الرسالة. */
    let shaped = row;
    if (resource === 'clientPayments' && row.caseId) {
      const kase = await env.DB.prepare(`SELECT case_number FROM cases WHERE id = ?`).bind(row.caseId).first();
      shaped = { ...row, caseNumber: kase?.case_number ?? '' };
    }

    const subject = event.subject(shaped);
    const lines = event.lines(shaped, user?.name ?? '').filter(Boolean);
    await writeInApp(env, members, { kind: event.pref, title: subject, body: lines.join(' · '), link: event.link });

    const to = members.map((member) => member.email).filter((email) => email && String(email).trim());
    if (mailConfigured(env) && to.length) await sendMail(env, { to, subject, lines });
  } catch (error) {
    console.error('Notify: تعذّر الإشعار —', error?.message ?? error);
  }
}

/* ═══ المجدول ═══ */

/** وقتُ الرياض — المكتبُ يقول «الصباح» بساعته لا بساعة غرينتش. */
const riyadh = (now) => {
  const shifted = new Date(now.getTime() + 3 * 3600 * 1000);
  return {
    day: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
    dayOfMonth: shifted.getUTCDate(),
    at: now.getTime(),
  };
};

/** الساعةُ التي تُرسل فيها اليومية والأسبوعية — الثامنة صباحاً بالرياض. */
const SEND_HOUR = 8;

async function readState(env) {
  const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = ?`).bind(STATE_KEY).first();
  return safeJson(row?.value) ?? {};
}

async function writeState(env, state) {
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, 'cron', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(STATE_KEY, JSON.stringify(state), Math.floor(Date.now() / 1000))
    .run();
}

/** متابعاتُ اليوم — مرّةً في اليوم، والحالةُ تمنع التكرار مع جدولة كلّ ساعة. */
async function sendFollowUps(env, day) {
  const { results } = await env.DB.prepare(
    `SELECT full_name, phone, prospect_status FROM prospects
      WHERE archived_at IS NULL AND follow_up_date = ? ORDER BY full_name`,
  )
    .bind(day)
    .all();
  if (!(results ?? []).length) return;

  const members = await membersFor(env, { pref: 'followUps', permission: ['prospects', 'read'] });
  if (!members.length) return;
  const subject = `متابعاتُ اليوم: ${results.length}`;
  await writeInApp(env, members, {
    kind: 'followUps',
    title: subject,
    body: results.slice(0, 10).map((row) => row.full_name).join('، '),
    link: 'prospects',
  });
  const to = members.map((member) => member.email).filter((email) => email && String(email).trim());
  if (!mailConfigured(env) || !to.length) return;
  await sendMail(env, {
    to,
    subject,
    title: 'عملاءُ محتملون موعدُ متابعتهم اليوم',
    lines: results.map((row) => `• ${row.full_name}${row.phone ? ` — ${row.phone}` : ''}${row.prospect_status ? ` (${row.prospect_status})` : ''}`),
  });
}

/** التقريرُ الأسبوعي — للمسؤولين المشتركين في «التحديثات». */
async function sendWeekly(env) {
  const to = await recipientsFor(env, { pref: 'updates', permission: null, adminsOnly: true });
  if (!to.length) return;

  const stats = (await (await readStats(env)).json())?.data ?? {};
  const count = async (sql) => Number((await env.DB.prepare(sql).first().catch(() => null))?.n ?? 0);
  const [conflicts, reviews, waiting] = await Promise.all([
    count(`SELECT COUNT(*) n FROM basecamp_conflicts WHERE resolved_at IS NULL`),
    count(`SELECT COUNT(*) n FROM basecamp_reviews WHERE resolved_at IS NULL`),
    count(`SELECT COUNT(*) n FROM wafeq_payments WHERE status IN ('suggested', 'unmatched')`),
  ]);

  await sendMail(env, {
    to,
    subject: 'التقريرُ الأسبوعي — نظام إدارة العملاء',
    title: 'التقريرُ الأسبوعي',
    lines: [
      `العملاء: ${stats.totalClients ?? 0} · المحتملون: ${stats.totalProspects ?? 0}`,
      `القضايا: ${stats.totalCases ?? 0} · المنظورة: ${stats.pendingCases ?? 0} · المكتملة: ${stats.completedCases ?? 0}`,
      `نسبة كسب القضايا: ${stats.winRate ?? 0}% (الرابحة من المحسومة) · القضايا التطوّعية: ${stats.proBonoCases ?? 0}`,
      `مستحقّاتٌ غير محصّلة: ${stats.outstandingAmount ?? 0} ريال`,
      `ينتظر نظرك: ${conflicts} اختلافاً و${reviews} مراجعةً في بيسكامب، و${waiting} دفعةً من وافق بلا ربطٍ مؤكَّد.`,
    ],
  });
}

/** يُنادى من الجدولة كلَّ ساعة، ولا يعمل إلا في ساعته ومرّةً في يومه. */
export async function scheduledNotifications(env, now = new Date()) {
  const when = riyadh(now);
  const { day, hour, weekday } = when;
  if (hour !== SEND_HOUR) return;

  try {
    const state = await readState(env);
    if (state.followUps !== day) {
      await sendFollowUps(env, day);
      state.followUps = day;
    }
    /* الأحد أوّلُ أسبوع العمل. والتقريرُ الأسبوعيّ بريدٌ وحده. */
    if (mailConfigured(env) && weekday === 0 && state.weekly !== day) {
      await sendWeekly(env);
      state.weekly = day;
    }
    await writeState(env, state);
    /* والتقاريرُ المجدولة — ولكلٍّ منها حارسُه (`last_sent_at`). */
    if (mailConfigured(env)) await scheduledReports(env, when);
    /* وما مضى عليه تسعون يوماً من بنود الجرس يُحذف. */
    await env.DB.prepare(`DELETE FROM notifications WHERE created_at < ?`)
      .bind(Math.floor(now.getTime() / 1000) - 90 * 86400)
      .run();
  } catch (error) {
    console.error('Notify/cron: تعذّر الإرسال —', error?.message ?? error);
  }
}

/* ═══ مسارا الجرس ═══ */

/** `GET /api/notifications` — أحدثُ ثلاثين بنداً للعضو نفسِه، وعددُ غير المقروء. */
export async function listNotifications(env, user) {
  const [items, unread] = await Promise.all([
    env.DB.prepare(
      `SELECT id, kind, title, body, link, read_at, created_at FROM notifications
        WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
    ).bind(user.id).all(),
    env.DB.prepare(`SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL`)
      .bind(user.id)
      .first(),
  ]);
  return Response.json({
    ok: true,
    data: {
      unread: Number(unread?.n ?? 0),
      items: (items.results ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body ?? '',
        link: row.link,
        read: Boolean(row.read_at),
        createdAt: new Date(row.created_at * 1000).toISOString(),
      })),
    },
  });
}

/**
 * `POST /api/notifications/read { ids? }` — يُعلَّم مقروءاً ما سُمّي، أو الكلُّ.
 *
 * والشرطُ `user_id = ?` في الجملة نفسِها: معرّفُ بندٍ لعضوٍ آخر لا يُعلَّمه
 * من نادى باسمه.
 */
export async function markNotificationsRead(request, env, user) {
  let body = {};
  try { body = (await request.json()) ?? {}; } catch { body = {}; }
  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'string').slice(0, 100) : null;
  const now = Math.floor(Date.now() / 1000);

  if (ids?.length) {
    const holes = ids.map(() => '?').join(', ');
    await env.DB.prepare(
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${holes})`,
    ).bind(now, user.id, ...ids).run();
  } else {
    await env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`)
      .bind(now, user.id)
      .run();
  }
  return Response.json({ ok: true });
}
