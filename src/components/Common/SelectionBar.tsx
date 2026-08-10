import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2, X } from 'lucide-react';

import { BulkAction } from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { formatNumber, isolate } from '@/registry/naf/lib/format';

/* ═══ شريطُ ما حُدِّد ═══
 *
 * يظهر حين يُحدَّد شيء، ويختفي حين لا شيء. ويقول العددَ صراحةً قبل أيّ
 * فعل — «١٢ محدَّداً» — لأنّ من يضغط «حذف» بعد تمريرةٍ طويلة قد يكون
 * حدّد أكثر ممّا ظنّ.
 *
 * والحذفُ يُسأل عنه مرّتين، ونصُّ السؤال يذكر ما يسقط معه: حذفُ عميلٍ
 * يُسقط قضاياه بقيد `ON DELETE CASCADE` في المخطَّط. وإخفاءُ ذلك خلف
 * «هل أنت متأكد؟» يجعل التأكيدَ توقيعاً على ما لم يُقرأ.
 */
export default function SelectionBar({
  count,
  onClear,
  onAction,
  busy,
  showRestore,
  deleteWarning,
  noun,
}: {
  count: number;
  onClear: () => void;
  onAction: (action: BulkAction) => void;
  busy: boolean;
  /** يُعرض حين يكون في المحدَّد مؤرشفٌ يمكن إرجاعه. */
  showRestore: boolean;
  /** ما يسقط مع المحذوف — يُقال في نصّ التأكيد. */
  deleteWarning?: string;
  /** «عميلاً» أو «قضيةً» — ليقرأ العددُ عربياً سليماً. */
  noun: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (count === 0) return null;

  return (
    <div className="sticky top-2 z-20 rounded-2xl border border-primary/30 bg-primary-soft p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-primary-strong">
          <bdi>{formatNumber(count)}</bdi> {noun} محدَّد
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => onAction('archive')} variant="outline" size="sm" disabled={busy}>
            <Archive className="h-4 w-4" aria-hidden="true" />
            أرشفة
          </Button>

          {showRestore && (
            <Button type="button" onClick={() => onAction('restore')} variant="outline" size="sm" disabled={busy}>
              <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
              إرجاع من الأرشيف
            </Button>
          )}

          <Button
            type="button"
            onClick={() => setConfirming(true)}
            variant="destructive"
            size="sm"
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            حذف
          </Button>

          <Button type="button" onClick={onClear} variant="ghost" size="sm" disabled={busy}>
            <X className="h-4 w-4" aria-hidden="true" />
            إلغاء التحديد
          </Button>
        </div>
      </div>

      {confirming && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive-soft p-4 space-y-3">
          <p className="text-sm text-destructive-strong">
            {`سيُحذف ${isolate(formatNumber(count))} ${noun} حذفاً لا رجعةَ فيه.`}
            {deleteWarning ? ` ${deleteWarning}` : ''}
          </p>
          <p className="text-sm text-muted-foreground">
            وإن كان المرادُ إخفاءَها من القائمة لا إتلافَها فالأرشفةُ تكفي — وتُرجَع متى شئت.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                setConfirming(false);
                onAction('delete');
              }}
              variant="destructive"
              size="sm"
              disabled={busy}
            >
              نعم، احذفها
            </Button>
            <Button type="button" onClick={() => setConfirming(false)} variant="outline" size="sm">
              تراجع
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
