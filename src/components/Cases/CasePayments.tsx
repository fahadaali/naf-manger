import { useEffect, useState } from 'react';
import { Banknote, Trash2, TriangleAlert } from 'lucide-react';
import { ClientPayment } from '../../types';
import { db } from '../../data/database';
import { ApiError } from '../../data/api';
import { useAuth } from '../../contexts/AuthContext';
import { Money } from '@/registry/naf/currency/money';
import { formatDate } from '@/registry/naf/lib/format';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Alert } from '@/registry/naf/ui/alert';

/* طرقُ الدفع كما يقولها المكتب — نصٌّ يُحفظ كما هو، لا رمزٌ تقرؤه إحصاءات. */
const METHODS = ['تحويل بنكي', 'نقد', 'شيك', 'بطاقة'];

const SOURCE_LABEL: Record<ClientPayment['source'], string> = {
  manual: '',
  opening: 'رصيد افتتاحي',
  wafeq: 'من وافق',
};

const ERROR_TEXT: Record<string, string> = {
  invalid_amount: 'أدخل مبلغاً أكبر من صفر',
  pro_bono_case: 'القضية تطوّعية — لا دفعات عليها',
  external_payment: 'هذه الدفعة من وافق — تُصحَّح هناك',
  forbidden: 'لا تملك صلاحية هذا',
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyDraft = () => ({ amount: '', paymentDate: today(), method: METHODS[0], reference: '', notes: '' });

interface CasePaymentsProps {
  caseId: string;
  /** يُنادى بالمحصَّل الجديد بعد كل إضافةٍ أو حذف — كما حسبه الخادم. */
  onCollectedChange: (collected: number) => void;
}

/**
 * ═══ دفعاتُ العميل على القضية ═══
 *
 * سجلٌّ يُضاف إليه ويُحذف منه، ولا يُعدَّل: دفعةٌ أخطأ كاتبُها تُحذف وتُكتب
 * صحيحة. والمحصَّلُ مجموعُها يحسبه الخادم — فبعد كل فعلٍ تُقرأ القضيةُ
 * ثانيةً، ولا يُجمع هنا رقمٌ قد يخالف ما في القاعدة.
 */
export default function CasePayments({ caseId, onCollectedChange }: CasePaymentsProps) {
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setPayments(await db.getClientPayments({ caseId }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const refreshCollected = async () => {
    const fresh = await db.getCase(caseId);
    onCollectedChange(fresh.paymentStatus?.collectedAmount ?? 0);
  };

  const explain = (cause: unknown, fallback: string) =>
    setError((cause instanceof ApiError && ERROR_TEXT[cause.code]) || fallback);

  const record = async () => {
    setError('');
    const amount = parseFloat(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setError(ERROR_TEXT.invalid_amount);

    setBusy(true);
    try {
      await db.createClientPayment({
        caseId,
        amount,
        paymentDate: new Date(draft.paymentDate),
        method: draft.method,
        reference: draft.reference,
        notes: draft.notes,
      });
      setDraft(emptyDraft());
      setAdding(false);
      await Promise.all([load(), refreshCollected()]);
    } catch (cause) {
      explain(cause, 'تعذّر تسجيل الدفعة. أعد المحاولة');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (payment: ClientPayment) => {
    if (!window.confirm(`حذف دفعة بمبلغ ${payment.amount} ريال؟ يُعاد حسابُ المحصَّل.`)) return;
    setError('');
    setBusy(true);
    try {
      await db.deleteClientPayment(payment.id);
      await Promise.all([load(), refreshCollected()]);
    } catch (cause) {
      explain(cause, 'تعذّر حذف الدفعة. أعد المحاولة');
    } finally {
      setBusy(false);
    }
  };

  const mayAdd = hasPermission('cases', 'create');
  const mayDelete = hasPermission('cases', 'delete');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h5 className="font-medium text-foreground flex items-center gap-2">
          <Banknote className="h-4 w-4" aria-hidden="true" />
          سجل الدفعات
        </h5>
        {mayAdd && (
          <Button
            type="button"
            onClick={() => { setAdding((open) => !open); setError(''); }}
            variant={adding ? 'ghost' : 'outline'}
            size="sm"
          >
            {adding ? 'إلغاء' : 'تسجيل دفعة'}
          </Button>
        )}
      </div>

      {adding && (
        <div className="bg-card rounded border p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">المبلغ بالريال</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={draft.amount}
                onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">تاريخ الدفع</label>
              <Input
                type="date"
                value={draft.paymentDate}
                onChange={(e) => setDraft((prev) => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">الطريقة</label>
              <Select
                value={draft.method}
                onChange={(e) => setDraft((prev) => ({ ...prev, method: e.target.value }))}
              >
                {METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">المرجع</label>
              <Input
                type="text"
                value={draft.reference}
                onChange={(e) => setDraft((prev) => ({ ...prev, reference: e.target.value }))}
                placeholder="رقم الحوالة أو الإيصال"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">ملاحظات</label>
              <Input
                type="text"
                value={draft.notes}
                onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="اختياري"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={record} disabled={busy}>
              {busy ? 'جارٍ التسجيل' : 'تسجيل الدفعة'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <span>{error}</span>
        </Alert>
      )}

      {payments.length > 0 ? (
        <ul className="divide-y divide-border rounded border bg-card">
          {payments.map((payment) => (
            <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  <Money value={payment.amount} />
                  {payment.method && <span className="text-muted-foreground"> · {payment.method}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  <bdi>{formatDate(payment.paymentDate)}</bdi>
                  {payment.reference && <> · <bdi>{payment.reference}</bdi></>}
                  {payment.notes && <> · {payment.notes}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {SOURCE_LABEL[payment.source] && (
                  <Badge variant="outline">{SOURCE_LABEL[payment.source]}</Badge>
                )}
                {mayDelete && payment.source !== 'wafeq' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(payment)}
                    disabled={busy}
                    aria-label="حذف الدفعة"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">لا دفعاتٌ مسجَّلة بعد.</p>
      )}
    </div>
  );
}
