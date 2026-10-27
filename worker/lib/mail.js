// إرسالُ البريد — عبر Resend، بنداء HTTP واحد.
//
// ═══ لماذا مزوّدٌ بـHTTP ═══
//
// Workers لا تتكلّم SMTP. فشاشةُ البريد كانت تحفظ إعداد خادمٍ لا يُنادى، وتقول
// «غير مربوط». وResend يُنادى بـ`fetch` ويكفيه مفتاحٌ واحد.
//
// ═══ ما يلزمه ═══
//
//   `RESEND_API_KEY` — سرٌّ في `wrangler secret`، لا في `wrangler.toml`.
//   `MAIL_FROM`      — المُرسِل، «ناف <no-reply@naflaw.sa>». ونطاقُه موثَّقٌ عند
//                      Resend (سجلّات DNS)، وإلا رُدّ الإرسال. ويُضبط سرّاً كذلك
//                      لا متغيّراً في `wrangler.toml`: النشرُ يكتب متغيّراتِ الملفّ
//                      فوق ما ضُبط في اللوحة، والأسرارُ تبقى عبر النشرات.
//
// وغيابُ أحدهما غيابُ الربط: لا يُرسل شيء، ولا يُسقط ذلك فعلاً وقع — حفظُ قضيةٍ
// لا ينتظر بريداً ولا يسقط لسقوطه.

const ENDPOINT = 'https://api.resend.com/emails';

/** حدُّ الانتظار: بريدٌ متأخّر لا يُبطئ حفظَ قضية. */
const TIMEOUT_MS = 8000;

export const mailConfigured = (env) => Boolean(env?.RESEND_API_KEY && env?.MAIL_FROM);

/** نصٌّ يُدرج في HTML — اسمُ موكّلٍ فيه `<` لا يصير وسماً. */
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * قالبٌ واحد للرسائل كلِّها: عربيٌّ من اليمين، عنوانٌ وأسطر.
 *
 * `lines` نصوصٌ تُهرَّب هنا — لا HTML جاهزٌ من المنادي، فلا يتسرّب وسمٌ من
 * بيانات موكّل إلى رسالةٍ تُفتح في بريد غيره.
 */
export function renderMail(title, lines, table = null) {
  const body = lines
    .map((line) => `<p style="margin:0 0 8px">${escapeHtml(line).replace(/\n/g, '<br>')}</p>`)
    .join('') + renderTable(table);
  return `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;line-height:1.7">
<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>${body}
<p style="margin-top:16px;color:#888;font-size:12px">نظام إدارة العملاء — شركة ناف</p></body></html>`;
}

/* جدولٌ — للتقارير المجدولة. خلاياه نصوصٌ تُهرَّب كبقية الرسالة. */
function renderTable(table) {
  if (!table?.headers?.length) return '';
  const cell = (value, tag) =>
    `<${tag} style="border:1px solid #ddd;padding:4px 8px;text-align:right">${escapeHtml(value ?? '')}</${tag}>`;
  const head = `<tr>${table.headers.map((header) => cell(header, 'th')).join('')}</tr>`;
  const rows = (table.rows ?? []).map((row) => `<tr>${row.map((value) => cell(value, 'td')).join('')}</tr>`).join('');
  return `<table style="border-collapse:collapse;margin-top:8px;font-size:13px">${head}${rows}</table>`;
}

/** نصٌّ إلى base64 — UTF-8، لمرفقات Resend. */
export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
}

/**
 * يرسل رسالة. ولا يرمي: يردّ `{ ok, id }` أو `{ ok: false, error }`.
 *
 * @param {{ to: string | string[], subject: string, title?: string, lines?: string[], text?: string,
 *           table?: { headers: string[], rows: string[][] }, attachments?: { filename: string, content: string }[] }} message
 */
export async function sendMail(env, { to, subject, title, lines = [], text, table = null, attachments = [] }) {
  if (!mailConfigured(env)) return { ok: false, error: 'not_configured' };

  const recipients = (Array.isArray(to) ? to : [to])
    .map((entry) => String(entry ?? '').trim())
    .filter((entry) => /^\S+@\S+\.\S+$/.test(entry));
  if (!recipients.length) return { ok: false, error: 'no_recipients' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: recipients,
        subject,
        html: renderMail(title ?? subject, lines, table),
        text: text ?? [title ?? subject, ...lines].join('\n'),
        ...(attachments.length ? { attachments } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? 'unauthorized'
        : response.status === 422 ? 'rejected' : response.status === 429 ? 'rate_limited' : 'send_failed';
      console.error('Mail: رُدّ الإرسال —', response.status);
      return { ok: false, error: code };
    }
    const data = await response.json().catch(() => ({}));
    return { ok: true, id: data?.id ?? null };
  } catch (error) {
    console.error('Mail: تعذّر الإرسال —', error?.message ?? error);
    return { ok: false, error: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

const fail = (error, status) => Response.json({ ok: false, error }, { status });

/** `GET /api/mail/status` — للمسؤول. والمُرسِل يُعرض، والمفتاحُ لا. */
export async function readMailStatus(env, user) {
  if (user.role !== 'admin') return fail('forbidden', 403);
  return Response.json({
    ok: true,
    data: { configured: mailConfigured(env), from: env?.MAIL_FROM ?? null, hasKey: Boolean(env?.RESEND_API_KEY) },
  });
}

/** `POST /api/mail/test { to }` — رسالةٌ تجريبية. */
export async function sendTestMail(request, env, user) {
  if (user.role !== 'admin') return fail('forbidden', 403);
  let body;
  try { body = await request.json(); } catch { return fail('invalid_body', 400); }
  const result = await sendMail(env, {
    to: body?.to,
    subject: 'رسالةٌ تجريبية من نظام إدارة العملاء',
    lines: ['وصلت هذه الرسالة، فالبريدُ مربوطٌ ويعمل.', `أرسلها: ${user.name ?? ''}`],
  });
  if (!result.ok) {
    const status = result.error === 'not_configured' ? 503 : result.error === 'no_recipients' ? 400 : 502;
    return fail(result.error, status);
  }
  return Response.json({ ok: true, data: { id: result.id } });
}
