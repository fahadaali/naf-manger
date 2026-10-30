import { useEffect, useState } from 'react';
import { CalendarRange, ChevronDown, Pencil, Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { ClientContract, ContractFrequency, ContractRateChange, ContractSummary } from '../../types';
import { db } from '../../data/database';
import { ApiError } from '../../data/api';
import { useAuth } from '../../contexts/AuthContext';
import { Money } from '@/registry/naf/currency/money';
import { formatDate, formatNumber } from '@/registry/naf/lib/format';
import { contractFrequencyLabel, contractStatusLabel } from '../../lib/labels';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Input } from '@/registry/naf/ui/input';
import { Select } from '@/registry/naf/ui/select';

const FREQUENCIES: ContractFrequency[] = ['monthly', 'quarterly', 'semiannual', 'annual'];

const todayIso = () => new Date().toISOString().slice(0, 10);

/* نهايةُ سنةٍ من البداية — اليومُ الذي يسبق ذكراها، كما يحسبها الخادم. */
function yearEnd(start: string): string {
  const [y, m, d] = start.split('-').map(Number);
  if (!y || !m || !d) return '';
  const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
  const anniversary = Date.UTC(y + 1, m - 1, Math.min(d, last));
  return new Date(anniversary - 86400000).toISOString().slice(0, 10);
}

const STATUS_VARIANT: Record<ContractSummary['status'], 'success' | 'warning' | 'destructive' | 'info'> = {
  active: 'success',
  expiring: 'warning',
  expired: 'destructive',
  upcoming: 'info',
};

const INSTALLMENT: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'default' }> = {
  paid: { label: 'مسدَّدة', variant: 'success' },
  partial: { label: 'مسدَّدة جزئياً', variant: 'warning' },
  overdue: { label: 'متأخّرة', variant: 'destructive' },
  upcoming: { label: 'لم تحلّ', variant: 'default' },
};

/* رموزُ الخادم بعبارة المكتب. */
const ERRORS: Record<string, string> = {
  contract_overlap: 'للعميل عقدٌ آخر في هذه المدّة — العقدان لا يتداخلان',
  end_before_start: 'تاريخ النهاية قبل تاريخ البداية',
  invalid_date: 'تاريخٌ غير صحيح',
  invalid_amount: 'المبلغ غير صحيح',
  forbidden: 'لا تملك صلاحية تعديل العملاء',
};
const messageOf = (error: unknown) =>
  (error instanceof ApiError && ERRORS[error.code]) || 'تعذّر الحفظ — أعد المحاولة';

interface Draft {
  startDate: string;
  endDate: string;
  frequency: ContractFrequency;
  amount: string;
  notes: string;
  rateChanges: { from: string; amount: string }[];
}

const emptyDraft = (): Draft => {
  const start = todayIso();
  return { startDate: start, endDate: yearEnd(start), frequency: 'monthly', amount: '', notes: '', rateChanges: [] };
};

const draftOf = (contract: ClientContract): Draft => ({
  startDate: contract.startDate,
  endDate: contract.endDate,
  frequency: contract.frequency,
  amount: String(contract.amount),
  notes: contract.notes,
  rateChanges: contract.rateChanges.map((change) => ({ from: change.from, amount: String(change.amount) })),
});

interface ClientContractsProps {
  clientId: string;
  /** العقدُ يُبدّل قضايا الموكّل (عملٌ قانونيّ) — فتُعاد قراءتُها. */
  onChanged?: () => void;
}

/**
 * ═══ العقدُ السنويّ للموكّل ═══
 *
 * بدايةٌ ونهاية ودفعةٌ تتكرّر، وتعديلُ مبلغها من تاريخٍ ما (بعد عشرة أشهر مثلاً)،
 * وتجديدُه لسنةٍ تالية بمبلغٍ جديد. والجدولُ والمتأخّرُ والمتبقّي يحسبها الخادم —
 * هنا تُعرض ولا تُحسب. وقضايا المتعاقد تصير «عملاً قانونياً» بأتعاب «عقد سنوي».
 */
export default function ClientContracts({ clientId, onChanged }: ClientContractsProps) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('clients', 'update');

  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [loaded, setLoaded] = useState(false);
  /* `new` لعقدٍ جديد، أو معرّفُ عقدٍ يُعدَّل. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    db.getContracts(clientId).then((rows) => {
      if (!alive) return;
      setContracts(rows);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [clientId]);

  /* العقدُ الراجعُ من الخادم يحلّ محلّ نسخته، أو يُضاف أوّلاً. */
  const put = (contract: ClientContract) =>
    setContracts((list) => [contract, ...list.filter((entry) => entry.id !== contract.id)]
      .sort((a, b) => b.startDate.localeCompare(a.startDate)));

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };

  const openNew = () => { setDraft(emptyDraft()); setEditing('new'); setError(''); };
  const openEdit = (contract: ClientContract) => { setDraft(draftOf(contract)); setEditing(contract.id); setError(''); };

  const save = () => run(async () => {
    const amount = Number(draft.amount);
    if (!draft.amount || !Number.isFinite(amount) || amount < 0) throw new ApiError('invalid_amount', 400);
    const rateChanges: ContractRateChange[] = draft.rateChanges
      .filter((change) => change.from && change.amount !== '')
      .map((change) => ({ from: change.from, amount: Number(change.amount) }));
    const terms = {
      startDate: draft.startDate,
      endDate: draft.endDate,
      frequency: draft.frequency,
      amount,
      notes: draft.notes,
      rateChanges,
    };
    put(editing === 'new'
      ? await db.createContract({ clientId, ...terms })
      : await db.updateContract(editing as string, terms));
    setEditing(null);
    onChanged?.();
  });

  const remove = (contract: ClientContract) => {
    if (!window.confirm('حذف العقد ودفعاته المسجّلة؟ قضايا العميل تبقى «عملاً قانونياً».')) return;
    run(async () => {
      await db.deleteContract(contract.id);
      setContracts((list) => list.filter((entry) => entry.id !== contract.id));
    });
  };

  const renew = (contract: ClientContract) => {
    const answer = window.prompt(
      `تجديد العقد لسنةٍ تبدأ ${formatDate(contract.endDate)} + يوم.\nمبلغ الدفعة الجديد بالريال:`,
      String(contract.summary.installments[contract.summary.installments.length - 1]?.amount ?? contract.amount),
    );
    if (answer === null) return;
    run(async () => {
      put(await db.renewContract(contract.id, { amount: Number(answer) }));
      onChanged?.();
    });
  };

  if (!loaded) return null;
  if (!contracts.length && !canEdit) return null;

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => {
      const next = { ...current, [key]: value };
      /* تغييرُ البداية يُزحزح النهاية معها ما دامت سنةً كاملة — لا ما عُدّل بيد. */
      if (key === 'startDate' && current.endDate === yearEnd(current.startDate)) next.endDate = yearEnd(String(value));
      return next;
    });

  return (
    <div className="bg-info-soft rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CalendarRange className="h-5 w-5" aria-hidden="true" />
          العقد السنوي
        </h3>
        {canEdit && editing === null && (
          <Button type="button" size="sm" variant="outline" onClick={openNew}>
            <Plus aria-hidden="true" />
            عقد جديد
          </Button>
        )}
      </div>

      {!contracts.length && editing === null && (
        <p className="text-sm text-muted-foreground">
          لا عقدَ سنويّ لهذا العميل. ومتى أُضيف صارت قضاياه كلُّها «عملاً قانونياً» بأتعاب «عقد سنوي».
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive-strong flex items-center gap-2">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" />
          {error}
        </p>
      )}

      {editing !== null && (
        <div className="bg-card rounded-lg border p-4 space-y-3">
          <h4 className="font-medium text-foreground">{editing === 'new' ? 'عقد سنوي جديد' : 'تعديل العقد'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block font-medium text-foreground mb-1">تاريخ البداية</span>
              <Input type="date" value={draft.startDate} onChange={(e) => setField('startDate', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="block font-medium text-foreground mb-1">تاريخ النهاية</span>
              <Input type="date" value={draft.endDate} onChange={(e) => setField('endDate', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="block font-medium text-foreground mb-1">تكرار الدفعة</span>
              <Select value={draft.frequency} onChange={(e) => setField('frequency', e.target.value as ContractFrequency)}>
                {FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>{contractFrequencyLabel(frequency)}</option>
                ))}
              </Select>
            </label>
            <label className="block text-sm">
              <span className="block font-medium text-foreground mb-1">مبلغ الدفعة بالريال</span>
              <Input type="number" min="0" value={draft.amount} onChange={(e) => setField('amount', e.target.value)} placeholder="5000" />
            </label>
          </div>

          {/* ═══ تعديلُ المبلغ في أثناء العقد ═══ كلُّ دفعةٍ تحلّ في التاريخ أو بعده تأخذه. */}
          {editing !== 'new' && (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-foreground">تعديل مبلغ الدفعة في أثناء العقد</span>
              {draft.rateChanges.map((change, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    <span className="block text-muted-foreground mb-1">ابتداءً من</span>
                    <Input type="date" value={change.from}
                      onChange={(e) => setField('rateChanges', draft.rateChanges.map((entry, at) => at === index ? { ...entry, from: e.target.value } : entry))} />
                  </label>
                  <label className="text-sm">
                    <span className="block text-muted-foreground mb-1">المبلغ الجديد</span>
                    <Input type="number" min="0" value={change.amount}
                      onChange={(e) => setField('rateChanges', draft.rateChanges.map((entry, at) => at === index ? { ...entry, amount: e.target.value } : entry))} />
                  </label>
                  <Button type="button" variant="ghost" size="icon-md" aria-label="حذف التعديل"
                    onClick={() => setField('rateChanges', draft.rateChanges.filter((_, at) => at !== index))}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm"
                onClick={() => setField('rateChanges', [...draft.rateChanges, { from: todayIso(), amount: draft.amount }])}>
                <Plus aria-hidden="true" />
                إضافة تعديل
              </Button>
            </div>
          )}

          <label className="block text-sm">
            <span className="block font-medium text-foreground mb-1">ملاحظات</span>
            <Input value={draft.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="نطاق العقد، شروط خاصة…" />
          </label>

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={busy}>حفظ</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)} disabled={busy}>إلغاء</Button>
          </div>
        </div>
      )}

      {contracts.map((contract) => (
        <ContractCard
          key={contract.id}
          contract={contract}
          canEdit={canEdit}
          busy={busy}
          onEdit={() => openEdit(contract)}
          onRenew={() => renew(contract)}
          onDelete={() => remove(contract)}
          onPay={(payment) => run(async () => put(await db.addContractPayment(contract.id, payment)))}
          onUnpay={(paymentId) => run(async () => put(await db.deleteContractPayment(contract.id, paymentId)))}
        />
      ))}
    </div>
  );
}

interface ContractCardProps {
  contract: ClientContract;
  canEdit: boolean;
  busy: boolean;
  onEdit: () => void;
  onRenew: () => void;
  onDelete: () => void;
  onPay: (payment: { amount: number; paymentDate: string; method?: string; reference?: string }) => void;
  onUnpay: (paymentId: string) => void;
}

function ContractCard({ contract, canEdit, busy, onEdit, onRenew, onDelete, onPay, onUnpay }: ContractCardProps) {
  const { summary } = contract;
  const [open, setOpen] = useState(summary.status !== 'expired');
  const [paying, setPaying] = useState(false);
  const [payment, setPayment] = useState({ amount: '', paymentDate: todayIso(), method: '', reference: '' });

  const startPaying = () => {
    const suggested = summary.overdue > 0 ? summary.overdue : summary.nextDue?.amount ?? summary.currentAmount;
    setPayment({ amount: String(suggested || ''), paymentDate: todayIso(), method: '', reference: '' });
    setPaying(true);
  };

  const submitPayment = () => {
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    onPay({ amount, paymentDate: payment.paymentDate, method: payment.method || undefined, reference: payment.reference || undefined });
    setPaying(false);
  };

  return (
    <div className="bg-card rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[summary.status]}>{contractStatusLabel(summary.status)}</Badge>
            <span className="text-sm text-foreground">
              <bdi>{formatDate(contract.startDate)}</bdi> ← <bdi>{formatDate(contract.endDate)}</bdi>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            دفعة {contractFrequencyLabel(contract.frequency)}: <Money value={summary.currentAmount} />
            {summary.status !== 'expired' && summary.daysLeft >= 0 && ` · يتبقّى ${formatNumber(summary.daysLeft)} يوماً`}
          </p>
          {contract.notes && <p className="text-sm text-muted-foreground">{contract.notes}</p>}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={onEdit} disabled={busy}>
              <Pencil aria-hidden="true" />
              تعديل
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onRenew} disabled={busy}>
              <RefreshCw aria-hidden="true" />
              تجديد
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="حذف العقد" onClick={onDelete} disabled={busy}>
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <Figure label="قيمة العقد" value={summary.totalValue} />
        <Figure label="المحصَّل" value={summary.paid} tone="text-success" />
        <Figure label="متأخّر" value={summary.overdue} tone={summary.overdue > 0 ? 'text-destructive' : undefined} />
        <Figure label="المتبقّي حتى النهاية" value={summary.remaining} />
      </div>

      {summary.nextDue && (
        <p className="text-sm text-muted-foreground">
          الدفعة القادمة: <bdi>{formatDate(summary.nextDue.dueDate)}</bdi> — <Money value={summary.nextDue.amount} />
        </p>
      )}

      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        جدول الدفعات والمدفوعات
      </button>

      {open && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h5 className="text-sm font-medium text-foreground mb-2">جدول الاستحقاق</h5>
            <ul className="divide-y rounded border text-sm">
              {summary.installments.map((item) => (
                <li key={item.dueDate} className="flex items-center justify-between gap-2 px-3 py-2">
                  <bdi>{formatDate(item.dueDate)}</bdi>
                  <span className="flex items-center gap-2">
                    <Money value={item.amount} />
                    <Badge variant={INSTALLMENT[item.state].variant}>{INSTALLMENT[item.state].label}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-foreground">المدفوعات</h5>
              {canEdit && !paying && (
                <Button type="button" variant="outline" size="sm" onClick={startPaying} disabled={busy}>
                  <Plus aria-hidden="true" />
                  تسجيل دفعة
                </Button>
              )}
            </div>
            {paying && (
              <div className="rounded border p-3 mb-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min="0" aria-label="المبلغ" placeholder="المبلغ" value={payment.amount}
                    onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
                  <Input type="date" aria-label="التاريخ" value={payment.paymentDate}
                    onChange={(e) => setPayment({ ...payment, paymentDate: e.target.value })} />
                  <Input aria-label="الطريقة" placeholder="الطريقة (تحويل، نقد…)" value={payment.method}
                    onChange={(e) => setPayment({ ...payment, method: e.target.value })} />
                  <Input aria-label="المرجع" placeholder="المرجع" value={payment.reference}
                    onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={submitPayment} disabled={busy}>حفظ الدفعة</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPaying(false)}>إلغاء</Button>
                </div>
              </div>
            )}
            {contract.payments.length ? (
              <ul className="divide-y rounded border text-sm">
                {contract.payments.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <bdi>{formatDate(entry.paymentDate)}</bdi>
                      {(entry.method || entry.reference) && (
                        <span className="text-muted-foreground"> · {[entry.method, entry.reference].filter(Boolean).join(' · ')}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Money value={entry.amount} />
                      {canEdit && (
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="حذف الدفعة"
                          onClick={() => { if (window.confirm('حذف هذه الدفعة؟')) onUnpay(entry.id); }} disabled={busy}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">لا دفعات مسجّلة بعد.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <p className={`text-lg font-bold ${tone ?? 'text-foreground'}`}><Money value={value} /></p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
