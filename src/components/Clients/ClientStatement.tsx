import { useEffect, useState } from 'react';
import { Download, ReceiptText } from 'lucide-react';
import { Case, Client, ClientPayment } from '../../types';
import { db } from '../../data/database';
import { downloadXlsx } from '../../lib/xlsx';
import { Money } from '@/registry/naf/currency/money';
import { formatDate } from '@/registry/naf/lib/format';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';

interface ClientStatementProps {
  client: Client;
  cases: Case[];
}

const isoDay = (value: Date) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

/**
 * ═══ كشفُ حساب الموكّل ═══
 *
 * لكلّ قضيةٍ أتعابُها وما حُصّل منها وما بقي، ثم المجموع — والدفعاتُ كلُّها
 * بتاريخها. والأرقامُ من `payment_status` الذي يكتبه الخادم من سجلّ الدفعات،
 * فلا يُجمع هنا ما قد يخالف القاعدة. والتطوّعيةُ تُذكر ولا تُحسب.
 */
export default function ClientStatement({ client, cases }: ClientStatementProps) {
  const [payments, setPayments] = useState<ClientPayment[]>([]);

  useEffect(() => {
    let alive = true;
    db.getClientPayments({ clientId: client.id }).then((rows) => { if (alive) setPayments(rows); });
    return () => { alive = false; };
  }, [client.id]);

  const rows = cases.map((case_) => {
    const proBono = case_.feeStructure?.type === 'pro_bono';
    const total = proBono ? 0 : case_.paymentStatus?.totalAmount ?? 0;
    const collected = proBono ? 0 : case_.paymentStatus?.collectedAmount ?? 0;
    return { case_, proBono, total, collected, remaining: Math.max(total - collected, 0) };
  });

  const totals = rows.reduce(
    (sum, row) => ({
      total: sum.total + row.total,
      collected: sum.collected + row.collected,
      remaining: sum.remaining + row.remaining,
    }),
    { total: 0, collected: 0, remaining: 0 },
  );

  const caseNumberOf = (caseId: string) =>
    cases.find((case_) => case_.id === caseId)?.caseNumber ?? '';

  const exportStatement = () => {
    downloadXlsx(
      [
        {
          name: 'القضايا',
          headers: ['رقم المشروع', 'نوع القضية', 'الأتعاب', 'المحصَّل', 'المتبقّي', 'ملاحظة'],
          rows: [
            ...rows.map((row) => ({
              'رقم المشروع': row.case_.caseNumber,
              'نوع القضية': row.case_.caseType,
              'الأتعاب': row.total,
              'المحصَّل': row.collected,
              'المتبقّي': row.remaining,
              'ملاحظة': row.proBono ? 'تطوّعية' : '',
            })),
            {
              'رقم المشروع': 'المجموع',
              'الأتعاب': totals.total,
              'المحصَّل': totals.collected,
              'المتبقّي': totals.remaining,
            },
          ],
        },
        {
          name: 'الدفعات',
          headers: ['التاريخ', 'رقم المشروع', 'المبلغ', 'الطريقة', 'المرجع', 'ملاحظات'],
          rows: payments.map((payment) => ({
            'التاريخ': isoDay(payment.paymentDate),
            'رقم المشروع': caseNumberOf(payment.caseId),
            'المبلغ': payment.amount,
            'الطريقة': payment.method ?? '',
            'المرجع': payment.reference ?? '',
            'ملاحظات': payment.notes ?? '',
          })),
        },
      ],
      `كشف حساب - ${client.fullName}.xlsx`,
    );
  };

  if (!cases.length) return null;

  return (
    <div className="bg-success-soft rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ReceiptText className="h-5 w-5" aria-hidden="true" />
          كشف الحساب
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={exportStatement}>
          <Download aria-hidden="true" />
          تصدير Excel
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-lg font-bold text-foreground"><Money value={totals.total} /></p>
          <p className="text-sm text-muted-foreground">الأتعاب</p>
        </div>
        <div>
          <p className="text-lg font-bold text-success"><Money value={totals.collected} /></p>
          <p className="text-sm text-muted-foreground">المحصَّل</p>
        </div>
        <div>
          <p className="text-lg font-bold text-destructive"><Money value={totals.remaining} /></p>
          <p className="text-sm text-muted-foreground">المتبقّي</p>
        </div>
      </div>

      <ul className="divide-y divide-border rounded border bg-card">
        {rows.map(({ case_, proBono, total, collected, remaining }) => (
          <li key={case_.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span className="font-medium text-foreground">
              <bdi>{case_.caseNumber}</bdi>
              <span className="text-muted-foreground"> · {case_.caseType}</span>
            </span>
            {proBono ? (
              <Badge variant="outline">تطوّعية</Badge>
            ) : (
              <span className="text-muted-foreground">
                <Money value={collected} /> من <Money value={total} />
                {remaining > 0 && <> · متبقٍّ <Money value={remaining} /></>}
              </span>
            )}
          </li>
        ))}
      </ul>

      {payments.length > 0 && (
        <div>
          <h4 className="font-medium text-foreground mb-2">الدفعات</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {payments.map((payment) => (
              <li key={payment.id}>
                <bdi>{formatDate(payment.paymentDate)}</bdi> — <Money value={payment.amount} />
                {' '}على <bdi>{caseNumberOf(payment.caseId)}</bdi>
                {payment.method && ` · ${payment.method}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
