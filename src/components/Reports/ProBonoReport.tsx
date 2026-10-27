import { useEffect, useState } from 'react';
import { Download, HandHeart } from 'lucide-react';
import { Case } from '../../types';
import { db } from '../../data/database';
import { downloadXlsx } from '../../lib/xlsx';
import { caseStatusLabel } from '../../lib/labels';
import { Money } from '@/registry/naf/currency/money';
import { formatNumber } from '@/registry/naf/lib/format';
import { Card } from '@/registry/naf/ui/card';
import { Button } from '@/registry/naf/ui/button';
import { Select } from '@/registry/naf/ui/select';

const yearOf = (value: Date | string) => new Date(value).getFullYear();

/**
 * ═══ تقريرُ المسؤولية الاجتماعية ═══
 *
 * القضايا التطوّعية في سنةٍ بعينها — بـ«تاريخ الإنشاء» يومَ فُتحت — ومجموعُ
 * ساعاتها وقيمتها التقديرية: ما كان المكتب سيتقاضاه. ويُصدَّر Excel.
 */
export default function ProBonoReport() {
  const [cases, setCases] = useState<Case[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    db.getCases().then((rows) => setCases(rows.filter((row) => row.feeStructure?.type === 'pro_bono')));
  }, []);

  if (!cases.length) return null;

  const years = [...new Set(cases.map((row) => yearOf(row.createdDate)))].sort((a, b) => b - a);
  const shown = cases.filter((row) => yearOf(row.createdDate) === year);
  const totals = shown.reduce(
    (sum, row) => ({ hours: sum.hours + (row.proBonoHours ?? 0), value: sum.value + (row.proBonoValue ?? 0) }),
    { hours: 0, value: 0 },
  );

  const exportYear = () => {
    const headers = ['رقم المشروع', 'الموكّل', 'نوع القضية', 'الحالة', 'الساعات', 'القيمة التقديرية'];
    downloadXlsx(
      [{
        name: `التطوّعي ${year}`,
        headers,
        rows: [
          ...shown.map((row) => ({
            'رقم المشروع': row.caseNumber,
            'الموكّل': row.clientName,
            'نوع القضية': row.caseType,
            'الحالة': caseStatusLabel(row.status),
            'الساعات': row.proBonoHours ?? '',
            'القيمة التقديرية': row.proBonoValue ?? '',
          })),
          { 'رقم المشروع': 'المجموع', 'الساعات': totals.hours, 'القيمة التقديرية': totals.value },
        ],
      }],
      `المسؤولية الاجتماعية ${year}.xlsx`,
    );
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <HandHeart className="h-5 w-5" aria-hidden="true" />
          تقرير المسؤولية الاجتماعية
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} aria-label="السنة">
            {(years.includes(year) ? years : [year, ...years]).map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={exportYear} disabled={!shown.length}>
            <Download aria-hidden="true" />
            تصدير Excel
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-foreground"><bdi>{formatNumber(shown.length)}</bdi></p>
          <p className="text-sm text-muted-foreground">قضية تطوّعية</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground"><bdi>{formatNumber(totals.hours)}</bdi></p>
          <p className="text-sm text-muted-foreground">ساعة</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground"><Money value={totals.value} /></p>
          <p className="text-sm text-muted-foreground">القيمة التقديرية</p>
        </div>
      </div>
    </Card>
  );
}
