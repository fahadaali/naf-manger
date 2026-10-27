import { useEffect, useState } from 'react';
import { ExternalLink, MessageSquare, Send } from 'lucide-react';
import { BoardKind, ProspectComment } from '../../types';
import { db } from '../../data/database';
import { formatDateTime } from '@/registry/naf/lib/format';
import { Textarea } from '@/registry/naf/ui/textarea';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';

/* ═══ التعليقات ═══
 *
 * سجلٌّ يُضاف إليه لا حقلٌ يُكتب فوقه — والملاحظةُ في النموذج هي الحقل.
 * وما يُكتب هنا يصل بطاقةَ العميل في بيسكامب، وما يُكتب تحت البطاقة هناك
 * يظهر هنا، وشارةُ كلِّ تعليقٍ تقول من أين جاء.
 */
/* والمكوّنُ واحدٌ للمحتمل والعميل: `kind` يقول أيَّ جدولٍ وأيَّ لوحة. */
export default function ProspectComments({
  prospectId,
  canComment,
  kind = 'prospects',
}: {
  prospectId: string;
  canComment: boolean;
  kind?: BoardKind;
}) {
  const [comments, setComments] = useState<ProspectComment[]>([]);
  const [basecampUrl, setBasecampUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    db.getComments(kind, prospectId)
      .then((data) => {
        if (!alive) return;
        setComments(data.comments);
        setBasecampUrl(data.basecampUrl);
      })
      .catch(() => alive && setError('تعذّر تحميل التعليقات.'));
    return () => { alive = false; };
  }, [kind, prospectId]);

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError('');
    try {
      const added = await db.addComment(kind, prospectId, body);
      setComments((list) => [...list, added]);
      setDraft('');
    } catch {
      setError('تعذّر حفظ التعليق. أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <MessageSquare className="h-5 w-5" aria-hidden="true" />
          التعليقات
        </h3>
        {basecampUrl && (
          <a
            href={basecampUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            البطاقة في بيسكامب
          </a>
        )}
      </div>

      {comments.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">لا تعليقات بعد.</p>
      )}

      <ul className="space-y-3">
        {comments.map((comment) => (
          <li key={comment.id} className="rounded-lg bg-muted p-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{comment.authorName || '—'}</span>
              <Badge variant={comment.source === 'basecamp' ? 'info' : 'default'}>
                {comment.source === 'basecamp' ? 'من بيسكامب' : 'من المنصة'}
              </Badge>
              <bdi className="ms-auto">{formatDateTime(new Date(comment.createdAt * 1000))}</bdi>
            </div>
            <p className="text-sm text-foreground whitespace-pre-line break-words">{comment.body}</p>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canComment && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="اكتب تعليقاً"
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={busy || !draft.trim()} size="sm">
              <Send className="h-4 w-4" />
              إضافة تعليق
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
