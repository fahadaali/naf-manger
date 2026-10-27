import { CalendarRange } from 'lucide-react';
import { Card } from '@/registry/naf/ui/card';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { MONTHS, PRESETS, Period, PeriodKind, iso, periodRange } from '../../lib/periods';
import { formatDate } from '@/registry/naf/lib/format';

/**
 * ═══ فلترُ الفترة ═══
 *
 * أزرارٌ جاهزة (الأسبوع والشهر والربع والعام — الحاليّ والماضي)، و«مخصّص»
 * يفتح: سنةً أو ربعاً أو شهراً أو أسبوعاً بعينه، أو من تاريخ إلى تاريخ.
 */
export default function PeriodFilter({ value, onChange }: { value: Period; onChange: (period: Period) => void }) {
  const today = new Date();
  const year = today.getFullYear();
  /* السنواتُ من ٢٠١٥ إلى العام الجاري — أقدمُ ما في ملفّات المكتب تقريباً. */
  const years = Array.from({ length: year - 2014 }, (_, index) => year - index);
  const range = periodRange(value);
  const custom = !['all', 'preset'].includes(value.kind);

  const pick = (kind: PeriodKind) => {
    switch (kind) {
      case 'year': onChange({ kind, year }); break;
      case 'quarter': onChange({ kind, year, quarter: Math.floor(today.getMonth() / 3) + 1 }); break;
      case 'month': onChange({ kind, year, month: today.getMonth() + 1 }); break;
      case 'week': onChange({ kind, from: iso(today) }); break;
      case 'range': onChange({ kind, from: `${year}-01-01`, to: iso(today) }); break;
      default: onChange({ kind: 'all' });
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <Button size="sm" variant={value.kind === 'all' ? 'default' : 'outline'} onClick={() => onChange({ kind: 'all' })}>
          الكل
        </Button>
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            size="sm"
            variant={value.kind === 'preset' && value.preset === preset.id ? 'default' : 'outline'}
            onClick={() => onChange({ kind: 'preset', preset: preset.id })}
          >
            {preset.label}
          </Button>
        ))}
        <Button size="sm" variant={custom ? 'default' : 'outline'} onClick={() => !custom && pick('year')}>
          مخصّص
        </Button>
      </div>

      {custom && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={value.kind} onChange={(event) => pick(event.target.value as PeriodKind)} aria-label="نوع الفترة" className="w-auto">
            <option value="year">سنة</option>
            <option value="quarter">ربع</option>
            <option value="month">شهر</option>
            <option value="week">أسبوع</option>
            <option value="range">من تاريخ إلى تاريخ</option>
          </Select>

          {(value.kind === 'year' || value.kind === 'quarter' || value.kind === 'month') && (
            <Select
              value={String(value.year ?? year)}
              onChange={(event) => onChange({ ...value, year: Number(event.target.value) })}
              aria-label="السنة"
              className="w-auto"
            >
              {years.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </Select>
          )}
          {value.kind === 'quarter' && (
            <Select
              value={String(value.quarter ?? 1)}
              onChange={(event) => onChange({ ...value, quarter: Number(event.target.value) })}
              aria-label="الربع"
              className="w-auto"
            >
              <option value="1">الربع الأول</option>
              <option value="2">الربع الثاني</option>
              <option value="3">الربع الثالث</option>
              <option value="4">الربع الرابع</option>
            </Select>
          )}
          {value.kind === 'month' && (
            <Select
              value={String(value.month ?? 1)}
              onChange={(event) => onChange({ ...value, month: Number(event.target.value) })}
              aria-label="الشهر"
              className="w-auto"
            >
              {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </Select>
          )}
          {value.kind === 'week' && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              أيُّ يومٍ فيه
              <Input type="date" value={value.from ?? ''} onChange={(event) => onChange({ ...value, from: event.target.value })} className="w-auto" />
            </label>
          )}
          {value.kind === 'range' && (
            <>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                من
                <Input type="date" value={value.from ?? ''} onChange={(event) => onChange({ ...value, from: event.target.value })} className="w-auto" />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                إلى
                <Input type="date" value={value.to ?? ''} onChange={(event) => onChange({ ...value, to: event.target.value })} className="w-auto" />
              </label>
            </>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {range
          ? <>من <bdi>{formatDate(new Date(`${range.from}T00:00:00`))}</bdi> إلى <bdi>{formatDate(new Date(`${range.to}T00:00:00`))}</bdi>
            {' '}— ويُقارَن بالفترة السابقة المساوية لها. والجاري والمستحقّاتُ وحِملُ المحامين: الآن.</>
          : 'كلُّ الفترات — والمؤشّرُ آخرُ ثلاثين يوماً عمّا قبلها، والمحصَّلُ هذا العام.'}
      </p>
    </Card>
  );
}
