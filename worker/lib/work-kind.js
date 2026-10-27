// نوعُ العمل: قضيةٌ منظورة أمام جهة، أو عملٌ قانونيٌّ مستمرّ.
//
// يُكتب في `cases.work_kind` حين يختاره إنسان، وغيابُه يعني «يُستنتج»: قضيةٌ
// لها جهةٌ مختصة أو رقمٌ لديها، أو نوعُها يبدأ بـ«قضية» — منظورة؛ وما سواها
// (عقود، استشارات، تأسيس، صياغة) عملٌ قانوني. والاستنتاجُ عند القراءة لا
// بالكتابة: نوعٌ تبدّل أو جهةٌ أُضيفت يبدّلانه بلا هجرة.

export const WORK_KINDS = ['litigation', 'legal_work'];

/* والصورةُ نفسُها في SQL — لعدّ اللوحة. «قضيه» بعد توحيد التاء لا يحتاجه
   SQLite: يُقارن بالصورتين. */
export const WORK_KIND_SQL = `COALESCE(NULLIF(work_kind, ''), CASE
  WHEN COALESCE(TRIM(authority), '') <> '' OR COALESCE(TRIM(court_case_number), '') <> '' THEN 'litigation'
  WHEN case_type LIKE 'قضية%' OR case_type LIKE 'قضيه%' THEN 'litigation'
  ELSE 'legal_work' END)`;

export function workKindOf(row) {
  if (WORK_KINDS.includes(row?.work_kind ?? row?.workKind)) return row.work_kind ?? row.workKind;
  const authority = String(row?.authority ?? '').trim();
  const court = String(row?.court_case_number ?? row?.courtCaseNumber ?? '').trim();
  if (authority || court) return 'litigation';
  const type = String(row?.case_type ?? row?.caseType ?? '').trim();
  return /^قضي[ةه]/.test(type) ? 'litigation' : 'legal_work';
}
