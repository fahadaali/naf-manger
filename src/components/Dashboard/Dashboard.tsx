import { useState, useEffect } from 'react';
import { Award, Banknote, CalendarRange, FileText, Gavel, HandHeart, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react';
import { Money } from '@/registry/naf/currency/money';
import { Card } from '@/registry/naf/ui/card';
import StatsCard from './StatsCard';
import ChartCard from './ChartCard';
import ActivityFeed from './ActivityFeed';
import { db } from '../../data/database';
import { DashboardStats, ViewFilter } from '../../types';
import PeriodFilter from './PeriodFilter';
import { Period, periodRange } from '../../lib/periods';

const PERIOD_KEY = 'dashboard-period';
import { useChartPalette } from '../../lib/chart-tokens';
import { formatDate, formatNumber } from '@/registry/naf/lib/format';
import { useSettingList } from '../../lib/use-settings';
import { caseStatusLabel, clientTypeLabel, contractFrequencyLabel } from '../../lib/labels';

/* الحالةُ الفارغة تُكتب مرّةً وتُقرأ في الابتداء وفي الخطأ معاً: كانت
   مكرّرةً في موضعين، فيُزاد حقلٌ في أحدهما ويُنسى في الآخر. */
const EMPTY_STATS: DashboardStats = {
  totalClients: 0,
  totalProspects: 0,
  totalCases: 0,
  pendingCases: 0,
  completedCases: 0,
  winRate: 0,
  clientsByType: { individual: 0, company: 0, association: 0, government: 0 },
  prospectsByStatus: {},
  casesByStatus: { pending: 0, 'in-progress': 0, completed: 0, postponed: 0 },
  conversionRate: 0,
  proBonoCases: 0,
  outstandingAmount: 0,
};

/** نقرةٌ في اللوحة تفتح شاشتَها بالتصفية المناسبة — `App.tsx`. */
type Navigate = (view: string, filter?: ViewFilter) => void;

export default function Dashboard({ onNavigate }: { onNavigate?: Navigate } = {}) {
  const go = (view: string, filter?: ViewFilter) => () => onNavigate?.(view, filter);
  // لوحة الرسوم تُقرأ من الرموز وتُعاد قراءتها عند تبديل المظهر
  const palette = useChartPalette();

  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  /* الفترةُ تُذكر لكلّ متصفّح — تفضيلٌ لا بيانات، فـ`localStorage` يكفي. */
  const [period, setPeriod] = useState<Period>(() => {
    try {
      const saved = localStorage.getItem(PERIOD_KEY);
      return saved ? JSON.parse(saved) as Period : { kind: 'all' };
    } catch {
      return { kind: 'all' };
    }
  });
  const range = periodRange(period);
  const ranged = Boolean(range);
  const choosePeriod = (next: Period) => {
    setPeriod(next);
    try { localStorage.setItem(PERIOD_KEY, JSON.stringify(next)); } catch { /* بلا تخزينٍ يعمل كما هو */ }
  };

  useEffect(() => {
    // تحديث الإحصائيات عند تحميل الصفحة وعند تبديل الفترة
    loadStats();
    
    // تحديث الإحصائيات كل 30 ثانية
    const interval = setInterval(loadStats, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from, range?.to]);
  
  const loadStats = async () => {
    try {
      // الإحصاءات تُحسب في القاعدة لا هنا: جلبُ الجداول كاملةً إلى المتصفّح
      // ليُعدّ صفوفُها كان ينقل آلاف الصفوف في كل فتحةِ لوحة.
      setStats(await db.getStats(range));
    } catch (error) {
      console.error('Error loading stats:', error);
      // في حالة الخطأ، استخدم قيم افتراضية
      setStats(EMPTY_STATS);
    }
  };

  /* ═══ الرسمُ يتبع «تكوين النظام» ═══
   *
   * كانت الأربعةُ مكتوبةً هنا بأسمائها — `individual` و`company` وأختاهما،
   * و`pending` و`completed` وأختاهما — و`clientTypes` و`caseStatuses`
   * قائمتان يحرّرهما مسؤولُ المنصة. فنوعُ عميلٍ خامس يُضاف ويُحفظ ويظهر
   * في النماذج، **ولا يظهر في رسمٍ واحد**، وأصحابُه يختفون من «توزيع
   * العملاء» بلا أن يُقال.
   *
   * والقيمُ المسجَّلة في الصفوف تُضمّ إلى المكوَّنة: نوعٌ حُذف من التكوين
   * وبقيت له صفوفٌ لا يسقط من الرسم فتنقص الحصيلة عن مجموعها. */
  /* نقرةٌ على قطعةٍ أو عمود — بفهرسها في البيانات. والمؤشّرُ يدلّ أنها تُنقر. */
  const clickable = (open: (index: number) => void) => ({
    onClick: (_event: unknown, elements: { index: number }[]) => {
      if (elements?.length) open(elements[0].index);
    },
    onHover: (event: { native?: { target?: { style?: CSSStyleDeclaration } } }, elements: unknown[]) => {
      const style = event?.native?.target?.style;
      if (style) style.cursor = elements?.length ? 'pointer' : 'default';
    },
  });

  const configuredTypes = useSettingList('clientTypes');
  const configuredStatuses = useSettingList('caseStatuses');

  const clientTypes = [...new Set([...configuredTypes, ...Object.keys(stats.clientsByType)])];
  const caseStatuses = [...new Set([...configuredStatuses, ...Object.keys(stats.casesByStatus)])];

  const clientTypeData = {
    labels: clientTypes.map(clientTypeLabel),
    datasets: [
      {
        data: clientTypes.map((type) => stats.clientsByType[type] ?? 0),
        backgroundColor: palette.slice(0, clientTypes.length),
        borderWidth: 0
      }
    ]
  };

  const caseStatusData = {
    labels: caseStatuses.map(caseStatusLabel),
    datasets: [
      {
        label: 'عدد القضايا',
        data: caseStatuses.map((status) => stats.casesByStatus[status] ?? 0),
        backgroundColor: palette[1],
        borderRadius: 4
      }
    ]
  };

  return (
    <div className="space-y-6">
      <PeriodFilter value={period} onChange={choosePeriod} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* والمؤشّرات تأتي من `‎/api/stats‎` محسوبةً — كانت أرقاماً مكتوبةً
            هنا لا تُقرأ من شيء ولا تتغيّر: «‎+١٢٪‎» و«‎+٨٪‎» و«‎+٥٪‎» في كل
            فتحةٍ منذ أوّل يوم. */}
        <StatsCard
          title={ranged ? 'عملاء جدد في الفترة' : 'إجمالي العملاء'}
          value={stats.totalClients}
          icon={Users}
          color="bg-chart-1"
          trend={stats.growth?.clients}
          against={ranged ? 'period' : 'month'}
          onClick={go('clients')}
        />
        <StatsCard
          title={ranged ? 'محتملون جدد في الفترة' : 'العملاء المحتملين'}
          value={stats.totalProspects}
          icon={UserPlus}
          color="bg-chart-2"
          trend={stats.growth?.prospects}
          against={ranged ? 'period' : 'month'}
          onClick={go('prospects')}
        />
        <StatsCard
          title={ranged ? 'قضايا فُتحت في الفترة' : 'إجمالي القضايا'}
          value={stats.totalCases}
          icon={FileText}
          color="bg-chart-3"
          trend={stats.growth?.cases}
          against={ranged ? 'period' : 'month'}
          onClick={go('cases')}
        />
        {/* «جارية» بنوعها — قضايا منظورة أمام جهة، وأعمالٌ قانونية مستمرّة. */}
        <StatsCard
          title={ranged ? 'قضايا منظورة (الآن)' : 'قضايا منظورة'}
          value={stats.ongoingByKind?.litigation ?? 0}
          icon={Gavel}
          color="bg-chart-4"
          onClick={go('cases', { status: 'in-progress', workKind: 'litigation' })}
        />
        <StatsCard
          title={ranged ? 'أعمال قانونية مستمرة (الآن)' : 'أعمال قانونية مستمرة'}
          value={stats.ongoingByKind?.legalWork ?? 0}
          icon={TrendingUp}
          color="bg-chart-2"
          onClick={go('cases', { status: 'in-progress', workKind: 'legal_work' })}
        />
        {/* نسبةُ كسب القضايا: الرابحةُ من المحسومة — ما له نتيجة. وتحتها
            مكوّناتُها، وما انتهى بلا نتيجةٍ مسجّلة ليُسجَّل. */}
        <StatsCard
          title="نسبة كسب القضايا"
          value={<>
            {`${formatNumber(stats.winRate)}%`}
            {stats.outcomes && (
              <span className="block text-xs font-normal text-muted-foreground">
                {/* والتسويةُ والصلحُ كسبٌ للموكّل. */}
                {stats.outcomes.decided > 0
                  ? `${formatNumber(stats.outcomes.wins ?? stats.outcomes.won + stats.outcomes.settled)} كسب من ${formatNumber(stats.outcomes.decided)} محسومة`
                    + (stats.outcomes.settled ? ` (منها ${formatNumber(stats.outcomes.settled)} تسوية)` : '')
                    + (stats.outcomes.lost ? ` · ${formatNumber(stats.outcomes.lost)} خاسرة` : '')
                  : ranged ? 'لا قضايا حُسمت في الفترة' : 'لا قضايا محسومة بعد'}
                {stats.outcomes.undecided > 0 && (
                  <span className="block text-warning-strong">
                    {`${formatNumber(stats.outcomes.undecided)} منتهية بلا نتيجة — سجّلها`}
                  </span>
                )}
              </span>
            )}
          </>}
          icon={Award}
          color="bg-chart-5"
          trend={stats.growth?.winRate ?? undefined}
          against={ranged ? 'period' : 'month'}
          onClick={go('cases', { status: 'completed' })}
        />
        {/* العددُ وقيمتُها التقديرية هذا العام — ما كان المكتب سيتقاضاه. */}
        <StatsCard
          title={ranged ? 'قضايا تطوّعية في الفترة' : 'قضايا تطوّعية'}
          value={(stats.proBonoValue ?? 0) > 0
            ? <>{formatNumber(stats.proBonoCases ?? 0)} <span className="text-base font-medium text-muted-foreground">· <Money value={stats.proBonoValue ?? 0} /></span></>
            : stats.proBonoCases ?? 0}
          icon={HandHeart}
          color="bg-chart-1"
          onClick={go('cases')}
        />
        {/* المحصَّلُ هذا العام: القضايا والإيرادُ العامّ بلا قضية — كلٌّ بمفرده. */}
        {stats.collectedThisYear && (
          <StatsCard
            title={ranged ? 'المحصَّل في الفترة' : 'المحصَّل هذا العام'}
            value={<>
              <Money value={stats.collectedThisYear.cases + stats.collectedThisYear.general + (stats.collectedThisYear.contracts ?? 0)} />
              {(stats.collectedThisYear.contracts ?? 0) > 0 && (
                <span className="block text-xs font-normal text-muted-foreground">
                  منها دفعات العقود السنوية: <Money value={stats.collectedThisYear.contracts ?? 0} />
                </span>
              )}
              {stats.collectedThisYear.general > 0 && (
                <span className="block text-xs font-normal text-muted-foreground">
                  منها إيرادٌ عام بلا قضية: <Money value={stats.collectedThisYear.general} />
                </span>
              )}
            </>}
            icon={Banknote}
            color="bg-chart-3"
          />
        )}
        {/* ما لم يُحصَّل من أتعاب القضايا الحاضرة — مجموعُ «المتبقّي» — ومعه
            مستحقُّ العقود السنوية حتى نهايتها، وقضاياها خارج الأوّل فلا يُعدّ مرّتين. */}
        <StatsCard
          title={ranged ? 'مستحقّات غير محصّلة (الآن)' : 'مستحقّات غير محصّلة'}
          value={<>
            <Money value={(stats.outstandingAmount ?? 0) + (stats.contracts?.overdue ?? 0) + (stats.contracts?.notYetDue ?? 0)} />
            {stats.contracts && (stats.contracts.overdue > 0 || stats.contracts.notYetDue > 0) && (
              <span className="block text-xs font-normal text-muted-foreground">
                أتعاب القضايا: <Money value={stats.outstandingAmount ?? 0} />
                <span className="block">
                  العقود السنوية: <Money value={stats.contracts.overdue + stats.contracts.notYetDue} />
                  {stats.contracts.overdue > 0 && (
                    <span className="text-destructive-strong"> (متأخّر <Money value={stats.contracts.overdue} />)</span>
                  )}
                </span>
              </span>
            )}
          </>}
          icon={Wallet}
          color="bg-chart-2"
          onClick={go('cases')}
        />
        {/* العقودُ السنوية — الساريةُ الآن، وما ينتهي منها خلال ستّين يوماً. */}
        {stats.contracts && (stats.contracts.active > 0 || stats.contracts.upcoming > 0 || stats.contracts.expiring.length > 0) && (
          <StatsCard
            title={ranged ? 'العقود السنوية السارية (الآن)' : 'العقود السنوية السارية'}
            value={<>
              {formatNumber(stats.contracts.active)}
              <span className="block text-xs font-normal text-muted-foreground">
                {stats.contracts.expiring.length > 0
                  ? <span className="text-warning-strong">{`${formatNumber(stats.contracts.expiring.length)} تنتهي خلال 60 يوماً`}</span>
                  : 'لا عقود تنتهي خلال 60 يوماً'}
                {stats.contracts.upcoming > 0 && ` · ${formatNumber(stats.contracts.upcoming)} لم تبدأ`}
              </span>
            </>}
            icon={CalendarRange}
            color="bg-chart-4"
          />
        )}
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* والرسمان يُنقران: القطعةُ تفتح عملاءَ نوعها، والعمودُ قضايا حالته. */}
            <ChartCard
              title="توزيع العملاء حسب النوع"
              type="doughnut"
              data={clientTypeData}
              options={clickable((index) => go('clients', { clientType: clientTypes[index] })())}
            />
            <ChartCard
              title="حالة القضايا"
              type="bar"
              data={caseStatusData}
              options={clickable((index) => go('cases', { status: caseStatuses[index] })())}
            />
          </div>

          {/* ═══ عقودٌ تنتهي قريباً ═══
              خلال ستّين يوماً، أو انتهت حديثاً ولم تُجدَّد — والصفُّ يفتح ملفَّ العميل. */}
          {(stats.contracts?.expiring ?? []).length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <CalendarRange className="h-5 w-5" aria-hidden="true" />
                عقود سنوية تنتهي خلال 60 يوماً
              </h3>
              <ul className="divide-y">
                {(stats.contracts?.expiring ?? []).map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={go('clients', { clientId: row.clientId })}
                      className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md p-2 text-start text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      <span className="font-medium text-foreground">{row.clientName || 'عميل'}</span>
                      <span className="text-muted-foreground">
                        دفعة {contractFrequencyLabel(row.frequency)} <Money value={row.currentAmount} />
                        {' · '}
                        <bdi>{formatDate(row.endDate)}</bdi>
                        {' · '}
                        <span className={row.daysLeft < 0 ? 'text-destructive-strong font-medium' : row.daysLeft <= 30 ? 'text-warning-strong font-medium' : ''}>
                          {row.daysLeft < 0
                            ? `انتهى منذ ${formatNumber(-row.daysLeft)} يوماً — بلا تجديد`
                            : row.daysLeft === 0 ? 'ينتهي اليوم' : `بعد ${formatNumber(row.daysLeft)} يوماً`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* ═══ حِملُ المحامين ═══
              القضايا المفتوحة لكلّ محامٍ مسؤول — و«بلا محامٍ» أولى بالنظر. */}
          {(stats.casesByLawyer ?? []).length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">حِمل المحامين — القضايا المفتوحة</h3>
              <ul className="space-y-3">
                {(stats.casesByLawyer ?? []).map((row) => {
                  const top = Math.max(...(stats.casesByLawyer ?? []).map((entry) => entry.open), 1);
                  return (
                    <li key={row.lawyerId ?? 'none'}>
                      {/* الصفُّ زرٌّ يفتح قضايا المحامي — والمحتوى `span` لا `div`: الزرُّ لا يحمل كتلاً. */}
                      <button
                        type="button"
                        onClick={go('cases', { lawyer: row.lawyerId ?? 'none' })}
                        className="block w-full space-y-1 rounded-md p-1 text-start hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className="flex justify-between text-sm">
                          <span className={row.lawyerId ? 'text-foreground' : 'text-warning-strong font-medium'}>
                            {row.lawyerId ? row.name || 'محامٍ' : 'بلا محامٍ'}
                          </span>
                          <bdi className="text-muted-foreground">{formatNumber(row.open)}</bdi>
                        </span>
                        <span className="block h-2 rounded-full bg-muted overflow-hidden">
                          <span
                            className={`block h-full rounded-full ${row.lawyerId ? 'bg-primary' : 'bg-warning'}`}
                            style={{ width: `${(row.open / top) * 100}%` }}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
        
        <div className="lg:col-span-1">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}