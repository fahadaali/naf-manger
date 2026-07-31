import React, { useState, useEffect } from 'react';
import { Award, FileText, TrendingUp, UserPlus, Users } from 'lucide-react';
import StatsCard from './StatsCard';
import ChartCard from './ChartCard';
import ActivityFeed from './ActivityFeed';
import { db } from '../../data/database';
import { useChartPalette } from '../../lib/chart-tokens';
import { formatNumber } from '@/registry/naf/lib/format';

export default function Dashboard() {
  // لوحة الرسوم تُقرأ من الرموز وتُعاد قراءتها عند تبديل المظهر
  const palette = useChartPalette();

  const [stats, setStats] = useState({
    totalClients: 0,
    totalProspects: 0,
    totalCases: 0,
    pendingCases: 0,
    completedCases: 0,
    winRate: 0,
    clientsByType: { individual: 0, company: 0, association: 0, government: 0 },
    prospectsByStatus: {},
    casesByStatus: { pending: 0, 'in-progress': 0, completed: 0, postponed: 0 },
    conversionRate: 0
  });

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
      setStats({
        totalClients: 0,
        totalProspects: 0,
        totalCases: 0,
        pendingCases: 0,
        completedCases: 0,
        winRate: 0,
        clientsByType: { individual: 0, company: 0, association: 0, government: 0 },
        prospectsByStatus: {},
        casesByStatus: { pending: 0, 'in-progress': 0, completed: 0, postponed: 0 },
        conversionRate: 0
      });
    }
  };

  const clientTypeData = {
    labels: ['أفراد', 'شركات', 'جمعيات', 'جهات حكومية'],
    datasets: [
      {
        data: [
          stats.clientsByType.individual,
          stats.clientsByType.company,
          stats.clientsByType.association,
          stats.clientsByType.government
        ],
        backgroundColor: palette.slice(0, 4),
        borderWidth: 0
      }
    ]
  };

  const caseStatusData = {
    labels: ['منظورة', 'مكتملة', 'مؤجلة', 'قيد المعالجة'],
    datasets: [
      {
        label: 'عدد القضايا',
        data: [
          stats.casesByStatus.pending,
          stats.casesByStatus.completed,
          stats.casesByStatus.postponed,
          stats.casesByStatus['in-progress']
        ],
        backgroundColor: palette[1],
        borderRadius: 4
      }
    ]
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        <StatsCard
          title="إجمالي العملاء"
          value={stats.totalClients}
          icon={Users}
          color="bg-chart-1"
          trend={{ value: 12, label: 'الشهر الماضي' }}
        />
        <StatsCard
          title="العملاء المحتملين"
          value={stats.totalProspects}
          icon={UserPlus}
          color="bg-chart-2"
          trend={{ value: 8, label: 'الشهر الماضي' }}
        />
        <StatsCard
          title="إجمالي القضايا"
          value={stats.totalCases}
          icon={FileText}
          color="bg-chart-3"
          trend={{ value: 8, label: 'الشهر الماضي' }}
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
          trend={{ value: 5, label: 'الشهر الماضي' }}
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