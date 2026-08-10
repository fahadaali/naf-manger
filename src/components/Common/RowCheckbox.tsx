import { useEffect, useRef } from 'react';

/* مربّعُ اختيارٍ واحد. و`indeterminate` لا تُضبط في JSX — خاصّيةُ DOM لا
   سمةُ عنصر — فتُكتب على المرجع بعد كل تصيير، وإلا بدا «حدّد الكلّ»
   فارغاً وبعضُ الصفوف محدَّد. */
export default function RowCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate) && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
      className="h-4 w-4 flex-none accent-primary cursor-pointer"
    />
  );
}
