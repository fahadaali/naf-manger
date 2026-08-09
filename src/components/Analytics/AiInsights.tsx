import { useEffect, useState } from 'react';
import { CircleCheck, Lightbulb, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';

import { db } from '../../data/database';
import { AiInsightsResult, ApiInsight } from '../../types';
import { ApiError } from '../../data/api';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { formatDateTime } from '@/registry/naf/lib/format';

/* ═══ استبصارات التحليلات ═══
 *
 * شاشة التحليلات تعرض أرقاماً ورسوماً، وقراءتُها عملُ من يفتحها. وهذا
 * اللوح يقرؤها نيابةً عنه: ما الذي تغيّر، وأين يتسرّب المحتملون، وأيُّ
 * نوعِ قضايا يربح.
 *
 * والاستدلال يقع على Workers AI — داخل شبكة Cloudflare نفسها التي تحمل
 * المنصة وقاعدتَها، فلا مفتاحَ مزوّدٍ ولا خروجَ إلى طرفٍ ثالث.
 *
 * وما يُمرَّر إليه أرقامٌ مجمَّعة وحدها. وهذا يُقال في الشاشة صراحةً: من
 * يقرأ «تحليلاً ذكياً» في منصةِ مكتبِ محاماة يستحقّ أن يعرف ما الذي غادر.
 */

const TONE: Record<ApiInsight['tone'], { chip: string; label: string }> = {
  warning: { chip: 'bg-warning-soft text-warning-strong', label: 'يحتاج تدخّلاً' },
  opportunity: { chip: 'bg-success-soft text-success-strong', label: 'فرصة' },
  info: { chip: 'bg-info-soft text-info-strong', label: 'ملاحظة' },
};

export default function AiInsights() {
  const [result, setResult] = useState<AiInsightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      setResult(await db.getInsights(refresh));
    } catch (loadError) {
      const code = (loadError as ApiError)?.code;
      setResult(null);
      setError(
        code === 'not_connected'
          ? 'غير مربوط — يلزم ارتباط Workers AI في إعداد المنصة'
          : code === 'forbidden'
            ? 'لا صلاحية لك على التحليلات'
            : code === 'unreadable_response'
              ? 'ردَّ الطراز بما لا يُقرأ. أعد المحاولة'
              : 'تعذّر توليد الاستبصارات'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-foreground">قراءةٌ في الأرقام</h3>
        </div>

        <div className="flex items-center gap-3">
          {result && (
            <span className="text-xs text-muted-foreground">
              {result.cached ? 'محفوظة من' : 'وُلّدت'}{' '}
              <bdi>{formatDateTime(new Date(result.generatedAt * 1000))}</bdi>
            </span>
          )}
          <Button onClick={() => load(true)} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'جارٍ القراءة' : 'إعادة القراءة'}
          </Button>
        </div>
      </div>

      {/* ما يُرسَل يُقال، ولا يُترك للظنّ. */}
      <p className="text-xs text-muted-foreground">
        تُقرأ الأرقام المجمَّعة وحدها — أعدادٌ ونسبٌ واتّجاهٌ شهري. ولا يغادر اسمُ
        عميلٍ ولا رقمُ قضية ولا مبلغٌ منسوبٌ إلى أحد. والاستدلال داخل Cloudflare
        التي تحمل المنصة وقاعدتَها.
      </p>

      {error ? (
        <Alert variant={error.startsWith('غير مربوط') ? 'warning' : 'destructive'}>
          <TriangleAlert aria-hidden="true" />
          <span>{error}</span>
        </Alert>
      ) : loading && !result ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : result && result.insights.length > 0 ? (
        <ul className="space-y-3">
          {result.insights.map((insight, index) => {
            const tone = TONE[insight.tone];
            return (
              <li key={index} className="border border-border rounded-xl p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-foreground">{insight.title}</h4>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tone.chip}`}>
                    {tone.label}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{insight.body}</p>
                {insight.action && (
                  <p className="text-sm text-foreground flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 mt-0.5 flex-none text-primary" aria-hidden="true" />
                    {insight.action}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground py-6">
          <CircleCheck className="h-5 w-5" aria-hidden="true" />
          <span>لا ملاحظات بعد — أضف بياناتٍ ثم أعد القراءة.</span>
        </div>
      )}
    </Card>
  );
}
