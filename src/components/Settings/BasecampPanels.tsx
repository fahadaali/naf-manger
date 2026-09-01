import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  CircleCheck,
  Eye,
  Lightbulb,
  Play,
  RefreshCw,
  Sparkles,
  Timer,
  TriangleAlert,
} from 'lucide-react';

import { db } from '../../data/database';
import { BasecampConflict, BasecampMap, BasecampPreview, BasecampSummary } from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { Badge } from '@/registry/naf/ui/badge';
import { Select } from '@/registry/naf/ui/select';
import { formatDateTime, formatNumber } from '@/registry/naf/lib/format';
import { caseOutcomeLabel, caseStatusLabel, clientTypeLabel } from '../../lib/labels';

/* ألواحُ المراحل الثلاث بعد الاكتشاف: خريطةُ الحقول، والمعاينة والتنفيذ،
   والاختلافات. وهي في ملفٍّ ثانٍ لأنّ `BasecampSync` صار طويلاً — ولوحُ
   الاتّصال والتصنيف عملٌ آخرُ عن هذا. */

/* وحقولُ العميل بسابقةِ `client.` كما تصل من الخادم: الجدولُ واحدٌ للطرفين،
   والسابقةُ تفرّق «الملاحظات» عن «ملاحظات العميل». */
const FIELD_LABEL: Record<string, string> = {
  caseNumber: 'رقم القضية',
  caseType: 'نوع المشروع',
  summary: 'موضوع المشروع',
  status: 'حالة المشروع',
  outcome: 'نتيجة المشروع',
  notes: 'ملاحظات المشروع',
  'client.fullName': 'اسم العميل',
  'client.idNumber': 'رقم الهوية',
  'client.idType': 'نوع الهوية',
  'client.phone': 'رقم الجوال',
  'client.email': 'البريد الإلكتروني',
  'client.clientType': 'نوع العميل',
  'client.commercialRegister': 'السجل التجاري',
  'client.notes': 'ملاحظات العميل',
};

const PLAN_ERROR: Record<string, string> = {
  no_document: 'لا ملفّ «بيانات المشروع» في هذا المشروع',
  no_client_name: 'الملفّ بلا اسم عميل',
  duplicate_case_number: 'رقم القضية مكرّر بين مشروعين',
  read_failed: 'تعذّرت قراءة الملفّ',
  rate_limited: 'تجاوز حدّ النداءات',
  not_found: 'الملفّ غير موجود عندهم',
};

const ACTION_LABEL: Record<string, { text: string; variant: 'success' | 'primary' | 'outline' }> = {
  create_client: { text: 'عميل جديد', variant: 'success' },
  link_client: { text: 'عميل قائم', variant: 'outline' },
  create_case: { text: 'قضية جديدة', variant: 'success' },
  update_case: { text: 'تحديث', variant: 'primary' },
  none: { text: 'بلا تغيير', variant: 'outline' },
};

/* ═══ اسمُ الملفّ وخريطة الحقول ═══ */
export function FieldMapPanel({ onSaved }: { onSaved?: () => void }) {
  const [data, setData] = useState<BasecampMap | null>(null);
  const [draft, setDraft] = useState<[string, string][]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  /* مطويٌّ ابتداءً: الخريطة تُضبط مرّةً ثم تُنسى، وسبعةَ عشرَ سطراً
     مفتوحةً تدفع المعاينةَ والاختلافات — وهما عملُ كل يوم — تحت الطيّ. */
  const [open, setOpen] = useState(false);

  const load = async () => {
    const next = await db.getBasecampMap();
    setData(next);
    setDraft(Object.entries(next.map));
    setTitles(next.titles ?? []);
  };

  useEffect(() => {
    load().catch(() => setNote('تعذّرت قراءة الخريطة'));
  }, []);

  if (!data) return null;

  /* ═══ اقتراحُ ربطٍ لما لا ربط له ═══
     بنودُ الملفّ تتبدّل، فتظهر عناوينُ بلا ربط ويُترك ربطُها لمن يفتح
     الشاشة — وهو عملٌ يُؤجَّل فتضيع الحقول ما دام أُجِّل. فتُقرأ ملفّاتٌ
     حقيقية ويُقترح، **وتُضاف مسوّدةً لا محفوظة**: خطأٌ واحد في الخريطة
     يتكرّر على الحساب كلِّه، وذلك قرارٌ لا يُترك لاستدلال. */
  const suggest = async () => {
    setBusy(true);
    setNote('');
    try {
      const result = await db.suggestBasecampMap();
      if (!result.labels.length) {
        setNote('لا عناوينَ بلا ربط في آخر الملفّات');
        return;
      }
      if (!result.suggestions.length) {
        setNote(`عناوينُ بلا ربط: ${result.labels.slice(0, 6).join('، ')} — ولم يترجّح لها حقل`);
        return;
      }
      /* وما هو في المسوّدة لا يُكرَّر: اقتراحٌ على عنوانٍ كُتب سطرُه بيدٍ
         يُنتج سطرين لعنوانٍ واحد. */
      const have = new Set(draft.map(([label]) => label.trim()));
      const added = result.suggestions.filter((entry) => !have.has(entry.label));
      setDraft([...draft, ...added.map((entry) => [entry.label, entry.target] as [string, string])]);
      setNote(
        `أُضيف ${formatNumber(added.length)} اقتراحاً — راجِعها ثم احفظ` +
          (result.labels.length > result.suggestions.length
            ? `. ولم يترجّح حقلٌ لـ${formatNumber(result.labels.length - result.suggestions.length)} عنواناً`
            : ''),
      );
    } catch (suggestError) {
      const code = (suggestError as { code?: string })?.code;
      setNote(
        code === 'ai_disabled' ? 'التلخيصُ الآليّ مطفأ — شغّله أوّلاً'
          : code === 'no_document' ? 'لا ملفّاتٍ مقروءةً بعد — امسح الحساب أوّلاً'
            : 'تعذّر الاقتراح',
      );
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setNote('');
    try {
      const map: Record<string, string> = {};
      for (const [label, target] of draft) {
        const name = label.trim();
        if (name && target) map[name] = target;
      }
      await db.saveBasecampMap(map, titles.map((title) => title.trim()).filter(Boolean));
      setNote('حُفظت الخريطة والعناوين');
      onSaved?.();
    } catch {
      setNote('تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-foreground">اسمُ الملفّ وخريطةُ الحقول</h4>
          <p className="text-sm text-muted-foreground">
            العنوانُ كما هو مكتوبٌ في «بيانات المشروع»، يقابله حقلٌ في المنصة. والتشكيلُ
            والتطويلُ لا يُهمّان — تُطابَق موحَّدةً.
          </p>
        </div>
        <Button onClick={() => setOpen(!open)} variant="outline" size="sm">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          {open ? 'اطوِ' : `اعرض (${formatNumber(draft.length)})`}
        </Button>
      </div>

      {!open ? null : (
      <>
      {/* ═══ عناوينُ الملفّ المقبولة ═══
          كان العنوان مكتوباً في الشيفرة، فلمّا صار الملفّ «بيانات المشروع»
          توقّف الاستيرادُ كلُّه صامتاً. وهي قائمةٌ لا واحد: مشاريعُ سنينَ
          ماضية لا تزال تحمل «ملخص القضية». */}
      <div className="space-y-2 pb-4 border-b border-border">
        <p className="text-sm font-medium text-foreground">عناوينُ الملفّ المقبولة</p>
        <p className="text-xs text-muted-foreground">
          كلُّ مشروعٍ فيه ملفٌّ بأحد هذه العناوين يُرجَّح أنّه لعميل. والأوّلُ هو الجاري،
          وما بعده أسماءٌ قديمةٌ لم تُعَد تسميتُها.
        </p>
        {titles.map((title, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(event) => {
                const next = [...titles];
                next[index] = event.target.value;
                setTitles(next);
              }}
              placeholder="عنوان الملفّ في بيسكامب"
              className="flex-1 min-w-40 h-9 px-3 rounded-md border border-border bg-card text-sm"
            />
            <Button
              onClick={() => setTitles(titles.filter((_, position) => position !== index))}
              variant="outline"
              size="sm"
            >
              احذف
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setTitles([...titles, ''])} variant="outline" size="sm">
            أضف عنواناً
          </Button>
          <Button onClick={() => setTitles([...data.defaultTitles])} variant="outline" size="sm">
            أعد الافتراضي
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {draft.map(([label, target], index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <input
              value={label}
              onChange={(event) => {
                const next = [...draft];
                next[index] = [event.target.value, target];
                setDraft(next);
              }}
              placeholder="العنوان في الملفّ"
              className="flex-1 min-w-40 h-9 px-3 rounded-md border border-border bg-card text-sm"
            />
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground flex-none" aria-hidden="true" />
            <Select
              value={target}
              onChange={(event) => {
                const next = [...draft];
                next[index] = [label, event.target.value];
                setDraft(next);
              }}
              className="flex-1 min-w-44"
            >
              {Object.entries(data.targets).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.entity === 'client' ? 'العميل — ' : 'القضية — '}
                  {meta.label}
                </option>
              ))}
            </Select>
            <Button
              onClick={() => setDraft(draft.filter((_, position) => position !== index))}
              variant="outline"
              size="sm"
            >
              احذف
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setDraft([...draft, ['', 'client.fullName']])} variant="outline" size="sm">
          أضف سطراً
        </Button>
        <Button onClick={() => setDraft(Object.entries(data.defaults))} variant="outline" size="sm">
          أعد الافتراضي
        </Button>
        <Button onClick={suggest} disabled={busy} variant="outline" size="sm">
          <Sparkles className="h-4 w-4" />
          اقترح ربطاً من ملفّاتي
        </Button>
        <Button onClick={save} disabled={busy} size="sm">
          {busy ? 'جارٍ الحفظ' : 'احفظ الخريطة'}
        </Button>
        {note && <span className="text-sm text-muted-foreground">{note}</span>}
      </div>
      </>
      )}
      {!open && note && <p className="text-sm text-muted-foreground">{note}</p>}
    </Card>
  );
}

/* ═══ المعاينة والتنفيذ ═══ */
export function PreviewPanel({
  syncEnabled,
  lastSyncAt,
  aiEnabled,
  conflictPolicy,
  onChanged,
}: {
  syncEnabled: boolean;
  lastSyncAt: number | null;
  aiEnabled: boolean;
  conflictPolicy: 'ask' | 'basecamp' | 'platform';
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState<BasecampPreview | null>(null);
  const [applied, setApplied] = useState<BasecampSummary | null>(null);
  const [busy, setBusy] = useState<'preview' | 'sync' | 'auto' | 'ai' | 'policy' | null>(null);
  const [error, setError] = useState('');

  const run = async (which: 'preview' | 'sync') => {
    setBusy(which);
    setError('');
    setApplied(null);
    try {
      if (which === 'preview') {
        setPreview(await db.previewBasecamp());
      } else {
        setApplied(await db.syncBasecamp());
        setPreview(null);
        onChanged();
      }
    } catch (runError) {
      setError((runError as Error)?.message ?? 'تعذّر التنفيذ');
    } finally {
      setBusy(null);
    }
  };

  /* ═══ سياسةُ الاختلاف ═══
     ليس فيها ما «يوقف الاستيراد»: التعارضُ حقلٌ واحد لا يُكتب، وبقيةُ
     الحقول والقضايا والعملاء تُكتب كلُّها. وإنّما تُغني عن حسمِ كلِّ حقلٍ
     بيدٍ لمن استقرّ عنده أيُّ الطرفين أصحّ. */
  const setPolicy = async (policy: 'ask' | 'basecamp' | 'platform') => {
    setBusy('policy');
    setError('');
    try {
      await db.setBasecampConflictPolicy(policy);
      onChanged();
    } catch {
      setError('تعذّر حفظ السياسة');
    } finally {
      setBusy(null);
    }
  };

  const toggleAi = async (enabled: boolean) => {
    setBusy('ai');
    setError('');
    try {
      await db.setBasecampAi(enabled);
      onChanged();
    } catch {
      setError('تعذّر تبديل التلخيص الآليّ');
    } finally {
      setBusy(null);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    setBusy('auto');
    setError('');
    try {
      await db.setBasecampAutoSync(enabled);
      onChanged();
    } catch (toggleError) {
      setError(
        (toggleError as { code?: string })?.code === 'sync_first'
          ? 'لا تُفتح الآلية قبل مزامنةٍ يدويةٍ ناجحة — عاين ثم نفّذ أوّلاً'
          : 'تعذّر تبديل المزامنة الآلية',
      );
    } finally {
      setBusy(null);
    }
  };

  const tiles = preview
    ? [
        { label: 'عملاء جدد', value: preview.summary.createClients },
        /* وعملاءُ يُحدَّثون: بلاطةٌ جديدة لأنّ العميل صار يُدمَج بعد إنشائه —
           فنوعُه وملاحظاتُه تنزل على ملفّه القائم لا على الجديد وحده. */
        { label: 'عملاء يُحدَّثون', value: preview.summary.updateClients ?? 0 },
        { label: 'قضايا جديدة', value: preview.summary.createCases },
        { label: 'قضايا تُحدَّث', value: preview.summary.updateCases },
        { label: 'بلا تغيير', value: preview.summary.unchanged },
        { label: 'اختلافات', value: preview.summary.conflicts },
        { label: 'تعذّرت', value: preview.summary.failed },
      ]
    : [];

  return (
    <Card className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-foreground">المعاينة والتنفيذ</h4>
          <p className="text-sm text-muted-foreground">
            المعاينةُ تقرأ الملفّات وتقول ما سيقع — ولا تكتب في العملاء ولا القضايا حرفاً.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run('preview')} disabled={busy !== null} variant="outline">
            <Eye className={`h-4 w-4 ${busy === 'preview' ? 'animate-pulse' : ''}`} />
            {busy === 'preview' ? 'جارٍ القراءة' : 'عاين'}
          </Button>
          <Button onClick={() => run('sync')} disabled={busy !== null || !preview}>
            <Play className="h-4 w-4" />
            {busy === 'sync' ? 'جارٍ التنفيذ' : 'نفّذ المعاينة'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <span>{error}</span>
        </Alert>
      )}

      {applied && (
        <Alert variant="success">
          <CircleCheck aria-hidden="true" />
          <span>
            {`أُنشئ ${formatNumber(applied.clientsCreated ?? 0)} عميلاً و${formatNumber(applied.casesCreated ?? 0)} قضية، ` +
              `وحُدّثت ${formatNumber(applied.casesUpdated ?? 0)} قضيةً و${formatNumber(applied.clientsUpdated ?? 0)} عميلاً` +
              (applied.conflicts ? `، و${formatNumber(applied.conflicts)} اختلافاً ينتظر قرارك` : '') +
              /* والمؤجَّلُ يُقال: سقفُ الدورة بلغ، والباقي في التي تليها —
                 لا ميزةٌ عطلت. */
              (applied.ai?.enabled
                ? `. ولُخِّص ${formatNumber(applied.ai.cases ?? 0)} قضيةً و${formatNumber(applied.ai.clients ?? 0)} عميلاً` +
                  (applied.ai.deferred
                    ? `، وأُجِّل ${formatNumber(applied.ai.deferred)} إلى الدورة التالية`
                    : '')
                : '')}
          </span>
        </Alert>
      )}

      {preview && (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 py-2 border-y border-border">
            {tiles.map((tile) => (
              <div key={tile.label} className="text-center">
                <p className="text-xl font-bold text-foreground">
                  <bdi>{formatNumber(tile.value)}</bdi>
                </p>
                <p className="text-xs text-muted-foreground">{tile.label}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-start py-2 font-medium">المشروع</th>
                  <th className="text-start py-2 font-medium">العميل</th>
                  <th className="text-start py-2 font-medium">القضية</th>
                  {/* «تنبيهات» لا «ملاحظات»: للملفّ حقلُ ملاحظاتٍ يُستورد
                      الآن، واسمان واحدٌ في شاشةٍ واحدة يُقرآن شيئاً واحداً. */}
                  <th className="text-start py-2 font-medium">تنبيهات</th>
                </tr>
              </thead>
              <tbody>
                {preview.plans.map((plan) => (
                  <tr key={plan.projectId} className="border-b border-border/50 align-top">
                    <td className="py-3">{plan.projectName}</td>
                    <td className="py-3">
                      {plan.client ? (
                        <div className="space-y-1">
                          <Badge variant={ACTION_LABEL[plan.client.action].variant}>
                            {ACTION_LABEL[plan.client.action].text}
                          </Badge>
                          <p className="text-foreground">{plan.client.fullName}</p>
                          {plan.client.clientType && (
                            <p className="text-xs text-muted-foreground">
                              {clientTypeLabel(plan.client.clientType)}
                              {plan.client.representative
                                ? ` · ${plan.client.representative}`
                                : ''}
                            </p>
                          )}
                          {/* وما سيُكتب على عميلٍ قائم يُسمّى حقلاً حقلاً: من
                              يرى «نوع العميل، ملاحظات العميل» يعرف ما يقع
                              على ملفٍّ قائمٍ قبل أن يقع. */}
                          {plan.client.changes?.length > 0 && (
                            <p className="text-xs text-primary">
                              {plan.client.changes
                                .map((field) => FIELD_LABEL[`client.${field}`] ?? field)
                                .join('، ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {plan.case ? (
                        <div className="space-y-1">
                          <Badge variant={ACTION_LABEL[plan.case.action].variant}>
                            {ACTION_LABEL[plan.case.action].text}
                          </Badge>
                          <p className="text-foreground"><bdi>{plan.case.caseNumber}</bdi></p>
                          <p className="text-xs text-muted-foreground">
                            {[
                              plan.case.caseTypeSuggested ? `${plan.case.caseType} (مقترَح)` : null,
                              plan.case.status ? caseStatusLabel(plan.case.status) : null,
                              plan.case.outcome ? caseOutcomeLabel(plan.case.outcome) : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {/* والملاحظاتُ تُعرض مقصوصة: بها يُرى أنّها
                              التُقطت من الملفّ قبل أن تُكتب. */}
                          {plan.case.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {plan.case.notes}
                            </p>
                          )}
                          {plan.case.changes.length > 0 && (
                            <p className="text-xs text-primary">
                              {plan.case.changes.map((f) => FIELD_LABEL[f] ?? f).join('، ')}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 space-y-1">
                      {plan.error && (
                        <p className="text-destructive text-xs">
                          {PLAN_ERROR[plan.error] ?? plan.error}
                        </p>
                      )}
                      {plan.warnings.map((warning, index) => (
                        <p key={index} className="text-warning-strong text-xs">{warning}</p>
                      ))}
                      {plan.conflicts.map((conflict, index) => (
                        <p key={`c${index}`} className="text-warning-strong text-xs">
                          {`اختلافٌ في ${FIELD_LABEL[conflict.field] ?? conflict.field}`}
                        </p>
                      ))}
                      {/* حقولٌ قرأها الطراز حين عجزت القاعدة: منقولةٌ من
                          الملفّ حرفاً ومرّت بمدقّق حقلها — ومع ذلك تُسمَّى،
                          إذ أقربُ ما يُخطئ فيه الاستخلاص وضعُ قيمةٍ صحيحةٍ
                          في الحقل الخطأ. */}
                      {plan.aiFields?.length > 0 && (
                        <p className="text-info-strong text-xs flex items-start gap-1">
                          <Sparkles className="h-3 w-3 mt-0.5 flex-none" aria-hidden="true" />
                          {`قرأها الطراز: ${plan.aiFields
                            .map((field) => FIELD_LABEL[field] ?? FIELD_LABEL[field.split('.')[1]] ?? field)
                            .join('، ')} — راجِعها`}
                        </p>
                      )}
                      {plan.unmapped.length > 0 && (
                        <p className="text-muted-foreground text-xs flex items-start gap-1">
                          <Lightbulb className="h-3 w-3 mt-0.5 flex-none" aria-hidden="true" />
                          {`بلا ربط: ${plan.unmapped.slice(0, 4).join('، ')}`}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══ حين يتبدّل الطرفان ═══
          حقلٌ مسّته يدٌ في المنصة وتبدّل عندهم معاً. والافتراضُ أن يُسأل —
          فتصحيحُ المحامي لا يُمحى صامتاً. ومن استقرّ عنده أيُّ الطرفين
          أصحّ يختار، فلا يحسم حقلاً حقلاً. */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
        <div className="flex items-start gap-2">
          <ArrowLeftRight className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">حين يتبدّل الطرفان في حقلٍ واحد</p>
            <p className="text-xs text-muted-foreground max-w-xl">
              {conflictPolicy === 'ask'
                ? 'يُسجَّل بالقيمتين وينتظر قرارك. وبقيةُ الحقول تُكتب — لا يقف الاستيراد.'
                : conflictPolicy === 'basecamp'
                  ? 'تُكتب قيمةُ بيسكامب. وما تكتبه في المنصة يُدهس في الدورة التالية.'
                  : 'تبقى قيمةُ المنصة، ولا يُسأل عنها ثانيةً ما لم تتبدّل عندهم.'}
            </p>
          </div>
        </div>
        <Select
          value={conflictPolicy}
          onChange={(event) => setPolicy(event.target.value as 'ask' | 'basecamp' | 'platform')}
          disabled={busy !== null}
          className="min-w-52"
        >
          <option value="ask">اسألني — وهو الافتراض</option>
          <option value="basecamp">خذ من بيسكامب دائماً</option>
          <option value="platform">أبقِ ما في المنصة دائماً</option>
        </Select>
      </div>

      {/* ═══ التلخيصُ الآليّ ═══
          وهو الموضعُ الوحيد الذي يخرج فيه نصُّ قضيةٍ من القاعدة إلى طراز.
          فيُقال هنا صراحةً ما يُمرَّر وما لا يُمرَّر — لا في README وحده. */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
        <div className="flex items-start gap-2">
          <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">ملخّصٌ آليّ عند الاستيراد</p>
            <p className="text-xs text-muted-foreground max-w-xl">
              يكتب سطراً يلخّص كلَّ قضية، وسطراً يلخّص قضايا كلِّ موكّل — في حقلٍ
              مستقلٍّ عن الملاحظات، ويقترح نوعَ القضية من أنواعك حين يخلو منه الملفّ.
              ويُمرَّر إلى الطراز اسمُ الموكّل ونوعُ القضية وموضوعُها وحالتُها؛ ولا
              يُمرَّر رقمُ هوية ولا جوّالٌ ولا بريدٌ ولا أتعاب.
            </p>
          </div>
        </div>
        <Button
          onClick={() => toggleAi(!aiEnabled)}
          disabled={busy !== null}
          variant={aiEnabled ? 'outline' : 'default'}
        >
          <Sparkles className={`h-4 w-4 ${busy === 'ai' ? 'animate-pulse' : ''}`} />
          {aiEnabled ? 'أطفئه' : 'شغّله'}
        </Button>
      </div>

      {/* ═══ المزامنة الآلية ═══
          لا تُفتح قبل تنفيذٍ يدويٍّ ناجح: جدولةٌ تكتب في قاعدة موكّلين بلا
          أن يرى صاحبُها ما ستكتبه خطأٌ لا يُصلَح بعده. */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
        <div className="flex items-start gap-2">
          <Timer className="h-5 w-5 text-muted-foreground mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">المزامنة الآلية كلَّ ساعة</p>
            <p className="text-xs text-muted-foreground">
              {lastSyncAt
                ? 'تلتقط المشاريع الجديدة وتحدّث ما تبدّل — وما مسّته يدُك يقف وينتظر قرارك.'
                : 'تُفتح بعد أول تنفيذٍ يدويٍّ ناجح.'}
            </p>
          </div>
        </div>
        <Button
          onClick={() => toggleAuto(!syncEnabled)}
          disabled={busy !== null || !lastSyncAt}
          variant={syncEnabled ? 'outline' : 'default'}
        >
          <RefreshCw className={`h-4 w-4 ${busy === 'auto' ? 'animate-spin' : ''}`} />
          {syncEnabled ? 'أوقفها' : 'شغّلها'}
        </Button>
      </div>
    </Card>
  );
}

/* ═══ الاختلافات ═══ */
export function ConflictsPanel({ onResolved }: { onResolved: () => void }) {
  const [conflicts, setConflicts] = useState<BasecampConflict[]>([]);
  const [busy, setBusy] = useState('');

  const load = async () => {
    setConflicts(await db.getBasecampConflicts().catch(() => []));
  };

  useEffect(() => {
    load();
  }, []);

  const resolve = async (id: string, choice: 'basecamp' | 'platform' | 'ignored') => {
    setBusy(id);
    try {
      await db.resolveBasecampConflict(id, choice);
      await load();
      onResolved();
    } finally {
      setBusy('');
    }
  };

  if (conflicts.length === 0) return null;

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h4 className="font-semibold text-foreground">
          اختلافاتٌ تنتظر قرارك <bdi>({formatNumber(conflicts.length)})</bdi>
        </h4>
        <p className="text-sm text-muted-foreground">
          حقولٌ مسّتها يدٌ في المنصة وتبدّلت في بيسكامب معاً. لم يُكتب شيء — القرار لك.
        </p>
      </div>

      <div className="space-y-3">
        {conflicts.map((conflict) => (
          <div key={conflict.id} className="border border-border rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-foreground">
                {FIELD_LABEL[conflict.field] ?? conflict.field}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{conflict.projectName}</span>
              {conflict.caseNumber && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <bdi className="text-muted-foreground">{conflict.caseNumber}</bdi>
                </>
              )}
              <span className="text-xs text-muted-foreground ms-auto">
                <bdi>{formatDateTime(new Date(conflict.detectedAt * 1000))}</bdi>
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1">في المنصة</p>
                <p className="text-sm text-foreground break-words">{conflict.platformValue || '—'}</p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1">في بيسكامب</p>
                <p className="text-sm text-foreground break-words">{conflict.basecampValue || '—'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => resolve(conflict.id, 'basecamp')} disabled={busy === conflict.id} size="sm">
                خذ من بيسكامب
              </Button>
              <Button
                onClick={() => resolve(conflict.id, 'platform')}
                disabled={busy === conflict.id}
                variant="outline"
                size="sm"
              >
                أبقِ ما في المنصة
              </Button>
              <Button
                onClick={() => resolve(conflict.id, 'ignored')}
                disabled={busy === conflict.id}
                variant="outline"
                size="sm"
              >
                تجاهل
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
