import { useState, useEffect } from 'react';
import { Award, FileText, TrendingUp, UserPlus, Users } from 'lucide-react';
import StatsCard from './StatsCard';
import ChartCard from './ChartCard';
import ActivityFeed from './ActivityFeed';
import { db } from '../../data/database';
import { DashboardStats } from '../../types';
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
};

export default function Dashboard() {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* والمؤشّرات تأتي من `‎/api/stats‎` محسوبةً — كانت أرقاماً مكتوبةً
            هنا لا تُقرأ من شيء ولا تتغيّر: «‎+١٢٪‎» و«‎+٨٪‎» و«‎+٥٪‎» في كل
            فتحةٍ منذ أوّل يوم. */}
        <StatsCard
          title="إجمالي العملاء"
          value={stats.totalClients}
          icon={Users}
          color="bg-chart-1"
          trend={stats.growth?.clients}
        />
        <StatsCard
          title="العملاء المحتملين"
          value={stats.totalProspects}
          icon={UserPlus}
          color="bg-chart-2"
          trend={stats.growth?.prospects}
        />
        <StatsCard
          title="إجمالي القضايا"
          value={stats.totalCases}
          icon={FileText}
          color="bg-chart-3"
          trend={stats.growth?.cases}
        />
        <StatsCard
          title="القضايا المنظورة"
          value={stats.pendingCases}
          icon={TrendingUp}
          color="bg-chart-4"
        />
        <StatsCard
          title="معدل الربح"
          value={`${formatNumber(stats.winRate)}%`}
          icon={Award}
          color="bg-chart-5"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <ChartCard
              title="توزيع العملاء حسب النوع"
              type="doughnut"
              data={clientTypeData}
            />
            <ChartCard
              title="حالة القضايا"
              type="bar"
              data={caseStatusData}
            />
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}