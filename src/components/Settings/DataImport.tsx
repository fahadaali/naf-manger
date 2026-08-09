import { useRef, useState } from 'react';
import { CircleCheck, FileText, TriangleAlert, Users } from 'lucide-react';
import { db } from '../../data/database';
import { Client, Prospect } from '../../types';
import { downloadText, parseCsv, toCsv } from '../../lib/csv';
import { Button } from '@/registry/naf/ui/button';
import { Input } from '@/registry/naf/ui/input';
import { Alert } from '@/registry/naf/ui/alert';
import { formatNumber, isolate } from '@/registry/naf/lib/format';

/* ═══ الاستيراد يقع فعلاً ═══
 *
 * كانت هذه الشاشة أربعةَ أزرارٍ بلا `onClick` وحقلَي ملفٍّ بلا `onChange`:
 * يُختار الملفّ ويُضغط «رفع الملف» ولا يقع شيء ولا تُقال كلمة.
 *
 * والأعمدة هنا مرآةُ ما يُصدِّره `DataExport` حرفاً بحرف — فما خرج من
 * المنصة يعود إليها بلا تحرير. وهي عربيةٌ لأن من يفتح الملفّ يقرؤها.
 *
 * ولا حزمة `xlsx`: الصيغة CSV، وهي ما يُصدَّر أصلاً، ويفتحها Excel جدولاً.
 */

/** عمودٌ في القالب: عنوانُه العربي، وأين يقع من الصفّ، وهل هو لازم. */
interface Column<T> {
  header: string;
  required?: boolean;
  apply: (target: T, value: string) => void;
  sample: string;
}

const CLIENT_COLUMNS: Column<Partial<Client>>[] = [
  { header: 'الاسم الكامل', required: true, sample: 'محمد عبدالله', apply: (t, v) => { t.fullName = v; } },
  { header: 'رقم الهوية', required: true, sample: '1012345678', apply: (t, v) => { t.idNumber = v; } },
  { header: 'رقم الجوال', sample: '0501234567', apply: (t, v) => { t.phone = v; } },
  { header: 'البريد الإلكتروني', sample: 'name@example.com', apply: (t, v) => { t.email = v; } },
  {
    header: 'نوع العميل',
    sample: 'individual',
    apply: (t, v) => { t.clientType = (v || 'individual') as Client['clientType']; }
  },
  {
    header: 'حالة العميل',
    sample: 'current',
    apply: (t, v) => { t.status = (v || 'current') as Client['status']; }
  },
  { header: 'السجل التجاري', sample: '', apply: (t, v) => { if (v) t.commercialRegister = v; } },
  { header: 'الملاحظات', sample: '', apply: (t, v) => { t.notes = v; } }
];

const PROSPECT_COLUMNS: Column<Partial<Prospect>>[] = [
  { header: 'الاسم الكامل', required: true, sample: 'سارة أحمد', apply: (t, v) => { t.fullName = v; } },
  { header: 'رقم الهوية', required: true, sample: '1087654321', apply: (t, v) => { t.idNumber = v; } },
  { header: 'رقم الجوال', sample: '0559876543', apply: (t, v) => { t.phone = v; } },
  { header: 'البريد الإلكتروني', sample: 'name@example.com', apply: (t, v) => { t.email = v; } },
  {
    header: 'نوع العميل',
    sample: 'individual',
    apply: (t, v) => { t.clientType = (v || 'individual') as Prospect['clientType']; }
  },
  { header: 'حالة العميل المحتمل', sample: 'مهتم', apply: (t, v) => { t.prospectStatus = v; } },
  { header: 'المصدر', sample: 'إعلان', apply: (t, v) => { if (v) t.source = v; } },
  { header: 'الملاحظات', sample: '', apply: (t, v) => { t.notes = v; } }
];

interface Outcome {
  imported: number;
  failed: { line: number; reason: string }[];
}

/** لوحُ استيرادٍ واحد — يخدم العملاء والمحتملين بالبنية نفسها. */
function ImportPanel<T>({
  title,
  hint,
  columns,
  create,
  tone,
  Icon
}: {
  title: string;
  hint: string;
  columns: Column<Partial<T>>[];
  create: (row: Partial<T>) => Promise<unknown>;
  tone: 'primary' | 'success';
  Icon: typeof Users;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState('');

  const headers = columns.map((column) => column.header);

  const downloadTemplate = () => {
    const sample: Record<string, string> = {};
    for (const column of columns) sample[column.header] = column.sample;
    downloadText(toCsv(headers, [sample]), `${title}.csv`, 'text/csv;charset=utf-8');
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setOutcome(null);

    try {
      const rows = parseCsv(await file.text());
      if (!rows.length) {
        setError('الملفّ فارغ أو لا يحمل ترويسة');
        return;
      }

      const missing = columns
        .filter((column) => column.required && !(column.header in rows[0]))
        .map((column) => column.header);
      if (missing.length) {
        setError(`أعمدة ناقصة: ${missing.join('، ')}`);
        return;
      }

      const result: Outcome = { imported: 0, failed: [] };

      /* واحداً بعد واحد لا دفعةً: `‎/api/*‎` مسارُ صفٍّ واحد، والتوازي على
         عشرات الصفوف يُغرق الـWorker. والسطرُ الساقط يُسجَّل ولا يوقف من
         بعده — ملفٌّ فيه صفٌّ خاطئ يُستورد باقيه ويُقال ما سقط. */
      for (const [index, row] of rows.entries()) {
        const line = index + 2; // ١ للترويسة و١ لأن العدّ يبدأ من واحد
        const draft: Partial<T> = {};
        for (const column of columns) column.apply(draft, row[column.header] ?? '');

        const blank = columns.find(
          (column) => column.required && !String(row[column.header] ?? '').trim()
        );
        if (blank) {
          result.failed.push({ line, reason: `${blank.header} مطلوب` });
          continue;
        }

        try {
          await create(draft);
          result.imported++;
        } catch (rowError) {
          const code = (rowError as { code?: string })?.code ?? 'تعذّر الحفظ';
          result.failed.push({ line, reason: code === 'duplicate' ? 'رقم الهوية مكرّر' : code });
        }
      }

      setOutcome(result);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (readError) {
      console.error('تعذّر قراءة الملفّ:', readError);
      setError('تعذّر قراءة الملفّ. تأكّد أنه CSV');
    } finally {
      setBusy(false);
    }
  };

  const soft = tone === 'primary' ? 'bg-primary-soft border-primary/30' : 'bg-success-soft border-success/30';
  const solid = tone === 'primary' ? 'bg-primary' : 'bg-success';
  const fg = tone === 'primary' ? 'text-primary-foreground' : 'text-success-foreground';
  const strong = tone === 'primary' ? 'text-primary-strong' : 'text-success-strong';

  return (
    <div className={`rounded-2xl p-8 border ${soft}`}>
      <div className="text-center mb-6">
        <div className={`w-16 h-16 ${solid} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Icon className={`h-8 w-8 ${fg}`} />
        </div>
        <h4 className={`text-xl font-bold mb-2 ${strong}`}>{title}</h4>
        <p className="text-muted-foreground">{hint}</p>
      </div>

      <div className="space-y-4">
        <Button onClick={downloadTemplate} className="w-full" variant="outline" size="lg">
          تنزيل القالب
        </Button>

        <Input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setOutcome(null);
            setError('');
          }}
        />

        <Button
          onClick={run}
          disabled={!file || busy}
          className="w-full"
          variant={tone === 'primary' ? 'default' : 'success'}
          size="lg"
        >
          {busy ? 'جارٍ الاستيراد' : 'استيراد الملفّ'}
        </Button>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <span>{error}</span>
          </Alert>
        )}

        {outcome && (
          <Alert variant={outcome.failed.length ? 'warning' : 'success'}>
            {outcome.failed.length ? <TriangleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
            <div className="space-y-1">
              <p>
                استُورد <bdi>{formatNumber(outcome.imported)}</bdi> صفّاً
                {outcome.failed.length > 0 && (
                  <> وسقط <bdi>{formatNumber(outcome.failed.length)}</bdi></>
                )}
              </p>
              {outcome.failed.slice(0, 5).map((failure) => (
                <p key={failure.line} className="text-xs">
                  {`السطر ${isolate(failure.line)}: ${failure.reason}`}
                </p>
              ))}
              {outcome.failed.length > 5 && (
                <p className="text-xs">{`و${isolate(outcome.failed.length - 5)} غيرها`}</p>
              )}
            </div>
          </Alert>
        )}
      </div>
    </div>
  );
}

export default function DataImport() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground mb-2">استيراد البيانات</h3>
        <p className="text-muted-foreground">
          نزّل القالب، املأه، ثم ارفعه. والأعمدة هي نفسها التي يُصدِّرها تبويب «تصدير
          البيانات» — فما خرج يعود.
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        <ImportPanel<Client>
          title="استيراد العملاء"
          hint="الاسم الكامل ورقم الهوية مطلوبان"
          columns={CLIENT_COLUMNS}
          create={(row) => db.createClient(row as Omit<Client, 'id'>)}
          tone="primary"
          Icon={Users}
        />
        <ImportPanel<Prospect>
          title="استيراد العملاء المحتملين"
          hint="الاسم الكامل ورقم الهوية مطلوبان"
          columns={PROSPECT_COLUMNS}
          create={(row) => db.createProspect(row as Omit<Prospect, 'id'>)}
          tone="success"
          Icon={FileText}
        />
      </div>

      {/* القضايا لا تُستورد بعد: الصفُّ يشير إلى عميلٍ بمعرّفه، ومطابقةُ
          العميل من ملفٍّ تحتاج قراراً — بالهوية أم بالاسم، وما العمل إن
          تعدّد المطابق. وهو عملٌ يبدأ من ذلك القرار لا من نموذجٍ في شاشة. */}
    </div>
  );
}
