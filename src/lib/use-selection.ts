import { useCallback, useMemo, useState } from 'react';

/* ═══ ما حُدِّد ═══
 *
 * مجموعةُ معرّفات، لا أعلامٌ في الصفوف: المعرّف يبقى صحيحاً بعد إعادة
 * التحميل والفرز والترشيح، والعلمُ في الصفّ يضيع مع كلّ `setState` جديد.
 *
 * والتقليمُ عند القراءة لا عند كل تبديل: صفٌّ حُدِّد ثم رشّحه المستخدم
 * بعيداً عن الشاشة يبقى في المجموعة — فلو أُخرج عندها ثم رُفع الترشيح
 * لعاد بلا تحديد، وهو ليس ما فعله. لكنّه لا يُسلَّم في فعلٍ جماعي إلا إن
 * كان في المعروض، فلا يُحذف ما لا يراه.
 */
export function useSelection<T extends { id: string }>(visible: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => visible.map((row) => row.id), [visible]);

  /** المحدَّدُ من المعروض وحده — وهو ما يقع عليه الفعل. */
  const ids = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  );

  const rows = useMemo(
    () => visible.filter((row) => selected.has(row.id)),
    [visible, selected],
  );

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* «حدّد الكلّ» يعني المعروضَ الآن لا كلَّ ما في الجدول: من رشّح
     «الشركات» ثم ضغطها قصد الشركات. */
  const toggleAll = useCallback(() => {
    setSelected((current) => {
      const allChosen = visibleIds.length > 0 && visibleIds.every((id) => current.has(id));
      const next = new Set(current);
      for (const id of visibleIds) {
        if (allChosen) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, [visibleIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const allChosen = visibleIds.length > 0 && ids.length === visibleIds.length;
  const someChosen = ids.length > 0 && !allChosen;

  return { ids, rows, count: ids.length, has: (id: string) => selected.has(id), toggle, toggleAll, clear, allChosen, someChosen };
}
