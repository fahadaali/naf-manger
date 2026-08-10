import { useEffect, useState } from 'react';
import { LayoutGrid, Rows3 } from 'lucide-react';

/* ═══ بطاقاتٌ أو صفوف ═══
 *
 * البطاقةُ تُري الواحد، والصفُّ يُري الجملة. ومن يفتح شاشة العملاء ليجد
 * واحداً يريد البطاقة، ومن يفتحها ليمسح خمسين يريد الصفوف — والشاشة
 * الواحدة تخدم الاثنين إن سُئل صاحبُها.
 *
 * والاختيار يُحفظ: من بدّل إلى الصفوف لا يريد أن يبدّل ثانيةً في كل فتحة.
 * و`localStorage` لا الخادم — تفضيلُ جهازٍ لا تفضيلُ عضو: من يفتحها على
 * شاشةٍ عريضة في المكتب غيرُ من يفتحها على هاتفه.
 */
export type ViewMode = 'cards' | 'rows';

export function useViewMode(key: string, fallback: ViewMode = 'cards') {
  const storageKey = `naf.view.${key}`;

  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === 'cards' || saved === 'rows' ? saved : fallback;
    } catch {
      /* متصفّحٌ يمنع التخزين — يُعرض الافتراض ولا تسقط الشاشة. */
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, mode);
    } catch {
      /* لا شيء: التفضيل يضيع، والشاشة تعمل. */
    }
  }, [storageKey, mode]);

  return [mode, setMode] as const;
}

export default function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (next: ViewMode) => void;
}) {
  const base =
    'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
  const on = 'bg-primary text-primary-foreground';
  const off = 'bg-card text-muted-foreground hover:bg-muted';

  return (
    <div
      className="inline-flex rounded-xl border border-border overflow-hidden"
      role="group"
      aria-label="طريقة العرض"
    >
      <button
        type="button"
        onClick={() => onChange('cards')}
        className={`${base} ${mode === 'cards' ? on : off}`}
        aria-pressed={mode === 'cards'}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        بطاقات
      </button>
      <button
        type="button"
        onClick={() => onChange('rows')}
        className={`${base} ${mode === 'rows' ? on : off}`}
        aria-pressed={mode === 'rows'}
      >
        <Rows3 className="h-4 w-4" aria-hidden="true" />
        صفوف
      </button>
    </div>
  );
}
