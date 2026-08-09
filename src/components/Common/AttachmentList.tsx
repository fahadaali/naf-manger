import { useRef, useState } from 'react';
import { Download, FileText, Image, Paperclip, Trash2, TriangleAlert } from 'lucide-react';

import { Attachment } from '../../types';
import { fileUrl, uploadFile } from '../../data/api';
import { Button } from '@/registry/naf/ui/button';
import { Alert } from '@/registry/naf/ui/alert';
import { formatNumber } from '@/registry/naf/lib/format';

/* ═══ المرفقات ═══
 *
 * العمود `attachments` في ثلاثة جداول، والنوع، وخريطةُ الحقل في
 * `worker/lib/resources.js`، ومسارُ `‎/api/files‎` في الـWorker، وحاويةُ R2
 * في `wrangler.toml` — كلُّها كانت مبنيّةً وصفرُ واجهةٍ تُضيف مرفقاً أو
 * تعرضه. والنماذج تمرّر ما وجدت كما وجدته، فيبقى الحقل `[]` أبداً.
 *
 * والبايتات في الحاوية والمفتاحُ في الصفّ: مرفقٌ من عشرة ميغابايت لا
 * يُنقل مع كل قراءةِ سطر.
 */

/* الحدود مرآةُ `ATTACHMENT` في `worker/lib/files.js` — والخادم هو الحاكم.
   وهذا الفحص ليقول للرافع قبل أن ينتظر الرفع، لا ليقوم مقامه. */
const ACCEPTED: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};
const MAX_BYTES = 10 * 1024 * 1024;

/** حجمٌ يقرؤه إنسان. والأرقام غربية كما في `naf-format`. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} بايت`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} كيلوبايت`;
  return `${formatNumber(Math.round((bytes / (1024 * 1024)) * 10) / 10)} ميجابايت`;
}

interface AttachmentListProps {
  value: Attachment[];
  onChange?: (next: Attachment[]) => void;
  /** للعرض وحده — بلا رفعٍ ولا حذف. */
  readOnly?: boolean;
}

export default function AttachmentList({ value, onChange, readOnly = false }: AttachmentListProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const items = value ?? [];

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files ?? []);
    if (!chosen.length) return;

    setError('');
    setBusy(true);
    const added: Attachment[] = [];
    const rejected: string[] = [];

    /* واحداً بعد واحد لا دفعةً متوازية: عشرةُ ملفّاتٍ بعشرة ميغابايت
       تُغرق الرفع، والتتابع يُبقي أثرَ ما نجح إن سقط ما بعده. */
    for (const file of chosen) {
      if (!(file.type in ACCEPTED)) {
        rejected.push(`${file.name}: صيغة غير مقبولة`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name}: أكبر من 10 ميجابايت`);
        continue;
      }
      try {
        const uploaded = await uploadFile(file, 'attachment');
        added.push({
          id: uploaded.key,
          name: file.name,
          type: uploaded.type,
          key: uploaded.key,
          size: uploaded.size,
          uploadedAt: new Date().toISOString(),
        });
      } catch (uploadError) {
        console.error('تعذّر رفع المرفق:', uploadError);
        rejected.push(`${file.name}: تعذّر الرفع`);
      }
    }

    if (added.length) onChange?.([...items, ...added]);
    setError(rejected.join('، '));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  /* الحذف يرفع المرفق من الصفّ ولا يمسّ الكائن في الحاوية: الصفُّ قد لا
     يُحفظ بعدُ — من ضغط «إلغاء» في النموذج يجب أن يجد مرفقَه كما كان. */
  const remove = (key: string) => onChange?.(items.filter((item) => item.key !== key));

  return (
    <div className="space-y-3">
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = item.type.startsWith('image/') ? Image : FileText;
            return (
              <li
                key={item.key}
                className="flex items-center gap-3 p-3 bg-muted rounded-lg"
              >
                <Icon className="h-5 w-5 flex-none text-muted-foreground" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ACCEPTED[item.type] ?? item.type} · <bdi>{humanSize(item.size)}</bdi>
                  </p>
                </div>
                <a
                  href={fileUrl(item.key)}
                  target="_blank"
                  rel="noreferrer"
                  title="فتح المرفق"
                  className="p-2 rounded-sm text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                </a>
                {!readOnly && (
                  <Button
                    onClick={() => remove(item.key)}
                    className="text-destructive hover:text-destructive-strong"
                    title="حذف المرفق"
                    variant="ghost"
                    size="icon-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">لا مرفقات</p>
      )}

      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={Object.keys(ACCEPTED).join(',')}
            onChange={handleSelect}
            className="hidden"
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            variant="outline"
            size="sm"
          >
            <Paperclip className="h-4 w-4" />
            {busy ? 'جارٍ الرفع' : 'إضافة مرفق'}
          </Button>
          <p className="text-xs text-muted-foreground">
            PDF أو Word أو Excel أو صورة (أقل من 10 ميجابايت)
          </p>
        </>
      )}

      {error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <span>{error}</span>
        </Alert>
      )}
    </div>
  );
}
