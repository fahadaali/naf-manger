import { useState, useEffect } from 'react';
import { ChartColumn, FileOutput, Pencil, Table2, TriangleAlert, X } from 'lucide-react';
import { chartPalette } from '../../lib/chart-tokens';
import { CustomReport, ReportResult } from '../../types';
import { db } from '../../data/database';
import { columnLabel, formatCell } from '../../lib/report-fields';
import { downloadText, toCsv } from '../../lib/csv';
import { downloadXlsx } from '../../lib/xlsx';
import { Alert } from '@/registry/naf/ui/alert';
import ChartCard from '../Dashboard/ChartCard';
import { formatDate, formatNumber } from '@/registry/naf/lib/format';
import { Button } from '@/registry/naf/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/registry/naf/ui/table';
import { Card } from '@/registry/naf/ui/card';

interface ReportViewerProps {
  report: CustomReport;
  onClose: () => void;
  onEdit: () => void;
}

export default function ReportViewer({ report, onClose, onEdit }: ReportViewerProps) {
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  /* ═══ الصفوف من القاعدة ═══
   *
   * كان `db.generateReportData(report)` يُرجع `[]` دائماً، ثم يقع الاستدعاء
   * في `catch` فتُعرض ثلاثةُ صفوفٍ مكتوبة في الشيفرة — «عينة بيانات 1» —
   * على أنها نتيجةُ التقرير. فالشاشة تعرض ما لا وجود له في القاعدة.
   *
   * والآن `‎/api/reports/:id/run‎`: الاستعلام يُبنى في الخادم من تعريفٍ
   * منقّى، والأعمدةُ تُردّ معه فلا تُشتقّ من أول صفّ. */
  useEffect(() => {
    let alive = true;
    setLoading(true);

    db.runReport(report.id)
      .then((result) => { if (alive) { setResult(result); setError(''); } })
      .catch((runError) => {
        console.error('تعذّر تشغيل التقرير:', runError);
        if (alive) { setResult(null); setError('تعذّر تشغيل التقرير'); }
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [report.id]);

  const rows = result?.rows ?? [];
  const columns = result?.columns ?? [];

  /* التصدير يُسلّم ما يَعِد به: دفترُ `.xlsx` حقيقي أو CSV. وكان الثلاثةُ
     — CSV وExcel وPDF — يكتبون JSON نفسه ويغيّرون الامتداد وحده. */
  const exportReport = (format: 'csv' | 'xlsx') => {
    const safeName = report.name.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'تقرير';
    const labelled = rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const column of columns) out[columnLabel(column)] = row[column] ?? '';
      return out;
    });
    const headers = columns.map(columnLabel);

    if (format === 'xlsx') {
      downloadXlsx([{ name: safeName, headers, rows: labelled }], `${safeName}.xlsx`);
    } else {
      downloadText(toCsv(headers, labelled), `${safeName}.csv`, 'text/csv;charset=utf-8');
    }
  };

  const getChartData = () => {
    if (!rows.length || columns.length < 2) return null;

    /* أوّلُ عمودٍ تسمية، وأوّلُ عمودٍ عدديّ قيمة. وكان يقرأ `item.name` و
       `item.value` — حقلين لا يردّهما أي تقرير. */
    const [labelColumn] = columns;
    const valueColumn =
      columns.slice(1).find((column) => rows.some((row) => typeof row[column] === 'number')) ??
      columns[1];

    return {
      labels: rows.map((row) => String(row[labelColumn] ?? '')),
      datasets: [{
        label: columnLabel(valueColumn),
        data: rows.map((row) => Number(row[valueColumn] ?? 0)),
        // ستّ درجات كانت مكتوبةً بيدها، والمسجَّل خمس. اللوحة تدور على
        // الخمس بدل اختراع سادسة تقارب إحداها فتُبطل التمييز الذي وُضعت له.
        backgroundColor: chartPalette(rows.length),
        borderRadius: 4
      }]
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جارٍ تحميل التقرير</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={onClose} className="rounded-full" variant="ghost" size="icon-md">
              <X className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{report.name}</h1>
              {report.description && (
                <p className="text-sm text-muted-foreground">{report.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'table' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Table2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'chart' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ChartColumn className="h-4 w-4" />
              </button>
            </div>
            
            <div className="relative group">
              <Button  variant="outline">
                <FileOutput className="h-4 w-4" />
                تصدير
              </Button>
              <div className="absolute end-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <Button onClick={() => exportReport('xlsx')} className="w-full justify-start first:rounded-t-lg" variant="ghost">
                  تصدير Excel (.xlsx)
                </Button>
                <Button onClick={() => exportReport('csv')} className="w-full justify-start" variant="ghost">
                  تصدير CSV
                </Button>
                <Button onClick={() => window.print()} className="w-full justify-start last:rounded-b-lg" variant="ghost">
                  طباعة — ومنها «حفظ كـPDF»
                </Button>
              </div>
            </div>
            
            <Button onClick={onEdit} className="border-primary text-primary" variant="outline">
              <Pencil className="h-4 w-4" />
              تعديل
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Report Info */}
        <div className="bg-card rounded-lg border border-border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">مصدر البيانات:</span>
              <span className="font-medium text-foreground ms-2">{report.dataSource}</span>
            </div>
            <div>
              <span className="text-muted-foreground">عدد السجلات:</span>
              <span className="font-medium text-foreground ms-2"><bdi>{formatNumber(rows.length)}</bdi></span>
            </div>
            <div>
              <span className="text-muted-foreground">آخر تحديث:</span>
              <span className="font-medium text-foreground ms-2">
                <bdi>{formatDate(report.lastModified)}</bdi>
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">نوع العرض:</span>
              <span className="font-medium text-foreground ms-2">{report.visualization.type}</span>
            </div>
          </div>
        </div>

        {/* Data Display */}
        <Card className="overflow-hidden">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              {error ? (
                <div className="p-8">
                  <Alert variant="destructive">
                    <TriangleAlert aria-hidden="true" />
                    <span>{error}</span>
                  </Alert>
                </div>
              ) : rows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {/* الأعمدة من الخادم لا من `Object.keys(rows[0])`: صفٌّ
                          تخلو فيه قيمةٌ يُسقط عمودَها فتنقص الترويسة. */}
                      {columns.map((column) => (
                        <TableHead key={column} className="tracking-wider">
                          {columnLabel(column)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={index}>
                        {columns.map((column) => (
                          <TableCell key={column} className="text-foreground">
                            <bdi>{formatCell(row[column])}</bdi>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground">لا نتائج تطابق شروط التقرير. وسّع المدى أو امسح الشروط.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              {getChartData() ? (
                <ChartCard
                  title={report.name}
                  type={report.visualization.type === 'bar' ? 'bar' : 'doughnut'}
                  data={getChartData()!}
                />
              ) : (
                <div className="text-center py-12">
                  <ChartColumn className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">يظهر الرسم بعد أول مجموعة مكتملة من البيانات.</p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Applied Filters */}
        {report.filters && report.filters.length > 0 && (
          <div className="mt-6 bg-primary-soft border border-primary/30 rounded-lg p-4">
            <h3 className="font-medium text-primary-strong mb-2">الفلاتر المطبقة:</h3>
            <div className="space-y-1">
              {report.filters.map((filter, index) => (
                <div key={filter.id} className="text-sm text-primary-strong">
                  {index > 0 && <span className="ms-2">{filter.logicalOperator}</span>}
                  <span className="font-medium">{filter.fieldId}</span>
                  <span className="mx-2">{filter.operator}</span>
                  <span className="font-medium">{filter.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}