/* ============================================================
   شارةُ حالة القضية ونتيجتِها — أيقونةٌ ولونٌ ونصّ معاً.

   ═══ العطل الذي أوجب هذا الملفّ ═══

   كانت الخريطةُ مكتوبةً في ثلاثة مواضع: `CasesView` و`CaseModal`
   و`MarketerModal`. والثالثةُ نسيت `postponed` واكتفت بـ`?? map.pending`
   — فالقضيةُ **المؤجَّلة** كانت تُعرض في جدول قضايا المسوّق «منظورة»
   بشارةٍ برتقالية. تسميةٌ خاطئة لا مجرّد تكرار.

   وأسوأُ منه أنّ الملفّين الأوّلين كانا يستوردان `caseStatusLabel` من
   `lib/labels.ts` ويستعملانه في المنسدلة، ثم يعرّفان `getStatusLabel`
   محلّياً ويستعملانه في الشارة — فالمنسدلةُ تقرأ من السجلّ والشارةُ من
   نسخةٍ محلّية، في الملفّ الواحد.

   فالنصُّ من `labels.ts` — وهو مرآةُ `naf-terms.md` — والأيقونةُ واللون
   من هنا، والمقابلاتُ مسجَّلة في `naf-icons.md` تحت «حالة القضية»
   و«نتيجة القضية». وموضعٌ واحدٌ لا يُنسى في الرابع.
   ============================================================ */

import {
  CalendarX,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  Handshake,
  LoaderCircle,
} from 'lucide-react';

import { caseOutcomeLabel, caseStatusLabel } from './labels';

type Variant = 'success' | 'primary' | 'warning' | 'destructive' | 'default';

export interface StatusBadge {
  variant: Variant;
  Icon: typeof Clock;
  label: string;
}

const STATUS: Record<string, { variant: Variant; Icon: typeof Clock }> = {
  completed: { variant: 'success', Icon: CircleCheck },
  'in-progress': { variant: 'primary', Icon: LoaderCircle },
  pending: { variant: 'warning', Icon: Clock },
  postponed: { variant: 'destructive', Icon: CalendarX },
};

const OUTCOME: Record<string, { variant: Variant; Icon: typeof Clock }> = {
  won: { variant: 'success', Icon: CircleCheck },
  lost: { variant: 'destructive', Icon: CircleX },
  settled: { variant: 'warning', Icon: Handshake },
};

/**
 * شارةُ الحالة.
 *
 * والحالةُ المجهولة تأخذ علامةَ استفهامٍ ونصَّها الخام — لا تُنسب إلى
 * حالةٍ أخرى. فقيمةٌ غريبة في العمود يجب أن تُرى في المراجعة لا أن تُخفى
 * خلف تسميةِ غيرها.
 */
export function caseStatusBadge(status?: string): StatusBadge {
  const found = status ? STATUS[status] : undefined;
  return {
    ...(found ?? { variant: 'default' as const, Icon: CircleHelp }),
    label: caseStatusLabel(status),
  };
}

/** شارةُ النتيجة. والمجهولةُ كالحالة: تُرى ولا تُنسب إلى غيرها. */
export function caseOutcomeBadge(outcome?: string): StatusBadge {
  const found = outcome ? OUTCOME[outcome] : undefined;
  return {
    ...(found ?? { variant: 'default' as const, Icon: CircleHelp }),
    label: caseOutcomeLabel(outcome),
  };
}
