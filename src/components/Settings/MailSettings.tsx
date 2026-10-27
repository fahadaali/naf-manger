import { useEffect, useState } from 'react';
import { CircleCheck, Mail, TriangleAlert } from 'lucide-react';
import { db } from '../../data/database';
import { ApiError } from '../../data/api';
import { MailStatus } from '../../types';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Alert } from '@/registry/naf/ui/alert';
import { Card } from '@/registry/naf/ui/card';

/* ═══ البريد عبر Resend ═══
 *
 * كانت هنا إعداداتُ خادم SMTP تُحفظ ولا يُرسل بها شيء: Workers لا تتكلّم
 * SMTP. والإرسالُ الآن من الخادم عبر Resend بمفتاحٍ سرّيّ، فلا يُكتب في هذه
 * الشاشة إعداد — تقول حالةَ الربط، وترسل رسالةً تجريبية.
 *
 * وما كان محفوظاً من إعداد SMTP لم يُمسّ في القاعدة؛ إنما لم يعد يُقرأ.
 */

const ERRORS: Record<string, string> = {
  not_configured: 'البريدُ غير مربوط — يلزم RESEND_API_KEY وMAIL_FROM في إعداد المنصة',
  unauthorized: 'رفض Resend المفتاح — تحقّق منه',
  rejected: 'رُفضت الرسالة — غالباً لأنّ نطاق المُرسِل لم يُوثَّق عند Resend',
  rate_limited: 'تجاوزنا حدَّ الإرسال — أعد المحاولة بعد قليل',
  no_recipients: 'أدخل بريداً صحيحاً',
  unreachable: 'تعذّر الوصول إلى Resend',
};

export default function MailSettings() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    db.getMailStatus().then(setStatus).catch(() => setStatus({ configured: false, from: null, hasKey: false }));
  }, []);

  const sendTest = async () => {
    setBusy(true);
    setResult(null);
    try {
      await db.sendTestMail(to);
      setResult({ ok: true, text: `أُرسلت رسالةٌ تجريبية إلى ${to}` });
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : '';
      setResult({ ok: false, text: ERRORS[code] ?? 'تعذّر الإرسال' });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <p className="text-muted-foreground">جارٍ التحميل…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Mail className="h-5 w-5" aria-hidden="true" />
          البريد الإلكتروني
        </h3>
        <p className="text-sm text-muted-foreground max-w-2xl">
          يُرسَل من الخادم عبر Resend: إشعاراتُ الأعضاء بحسب تفضيلاتهم، ومتابعاتُ اليوم صباحاً، والتقريرُ
          الأسبوعيُّ صباحَ الأحد، ودعواتُ اجتماعات Zoom.
        </p>
      </div>

      {status.configured ? (
        <Alert>
          <CircleCheck aria-hidden="true" />
          <span>مربوط — المُرسِل: <bdi>{status.from}</bdi></span>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <span>
            {ERRORS.not_configured}.{' '}
            {status.hasKey ? 'المفتاحُ مضبوط، والمُرسِلُ ناقص.' : 'يُضبط المفتاحُ سرّاً من لوحة Cloudflare أو بـ wrangler secret put RESEND_API_KEY.'}
          </span>
        </Alert>
      )}

      <Card className="p-4 space-y-3">
        <p className="font-medium text-foreground">رسالةٌ تجريبية</p>
        <div className="flex flex-wrap gap-2">
          <Input
            type="email"
            dir="ltr"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@naflaw.sa"
            className="max-w-sm"
            aria-label="البريد المرسَل إليه"
          />
          <Button onClick={sendTest} disabled={busy || !status.configured || !to}>
            {busy ? 'جارٍ الإرسال' : 'إرسال'}
          </Button>
        </div>
        {result && (
          <Alert variant={result.ok ? 'default' : 'destructive'}>
            {result.ok ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
            <span>{result.text}</span>
          </Alert>
        )}
      </Card>
    </div>
  );
}
