// إرسالُ التقارير المخصّصة دورياً — يومياً أو أسبوعياً أو شهرياً.
//
// ═══ مرّةً في دورته ═══
//
// الجدولةُ تعمل كلَّ ساعة، والتقريرُ يُرسل في ساعة الصباح وحدها (`notify.js`)
// ومرّةً في دورته: اليوميُّ كلَّ يوم، والأسبوعيُّ صباحَ الأحد، والشهريُّ في أوّل
// الشهر. و`last_sent_at` يمنع الإرسال الثاني في اليوم نفسه.
//
// ═══ ومن يتلقّى ═══
//
// العضوُ المسمّى مستلماً **إن ملك قراءةَ التقارير** (`analytics.read`) **وإن
// كان التقريرُ عامّاً أو له** — من لا يرى التقريرَ في الشاشة لا يتلقّاه بالبريد.
// والبريدُ الخارجيّ لا يُكتب إلا بيد مسؤول (`readSchedule` في `reports.js`).
//
// والرسالةُ أوّلُ خمسين صفاً جدولاً، والتقريرُ كلُّه CSV مرفقاً.

import { executeReport } from './reports.js';
import { permissionsFor } from './roles.js';
import { sendMail, toBase64 } from './mail.js';

/* عناوينُ الأعمدة بالعربية — مرآةُ `src/lib/report-fields.ts`. */
const LABELS = {
  clients: {
    fullName: 'الاسم الكامل', idNumber: 'رقم الهوية', clientType: 'نوع العميل', status: 'الحالة',
    joinDate: 'تاريخ الانضمام', email: 'البريد الإلكتروني', phone: 'رقم الجوال',
  },
  prospects: {
    fullName: 'الاسم الكامل', idNumber: 'رقم الهوية', prospectStatus: 'حالة العميل المحتمل',
    expectedValue: 'القيمة المتوقعة', source: 'المصدر', joinDate: 'تاريخ الإضافة', followUpDate: 'موعد المتابعة',
  },
  cases: {
    caseNumber: 'رقم المشروع', authority: 'الجهة المختصة', courtCaseNumber: 'رقم القضية لدى الجهة', caseType: 'نوع القضية', status: 'الحالة', outcome: 'النتيجة',
    clientName: 'اسم العميل', marketerName: 'المسوّق', lawyerName: 'المحامي المسؤول',
    proBonoValue: 'قيمة التطوّعي التقديرية', proBonoHours: 'ساعات التطوّعي', feeType: 'نوع الأتعاب',
    createdDate: 'تاريخ الإنشاء', updatedDate: 'تاريخ التحديث',
  },
};
const AGG = { count: 'العدد', sum: 'المجموع', avg: 'المتوسط', min: 'الأدنى', max: 'الأعلى' };

function labelOf(source, column) {
  if (column === 'count') return 'العدد';
  const [field, fn] = column.split('_');
  const base = LABELS[source]?.[field] ?? field;
  return fn ? `${base} — ${AGG[fn] ?? fn}` : base;
}

const safeJson = (raw) => {
  try { return JSON.parse(raw ?? 'null'); } catch { return null; }
};

/** أهذا التقريرُ مستحَقٌّ اليوم؟ */
function due(frequency, { weekday, dayOfMonth }) {
  if (frequency === 'daily') return true;
  if (frequency === 'weekly') return weekday === 0;
  if (frequency === 'monthly') return dayOfMonth === 1;
  return false;
}

const text = (value) => (value === null || value === undefined ? '' : String(value));

function toCsv(headers, rows) {
  const escape = (value) => {
    const raw = text(value);
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n') + '\r\n';
}

/** مستلمو تقريرٍ — بالقواعد أعلاه. */
async function recipientsOf(env, report) {
  const listed = safeJson(report.schedule_recipients) ?? [];
  const external = listed.filter((entry) => String(entry).includes('@'));
  const ids = listed.filter((entry) => !String(entry).includes('@'));
  if (!ids.length) return external;

  const holes = ids.map(() => '?').join(', ');
  const { results } = await env.DB.prepare(
    `SELECT user_id, email, role, perms FROM members
      WHERE is_active = 1 AND email IS NOT NULL AND email <> '' AND user_id IN (${holes})`,
  )
    .bind(...ids)
    .all();

  const members = (results ?? []).filter((member) => {
    if (!permissionsFor(member.role, safeJson(member.perms))?.analytics?.read) return false;
    return Number(report.is_public) === 1 || member.user_id === report.created_by || member.role === 'admin';
  });
  return [...new Set([...members.map((member) => member.email), ...external])];
}

/**
 * يُنادى من `scheduledNotifications` في ساعة الصباح. ولا يرمي: تقريرٌ سقط لا
 * يمنع ما بعده.
 *
 * @param {{ day: string, weekday: number, dayOfMonth: number, at?: number }} when — بتوقيت الرياض،
 *        و`at` لحظةُ الدورة (ملّي ثانية) — بها يُختم الإرسال، فيُقارن اليومُ بيومه.
 */
export async function scheduledReports(env, when) {
  const stamp = Math.floor((when.at ?? Date.parse(`${when.day}T05:00:00Z`)) / 1000);
  const { results } = await env.DB.prepare(
    `SELECT * FROM custom_reports WHERE schedule_frequency IS NOT NULL`,
  ).all();

  let sent = 0;
  for (const report of results ?? []) {
    if (!due(report.schedule_frequency, when)) continue;
    /* مرّةً في اليوم: آخرُ إرسالٍ وقع في يوم الرياض نفسِه يكفي. */
    if (report.last_sent_at) {
      const last = new Date((report.last_sent_at + 3 * 3600) * 1000).toISOString().slice(0, 10);
      if (last === when.day) continue;
    }

    try {
      const to = await recipientsOf(env, report);
      if (!to.length) continue;

      const executed = await executeReport(env, report);
      if (executed.error) continue;

      const headers = executed.columns.map((column) => labelOf(report.data_source, column));
      const rows = executed.rows.map((row) => executed.columns.map((column) => text(row[column])));
      const result = await sendMail(env, {
        to,
        subject: `تقرير: ${report.name}`,
        title: report.name,
        lines: [
          report.description || '',
          `${rows.length} صفاً${rows.length > 50 ? ' — في الرسالة أوّلُ خمسين، والتقريرُ كلُّه في المرفق' : ''}.`,
        ].filter(Boolean),
        table: { headers, rows: rows.slice(0, 50) },
        attachments: [{ filename: `${report.name}.csv`, content: toBase64(toCsv(headers, rows)) }],
      });
      if (!result.ok) continue;

      await env.DB.prepare(`UPDATE custom_reports SET last_sent_at = ? WHERE id = ?`)
        .bind(stamp, report.id)
        .run();
      sent++;
    } catch (error) {
      console.error('Reports/cron: تعذّر إرسال تقرير —', report.id, error?.message ?? error);
    }
  }
  return sent;
}
