import React, { useState, useEffect } from 'react';
import { Users, FileText, TrendingUp, Award, UserPlus, Link, Monitor, Copy, CheckCircle } from 'lucide-react';
import StatsCard from './StatsCard';
import ChartCard from './ChartCard';
import ActivityFeed from './ActivityFeed';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function Dashboard() {
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
      // جلب البيانات مباشرة من Supabase
      const [
        { data: clients, error: clientsError },
        { data: prospects, error: prospectsError },
        { data: cases, error: casesError }
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('cases').select('*')
      ]);

      if (clientsError) throw clientsError;
      if (prospectsError) throw prospectsError;
      if (casesError) throw casesError;

      const clientsData = clients || [];
      const prospectsData = prospects || [];
      const casesData = cases || [];

      // حساب الإحصائيات
      const totalClients = clientsData.length;
      const totalProspects = prospectsData.length;
      const totalCases = casesData.length;
      
      const pendingCases = casesData.filter(c => c.status === 'pending').length;
      const inProgressCases = casesData.filter(c => c.status === 'in-progress').length;
      const completedCases = casesData.filter(c => c.status === 'completed').length;
      const postponedCases = casesData.filter(c => c.status === 'postponed').length;
      
      const wonCases = casesData.filter(c => c.outcome === 'won').length;
      const winRate = completedCases > 0 ? Math.round((wonCases / completedCases) * 100) : 0;
      
      const conversionRate = (totalClients + totalProspects) > 0 ? 
        Math.round((totalClients / (totalClients + totalProspects)) * 100) : 0;

      // توزيع العملاء حسب النوع
      const clientsByType = {
        individual: clientsData.filter(c => c.client_type === 'individual').length,
        company: clientsData.filter(c => c.client_type === 'company').length,
        association: clientsData.filter(c => c.client_type === 'association').length,
        government: clientsData.filter(c => c.client_type === 'government').length
      };

      // توزيع العملاء المحتملين حسب الحالة
      const prospectsByStatus: Record<string, number> = {};
      prospectsData.forEach(p => {
        prospectsByStatus[p.prospect_status] = (prospectsByStatus[p.prospect_status] || 0) + 1;
      });

      // توزيع القضايا حسب الحالة
      const casesByStatus = {
        pending: pendingCases,
        'in-progress': inProgressCases,
        completed: completedCases,
        postponed: postponedCases
      };

      setStats({
        totalClients,
        totalProspects,
        totalCases,
        pendingCases,
        completedCases,
        winRate,
        clientsByType,
        prospectsByStatus,
        casesByStatus,
        conversionRate
      });
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
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444'
        ],
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
        backgroundColor: '#3b82f6',
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
          color="bg-blue-500"
          trend={{ value: 12, label: 'الشهر الماضي' }}
        />
        <StatsCard
          title="العملاء المحتملين"
          value={stats.totalProspects}
          icon={UserPlus}
          color="bg-purple-500"
          trend={{ value: 8, label: 'الشهر الماضي' }}
        />
        <StatsCard
          title="إجمالي القضايا"
          value={stats.totalCases}
          icon={FileText}
          color="bg-green-500"
          trend={{ value: 8, label: 'الشهر الماضي' }}
        />
        <StatsCard
          title="القضايا المنظورة"
          value={stats.pendingCases}
          icon={TrendingUp}
          color="bg-amber-500"
        />
        <StatsCard
          title="معدل الربح"
          value={`${stats.winRate}%`}
          icon={Award}
          color="bg-red-500"
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