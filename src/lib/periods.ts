/**
 * ═══ فتراتُ لوحة التحكم ═══
 *
 * جاهزةٌ (هذا الأسبوع والماضي، والشهر، والربع، والعام) ومخصّصة (سنةٌ أو ربعٌ أو
 * شهرٌ أو أسبوعٌ بعينه، أو من تاريخ إلى تاريخ). وكلُّها تؤول إلى تاريخين شاملين
 * `YYYY-MM-DD` يقرؤهما `GET /api/stats?from&to`، فيُقارَن كلٌّ بالفترة السابقة
 * المساوية له طولاً.
 *
 * والأسبوعُ يبدأ بالأحد — أسبوعُ العمل في المملكة. والحسابُ بتقويم الجهاز.
 */
export type PeriodKind = 'all' | 'preset' | 'year' | 'quarter' | 'month' | 'week' | 'range';

export type PresetId =
  | 'this-week' | 'last-week' | 'this-month' | 'last-month'
  | 'this-quarter' | 'last-quarter' | 'this-year' | 'last-year';

export interface Period {
  kind: PeriodKind;
  preset?: PresetId;
  year?: number;
  quarter?: number; // ١–٤
  month?: number; // ١–١٢
  /** أيُّ يومٍ في الأسبوع المختار، أو بدايةُ المدى. */
  from?: string;
  to?: string;
}

export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'this-week', label: 'هذا الأسبوع' },
  { id: 'last-week', label: 'الأسبوع الماضي' },
  { id: 'this-month', label: 'هذا الشهر' },
  { id: 'last-month', label: 'الشهر الماضي' },
  { id: 'this-quarter', label: 'هذا الربع' },
  { id: 'last-quarter', label: 'الربع الماضي' },
  { id: 'this-year', label: 'هذا العام' },
  { id: 'last-year', label: 'العام الماضي' },
];

export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const pad = (value: number) => String(value).padStart(2, '0');
export const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const day = (year: number, month: number, date: number) => new Date(year, month, date);

function weekOf(date: Date): [Date, Date] {
  const start = day(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  return [start, day(start.getFullYear(), start.getMonth(), start.getDate() + 6)];
}
const monthOf = (year: number, month: number): [Date, Date] => [day(year, month, 1), day(year, month + 1, 0)];
const quarterOf = (year: number, quarter: number): [Date, Date] =>
  [day(year, (quarter - 1) * 3, 1), day(year, quarter * 3, 0)];
const yearOf = (year: number): [Date, Date] => [day(year, 0, 1), day(year, 11, 31)];

/** الفترةُ تاريخين شاملين — أو `null` للكلّ (أو لمدى ناقص). */
export function periodRange(period: Period, today = new Date()): { from: string; to: string } | null {
  let range: [Date, Date] | null = null;
  const y = today.getFullYear();
  const m = today.getMonth();
  const q = Math.floor(m / 3) + 1;

  switch (period.kind) {
    case 'preset':
      switch (period.preset) {
        case 'this-week': range = weekOf(today); break;
        case 'last-week': range = weekOf(day(y, m, today.getDate() - 7)); break;
        case 'this-month': range = monthOf(y, m); break;
        case 'last-month': range = monthOf(m === 0 ? y - 1 : y, (m + 11) % 12); break;
        case 'this-quarter': range = quarterOf(y, q); break;
        case 'last-quarter': range = q === 1 ? quarterOf(y - 1, 4) : quarterOf(y, q - 1); break;
        case 'this-year': range = yearOf(y); break;
        case 'last-year': range = yearOf(y - 1); break;
        default: range = null;
      }
      break;
    case 'year': range = yearOf(period.year ?? y); break;
    case 'quarter': range = quarterOf(period.year ?? y, period.quarter ?? q); break;
    case 'month': range = monthOf(period.year ?? y, (period.month ?? m + 1) - 1); break;
    case 'week': range = period.from ? weekOf(new Date(`${period.from}T00:00:00`)) : weekOf(today); break;
    case 'range':
      if (period.from && period.to && period.from <= period.to) return { from: period.from, to: period.to };
      return null;
    default: return null;
  }
  return range ? { from: iso(range[0]), to: iso(range[1]) } : null;
}

/** وصفُ الفترة سطراً — للعنوان وللمقارنة. */
export function periodLabel(period: Period): string {
  switch (period.kind) {
    case 'preset': return PRESETS.find((preset) => preset.id === period.preset)?.label ?? 'الكل';
    case 'year': return `عام ${period.year}`;
    case 'quarter': return `الربع ${['الأول', 'الثاني', 'الثالث', 'الرابع'][(period.quarter ?? 1) - 1]} ${period.year}`;
    case 'month': return `${MONTHS[(period.month ?? 1) - 1]} ${period.year}`;
    case 'week': return 'أسبوع مخصّص';
    case 'range': return 'مدى مخصّص';
    default: return 'كل الفترات';
  }
}
