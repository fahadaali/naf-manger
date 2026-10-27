import { useState } from 'react';
import { Download, RotateCcw, TriangleAlert } from 'lucide-react';

import { db } from '../../data/database';
import { BasecampResetImpact } from '../../types';
import { downloadText } from '../../lib/csv';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { Input } from '@/registry/naf/ui/input';
import { Money } from '@/registry/naf/currency/money';
import { formatNumber } from '@/registry/naf/lib/format';

/* ═══ إعادةُ الاستيراد من الصفر ═══
 *
 * كانت القضايا تُستورد برقم «رقم القضية» في الملفّ — وهو رقمُها لدى الجهة
 * المختصة لا رقمُ المشروع. فتُحذف المستوردةُ وتُعاد برقم مشروعها.
 *
 * ثلاثُ خطوات لا تُقفز: نسخةٌ احتياطية ← معاينةٌ بالأعداد ← عبارةُ تأكيد.
 * والحذفُ لا يرجع: ما أُضيف في المنصة على هذه القضايا (أتعاب، دفعات، عمولات،
 * محامٍ، مرفقات) يذهب معها، والنسخةُ هي ما يبقى منه.
 */

const PHRASE = 'أعد الاستيراد';

const SOURCE_LABEL: Record<string, string> = {
  manual: 'يدوية',
  opening: 'أرصدةٌ افتتاحية',
  wafeq: 'من وافق',
};

export default function BasecampReset({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [impact, setImpact] = useState<BasecampResetImpact | null>(null);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState<'backup' | 'preview' | 'reset' | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState<BasecampResetImpact | null>(null);

  const step = async (key: 'backup' | 'preview' | 'reset', work: () => Promise<void>, fallback: string) => {
    setBusy(key);
    setError('');
    try {
      await work();
    } catch {
      setError(fallback);
    } finally {
      setBusy(null);
    }
  };

  const backup = () => step('backup', async () => {
    const data = await db.exportAllData();
    const day = new Date().toISOString().slice(0, 10);
    downloadText(JSON.stringify(data, null, 2), `نسخة-احتياطية-${day}.json`, 'application/json');
    setBackedUp(true);
  }, 'تعذّر تنزيل النسخة الاحتياطية');

  const preview = () => step('preview', async () => {
    setImpact((await db.resetBasecampImport(true)).impact);
  }, 'تعذّرت المعاينة');

  const reset = () => step('reset', async () => {
    const result = await db.resetBasecampImport(false, phrase.trim());
    setDone(result.impact);
    setImpact(null);
    setPhrase('');
    onDone();
  }, 'تعذّر التنفيذ — لم يُحذف شيء');

  if (!open) {
    return (
      <Card className="p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-foreground">إعادةُ الاستيراد من الصفر</h4>
          <p className="text-sm text-muted-foreground">
            تحذف القضايا المستوردة من بيسكامب لتُعاد برقم مشروعها. والعملاءُ باقون.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <RotateCcw aria-hidden="true" />
          ابدأ
        </Button>
      </Card>
    );
  }

  const payments = Object.entries(impact?.payments ?? {});

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h4 className="font-semibold text-foreground">إعادةُ الاستيراد من الصفر</h4>
        <p className="text-sm text-muted-foreground max-w-2xl">
          تُحذف القضايا التي أنشأها الربطُ ببيسكامب، ثم تُعاد بالمزامنة برقم مشروعها، و«رقم القضية» في الملفّ يصير
          رقمَها لدى الجهة. <strong>ويُحذف معها ما أُضيف عليها في المنصة</strong>: الأتعاب والدفعات والعمولات والمحامي
          والمرفقات. ويبقى العملاء، وتصنيفُ المشاريع، والقضايا المُدخلة يدوياً. ودفعاتُ وافق ترجع «بلا قضية» لتُطابَق ثانيةً.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <span>{error}</span>
        </Alert>
      )}

      {done ? (
        <Alert>
          <span>
            حُذفت {formatNumber(done.cases)} قضيةً مستوردة. الخطوةُ التالية: «معاينة» ثم «مزامنة» في لوح المزامنة أعلاه —
            وبعدها «اربط بالذكاء الاصطناعي الآن» في الربط بوافق.
          </span>
        </Alert>
      ) : (
        <ol className="space-y-4 text-sm">
          <li className="space-y-2">
            <p className="font-medium text-foreground">١) نسخةٌ احتياطية</p>
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={backup}>
              <Download aria-hidden="true" />
              {backedUp ? 'نُزّلت — نزّلها ثانيةً' : 'نزّل نسخةً احتياطية'}
            </Button>
          </li>

          <li className="space-y-2">
            <p className="font-medium text-foreground">٢) ما سيُحذف</p>
            <Button variant="outline" size="sm" disabled={busy !== null || !backedUp} onClick={preview}>
              اعرض الأعداد
            </Button>
            {impact && (
              <ul className="list-disc ps-5 text-muted-foreground space-y-1">
                <li>{formatNumber(impact.cases)} قضيةً مستوردة</li>
                <li>
                  منها: {formatNumber(impact.withFees)} عليها أتعاب، و{formatNumber(impact.withLawyer)} عليها محامٍ،
                  و{formatNumber(impact.withAttachments)} فيها مرفقات، و{formatNumber(impact.withMarketer)} لمسوّق
                </li>
                {payments.length > 0 ? payments.map(([source, entry]) => (
                  <li key={source}>
                    {formatNumber(entry.count)} دفعة {SOURCE_LABEL[source] ?? source} — <Money value={entry.amount} />
                  </li>
                )) : <li>لا دفعات</li>}
                <li>{formatNumber(impact.commissions.count)} دفعةَ عمولة — <Money value={impact.commissions.amount} /></li>
                <li>{formatNumber(impact.wafeqReturned)} دفعةً من وافق ترجع «بلا قضية»</li>
                <li>
                  {formatNumber(impact.conflicts)} اختلافاً و{formatNumber(impact.reviews)} سؤالَ مراجعة قديماً
                </li>
              </ul>
            )}
          </li>

          <li className="space-y-2">
            <p className="font-medium text-foreground">٣) التأكيد</p>
            <label className="block text-muted-foreground">
              اكتب «<bdi>{PHRASE}</bdi>» للتنفيذ
              <Input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                disabled={!impact}
                className="mt-1 max-w-xs"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={busy !== null || !impact || phrase.trim() !== PHRASE}
                onClick={reset}
              >
                {busy === 'reset' ? 'جارٍ الحذف' : 'احذف المستورد'}
              </Button>
              <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => setOpen(false)}>
                إلغاء
              </Button>
            </div>
          </li>
        </ol>
      )}
    </Card>
  );
}
