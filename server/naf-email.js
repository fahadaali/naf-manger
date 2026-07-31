/* ============================================================
   قوالب البريد — الموضع الوحيد الذي تُكتب فيه قيم التصميم حرفياً.

   ═══ لماذا هذا استثناء ═══

   عملاء البريد لا يدعمون خصائص CSS المخصّصة، فلا يُحلّ ‎var(--primary)‎
   داخل صندوق وارد. والقاعدة تصرّح بالاستثناء وتشترط ثلاثة:
   «احفظ تلك القيم في ملفّ قالبٍ واحد، وعلّق على السبب، وطابق القيم
   نفسها في المعاينة».

   وكانت القيم قبل هذا الملفّ مبعثرةً في ثلاثة قوالب داخل ‎index.js‎،
   بلا تعليق، ومأخوذةً من اللوحة الموازية التي أُسقطت — ‎#2563eb‎
   و‎#7c3aed‎ — فكان البريد يحمل هويةً غير هوية المنصة.

   ═══ من أين جاءت هذه القيم ═══

   كلُّها مشتقّة من رموز ‎naf-theme.css‎ في الوضع الفاتح، محوّلةً من
   oklch إلى sRGB. البريد يبقى فاتحاً دائماً كالمستند المطبوع — لا
   يقرأ العميلُ وضعَ القارئ ولا يتبعه.

     --primary          oklch(0.5700 0.0904 80.9413)   → #937133
     --primary-strong   oklch(0.5200 0.0904 80.9413)   → #836323
     --foreground       oklch(0.3211 0 0)              → #333333
     --muted-foreground oklch(0.5250 0.0234 264.3637)  → #646A78
     --muted            oklch(0.9846 0.0017 247.8389)  → #F9FAFB
     --border           oklch(0.8853 0 0)              → #D9D9D9
     --surface-deep     oklch(0.3451 0.0833 260.8804)  → #1F3864
     --warning-strong   oklch(0.5220 0.1400 75.0000)   → #975A00
     --warning-soft     color-mix(warning 14%, card)   → #F3EADB

   **أي تغيير في الثيم يُلزم إعادة التحويل وتحديث هذا الجدول.** وهو
   ثمن الاستثناء: القيمة هنا لا تتبع السجلّ تلقائياً، فتتبعه بيدٍ.

   ═══ الاتجاه ═══

   العملاء المكتبية القديمة لا تدعم الخصائص المنطقية، فتُكتب هنا
   ‎direction: rtl‎ والخصائص الفيزيائية عمداً — بخلاف الواجهة.

   ═══ الأرقام والتواريخ — لا استثناء فيها ═══

   §٨ تقول «أرقام غربية دائماً» ولا تستثني البريد. وكان القالب يكتب
   ‎toLocaleString('ar-SA')‎ فيُخرج هجرياً بأرقام هندية، بينما تعرض
   شاشةُ المعاينة داخل التطبيق ميلادياً بأرقام غربية — أي أن المُرسِل
   يرى ما لا يصل المستلمَ، وهو ما تحذّر منه القاعدة نصّاً.

   والصيغتان أدناه مطابقتان لـ‎formatDate‎ و‎formatTime‎ في
   ‎naf-format‎: ‎2026/07/26‎ و‎14:30‎. وتكرارُهما هنا لا مفرّ منه —
   هذا Node بصيغة CommonJS ولا يقرأ وحدة TypeScript في ‎src‎ — فإن
   تغيّرت الصيغة في السجلّ تتبعها هذه.
   ============================================================ */

const COLOR = {
  primary: '#937133',
  primaryStrong: '#836323',
  foreground: '#333333',
  mutedForeground: '#646A78',
  muted: '#F9FAFB',
  border: '#D9D9D9',
  surfaceDeep: '#1F3864',
  warningSoft: '#F3EADB',
  warningStrong: '#975A00',
  onColor: '#FFFFFF',
};

/* قائمة خطوط للبريد لا الخطّ المعتمد: العميل لا يحمّل خطّ ويب، فلا
   يصل IBM Plex Sans Arabic إلى صندوق الوارد. تُترك للنظام يختار. */
const FONT = "'Segoe UI', Tahoma, Arial, sans-serif";

const pad = (n) => String(n).padStart(2, '0');

/** ميلادي بأرقام غربية: "2026/07/26" — مطابق لـ formatDate */
function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** نظام ٢٤ ساعة: "14:30" — مطابق لـ formatTime */
function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ميلادي مع الوقت: "2026/07/26 14:30" — مطابق لـ formatDateTime */
function formatDateTime(value) {
  return `${formatDate(value)} ${formatTime(value)}`;
}

/**
 * غلاف موحّد لكل رسالة: ترويسة بالسطح العميق، ومتن أبيض، وتذييل.
 *
 * غلافٌ واحد لا ثلاثة: كانت كل نقطة نهاية تبني هيكلها بيدها، فاختلفت
 * الثلاثة في اللون والحشو وحجم النصّ بلا سبب.
 */
function shell({ title, subtitle = '', body }) {
  return `
<div style="font-family: ${FONT}; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
  <div style="background: ${COLOR.surfaceDeep}; padding: 30px; text-align: center; color: ${COLOR.onColor}; border-radius: 10px 10px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">${title}</h1>
    ${subtitle ? `<p style="margin: 10px 0 0 0; opacity: 0.9;">${subtitle}</p>` : ''}
  </div>

  <div style="background: ${COLOR.onColor}; padding: 30px; border: 1px solid ${COLOR.border}; border-top: none; color: ${COLOR.foreground};">
    ${body}

    <div style="border-top: 1px solid ${COLOR.border}; padding-top: 20px; margin-top: 30px;">
      <p style="color: ${COLOR.mutedForeground}; font-size: 14px; margin: 0;">
        مع تحيات فريق ناف
      </p>
    </div>
  </div>
</div>`;
}

/** رسالة اختبار إعدادات البريد */
function testEmail() {
  return shell({
    title: 'ناف — اختبار البريد',
    body: `
      <p style="margin: 0 0 12px 0;">وصلت هذه الرسالة، فإعدادات البريد سليمة.</p>
      <p style="margin: 0; color: ${COLOR.mutedForeground};">
        أُرسلت من نظام إدارة المكتب القانوني.
      </p>`,
  });
}

/** رسالة عامة بعنوان ومتن */
function notificationEmail({ subject, message }) {
  return shell({
    title: 'ناف',
    subtitle: subject,
    body: `
      <div style="background: ${COLOR.muted}; padding: 20px; border-radius: 8px; margin: 0 0 20px 0;">
        ${message}
      </div>`,
  });
}

/**
 * دعوة اجتماع.
 *
 * التاريخ والوقت والمدة ورقم الاجتماع كلُّها أرقام داخل نصّ عربي، فتُعزل
 * بمحرفَي العزل U+2068 و U+2069 — لا `<bdi>`، فالعميل قد لا يصيّره،
 * والمحرفان يعملان في النصّ نفسه.
 */
const iso = (v) => `⁨${v}⁩`;

function meetingInviteEmail(meeting) {
  const row = (label, value) =>
    `<p style="margin: 5px 0;"><strong>${label}:</strong> ${value}</p>`;

  return shell({
    title: 'دعوة اجتماع',
    subtitle: meeting.title,
    body: `
      <div style="background: ${COLOR.muted}; padding: 20px; border-radius: 8px; margin: 0 0 20px 0;">
        <h3 style="color: ${COLOR.foreground}; margin-top: 0;">تفاصيل الاجتماع</h3>
        ${row('التاريخ والوقت', iso(formatDateTime(meeting.startTime)))}
        ${row('المدة', `${iso(meeting.duration)} دقيقة`)}
        ${row('رقم الاجتماع', iso(meeting.id))}
        ${meeting.password ? row('كلمة المرور', iso(meeting.password)) : ''}
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${meeting.joinUrl}"
           style="background: ${COLOR.primary}; color: ${COLOR.onColor}; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          دخول الاجتماع
        </a>
      </div>

      ${
        meeting.agenda
          ? `<div style="background: ${COLOR.warningSoft}; padding: 15px; border-radius: 8px; margin: 20px 0;">
               <h4 style="color: ${COLOR.warningStrong}; margin-top: 0;">جدول الأعمال</h4>
               <p style="color: ${COLOR.warningStrong}; white-space: pre-wrap; margin-bottom: 0;">${meeting.agenda}</p>
             </div>`
          : ''
      }`,
  });
}

module.exports = {
  COLOR,
  formatDate,
  formatTime,
  formatDateTime,
  testEmail,
  notificationEmail,
  meetingInviteEmail,
};
