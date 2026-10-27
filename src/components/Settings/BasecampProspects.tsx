import { useEffect, useState } from 'react';
import { CircleCheck, RefreshCw, Search, SquareKanban, TriangleAlert } from 'lucide-react';

import { db } from '../../data/database';
import { ApiError } from '../../data/api';
import { BasecampBoardStatus, BasecampCardTables, BoardKind } from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { Input } from '@/registry/naf/ui/input';
import { Select } from '@/registry/naf/ui/select';
import { formatDateTime, formatNumber } from '@/registry/naf/lib/format';

/* ═══ لوحاتُ العملاء في بيسكامب ═══
 *
 * مشروعٌ واحد — «إدارة العملاء» — فيه لوحتا بطاقات: العملاء المحتملون
 * والعملاء الفعليون. ومعرّفُه يُدخل هنا لا في الشيفرة، ثم تُختار لكلِّ نوعٍ
 * لوحتُه: يُقترح الاختيارُ من الاسم ويُغيَّر بيد. وكان الإعدادُ يأخذ أوّلَ
 * لوحةٍ في المشروع — ومع لوحتين قد يربط المحتملين بلوحة العملاء.
 *
 * والإعدادُ يطابق الأعمدةَ بحالات «تكوين النظام» وينشئ الناقص منها، ويسجّل
 * Webhook واحداً للمشروع. والاتّجاهُ اثنان، بخلاف ربط المشاريع.
 */

const KINDS: BoardKind[] = ['prospects', 'clients'];
const KIND_TITLE: Record<BoardKind, string> = { prospects: 'العملاء المحتملون', clients: 'العملاء الفعليون' };

const ERRORS: Record<string, string> = {
  invalid_project: 'معرّف المشروع أرقامٌ فقط — من رابطه في بيسكامب',
  project_not_found: 'لا مشروع بهذا المعرّف في الحساب المربوط',
  no_card_table: 'لا لوحة بطاقات (Card Table) في هذا المشروع — فعّلها من أدواته أولاً',
  card_table_not_found: 'اللوحة المختارة لم تعد في المشروع. اقرأ اللوحات ثانيةً',
  choose_card_table: 'اختر لوحةً لنوعٍ واحدٍ على الأقل',
  same_card_table: 'لا تُربط لوحةٌ واحدة للنوعين — اختر لكلٍّ لوحتَه',
  not_configured: 'لم تُعدّ اللوحات بعد',
  not_connected: 'لم يُربط حساب بيسكامب بعد',
  rate_limited: 'تجاوزت المزامنة حدَّ نداءات بيسكامب. أعد المحاولة بعد قليل',
  provider_failed: 'ردّ بيسكامب بخطأ. أعد المحاولة',
};

const say = (error: unknown) =>
  ERRORS[error instanceof ApiError ? error.code : ''] ?? 'تعذّر التنفيذ. أعد المحاولة.';

type Tone = 'success' | 'warning' | 'destructive';

export default function BasecampProspects() {
  const [boards, setBoards] = useState<Partial<Record<BoardKind, BasecampBoardStatus>>>({});
  const [projectId, setProjectId] = useState('');
  const [tables, setTables] = useState<BasecampCardTables | null>(null);
  const [choice, setChoice] = useState<Record<BoardKind, string>>({ prospects: '', clients: '' });
  const [busy, setBusy] = useState<'' | 'read' | 'setup' | 'sync'>('');
  const [message, setMessage] = useState<{ tone: Tone; text: string } | null>(null);

  const load = async () => {
    try {
      const data = await db.getBasecampBoards();
      setBoards(data);
      const configured = KINDS.map((kind) => data[kind]).find((board) => board?.configured);
      if (configured?.projectId) setProjectId((current) => current || configured.projectId || '');
      setChoice((current) => ({
        prospects: current.prospects || data.prospects?.cardTableId || '',
        clients: current.clients || data.clients?.cardTableId || '',
      }));
    } catch {
      setBoards({});
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* والرابطُ كلُّه يُقبل: `…/projects/12345678` — يُؤخذ الرقمُ منه. */
  const cleanId = () => (projectId.match(/projects\/(\d+)/)?.[1] ?? projectId).replace(/\D/g, '');

  const readTables = async () => {
    setBusy('read');
    setMessage(null);
    try {
      const result = await db.getBasecampCardTables(cleanId());
      setTables(result);
      setChoice({
        prospects: result.suggested.prospects ?? '',
        clients: result.suggested.clients ?? '',
      });
    } catch (error) {
      setTables(null);
      setMessage({ tone: 'destructive', text: say(error) });
    } finally {
      setBusy('');
    }
  };

  const setup = async () => {
    setBusy('setup');
    setMessage(null);
    try {
      const result = await db.setupBasecampBoards({
        projectId: cleanId(),
        prospectsTableId: choice.prospects || null,
        clientsTableId: choice.clients || null,
      });
      const lines = KINDS.flatMap((kind) => {
        const done = result[kind];
        if (!done) return [];
        const created = done.columnsCreated.length ? ` وأُنشئت أعمدة: ${done.columnsCreated.join('، ')}.` : '';
        const renamed = done.columnsRenamed?.length ? ` وأُعيدت تسمية: ${done.columnsRenamed.join('، ')}.` : '';
        return [`${KIND_TITLE[kind]} ← «${done.cardTableName}».${created}${renamed}`];
      });
      const webhookFailed = KINDS.some((kind) => result[kind] && !result[kind]?.webhook);
      setMessage({
        tone: webhookFailed ? 'warning' : 'success',
        text: `تم الإعداد: ${lines.join(' ')}${webhookFailed ? ' لكن تعذّر تسجيل الإشعار الفوري — تعمل المزامنة كل ساعة.' : ''}`,
      });
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
      const result = await db.syncBasecampBoards();
      const parts = KINDS.flatMap((kind) => {
        const r = result[kind];
        if (!r) return [];
        return [`${KIND_TITLE[kind]}: ${formatNumber(r.cards)} بطاقة، و${formatNumber(r.created)} جديداً من بيسكامب، و${formatNumber(r.pushed)} بطاقة جديدة من المنصة`
          + (r.conflicts ? `، و${formatNumber(r.conflicts)} اختلافاً` : '')
          + (r.errors ? `، وتعذّر ${formatNumber(r.errors)}` : '')];
      });
      const errors = KINDS.some((kind) => (result[kind]?.errors ?? 0) > 0);
      setMessage({ tone: errors ? 'warning' : 'success', text: `تمت المزامنة — ${parts.join('. ')}.` });
      await load();
    } catch (error) {
      setMessage({ tone: 'destructive', text: say(error) });
    } finally {
      setBusy('');
    }
  };

  const anyConfigured = KINDS.some((kind) => boards[kind]?.configured);
  const sameChoice = Boolean(choice.prospects) && choice.prospects === choice.clients;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start gap-3">
        <SquareKanban className="h-6 w-6 text-primary flex-none" aria-hidden="true" />
        <div>
          <h4 className="font-semibold text-foreground">لوحات العملاء في بيسكامب</h4>
          <p className="text-sm text-muted-foreground">
            لوحتان في مشروع واحد: العملاء المحتملون والعملاء الفعليون. كل حالة عمود، وكل عميل بطاقة. ما يُنشأ أو يُعدَّل
            أو يُعلَّق عليه في أحد الطرفين يظهر في الآخر، والبطاقة التي تُكتب بنصٍّ حرّ في بيسكامب تُستخرج بياناتها آلياً.
          </p>
        </div>
      </div>

      {anyConfigured && (
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {KINDS.map((kind) => {
            const board = boards[kind];
            return (
              <div key={kind} className="rounded-lg bg-muted p-3 space-y-1">
                <p className="font-medium text-foreground">{KIND_TITLE[kind]}</p>
                {board?.configured ? (
                  <>
                    <p className="text-muted-foreground">
                      اللوحة: <span className="text-foreground">{board.cardTableName || board.cardTableId}</span>
                    </p>
                    <p className="text-muted-foreground">
                      مربوطون ببطاقة: <bdi className="text-foreground">{formatNumber(board.linked ?? 0)} / {formatNumber(board.records ?? 0)}</bdi>
                    </p>
                    <p className="flex items-center gap-1 text-muted-foreground">
                      الإشعار الفوري:
                      {board.webhook
                        ? <><CircleCheck className="h-4 w-4 text-success" aria-hidden="true" /> مفعّل</>
                        : <><TriangleAlert className="h-4 w-4 text-warning" aria-hidden="true" /> غير مسجّل</>}
                    </p>
                    <p className="text-muted-foreground">
                      آخر مزامنة: {board.lastSyncAt ? <bdi className="text-foreground">{formatDateTime(new Date(board.lastSyncAt * 1000))}</bdi> : '—'}
                    </p>
                    {board.lastSyncError && (
                      <p className="text-warning-strong">آخر خطأ: <bdi>{board.lastSyncError}</bdi></p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">لم تُعدّ بعد.</p>
                )}
              </div>
            );
          })}
        </div>
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
        <Button onClick={readTables} disabled={busy !== '' || !projectId.trim()} variant="outline">
          <Search className="h-4 w-4" />
          اقرأ اللوحات
        </Button>
        {anyConfigured && (
          <Button onClick={sync} disabled={busy !== ''} variant="outline">
            <RefreshCw className={`h-4 w-4 ${busy === 'sync' ? 'animate-spin' : ''}`} />
            مزامنة الآن
          </Button>
        )}
      </div>

      {tables && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            لوحات مشروع «{tables.projectName}». اختر لكل نوع لوحته — والاختيار مقترح من الاسم.
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {KINDS.map((kind) => (
              <label key={kind} className="space-y-1 text-sm">
                <span className="font-medium text-foreground">{KIND_TITLE[kind]}</span>
                <Select
                  value={choice[kind]}
                  onChange={(event) => setChoice((current) => ({ ...current, [kind]: event.target.value }))}
                >
                  <option value="">— لا تُربط —</option>
                  {tables.tables.map((table) => (
                    <option key={table.id} value={table.id}>{table.title || table.id}</option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
          {sameChoice && (
            <p className="text-sm text-destructive">{ERRORS.same_card_table}</p>
          )}
          <div className="flex justify-end">
            <Button onClick={setup} disabled={busy !== '' || sameChoice || (!choice.prospects && !choice.clients)}>
              <SquareKanban className="h-4 w-4" />
              {anyConfigured ? 'أعد الإعداد' : 'إعداد اللوحات'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
