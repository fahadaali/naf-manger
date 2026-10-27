import type { Case } from '../types';

/**
 * نوعُ العمل — قضيةٌ منظورة أمام جهة، أو عملٌ قانونيٌّ مستمرّ.
 *
 * نسخةٌ من `worker/lib/work-kind.js`: المختارُ إن كُتب، وإلا يُستنتج — جهةٌ
 * مختصة أو رقمٌ لديها أو نوعٌ يبدأ بـ«قضية» منظورة، وما سواها عملٌ قانوني.
 */
export type WorkKind = 'litigation' | 'legal_work';

export const WORK_KIND_LABEL: Record<WorkKind, string> = {
  litigation: 'قضية منظورة',
  legal_work: 'عمل قانوني',
};

export function workKindOf(case_: Pick<Case, 'workKind' | 'authority' | 'courtCaseNumber' | 'caseType'>): WorkKind {
  if (case_.workKind === 'litigation' || case_.workKind === 'legal_work') return case_.workKind;
  if ((case_.authority ?? '').trim() || (case_.courtCaseNumber ?? '').trim()) return 'litigation';
  return /^قضي[ةه]/.test((case_.caseType ?? '').trim()) ? 'litigation' : 'legal_work';
}

/** «جارية» — و`pending` القديمة منها. */
export const isOngoing = (status: string) => status === 'in-progress' || status === 'pending';
