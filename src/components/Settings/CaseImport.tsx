import { useRef, useState } from 'react';
import { Briefcase, CircleCheck, TriangleAlert } from 'lucide-react';
import { db } from '../../data/database';
import { ApiError } from '../../data/api';
import { CaseImportPreview, CaseImportRow } from '../../types';
import { downloadText, parseCsv, toCsv } from '../../lib/csv';
import { Button } from '@/registry/naf/ui/button';
import { Input } from '@/registry/naf/ui/input';
import { Alert } from '@/registry/naf/ui/alert';
import { formatNumber, isolate } from '@/registry/naf/lib/format';

/* أعمدةُ القالب: عنوانُها العربي، ومفتاحُها عند الخادم، ومثالُها. */
const COLUMNS: { header: string; key: keyof CaseImportRow; sample: string; required?: boolean }[] = [
  { header: 'رقم المشروع', key: 'caseNumber', sample: 'ق-2026-120', required: true },
  { header: 'اسم العميل', key: 'clientName', sample: 'شركة الأفق التجارية', required: true },
  { header: 'هوية العميل', key: 'clientIdNumber', sample: '7001234567' },
  { header: 'جوال العميل', key: 'clientPhone', sample: '0501234567' },
  { header: 'نوع القضية', key: 'caseType', sample: 'قضية تجارية' },
  { header: 'موضوع القضية', key: 'summary', sample: 'نزاع على عقد توريد' },
  { header: 'الجهة المختصة', key: 'authority', sample: 'المحكمة التجارية بالرياض' },
  { header: 'رقم القضية لدى الجهة', key: 'courtCaseNumber', sample: '4470123456' },
  { header: 'الحالة', key: 'status', sample: 'قيد المعالجة' },
  { header: 'النتيجة', key: 'outcome', sample: '' },
  { header: 'المحامي المسؤول', key: 'lawyer', sample: '' },
  { header: 'الخصم', key: 'opposingParties', sample: 'مؤسسة الريان' },
  { header: 'نوع الأتعاب', key: 'feeType', sample: 'مقدم فقط' },
  { header: 'المبلغ الإجمالي', key: 'totalAmount', sample: '50000' },
  { header: 'المبلغ المحصل', key: 'collectedAmount', sample: '20000' },
  { header: 'تاريخ الإنشاء', key: 'createdDate', sample: '2026/01/15' },
  { header: 'الملاحظات', key: 'notes', sample: '' },
];

const ERRORS: Record<string, string> = {
  forbidden: 'يلزم تصريحُ إنشاء القضايا والعملاء معاً',
  too_many_rows: 'الملفّ أكبر من ٥٠٠ صفّ — قسّمه',
  no_rows: 'الملفّ بلا صفوف',
};

/**
 * ═══ استيرادُ القضايا ═══
 *
 * معاينةٌ أوّلاً لا تكتب حرفاً — كم قضيةً تُنشأ، وكم عميلاً يُنشأ ويُربط، وكلُّ
 * صفٍّ مرفوضٍ بسببه — ثم «تنفيذ» يُوقع ما عُرض. والعميلُ يُطابَق بالهوية ثم
 * بالاسم، وما لم يُطابَق يُنشأ.
 */
export default function CaseImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CaseImportRow[]>([]);
  const [preview, setPreview] = useState<CaseImportPreview | null>(null);
  const [done, setDone] = useState<CaseImportPreview['summary'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const template = () => {
    const sample: Record<string, string> = {};
    for (const column of COLUMNS) sample[column.header] = column.sample;
    downloadText(toCsv(COLUMNS.map((column) => column.header), [sample]), 'استيراد القضايا.csv', 'text/csv;charset=utf-8');
  };

  const pick = async (file: File | undefined) => {
    setPreview(null);
    setDone(null);
    setError('');
    if (!file) return;
    setBusy(true);
    try {
      const parsed = parseCsv(await file.text());
      const missing = COLUMNS.filter((column) => column.required && !(column.header in (parsed[0] ?? {})));
      if (!parsed.length) throw new Error('الملفّ فارغ أو لا يحمل ترويسة');
      if (missing.length) throw new Error(`أعمدة ناقصة: ${missing.map((column) => column.header).join('، ')}`);
      const shaped = parsed.map((row, index) => {
        const entry: CaseImportRow = { line: index + 2 };
        for (const column of COLUMNS) {
          const value = String(row[column.header] ?? '').trim();
          if (value) (entry as unknown as Record<string, string>)[column.key] = value;
        }
        return entry;
      });
      setRows(shaped);
      setPreview(await db.importCases(shaped, true));
    } catch (cause) {
      setError(cause instanceof ApiError ? ERRORS[cause.code] ?? 'تعذّرت المعاينة' : (cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await db.importCases(rows, false);
      setDone(result.summary);
      setPreview(null);
      setRows([]);
      if (inputRef.current) inputRef.current.value = '';
    } catch (cause) {
      setError(cause instanceof ApiError ? ERRORS[cause.code] ?? 'تعذّر التنفيذ' : 'تعذّر التنفيذ');
    } finally {
      setBusy(false);
    }
  };

  const flagged = (preview?.rows ?? []).filter((row) => row.status === 'rejected' || row.warnings.length);

  return (
    <div className="rounded-2xl p-8 border bg-info-soft border-info/30 max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-info rounded-full flex items-center justify-center mx-auto mb-4">
          <Briefcase className="h-8 w-8 text-info-foreground" />
        </div>
        <h4 className="text-xl font-bold mb-2 text-info-strong">استيراد القضايا</h4>
        <p className="text-muted-foreground">
          رقمُ القضية واسمُ العميل لازمان. والعميلُ يُطابَق بهويته ثم باسمه، وإن لم يوجد يُنشأ — وتُعرض
          المعاينةُ قبل أن يُكتب شيء.
        </p>
      </div>

      <div className="space-y-4">
        <Button onClick={template} className="w-full" variant="outline" size="lg">تنزيل القالب</Button>
        <Input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(event) => pick(event.target.files?.[0])} />

        {error && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <span>{error}</span>
          </Alert>
        )}

        {preview && (
          <div className="space-y-3">
            <Alert variant={preview.summary.rejected ? 'warning' : 'success'}>
              {preview.summary.rejected ? <TriangleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
              <span>
                المعاينة — لم يُكتب شيء: تُنشأ <bdi>{formatNumber(preview.summary.cases)}</bdi> قضية، ويُنشأ{' '}
                <bdi>{formatNumber(preview.summary.clientsCreated)}</bdi> عميل، ويُربط{' '}
                <bdi>{formatNumber(preview.summary.clientsLinked)}</bdi> بعميلٍ قائم
                {preview.summary.rejected > 0 && <>، ويُرفض <bdi>{formatNumber(preview.summary.rejected)}</bdi> صفّ</>}.
              </span>
            </Alert>
            {flagged.length > 0 && (
              <ul className="rounded border bg-card divide-y divide-border text-sm max-h-64 overflow-y-auto">
                {flagged.map((row) => (
                  <li key={row.line} className="p-2">
                    <span className={row.status === 'rejected' ? 'text-destructive font-medium' : 'text-foreground'}>
                      {`السطر ${isolate(row.line)}`}{row.caseNumber && <> — <bdi>{row.caseNumber}</bdi></>}
                    </span>
                    {[...row.reasons, ...row.warnings].map((text, index) => (
                      <p key={index} className="text-xs text-muted-foreground">{text}</p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={apply} disabled={busy || preview.summary.cases === 0} className="w-full" size="lg">
              {busy ? 'جارٍ التنفيذ' : `تنفيذ — إنشاء ${preview.summary.cases} قضية`}
            </Button>
          </div>
        )}

        {done && (
          <Alert variant={done.failed ? 'warning' : 'success'}>
            <CircleCheck aria-hidden="true" />
            <span>
              استُوردت <bdi>{formatNumber(done.written ?? 0)}</bdi> قضية، وأُنشئ <bdi>{formatNumber(done.clientsCreated)}</bdi> عميل
              {done.failed ? <>، وتعذّر <bdi>{formatNumber(done.failed)}</bdi></> : null}.
            </span>
          </Alert>
        )}
      </div>
    </div>
  );
}
