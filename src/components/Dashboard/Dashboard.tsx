import { useState, useEffect } from 'react';
import { Award, Banknote, FileText, Gavel, HandHeart, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react';
import { Money } from '@/registry/naf/currency/money';
import { Card } from '@/registry/naf/ui/card';
import StatsCard from './StatsCard';
import ChartCard from './ChartCard';
import ActivityFeed from './ActivityFeed';
import { db } from '../../data/database';
import { DashboardStats, ViewFilter } from '../../types';
import { useChartPalette } from '../../lib/chart-tokens';
import { formatNumber } from '@/registry/naf/lib/format';
import { useSettingList } from '../../lib/use-settings';
import { caseStatusLabel, clientTypeLabel } from '../../lib/labels';

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

  useEffect(() => {
    // تحديث الإحصائيات عند تحميل الصفحة
    loadStats();
    
    // تحديث الإحصائيات كل 30 ثانية
    const interval = setInterval(loadStats, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  const loadStats = async () => {
    try {
      // الإحصاءات تُحسب في القاعدة لا هنا: جلبُ الجداول كاملةً إلى المتصفّح
      // ليُعدّ صفوفُها كان ينقل آلاف الصفوف في كل فتحةِ لوحة.
      setStats(await db.getStats());
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* والمؤشّرات تأتي من `‎/api/stats‎` محسوبةً — كانت أرقاماً مكتوبةً
            هنا لا تُقرأ من شيء ولا تتغيّر: «‎+١٢٪‎» و«‎+٨٪‎» و«‎+٥٪‎» في كل
            فتحةٍ منذ أوّل يوم. */}
        <StatsCard
          title="إجمالي العملاء"
          value={stats.totalClients}
          icon={Users}
          color="bg-chart-1"
          trend={stats.growth?.clients}
          onClick={go('clients')}
        />
        <StatsCard
          title="العملاء المحتملين"
          value={stats.totalProspects}
          icon={UserPlus}
          color="bg-chart-2"
          trend={stats.growth?.prospects}
          onClick={go('prospects')}
        />
        <StatsCard
          title="إجمالي القضايا"
          value={stats.totalCases}
          icon={FileText}
          color="bg-chart-3"
          trend={stats.growth?.cases}
          onClick={go('cases')}
        />
        {/* «جارية» بنوعها — قضايا منظورة أمام جهة، وأعمالٌ قانونية مستمرّة. */}
        <StatsCard
          title="قضايا منظورة"
          value={stats.ongoingByKind?.litigation ?? 0}
          icon={Gavel}
          color="bg-chart-4"
          onClick={go('cases', { status: 'in-progress', workKind: 'litigation' })}
        />
        <StatsCard
          title="أعمال قانونية مستمرة"
          value={stats.ongoingByKind?.legalWork ?? 0}
          icon={TrendingUp}
          color="bg-chart-2"
          onClick={go('cases', { status: 'in-progress', workKind: 'legal_work' })}
        />
        <StatsCard
          title="معدل الربح"
          value={`${formatNumber(stats.winRate)}%`}
          icon={Award}
          color="bg-chart-5"
          trend={stats.growth?.winRate ?? undefined}
          onClick={go('cases', { status: 'completed' })}
        />
        {/* العددُ وقيمتُها التقديرية هذا العام — ما كان المكتب سيتقاضاه. */}
        <StatsCard
          title="قضايا تطوّعية"
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
            title="المحصَّل هذا العام"
            value={<>
              <Money value={stats.collectedThisYear.cases + stats.collectedThisYear.general} />
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
        {/* ما لم يُحصَّل من أتعاب القضايا الحاضرة — مجموعُ «المتبقّي». */}
        <StatsCard
          title="مستحقّات غير محصّلة"
          value={<Money value={stats.outstandingAmount ?? 0} />}
          icon={Wallet}
          color="bg-chart-2"
          onClick={go('cases')}
        />
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