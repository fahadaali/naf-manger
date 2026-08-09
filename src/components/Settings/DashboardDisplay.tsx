import { useEffect, useState } from 'react';
import { CircleCheck, Copy, Lightbulb, Plus, Trash2, TriangleAlert, Tv } from 'lucide-react';

import { db } from '../../data/database';
import { DisplayToken } from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { Input } from '@/registry/naf/ui/input';
import { Alert } from '@/registry/naf/ui/alert';
import { formatDateTime } from '@/registry/naf/lib/format';
import { messageTone } from '../../lib/status-message';

/* ═══ ما كان هنا ═══
 *
 * زرٌّ ينسخ `window.location.origin + pathname` — أي عنوان المنصة نفسه —
 * ويَعِد بعرضه على شاشات المكتب. وهو خلف الحارس: أيُّ شاشةٍ تفتحه تُحوَّل
 * إلى المركز وتطلب دخولاً من لا أحد. فالميزة موعودةٌ ولا يمكن أن تعمل.
 *
 * والآن رابطٌ لكل شاشة برمزٍ عشوائيّ، يُبطَل وحده حين تُنقل الشاشة أو
 * يُصوَّر رابطُها. وما خلفه إحصاءاتٌ مجمَّعة لا غير — لا اسمَ عميلٍ ولا
 * رقمَ قضية ولا مبلغ — لأن الرابط يعيش في شاشةٍ يراها كلُّ من يمرّ.
 */

export default function DashboardDisplay() {
  const [tokens, setTokens] = useState<DisplayToken[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => setTokens(await db.getDisplayTokens());

  useEffect(() => {
    load().catch((error) => console.error('تعذّر جلب روابط العرض:', error));
  }, []);

  const linkFor = (token: string) => `${window.location.origin}/display/${token}`;

  const create = async () => {
    setBusy(true);
    setMessage('');
    try {
      await db.createDisplayToken(label.trim());
      setLabel('');
      await load();
      setMessage('أُنشئ الرابط');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('تعذّر إنشاء الرابط:', error);
      setMessage('تعذّر إنشاء الرابط');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (token: DisplayToken) => {
    const name = token.label || 'بلا اسم';
    if (!window.confirm(`إبطال رابط «${name}»؟ ستتوقّف الشاشة التي تستعمله في الحال.`)) return;

    try {
      await db.deleteDisplayToken(token.token);
      await load();
      setMessage('أُبطل الرابط');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('تعذّر إبطال الرابط:', error);
      setMessage('تعذّر إبطال الرابط');
    }
  };

  const copy = async (token: string) => {
    const link = linkFor(token);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* `clipboard` يحتاج سياقاً آمناً، وقد لا يتاح. والبديل يبقي الفعل
         ممكناً بدل أن يصمت الزرّ. */
      const field = document.createElement('textarea');
      field.value = link;
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      document.body.removeChild(field);
    }
    setCopied(token);
    setTimeout(() => setCopied(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">عرض لوحة التحكم على الشاشات</h3>
        <p className="text-muted-foreground mt-1">
          رابطٌ لكل شاشة، يُفتح بلا تسجيل دخول ويُبطَل وحده متى شئت.
        </p>
      </div>

      <Alert variant="info">
        <Lightbulb aria-hidden="true" />
        <span>
          ما خلف الرابط أعدادٌ مجمَّعة وحدها — عدد العملاء والقضايا وحالاتها ومعدّل
          الربح. ولا يظهر فيه اسمُ عميل ولا رقمُ قضية ولا مبلغ.
        </span>
      </Alert>

      {message && (() => {
        const tone = messageTone(message);
        const Icon = tone === 'success' ? CircleCheck : TriangleAlert;
        return (
          <Alert variant={tone}>
            <Icon aria-hidden="true" />
            <span>{message}</span>
          </Alert>
        );
      })()}

      <div className="bg-muted rounded-lg p-6 space-y-4">
        <h4 className="font-medium text-foreground">رابط جديد</h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="اسم الشاشة — «شاشة الاستقبال»"
            className="flex-1"
          />
          <Button onClick={create} disabled={busy}>
            <Plus className="h-5 w-5" />
            {busy ? 'جارٍ الإنشاء' : 'إنشاء'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {tokens.length === 0 ? (
          <p className="text-muted-foreground">لا روابط عرض بعد.</p>
        ) : (
          tokens.map((token) => (
            <div key={token.token} className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Tv className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <p className="font-medium text-foreground">{token.label || 'بلا اسم'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    أُنشئ <bdi>{formatDateTime(new Date(token.createdAt * 1000))}</bdi>
                    {' · '}
                    {token.lastSeenAt
                      ? <>آخر قراءة <bdi>{formatDateTime(new Date(token.lastSeenAt * 1000))}</bdi></>
                      : 'لم يُقرأ بعد'}
                  </p>
                </div>
                <Button
                  onClick={() => revoke(token)}
                  className="text-destructive hover:text-destructive-strong"
                  title="إبطال الرابط"
                  variant="ghost"
                  size="icon-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate text-xs bg-muted rounded px-3 py-2" dir="ltr">
                  {linkFor(token.token)}
                </code>
                <Button
                  onClick={() => copy(token.token)}
                  variant={copied === token.token ? 'success' : 'outline'}
                  size="sm"
                >
                  <Copy className="h-4 w-4" />
                  {copied === token.token ? 'نُسخ' : 'نسخ'}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
