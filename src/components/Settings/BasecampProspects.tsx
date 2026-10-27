import { useEffect, useState } from 'react';
import { CircleCheck, RefreshCw, SquareKanban, TriangleAlert } from 'lucide-react';

import { db } from '../../data/database';
import { ApiError } from '../../data/api';
import { ProspectBoardStatus } from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { Input } from '@/registry/naf/ui/input';
import { formatDateTime, formatNumber } from '@/registry/naf/lib/format';

/* ═══ لوحةُ العملاء المحتملين ═══
 *
 * مشروعٌ واحد في بيسكامب — «إدارة العملاء» — فيه لوحةُ بطاقات. ومعرّفُه
 * يُدخل هنا لا في الشيفرة. والإعدادُ يطابق الأعمدةَ بحالات «تكوين النظام»
 * وينشئ الناقص منها ومعها عمودُ «تحوّل إلى عميل»، ويسجّل الـWebhook.
 *
 * والاتّجاهُ هنا اثنان، بخلاف ربط المشاريع: ما يُكتب في المنصة يُكتب في
 * البطاقة، وما يُكتب في البطاقة يُكتب في المنصة.
 */

const ERRORS: Record<string, string> = {
  invalid_project: 'معرّف المشروع أرقامٌ فقط — من رابطه في بيسكامب',
  project_not_found: 'لا مشروع بهذا المعرّف في الحساب المربوط',
  no_card_table: 'لا لوحة بطاقات (Card Table) في هذا المشروع — فعّلها من أدواته أولاً',
  not_configured: 'لم تُعدّ اللوحة بعد',
  not_connected: 'لم يُربط حساب بيسكامب بعد',
  rate_limited: 'تجاوزت المزامنة حدَّ نداءات بيسكامب. أعد المحاولة بعد قليل',
  provider_failed: 'ردّ بيسكامب بخطأ. أعد المحاولة',
};

const say = (error: unknown) =>
  ERRORS[error instanceof ApiError ? error.code : ''] ?? 'تعذّر التنفيذ. أعد المحاولة.';

export default function BasecampProspects() {
  const [status, setStatus] = useState<ProspectBoardStatus | null>(null);
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState<'' | 'setup' | 'sync'>('');
  const [message, setMessage] = useState<{ tone: 'success' | 'warning' | 'destructive'; text: string } | null>(null);

  const load = async () => {
    try {
      const data = await db.getProspectBoard();
      setStatus(data);
      if (data.projectId) setProjectId(data.projectId);
    } catch {
      setStatus({ configured: false });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setup = async () => {
    /* والرابطُ كلُّه يُقبل: `…/projects/12345678` — يُؤخذ الرقمُ منه. */
    const id = (projectId.match(/projects\/(\d+)/)?.[1] ?? projectId).replace(/\D/g, '');
    setBusy('setup');
    setMessage(null);
    try {
      const result = await db.setupProspectBoard(id);
      const created = result.columnsCreated.length
        ? ` وأُنشئت ${formatNumber(result.columnsCreated.length)} أعمدة: ${result.columnsCreated.join('، ')}.`
        : '';
      const renamed = result.columnsRenamed?.length
        ? ` وأُعيدت تسمية ${formatNumber(result.columnsRenamed.length)} أعمدة قديمة: ${result.columnsRenamed.join('، ')}.`
        : '';
      setMessage(result.webhook
        ? { tone: 'success', text: `تم ربط «${result.projectName}».${created}${renamed}` }
        : { tone: 'warning', text: `تم ربط «${result.projectName}»${created}${renamed} لكن تعذّر تسجيل الإشعار الفوري — تعمل المزامنة كل ساعة.` });
      await load();
    } catch (error) {
      setMessage({ tone: 'destructive', text: say(error) });
    } finally {
      setBusy('');
    }
  };

  const sync = async () => {
    setBusy('sync');
    setMessage(null);
    try {
      const result = await db.syncProspectBoard();
      setMessage({
        tone: result.errors ? 'warning' : 'success',
        text: `تمت المزامنة: ${formatNumber(result.cards)} بطاقة، و${formatNumber(result.created)} عميلاً جديداً من بيسكامب، و${formatNumber(result.pushed)} بطاقة جديدة من المنصة`
          + (result.conflicts ? `، و${formatNumber(result.conflicts)} اختلافاً ينتظر قرارك` : '')
          + (result.errors ? `، وتعذّر ${formatNumber(result.errors)}` : '') + '.',
      });
      await load();
    } catch (error) {
      setMessage({ tone: 'destructive', text: say(error) });
    } finally {
      setBusy('');
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <SquareKanban className="h-6 w-6 text-primary flex-none" aria-hidden="true" />
        <div>
          <h4 className="font-semibold text-foreground">لوحة العملاء المحتملين</h4>
          <p className="text-sm text-muted-foreground">
            كل حالة عمودٌ في لوحة بطاقات المشروع، وكل عميل محتمل بطاقة. ما يُنشأ أو يُعدَّل أو يُعلَّق عليه في أحد
            الطرفين يظهر في الآخر، والبطاقة التي تُكتب بنصٍّ حرّ في بيسكامب تُستخرج بياناتها آلياً.
          </p>
        </div>
      </div>

      {status?.configured && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">المشروع</p>
            <p className="font-medium text-foreground">{status.projectName || status.projectId}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">مربوطون ببطاقة</p>
            <p className="font-medium text-foreground">
              <bdi>{formatNumber(status.linked ?? 0)} / {formatNumber(status.prospects ?? 0)}</bdi>
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">الإشعار الفوري</p>
            <p className="flex items-center gap-1 font-medium text-foreground">
              {status.webhook
                ? <><CircleCheck className="h-4 w-4 text-success" aria-hidden="true" /> مفعّل</>
                : <><TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" /> غير مسجّل</>}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">آخر مزامنة</p>
            <p className="font-medium text-foreground">
              {status.lastSyncAt ? <bdi>{formatDateTime(new Date(status.lastSyncAt * 1000))}</bdi> : '—'}
            </p>
          </div>
        </div>
      )}

      {status?.lastSyncError && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <span>آخر خطأ: <bdi>{status.lastSyncError}</bdi></span>
        </Alert>
      )}

      {message && (
        <Alert variant={message.tone}>
          {message.tone === 'success' ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
          <span>{message.text}</span>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          placeholder="معرّف المشروع أو رابطه في بيسكامب"
          dir="ltr"
          className="sm:max-w-sm"
        />
        <Button onClick={setup} disabled={busy !== '' || !projectId.trim()}>
          <SquareKanban className="h-4 w-4" />
          {status?.configured ? 'أعد الإعداد' : 'إعداد اللوحة'}
        </Button>
        {status?.configured && (
          <Button onClick={sync} disabled={busy !== ''} variant="outline">
            <RefreshCw className={`h-4 w-4 ${busy === 'sync' ? 'animate-spin' : ''}`} />
            مزامنة الآن
          </Button>
        )}
      </div>
    </Card>
  );
}
