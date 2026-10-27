import { useEffect, useState } from 'react';
import { CircleCheck, Landmark, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';

import { db } from '../../data/database';
import { ApiError } from '../../data/api';
import {
  Case, WafeqAiSummary, WafeqPayment, WafeqPaymentStatus, WafeqProbe, WafeqProjectLink, WafeqRematch, WafeqStatus,
  WafeqSummary,
} from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { Badge } from '@/registry/naf/ui/badge';
import { Select } from '@/registry/naf/ui/select';
import { Money } from '@/registry/naf/currency/money';
import { formatDateTime, formatNumber } from '@/registry/naf/lib/format';

/* ═══ الربط بوافق ═══
 *
 * قراءةٌ لا كتابة: تُقرأ المدفوعات من وافق وتُربط بالقضايا، ولا يُكتب في
 * وافق حرف. والترتيبُ ترتيبُ العمل: اختبارُ الاتصال ← معاينة ← مزامنة ←
 * ثم تُفتح الآلية.
 *
 * **ولا ينزل إلى سجلّ الدفعات إلا ما رُبط.** رقمُ القضية في نصّ الدفعة يربط
 * آلياً، وما اقترحه الطرازُ أو دلّ عليه الموكّل ينتظر هنا تأكيداً بضغطة.
 */

const ERRORS: Record<string, string> = {
  not_configured: 'لم يُضبط مفتاحُ وافق — يلزم سرُّ WAFEQ_API_KEY في إعداد المنصة',
  unauthorized: 'رفض وافق المفتاح — تحقّق منه أو أنشئ مفتاحاً جديداً',
  rate_limited: 'تجاوزنا حدَّ النداءات عند وافق — أعد المحاولة بعد قليل',
  unreachable: 'تعذّر الوصول إلى وافق',
  not_found: 'لم يُعرف المسار عند وافق — شغّل «اختبار الاتصال» وأرسل لنا نتيجته',
  sync_first: 'شغّل مزامنةً يدويةً ناجحة أوّلاً',
  ai_unavailable: 'الذكاء الاصطناعي غيرُ مربوطٍ بالمنصة (ارتباط AI في Cloudflare)',
  pro_bono_case: 'القضية تطوّعية — لا دفعات عليها',
  forbidden: 'لا تملك صلاحية هذا',
};

const explain = (error: unknown, fallback: string) =>
  (error instanceof ApiError && ERRORS[error.code]) || fallback;

const MATCH_LABEL: Record<string, string> = {
  case_number: 'برقم القضية',
  project_name: 'باسم المشروع',
  wafeq_project: 'بمشروع وافق المعتمد',
  client: 'بالموكّل',
  ai: 'اقتراحٌ آليّ',
  manual: 'يدويّاً',
};

/* لماذا لم يُسأل الطراز — يُقال ولا يُسكت عنه. */
function AiLine({ ai }: { ai: WafeqAiSummary }) {
  const skipped = ai.skipped ?? { disabled: 0, noCandidates: 0 };
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-1">
      <Sparkles className="h-3 w-3" aria-hidden="true" />
      {ai.enabled ? <>سُئل الذكاءُ الاصطناعي {formatNumber(ai.used)} مرّة</> : <>الذكاءُ الاصطناعي مطفأ</>}
      {ai.deferred > 0 && <> · بقي {formatNumber(ai.deferred)} لضغطةٍ تالية</>}
      {ai.failed > 0 && <> · تعذّر {formatNumber(ai.failed)}</>}
      {skipped.disabled > 0 && <> · {formatNumber(skipped.disabled)} لم تُعرض عليه لأنّه مطفأ</>}
      {skipped.noCandidates > 0 && <> · {formatNumber(skipped.noCandidates)} بلا قضايا مفتوحة تُرشَّح</>}
    </p>
  );
}

const LINK_SOURCE: Record<WafeqProjectLink['source'], string> = {
  exact: 'تطابقُ الاسم',
  confirmed: 'أكّدتَه',
  manual: 'ربطٌ يدويّ',
};

/* ═══ مشاريعُ وافق المربوطة ═══
   كلُّ مشروعٍ هنا تُربط دفعاتُه بقضيته آلياً. يُبنى من تطابق الاسم ومن
   تأكيدك، ويُفكّ من هنا فتعود دفعاتُه التالية إلى الاقتراح. */
function ProjectLinks({ version, onChanged }: { version: number; onChanged: () => void }) {
  const [links, setLinks] = useState<WafeqProjectLink[]>([]);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    db.getWafeqProjectLinks().then(setLinks).catch(() => setLinks([]));
  }, [version]);

  if (!links.length) return null;

  const unlink = async (projectId: string) => {
    setBusy(projectId);
    try {
      await db.deleteWafeqProjectLink(projectId);
      setLinks((current) => current.filter((link) => link.projectId !== projectId));
      onChanged();
    } finally {
      setBusy('');
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h4 className="font-semibold text-foreground">مشاريعُ وافق المربوطة <bdi>({formatNumber(links.length)})</bdi></h4>
        <p className="text-sm text-muted-foreground">دفعاتُ هذه المشاريع تُربط بقضاياها آلياً. فكُّ الربط لا يمسّ ما رُبط من قبل.</p>
      </div>
      <ul className="divide-y divide-border rounded border">
        {links.map((link) => (
          <li key={link.projectId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div className="min-w-0">
              <p className="text-foreground">
                <bdi>{link.projectName || link.projectId}</bdi>
                <span className="text-muted-foreground"> ← </span>
                <bdi className="font-medium">{link.caseNumber}</bdi>
                {link.basecampName && <span className="text-muted-foreground"> · <bdi>{link.basecampName}</bdi></span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {LINK_SOURCE[link.source] ?? link.source} · {formatNumber(link.payments)} دفعةً مربوطة
              </p>
            </div>
            <Button variant="ghost" size="sm" disabled={busy === link.projectId} onClick={() => unlink(link.projectId)}>
              فكّ
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const TABS: { id: WafeqPaymentStatus; label: string }[] = [
  { id: 'suggested', label: 'مقترَحة' },
  { id: 'unmatched', label: 'بلا قضية' },
  { id: 'linked', label: 'مربوطة' },
  { id: 'ignored', label: 'متجاهَلة' },
];

export default function WafeqSync() {
  const [status, setStatus] = useState<WafeqStatus | null>(null);
  const [probe, setProbe] = useState<WafeqProbe | null>(null);
  const [summary, setSummary] = useState<{ title: string; data: WafeqSummary } | null>(null);
  const [rematch, setRematch] = useState<WafeqRematch | null>(null);
  /* يتبدّل بعد كلّ ما قد يُنشئ ربطَ مشروع — فيُعاد قراءةُ لوحه. */
  const [linksVersion, setLinksVersion] = useState(0);
  const [tab, setTab] = useState<WafeqPaymentStatus>('suggested');
  const [payments, setPayments] = useState<WafeqPayment[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadStatus = async () => {
    try {
      setStatus(await db.getWafeqStatus());
    } catch (cause) {
      setError(explain(cause, 'تعذّرت قراءة حالة الربط'));
    }
  };

  const loadPayments = async (which = tab) => {
    try {
      setPayments(await db.getWafeqPayments(which));
    } catch (cause) {
      setError(explain(cause, 'تعذّرت قراءة المدفوعات'));
    }
  };

  useEffect(() => {
    loadStatus();
    db.getCases().then((rows) => setCases(rows.filter((row) => !row.archivedAt && row.feeStructure?.type !== 'pro_bono')));
  }, []);

  useEffect(() => {
    if (status?.state === 'configured') loadPayments(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, status?.state]);

  const run = async (key: string, work: () => Promise<void>, fallback: string) => {
    setBusy(key);
    setError('');
    try {
      await work();
    } catch (cause) {
      setError(explain(cause, fallback));
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    await Promise.all([loadStatus(), loadPayments()]);
    setLinksVersion((version) => version + 1);
  };

  const decide = (payment: WafeqPayment, action: 'link' | 'ignore' | 'unlink', caseId?: string) =>
    run(payment.externalId, async () => {
      await db.decideWafeqPayment(payment.externalId, action, caseId);
      await refresh();
    }, 'تعذّر حفظ القرار');

  if (!status) {
    return <p className="text-muted-foreground">جارٍ التحميل…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Landmark className="h-5 w-5" aria-hidden="true" />
          الربط بوافق
        </h3>
        <p className="text-sm text-muted-foreground max-w-2xl">
          تُقرأ مدفوعاتُ الموكّلين من وافق وتُربط بقضاياها — قراءةً لا كتابة. رقمُ القضية في نصّ الدفعة يربطها
          آلياً، وما سواه يقترحه الطرازُ وتؤكّده أنت.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <span>{error}</span>
        </Alert>
      )}

      {status.state === 'not_configured' ? (
        <Alert>
          <TriangleAlert aria-hidden="true" />
          <span>{ERRORS.not_configured}. ويُضبط من لوحة Cloudflare نوعَ «Secret»، أو بالأمر <bdi>wrangler secret put WAFEQ_API_KEY</bdi>.</span>
        </Alert>
      ) : (
        <>
          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  آخرُ مزامنة:{' '}
                  <bdi>{status.lastSyncAt ? formatDateTime(new Date(status.lastSyncAt * 1000)) : 'لم تقع بعد'}</bdi>
                </p>
                {status.lastSyncError && <p className="text-destructive">آخرُ خطأ: {ERRORS[status.lastSyncError] ?? status.lastSyncError}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => run('test', async () => setProbe(await db.testWafeq()), 'تعذّر اختبار الاتصال')}
                >
                  اختبار الاتصال
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => run('preview', async () => {
                    setSummary({ title: 'المعاينة — لم يُكتب شيء', data: (await db.previewWafeq()).summary });
                  }, 'تعذّرت المعاينة')}
                >
                  معاينة
                </Button>
                <Button
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => run('sync', async () => {
                    setSummary({ title: 'المزامنة', data: await db.syncWafeq() });
                    await refresh();
                  }, 'تعذّرت المزامنة')}
                >
                  <RefreshCw aria-hidden="true" />
                  {busy === 'sync' ? 'جارٍ المزامنة' : 'مزامنة الآن'}
                </Button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(status.syncEnabled)}
                disabled={busy !== null || !status.lastSyncAt}
                onChange={(event) => run('auto', async () => {
                  await db.setWafeqAutoSync(event.target.checked);
                  await loadStatus();
                }, 'تعذّر تبديل الآلية')}
              />
              مزامنةٌ آلية كلَّ ساعة
              {!status.lastSyncAt && <span className="text-muted-foreground">— بعد أوّل مزامنةٍ يدوية</span>}
            </label>

            {/* ═══ الربطُ بالذكاء الاصطناعي ═══
                على المخزَّن «بلا قضية» دون قراءة وافق من جديد. ونتيجتُه اقتراحٌ
                تؤكّده — لا ينزل شيءٌ إلى سجلّ الدفعات بترجيح. */}
            <div className="rounded border p-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-foreground">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {!status.ai?.available
                    ? 'الذكاءُ الاصطناعي غيرُ مربوطٍ بالمنصة'
                    : status.ai.enabled ? 'الذكاءُ الاصطناعي يعمل — يقترح القضيةَ لما لا رقمَ فيه' : 'الذكاءُ الاصطناعي مطفأ'}
                  {status.ai?.model && <Badge variant="outline"><bdi dir="ltr">{status.ai.model}</bdi></Badge>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {status.ai?.available && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => run('ai', async () => {
                        await db.setBasecampAi(!status.ai?.enabled);
                        await loadStatus();
                      }, 'تعذّر تبديل الذكاء الاصطناعي')}
                    >
                      {status.ai.enabled ? 'أطفئه' : 'شغّله'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={busy !== null || !status.ai?.available || !status.ai.enabled || !(status.counts?.unmatched)}
                    onClick={() => run('rematch', async () => {
                      setRematch(await db.rematchWafeq());
                      await refresh();
                    }, 'تعذّر الربط بالذكاء الاصطناعي')}
                  >
                    <Sparkles aria-hidden="true" />
                    {busy === 'rematch' ? 'جارٍ الربط' : 'اربط بالذكاء الاصطناعي الآن'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                المفتاحُ نفسُه مفتاحُ «التلخيص الآليّ» في الربط ببيسكامب. وفي كلّ ضغطةٍ يُسأل عن {formatNumber(60)} دفعةً
                على الأكثر — اضغط ثانيةً حتى لا يبقى شيء.
              </p>
              {rematch && (
                <div className="text-muted-foreground">
                  <p>
                    فُحصت {formatNumber(rematch.checked)} · رُبطت {formatNumber(rematch.linked)} ·
                    مقترَحة {formatNumber(rematch.suggested)} · بقيت بلا قضية {formatNumber(rematch.unmatched)}
                  </p>
                  <AiLine ai={rematch.ai} />
                  {(rematch.invoiceErrors ?? 0) > 0 && (
                    <p className="text-destructive">تعذّرت قراءة {formatNumber(rematch.invoiceErrors ?? 0)} فاتورة</p>
                  )}
                </div>
              )}
            </div>

            {probe && (
              <div className="rounded border bg-muted p-3 text-sm space-y-1">
                <p className="flex items-center gap-2 text-foreground">
                  <CircleCheck className="h-4 w-4 text-success" aria-hidden="true" />
                  وصلنا إلى وافق — {formatNumber(probe.count)} دفعة{probe.paginated ? '، بصفحات' : ''}
                </p>
                <p className="text-muted-foreground">
                  الحقول: <bdi dir="ltr">{probe.fields.join(', ') || '—'}</bdi>
                </p>
                {Object.entries(probe.nested).map(([key, fields]) => (
                  <p key={key} className="text-muted-foreground">
                    <bdi dir="ltr">{key}: {fields.join(', ')}</bdi>
                  </p>
                ))}
                {([['الفاتورة', probe.invoice], ['الجهة', probe.contact]] as const).map(([title, shape]) => shape && (
                  <div key={title} className="pt-1">
                    <p className="text-foreground">{title}:</p>
                    {shape.error ? (
                      <p className="text-destructive">تعذّرت القراءة ({shape.error})</p>
                    ) : (
                      <>
                        <p className="text-muted-foreground"><bdi dir="ltr">{shape.fields?.join(', ') || '—'}</bdi></p>
                        {Object.entries(shape.nested ?? {}).map(([key, fields]) => (
                          <p key={key} className="text-muted-foreground"><bdi dir="ltr">{key}: {fields.join(', ')}</bdi></p>
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {summary && (
              <div className="rounded border bg-card p-3 text-sm">
                <p className="font-medium text-foreground mb-1">{summary.title}</p>
                <p className="text-muted-foreground">
                  قُرئت {formatNumber(summary.data.read)} · رُبطت {formatNumber(summary.data.linked)} ·
                  مقترَحة {formatNumber(summary.data.suggested)} · بلا قضية {formatNumber(summary.data.unmatched)} ·
                  بلا تغيير {formatNumber(summary.data.unchanged)}
                  {summary.data.skipped > 0 && <> · طُرحت {formatNumber(summary.data.skipped)} لم تُفهم</>}
                </p>
                <AiLine ai={summary.data.ai} />
                {(summary.data.invoiceErrors ?? 0) > 0 && (
                  <p className="text-destructive">تعذّرت قراءة {formatNumber(summary.data.invoiceErrors ?? 0)} فاتورة — يعيدها «اربط بالذكاء الاصطناعي الآن»</p>
                )}
                {summary.data.truncated && <p className="text-muted-foreground">بلغت الدورةُ سقفَ الصفحات — الباقي في التي تليها.</p>}
              </div>
            )}
          </Card>

          <ProjectLinks version={linksVersion} onChanged={() => loadStatus()} />

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="tablist">
              {TABS.map((entry) => (
                <Button
                  key={entry.id}
                  role="tab"
                  aria-selected={tab === entry.id}
                  variant={tab === entry.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTab(entry.id)}
                >
                  {entry.label}
                  <Badge variant="outline">{formatNumber(status.counts?.[entry.id] ?? 0)}</Badge>
                </Button>
              ))}
            </div>

            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا مدفوعات هنا.</p>
            ) : (
              <ul className="divide-y divide-border rounded border bg-card">
                {payments.map((payment) => {
                  const selected = choice[payment.externalId] ?? payment.suggestedCaseId ?? payment.caseId ?? '';
                  const pending = payment.status === 'suggested' || payment.status === 'unmatched';
                  return (
                    <li key={payment.externalId} className="p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">
                          <Money value={payment.amount} />
                          <span className="text-muted-foreground"> · {payment.contactName || 'دافعٌ مجهول'}</span>
                          {payment.paymentDate && <span className="text-muted-foreground"> · <bdi>{payment.paymentDate}</bdi></span>}
                        </p>
                        {payment.matchBy && <Badge variant="outline">{MATCH_LABEL[payment.matchBy] ?? payment.matchBy}</Badge>}
                      </div>
                      {(payment.reference || payment.description) && (
                        <p className="text-xs text-muted-foreground"><bdi>{[payment.reference, payment.description].filter(Boolean).join(' — ')}</bdi></p>
                      )}
                      {(payment.invoiceText || payment.projectName) && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          <span className="text-foreground">ما قُرئ: </span>
                          {payment.projectName && <>المشروع «<bdi>{payment.projectName}</bdi>» · </>}
                          <bdi>{payment.invoiceText}</bdi>
                        </p>
                      )}
                      {payment.reason && <p className="text-xs text-muted-foreground">{payment.reason}</p>}

                      {payment.status === 'linked' && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>مربوطةٌ بالقضية <bdi className="font-medium">{payment.caseNumber}</bdi></span>
                          <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => decide(payment, 'unlink')}>
                            فكّ الربط
                          </Button>
                        </div>
                      )}

                      {(pending || payment.status === 'ignored') && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={selected}
                            onChange={(event) => setChoice((prev) => ({ ...prev, [payment.externalId]: event.target.value }))}
                            className="min-w-52"
                          >
                            <option value="">اختر القضية</option>
                            {cases.map((kase) => (
                              <option key={kase.id} value={kase.id}>
                                {kase.caseNumber}{kase.courtCaseNumber ? ` (${kase.courtCaseNumber})` : ''} — {kase.clientName}
                              </option>
                            ))}
                          </Select>
                          <Button
                            size="sm"
                            disabled={busy !== null || !selected}
                            onClick={() => decide(payment, 'link', selected)}
                          >
                            {payment.status === 'suggested' && selected === payment.suggestedCaseId ? 'صحيح — اربط' : 'اربط'}
                          </Button>
                          {payment.status !== 'ignored' && (
                            <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => decide(payment, 'ignore')}>
                              تجاهل
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
