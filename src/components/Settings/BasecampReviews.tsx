import { useEffect, useState } from 'react';
import { Building2, CircleCheck, ExternalLink, ListChecks, Merge, Sparkles } from 'lucide-react';

import { db } from '../../data/database';
import { BasecampReview } from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Badge } from '@/registry/naf/ui/badge';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { formatNumber } from '@/registry/naf/lib/format';

/* ═══ ما يستحقّ نظرَك ═══
 *
 * الاستيرادُ لا يقف على هذه الشاشة: المزامنةُ الآلية تكتب وتمضي، وتفتح
 * هنا صفّاً لكل ما استحقّ نظراً. فمكتبٌ لا يفتحها شهراً تبقى استيراداتُه
 * جارية، وتنتظره أسئلتُه مجموعةً حين يفتحها.
 *
 * وكلُّ صفٍّ يُحسم في ضغطةٍ **وينتهي**: التصنيفُ يُكتب في `decided_by`،
 * واللفظُ في المعجم، والقيمةُ في عمودها — ولا يُعاد السؤال.
 */

const KIND_BADGE: Record<string, 'primary' | 'success' | 'outline'> = {
  project_kind: 'primary',
  case_type: 'outline',
  unresolved_value: 'outline',
  similar_client: 'primary',
  generated_number: 'outline',
};

export default function BasecampReviews({ onChanged }: { onChanged: () => void }) {
  const [reviews, setReviews] = useState<BasecampReview[]>([]);
  const [busy, setBusy] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = async () => {
    setReviews(await db.getBasecampReviews().catch(() => []));
  };

  useEffect(() => {
    load();
  }, []);

  const settle = async (review: BasecampReview, resolution: string, value?: string) => {
    setBusy(review.id);
    setError('');
    try {
      await db.resolveBasecampReview(review.id, resolution, value);
      /* والصفُّ يُرفع فوراً: قائمةٌ يُعاد جلبُها كلَّها لأجل صفٍّ حُسم
         تُقفز تحت يد من يسوّي عشرةً على التوالي. */
      setReviews((current) => current.filter((entry) => entry.id !== review.id));
      onChanged();
    } catch (settleError) {
      const code = (settleError as { code?: string })?.code;
      setError(
        code === 'duplicate_case_number' ? 'هذا الرقم مستعملٌ في قضيةٍ أخرى'
          : code === 'invalid_value' ? 'اختر قيمةً أوّلاً'
            : 'تعذّر الحفظ',
      );
    } finally {
      setBusy('');
    }
  };

  if (reviews.length === 0) return null;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <ListChecks className="h-6 w-6 text-primary mt-0.5" aria-hidden="true" />
        <div>
          <h4 className="font-semibold text-foreground">
            يستحقّ نظرك <bdi>({formatNumber(reviews.length)})</bdi>
          </h4>
          <p className="text-sm text-muted-foreground">
            الاستيرادُ وقع ولم ينتظر شيئاً — وهذه أسئلتُه. وكلُّ سؤالٍ يُحسم مرّةً
            ولا يعود.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        {reviews.map((review) => (
          <div key={review.id} className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={KIND_BADGE[review.kind] ?? 'outline'}>{review.kindLabel}</Badge>
              <a
                href={review.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-primary font-medium inline-flex items-center gap-1"
              >
                {review.projectName}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              {review.caseNumber && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <bdi className="text-muted-foreground">{review.caseNumber}</bdi>
                </>
              )}
            </div>

            {/* ═══ تصنيفُ المشروع ═══
                داخليٌّ أو مع عميل — يُحسم ويثبت، ولا ينقضه مسحٌ لاحق. */}
            {review.kind === 'project_kind' && (
              <>
                <p className="text-sm text-foreground">
                  {review.detail.hasDocument
                    ? 'فيه ملفُّ بيانات، فرُجّح أنّه مشروعُ عميل.'
                    : 'لا ملفَّ بيانات فيه، فرُجّح أنّه إداريٌّ داخلي.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => settle(review, 'client')} disabled={busy === review.id} size="sm">
                    <Building2 className="h-4 w-4" />
                    مشروعُ عميل
                  </Button>
                  <Button
                    onClick={() => settle(review, 'internal')}
                    disabled={busy === review.id}
                    variant="outline"
                    size="sm"
                  >
                    إداريٌّ داخلي
                  </Button>
                </div>
              </>
            )}

            {/* ═══ لفظٌ لم يُفهم ═══
                يُختار رمزُه مرّةً فيُكتب **ويُحفظ في المعجم** — فلا يُسأل
                عنه في مشروعٍ آخر ولا في دورةٍ قادمة. */}
            {review.kind === 'unresolved_value' && (
              <>
                <p className="text-sm text-foreground">
                  {`في «${review.detail.field}» كُتب: «${review.subject}» — ولم يُفهم، فلم يُكتب.`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={drafts[review.id] ?? ''}
                    onChange={(event) => setDrafts({ ...drafts, [review.id]: event.target.value })}
                    className="min-w-44"
                  >
                    <option value="">اختر ما يقابله</option>
                    {Object.entries(review.detail.codes ?? {}).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </Select>
                  <Button
                    onClick={() => settle(review, 'set', drafts[review.id])}
                    disabled={busy === review.id || !drafts[review.id]}
                    size="sm"
                  >
                    احفظه ولا تسألني ثانيةً
                  </Button>
                  <Button
                    onClick={() => settle(review, 'ignore')}
                    disabled={busy === review.id}
                    variant="outline"
                    size="sm"
                  >
                    تجاهله
                  </Button>
                </div>
              </>
            )}

            {/* ═══ نوعٌ اقترحه الطراز ═══ */}
            {review.kind === 'case_type' && (
              <>
                <p className="text-sm text-foreground inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {`الملفُّ بلا نوعٍ، فاقترح الطراز: «${review.detail.suggestion}»`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => settle(review, 'accept')} disabled={busy === review.id} size="sm">
                    <CircleCheck className="h-4 w-4" />
                    صحيح
                  </Button>
                  <Select
                    value={drafts[review.id] ?? ''}
                    onChange={(event) => setDrafts({ ...drafts, [review.id]: event.target.value })}
                    className="min-w-44"
                  >
                    <option value="">أو اختر غيره</option>
                    {(review.detail.options ?? []).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                  <Button
                    onClick={() => settle(review, 'set', drafts[review.id])}
                    disabled={busy === review.id || !drafts[review.id]}
                    variant="outline"
                    size="sm"
                  >
                    اكتبه
                  </Button>
                </div>
              </>
            )}

            {/* ═══ رقمُ قضيةٍ مولَّد ═══ */}
            {review.kind === 'generated_number' && (
              <>
                <p className="text-sm text-foreground">
                  {`الملفُّ بلا رقم قضية، فوُلِّد «${review.subject}» — واكتب الرقم الحقيقي إن كان.`}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={drafts[review.id] ?? ''}
                    onChange={(event) => setDrafts({ ...drafts, [review.id]: event.target.value })}
                    placeholder="رقم القضية"
                    className="max-w-56"
                  />
                  <Button
                    onClick={() => settle(review, 'set', drafts[review.id])}
                    disabled={busy === review.id || !drafts[review.id]}
                    size="sm"
                  >
                    اكتبه
                  </Button>
                  <Button
                    onClick={() => settle(review, 'accept')}
                    disabled={busy === review.id}
                    variant="outline"
                    size="sm"
                  >
                    اترك المولَّد
                  </Button>
                </div>
              </>
            )}

            {/* ═══ عميلٌ يشبه عميلاً ═══
                بلا رقم هويةٍ لا يُدمج آلياً — «محمد القحطاني» اسمُ عشرة. */}
            {review.kind === 'similar_client' && (
              <>
                <p className="text-sm text-foreground">
                  {`أُنشئ «${review.detail.newName}» ويشبه «${review.detail.existingName}» القائم — ولا هويةَ تفصل.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => settle(review, 'merge')} disabled={busy === review.id} size="sm">
                    <Merge className="h-4 w-4" />
                    هما واحد — ادمجهما
                  </Button>
                  <Button
                    onClick={() => settle(review, 'separate')}
                    disabled={busy === review.id}
                    variant="outline"
                    size="sm"
                  >
                    مختلفان
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
