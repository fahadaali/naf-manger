import { useEffect, useState } from 'react';
import {
  Building2,
  CircleCheck,
  ExternalLink,
  FileText,
  Link2,
  RefreshCw,
  TriangleAlert,
  Unlink,
} from 'lucide-react';

import { db } from '../../data/database';
import { ApiError } from '../../data/api';
import { BasecampProject, BasecampSample, BasecampStatus } from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { Badge } from '@/registry/naf/ui/badge';
import { formatDateTime, formatNumber } from '@/registry/naf/lib/format';
import { ConflictsPanel, FieldMapPanel, PreviewPanel } from './BasecampPanels';

/* ═══ ربط بيسكامب ═══
 *
 * حسابُ المكتب فيه مشاريعُ إدارةٍ داخلية ومشاريعُ عملاء، ولا يفرّق بينها
 * اسم. والذي يفرّق: مشروعُ العميل فيه ملفُّ «بيانات المشروع».
 *
 * وهذه الشاشة تُظهر التصنيف الآليّ **بوصفه اقتراحاً**، وتترك الحكم لمن
 * يفتحها. لأنّ التصنيف يقرّر أيَّ بياناتٍ تدخل قاعدةَ الموكّلين — وقرارٌ
 * كهذا لا يُترك لوجودِ ملفٍّ أو غيابه.
 *
 * والترتيب هو ترتيبُ العمل: اتّصالٌ ← تصنيفٌ ← خريطةُ حقول ← معاينةٌ ←
 * تنفيذ ← ثم تُفتح الآلية. ولا تُكتب في قاعدة العملاء كلمةٌ قبل معاينةٍ
 * رآها صاحبُ المكتب وأكّدها.
 */

/** رموزُ الخادم تُترجَم هنا: «تعذّر» لثلاث عللٍ مختلفة يرسل صاحبَه يبحث في المكان الخطأ. */
const ERRORS: Record<string, string> = {
  not_configured: 'لم يُسجَّل تطبيق بيسكامب بعد — تلزم أسرارُه في إعداد المنصة',
  not_connected: 'لم يُربط حساب بيسكامب بعد',
  key_changed: 'بُدِّل مفتاح التعمية، فلم يعد الرمز المحفوظ يُقرأ. أعد الربط',
  refresh_failed: 'انتهت صلاحية الإذن ولم يُجدَّد. أعد الربط',
  unauthorized: 'رفض بيسكامب الرمز. أعد الربط',
  forbidden: 'لا صلاحية لك على هذا',
  rate_limited: 'تجاوز المسح حدَّ نداءات بيسكامب. أعد المحاولة بعد قليل',
  provider_failed: 'ردّ بيسكامب بخطأ. أعد المحاولة',
  no_document: 'لا ملفّ «بيانات المشروع» في هذا المشروع',
};

/**
 * تفصيلُ سقوط المبادلة — حالةٌ ورمزٌ من 37signals.
 *
 * وهما ما يفرّق بين خطأين يبدوان واحداً: سرٌّ خاطئ، ورابطُ عودةٍ لا يطابق
 * المسجَّل عندهم. والأول يُصلَح في لوحة Cloudflare والثاني في بيسكامب.
 */
const EXCHANGE_HINT = (detail: string): string => {
  if (detail.includes('invalid_grant') || detail.includes('invalid_request')) {
    return 'الأرجح أنّ رابط العودة المسجَّل في بيسكامب لا يطابق نطاق المنصة';
  }
  if (detail.startsWith('401') || detail.includes('invalid_client')) {
    return 'الأرجح أنّ المعرّف أو السرّ خاطئ';
  }
  if (detail.startsWith('403')) return 'رفض بيسكامب الطلب';
  return 'ردٌّ غير متوقَّع من بيسكامب';
};

const readError = (error: unknown, fallback: string) => {
  const code = (error as ApiError)?.code;
  return (code && ERRORS[code]) || fallback;
};

/** العودة من صفحة الإذن تحمل نتيجتَها في العنوان. */
const RETURN: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  connected: { tone: 'success', text: 'رُبط حساب بيسكامب' },
  denied: { tone: 'warning', text: 'لم يُمنح الإذن' },
  bad_state: { tone: 'warning', text: 'انتهت صلاحية الطلب أو لم يطابق. أعد المحاولة' },
  exchange_failed: { tone: 'warning', text: 'تعذّرت مبادلة الرمز مع بيسكامب' },
  no_account: { tone: 'warning', text: 'لا حساب بيسكامب حديث على هذا الإذن' },
  no_code: { tone: 'warning', text: 'عادت بيسكامب بلا رمز' },
  forbidden: { tone: 'warning', text: 'لا صلاحية لك على الربط' },
  not_configured: { tone: 'warning', text: 'لم يُسجَّل تطبيق بيسكامب بعد' },
};

export default function BasecampSync() {
  const [status, setStatus] = useState<BasecampStatus | null>(null);
  const [projects, setProjects] = useState<BasecampProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [sample, setSample] = useState<BasecampSample | null>(null);
  const [sampleError, setSampleError] = useState('');

  /* نتيجةُ العودة تُقرأ مرّةً ثم تُمحى من العنوان: تحديثُ الصفحة بعدها
     يجب ألّا يعيد قول «رُبط الحساب» وقد رُبط منذ ساعة. */
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('basecamp');
    if (!result) return;
    /* الرمز قد يحمل تفصيلاً بعد نقطة: `exchange_failed.401-invalid_grant`.
       فيُقرأ أصلُه من الجدول ويُلحق به التفصيل — فيصل السببُ إلى من يربط
       بدل أن يبقى في سجلّ Cloudflare لا يفتحه. */
    const [base, detail] = result.split('.');
    const known = RETURN[base];
    setNotice(
      known
        /* والردُّ الخام يُعرض مع التفسير: التفسيرُ ترجيحٌ، والخامُ حقيقة —
           وبه يُفرَّق حين يُخطئ الترجيح. */
        ? {
            tone: known.tone,
            text: detail ? `${known.text} — ${EXCHANGE_HINT(detail)} (${detail})` : known.text,
          }
        : { tone: 'warning', text: 'تعذّر إتمام الربط' },
    );
    const url = new URL(window.location.href);
    url.searchParams.delete('basecamp');
    window.history.replaceState({}, '', url.toString());
  }, []);

  /**
   * `quiet` يُحدِّث بلا دوّارةِ الشاشة.
   *
   * ولولاه لاختفى ما تقوله الألواح فورَ قوله: لوحُ المعاينة ينادي `load`
   * بعد تنفيذٍ ناجح ليُحدِّث العدّادات، فترفع الدوّارةُ الشجرةَ كلَّها
   * وتُعيد تركيبها — فيسقط `applied` في اللوح ومعه جملةُ «أُنشئ كذا
   * وحُدّث كذا». يضغط صاحبُه «نفّذ» فلا يُقال له شيء، وقد وقع كلُّ شيء.
   */
  const load = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const next = await db.getBasecampStatus();
      setStatus(next);
      setProjects(next.state === 'connected' ? await db.getBasecampProjects() : []);
    } catch (loadError) {
      setError(readError(loadError, 'تعذّرت قراءة حالة الربط'));
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scan = async () => {
    setScanning(true);
    setError('');
    setNotice(null);
    try {
      const result = await db.scanBasecamp();
      setNotice({
        /* ═══ وملفٌّ أُعيدت تسميتُه يُقال صراحةً ═══
           عُرف بمعرّفه فلم ينقطع الاستيراد، لكنّ عنوانَه الجديد ليس في
           المقبولة — فيُذكر ليُضاف، وإلا بقي كلُّ مسحٍ يلتقطه بالمعرّف
           وحده ولا يلتقط مشروعاً جديداً سُمّي بالاسم نفسه. */
        tone: result.failed || result.incomplete || result.renamed ? 'warning' : 'success',
        text:
          `مُسح ${formatNumber(result.scanned)} مشروعاً — ` +
          `${formatNumber(result.client)} لعملاء و${formatNumber(result.internal)} داخلية` +
          (result.failed ? `، وتعذّر ${formatNumber(result.failed)}` : '') +
          (result.renamed
            ? `. و${formatNumber(result.renamed)} ملفّاً عُرف بمعرّفه بعد أن تبدّل عنوانُه` +
              (result.renamedTitles?.length
                ? ` — «${result.renamedTitles.slice(0, 3).join('»، «')}». أضِفه إلى العناوين المقبولة`
                : '')
            : '') +
          (result.incomplete ? '. ولم يكتمل المسرد — أعد المسح' : ''),
      });
      setProjects(await db.getBasecampProjects());
      setStatus(await db.getBasecampStatus());
    } catch (scanError) {
      setError(readError(scanError, 'تعذّر مسح الحساب'));
    } finally {
      setScanning(false);
    }
  };

  const classify = async (project: BasecampProject, kind: 'client' | 'internal') => {
    /* التبديل يظهر فوراً ويُراجَع بالردّ: جدولُ خمسين صفّاً يُعاد جلبُه
       كلَّه لأجل خانةٍ واحدة عملٌ لا داعي له. */
    setProjects((current) =>
      current.map((entry) =>
        entry.projectId === project.projectId ? { ...entry, kind, decidedByHand: true } : entry,
      ),
    );
    try {
      await db.classifyBasecampProject(project.projectId, kind);
      setStatus(await db.getBasecampStatus());
    } catch (classifyError) {
      setError(readError(classifyError, 'تعذّر حفظ التصنيف'));
      setProjects(await db.getBasecampProjects());
    }
  };

  const showSample = async (project: BasecampProject) => {
    setSample(null);
    setSampleError('');
    try {
      setSample(await db.getBasecampSample(project.projectId));
    } catch (readFailed) {
      setSampleError(readError(readFailed, 'تعذّرت قراءة الملفّ'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const clientProjects = projects.filter((project) => project.kind === 'client');

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground mb-2">الربط ببيسكامب</h3>
        <p className="text-muted-foreground">
          يُقرأ من بيسكامب ولا يُكتب فيه. ومشروعُ العميل يُعرف بملفّ «بيانات المشروع».
        </p>
      </div>

      {notice && (
        <Alert variant={notice.tone === 'success' ? 'success' : 'warning'}>
          {notice.tone === 'success' ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
          <span>{notice.text}</span>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <span>{error}</span>
        </Alert>
      )}

      {/* ═══ الاتّصال ═══ */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
            <div>
              <h4 className="font-semibold text-foreground">حساب بيسكامب</h4>
              <p className="text-sm text-muted-foreground">
                {status?.state === 'connected'
                  ? status.accountName || 'مربوط'
                  : status?.state === 'not_configured'
                    ? 'لم يُسجَّل التطبيق بعد'
                    : 'غير مربوط'}
              </p>
            </div>
          </div>

          {status?.state === 'connected' ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={scan} disabled={scanning} variant="outline">
                <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
                {scanning ? 'جارٍ المسح' : 'إعادة المسح'}
              </Button>
              <Button
                onClick={async () => {
                  await db.disconnectBasecamp();
                  await load();
                  setNotice({ tone: 'warning', text: 'فُكّ الارتباط. وما استُورد باقٍ' });
                }}
                variant="outline"
              >
                <Unlink className="h-4 w-4" />
                فكّ الارتباط
              </Button>
            </div>
          ) : status?.state === 'not_connected' ? (
            /* رابطٌ لا زرُّ `fetch`: التصريح تحويلُ متصفّح إلى صفحة إذنٍ عند
               بيسكامب، و`fetch` لا يتبعه ولا يُظهرها. */
            <Button asChild>
              <a href="/api/basecamp/connect">
                <Link2 className="h-4 w-4" />
                اربط الحساب
              </a>
            </Button>
          ) : null}
        </div>

        {status?.state === 'not_configured' && (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <div className="space-y-1">
              <p>يلزم تسجيل تطبيق في بيسكامب مرّةً، ثم ضبط ثلاثة أسرار في المنصة:</p>
              <p className="text-xs font-mono" dir="ltr">
                BASECAMP_CLIENT_ID · BASECAMP_CLIENT_SECRET · BASECAMP_TOKEN_KEY
              </p>
            </div>
          </Alert>
        )}

        {status?.state === 'connected' && status.projects && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
            {[
              { label: 'كل المشاريع', value: status.projects.total },
              { label: 'مشاريع عملاء', value: status.projects.client },
              { label: 'داخلية', value: status.projects.internal },
              { label: 'مربوطة بقضية', value: status.projects.linked },
            ].map((tile) => (
              <div key={tile.label} className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  <bdi>{formatNumber(tile.value)}</bdi>
                </p>
                <p className="text-xs text-muted-foreground">{tile.label}</p>
              </div>
            ))}
          </div>
        )}

        {status?.state === 'connected' && (
          <p className="text-xs text-muted-foreground">
            {status.lastSyncAt
              ? <>آخر مزامنة <bdi>{formatDateTime(new Date(status.lastSyncAt * 1000))}</bdi></>
              : 'لم تجرِ مزامنةٌ بعد — والمسح قراءةٌ لا يكتب في العملاء ولا القضايا.'}
          </p>
        )}
      </Card>

      {/* ═══ المشاريع ═══ */}
      {status?.state === 'connected' && (
        <Card className="p-6 space-y-4">
          <div>
            <h4 className="font-semibold text-foreground">المشاريع وتصنيفها</h4>
            <p className="text-sm text-muted-foreground">
              التصنيف الآليّ اقتراحٌ مبنيٌّ على وجود «بيانات المشروع». والحكمُ لك — وما
              حكمتَ به لا ينقضه مسحٌ لاحق.
            </p>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>لم تُمسح المشاريع بعد.</p>
              <Button onClick={scan} disabled={scanning} className="mt-4">
                <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
                امسح الحساب
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-start py-2 font-medium">المشروع</th>
                    <th className="text-start py-2 font-medium">ملفّ البيانات</th>
                    <th className="text-start py-2 font-medium">القضية</th>
                    <th className="text-start py-2 font-medium">التصنيف</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.projectId} className="border-b border-border/50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={project.appUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground hover:text-primary font-medium"
                          >
                            {project.name}
                          </a>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          {project.status === 'archived' && (
                            <Badge variant="outline">مؤرشف</Badge>
                          )}
                        </div>
                        {project.lastError && (
                          <p className="text-xs text-destructive mt-1">
                            {ERRORS[project.lastError] ?? project.lastError}
                          </p>
                        )}
                      </td>

                      <td className="py-3">
                        {project.hasDocument ? (
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => showSample(project)}
                              className="text-primary hover:text-primary-strong inline-flex items-center gap-1"
                            >
                              <FileText className="h-4 w-4" aria-hidden="true" />
                              اعرض
                            </button>
                            {/* واسمُه كما هو عندهم: مشروعٌ لم يُعَد تسميةُ
                                ملفّه يُرى بلا فتحه. */}
                            {project.docTitle && (
                              <p className="text-xs text-muted-foreground">{project.docTitle}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="py-3">
                        {project.caseNumber ? (
                          <span className="text-foreground"><bdi>{project.caseNumber}</bdi></span>
                        ) : (
                          <span className="text-muted-foreground">لم تُربط</span>
                        )}
                      </td>

                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {(['client', 'internal'] as const).map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => classify(project, kind)}
                              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                                project.kind === kind
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'border-border text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {kind === 'client' ? 'عميل' : 'داخلي'}
                            </button>
                          ))}
                          {project.decidedByHand && (
                            <span className="text-xs text-muted-foreground ms-1">بيدك</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* `formatNumber` لا `isolate`: الأولى مُنسِّقُ المنصة كلِّها
              (`en-US` بفاصل آلاف)، والثانية تعزل الاتّجاه ولا تُنسّق —
              فرقمٌ من أربع خاناتٍ يظهر بلا فاصلةٍ بين بلاطاتٍ تحملها.
              و`bdi` يتكفّل بالاتّجاه. */}
          {clientProjects.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <bdi>{formatNumber(clientProjects.length)}</bdi>
              {' مشروعاً مصنَّفاً «عميل». ولا يُستورد منها شيءٌ قبل معاينةٍ تراها وتؤكّدها.'}
            </p>
          )}
        </Card>
      )}

      {/* ═══ خريطةُ الحقول ثم المعاينة ثم الاختلافات ═══
          ولا تظهر إلا بعد ربطٍ قائم: لوحُ معاينةٍ فوق حسابٍ غير مربوط
          يَعِد بما لا يقع. */}
      {status?.state === 'connected' && (
        <>
          <FieldMapPanel />
          <PreviewPanel
            syncEnabled={status.syncEnabled === true}
            lastSyncAt={status.lastSyncAt ?? null}
            onChanged={() => load(true)}
          />
          <ConflictsPanel onResolved={() => load(true)} />
        </>
      )}

      {/* ═══ نصُّ الملفّ ═══
          يُعرض ليُبنى عليه ربطُ الحقول — من الواقع لا من تخمين. */}
      {(sample || sampleError) && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold text-foreground">
              {sample ? `«${sample.title || 'بيانات المشروع'}» — ${sample.projectName}` : 'تعذّرت القراءة'}
            </h4>
            <Button
              onClick={() => { setSample(null); setSampleError(''); }}
              variant="outline"
              size="sm"
            >
              أغلق
            </Button>
          </div>

          {sampleError ? (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <span>{sampleError}</span>
            </Alert>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                هذا نصُّ الملفّ كما هو في بيسكامب. ومنه تُبنى خريطةُ الحقول في المرحلة
                التالية — تُقرأ عناوينُه الحقيقية ولا تُخمَّن.
              </p>
              {/* نصٌّ لا HTML مُصيَّر: محتوى الملفّ يأتي من بيسكامب، وتصييرُه
                  في صفحة المنصة يجعله شيفرةً تعمل. والمقصود قراءتُه لا عرضُه
                  منسَّقاً. */}
              <pre className="text-xs bg-muted rounded-xl p-4 overflow-x-auto whitespace-pre-wrap max-h-96">
                {sample?.content}
              </pre>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
