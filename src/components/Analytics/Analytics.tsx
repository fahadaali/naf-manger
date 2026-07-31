import React, { useState, useEffect } from 'react';
import { 
  ChartBarIcon, 
  UserGroupIcon, 
  DocumentTextIcon,
  CalendarIcon,
  FunnelIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { TrendingUp } from 'lucide-react';
import { useChartPalette, softFill } from '../../lib/chart-tokens';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { Client, Prospect, Case, ActivityLog } from '../../types';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { db } from '../../data/database';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

export default function Analytics() {
  // لوحة الرسوم تُقرأ من الرموز وتُعاد قراءتها عند تبديل المظهر
  const palette = useChartPalette();

  const [clients, setClients] = useState<Client[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [selectedMetric, setSelectedMetric] = useState('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      
      /* التحويل صار في `database.ts` — موضعٌ واحد. وكان مكرّراً هنا حرفاً
         بحرف، فأيُّ عمودٍ يتغيّر اسمُه يلزم تعديلُه في موضعين، وأولُ ما
         يُنسى أحدُهما. */
      const [clientsData, prospectsData, casesData, activitiesData] = await Promise.all([
        db.getClients(),
        db.getProspects(),
        db.getCases(),
        db.getActivities(),
      ]);

      setClients(clientsData);
      setProspects(prospectsData);
      setCases(casesData);
      setActivities(activitiesData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      // Set empty arrays as fallback
      setClients([]);
      setProspects([]);
      setCases([]);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeFilter = () => {
    const days = parseInt(dateRange);
    const endDate = new Date();
    const startDate = subDays(endDate, days);
    return { startDate, endDate };
  };

  const getFilteredData = () => {
    const { startDate, endDate } = getDateRangeFilter();
    
    return {
      clients: (clients || []).filter(client => 
        isWithinInterval(client.joinDate, { start: startDate, end: endDate })
      ),
      prospects: (prospects || []).filter(prospect => 
        isWithinInterval(prospect.joinDate, { start: startDate, end: endDate })
      ),
      cases: (cases || []).filter(case_ => 
        isWithinInterval(case_.createdDate, { start: startDate, end: endDate })
      ),
      activities: (activities || []).filter(activity => 
        isWithinInterval(activity.timestamp, { start: startDate, end: endDate })
      )
    };
  };

  const getFilteredCases = () => {
    return (cases || []).filter(case_ => {
      const { startDate, endDate } = getDateRangeFilter();
      return isWithinInterval(case_.createdDate, { start: startDate, end: endDate });
    });
  };

  const getMonthlyTrends = () => {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subDays(currentDate, i * 30));
      const monthEnd = endOfMonth(monthStart);
      
      const monthClients = (clients || []).filter(client =>
        isWithinInterval(client.joinDate, { start: monthStart, end: monthEnd })
      ).length;
      
      const monthCases = (cases || []).filter(case_ =>
        isWithinInterval(case_.createdDate, { start: monthStart, end: monthEnd })
      ).length;
      
      const monthProspects = (prospects || []).filter(prospect =>
        isWithinInterval(prospect.joinDate, { start: monthStart, end: monthEnd })
      ).length;
      
      months.push({
        month: format(monthStart, 'MMM yyyy'),
        clients: monthClients,
        cases: monthCases,
        prospects: monthProspects
      });
    }
    
    return months;
  };

  const getClientTypeDistribution = () => {
    const filteredClients = getFilteredData().clients;
    const distribution = {
      individual: filteredClients.filter(c => c.clientType === 'individual').length,
      company: filteredClients.filter(c => c.clientType === 'company').length,
      association: filteredClients.filter(c => c.clientType === 'association').length,
      government: filteredClients.filter(c => c.clientType === 'government').length
    };
    
    return {
      labels: ['أفراد', 'شركات', 'جمعيات', 'جهات حكومية'],
      datasets: [{
        data: [distribution.individual, distribution.company, distribution.association, distribution.government],
        backgroundColor: palette.slice(0, 4),
        borderWidth: 0
      }]
    };
  };

  const getCaseStatusDistribution = () => {
    const filteredCases = getFilteredCases();
    const distribution = {
      pending: filteredCases.filter(c => c.status === 'pending').length,
      'in-progress': filteredCases.filter(c => c.status === 'in-progress').length,
      completed: filteredCases.filter(c => c.status === 'completed').length,
      postponed: filteredCases.filter(c => c.status === 'postponed').length
    };
    
    return {
      labels: ['منظورة', 'قيد المعالجة', 'مكتملة', 'مؤجلة'],
      datasets: [{
        data: [distribution.pending, distribution['in-progress'], distribution.completed, distribution.postponed],
        backgroundColor: palette.slice(0, 4),
        borderWidth: 0
      }]
    };
  };

  const getProspectStatusDistribution = () => {
    const filteredProspects = getFilteredData().prospects;
    const statusCounts: Record<string, number> = {};
    
    filteredProspects.forEach(prospect => {
      statusCounts[prospect.prospectStatus] = (statusCounts[prospect.prospectStatus] || 0) + 1;
    });
    
    return {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: palette,
        borderWidth: 0
      }]
    };
  };

  const getMonthlyTrendsChart = () => {
    const monthlyData = getMonthlyTrends();
    
    return {
      labels: monthlyData.map(m => m.month),
      datasets: [
        {
          label: 'العملاء الجدد',
          data: monthlyData.map(m => m.clients),
          borderColor: palette[0],
          backgroundColor: softFill(palette[0]),
          tension: 0.4
        },
        {
          label: 'القضايا الجديدة',
          data: monthlyData.map(m => m.cases),
          borderColor: palette[1],
          backgroundColor: softFill(palette[1]),
          tension: 0.4
        },
        {
          label: 'العملاء المحتملين',
          data: monthlyData.map(m => m.prospects),
          borderColor: palette[2],
          backgroundColor: softFill(palette[2]),
          tension: 0.4
        }
      ]
    };
  };

  const getCaseTypeDistribution = () => {
    const filteredCases = getFilteredCases();
    const typeCounts: Record<string, number> = {};
    
    filteredCases.forEach(case_ => {
      typeCounts[case_.caseType] = (typeCounts[case_.caseType] || 0) + 1;
    });
    
    return {
      labels: Object.keys(typeCounts),
      datasets: [{
        label: 'عدد القضايا',
        data: Object.values(typeCounts),
        backgroundColor: palette[1],
        borderRadius: 4
      }]
    };
  };

  const getWinRateAnalysis = () => {
    const completedCases = getFilteredCases().filter(c => c.status === 'completed');
    const wonCases = completedCases.filter(c => c.outcome === 'won');
    const lostCases = completedCases.filter(c => c.outcome === 'lost');
    const settledCases = completedCases.filter(c => c.outcome === 'settled');
    
    return {
      labels: ['رابحة', 'خاسرة', 'تسوية'],
      datasets: [{
        data: [wonCases.length, lostCases.length, settledCases.length],
        backgroundColor: palette.slice(0, 3),
        borderWidth: 0
      }]
    };
  };

  const getConversionFunnel = () => {
    const totalProspects = prospects.length;
    const interestedProspects = prospects.filter(p => p.prospectStatus === 'مهتم').length;
    const contactedProspects = prospects.filter(p => p.prospectStatus === 'تم التواصل').length;
    const waitingProspects = prospects.filter(p => p.prospectStatus === 'بانتظار توقيع').length;
    const convertedClients = clients.length;
    
    return {
      labels: ['إجمالي العملاء المحتملين', 'مهتمين', 'تم التواصل', 'بانتظار توقيع', 'تم التحويل'],
      datasets: [{
        label: 'عدد العملاء',
        data: [totalProspects, interestedProspects, contactedProspects, waitingProspects, convertedClients],
        backgroundColor: palette[1],
        borderRadius: 4
      }]
    };
  };

  const getKPIs = () => {
    const filteredData = getFilteredData();
    const filteredCases = getFilteredCases();
    
    const completedCases = filteredCases.filter(c => c.status === 'completed');
    const wonCases = completedCases.filter(c => c.outcome === 'won');
    const winRate = completedCases.length > 0 ? Math.round((wonCases.length / completedCases.length) * 100) : 0;
    
    const totalProspects = prospects.length;
    const totalClients = clients.length;
    const conversionRate = totalProspects + totalClients > 0 ? 
      Math.round((totalClients / (totalProspects + totalClients)) * 100) : 0;
    
    const avgCasesPerClient = clients.length > 0 ? Math.round(cases.length / clients.length * 10) / 10 : 0;
    
    return {
      totalClients: filteredData.clients.length,
      totalProspects: filteredData.prospects.length,
      totalCases: filteredCases.length,
      completedCases: completedCases.length,
      winRate,
      conversionRate,
      avgCasesPerClient,
      activeCases: filteredCases.filter(c => c.status === 'in-progress' || c.status === 'pending').length
    };
  };

  const exportAnalytics = () => {
    const analyticsData = {
      dateRange: `${dateRange} days`,
      generatedAt: new Date().toISOString(),
      kpis: getKPIs(),
      clientTypeDistribution: getClientTypeDistribution(),
      caseStatusDistribution: getCaseStatusDistribution(),
      prospectStatusDistribution: getProspectStatusDistribution(),
      monthlyTrends: getMonthlyTrends(),
      rawData: {
        clients: getFilteredData().clients,
        prospects: getFilteredData().prospects,
        cases: getFilteredCases(),
        activities: getFilteredData().activities
      }
    };
    
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NAF_Law_Analytics_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل البيانات التحليلية...</p>
        </div>
      </div>
    );
  }

  const kpis = getKPIs();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-deep text-surface-deep-foreground rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">التحليلات والإحصائيات</h1>
            <p className="text-surface-deep-muted">تحليل شامل لأداء المكتب وإحصائيات مفصلة</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-card text-foreground px-4 py-2 rounded-lg border-0 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="7">آخر 7 أيام</option>
              <option value="30">آخر 30 يوم</option>
              <option value="90">آخر 3 أشهر</option>
              <option value="365">آخر سنة</option>
            </select>
            <button
              onClick={exportAnalytics}
              className="bg-card text-primary px-4 py-2 rounded-lg hover:bg-primary-soft flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              تصدير
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-soft rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">العملاء الجدد</p>
              <p className="text-2xl font-bold text-foreground">{kpis.totalClients}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info-soft rounded-lg">
              <TrendingUp className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">العملاء المحتملين</p>
              <p className="text-2xl font-bold text-foreground">{kpis.totalProspects}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-soft rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">القضايا الجديدة</p>
              <p className="text-2xl font-bold text-foreground">{kpis.totalCases}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-soft rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">معدل الربح</p>
              <p className="text-2xl font-bold text-foreground">{kpis.winRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Selector */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'نظرة عامة' },
            { id: 'clients', label: 'تحليل العملاء' },
            { id: 'cases', label: 'تحليل القضايا' },
            { id: 'prospects', label: 'تحليل العملاء المحتملين' },
            { id: 'trends', label: 'الاتجاهات الزمنية' }
          ].map(metric => (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedMetric === metric.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground hover:bg-muted'
              }`}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts based on selected metric */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {selectedMetric === 'overview' && (
          <>
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">توزيع العملاء حسب النوع</h3>
              <div className="h-64">
                <Doughnut data={getClientTypeDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">حالة القضايا</h3>
              <div className="h-64">
                <Doughnut data={getCaseStatusDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </>
        )}

        {selectedMetric === 'clients' && (
          <>
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">توزيع العملاء حسب النوع</h3>
              <div className="h-64">
                <Bar data={getClientTypeDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">إحصائيات العملاء</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-foreground">إجمالي العملاء</span>
                  <span className="font-bold text-foreground">{clients.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-foreground">العملاء الحاليين</span>
                  <span className="font-bold text-success">{clients.filter(c => c.status === 'current').length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-foreground">متوسط القضايا لكل عميل</span>
                  <span className="font-bold text-primary">{kpis.avgCasesPerClient}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-foreground">معدل التحويل</span>
                  <span className="font-bold text-info">{kpis.conversionRate}%</span>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedMetric === 'cases' && (
          <>
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">أنواع القضايا</h3>
              <div className="h-64">
                <Bar data={getCaseTypeDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">معدل النجاح</h3>
              <div className="h-64">
                <Doughnut data={getWinRateAnalysis()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </>
        )}

        {selectedMetric === 'prospects' && (
          <>
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">حالة العملاء المحتملين</h3>
              <div className="h-64">
                <Doughnut data={getProspectStatusDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">قمع التحويل</h3>
              <div className="h-64">
                <Bar data={getConversionFunnel()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </>
        )}

        {selectedMetric === 'trends' && (
          <div className="lg:col-span-2">
            <div className="bg-card rounded-lg shadow-sm border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">الاتجاهات الشهرية</h3>
              <div className="h-80">
                <Line data={getMonthlyTrendsChart()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Analytics Table */}
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">تحليل مفصل</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">أداء العملاء</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">نمو العملاء (شهرياً)</span>
                  <span className="font-medium text-success">+{Math.round(kpis.totalClients / 6)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">معدل الاحتفاظ</span>
                  <span className="font-medium text-primary">
                    {Math.round((clients.filter(c => c.status === 'current').length / clients.length) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">متوسط القضايا لكل عميل</span>
                  <span className="font-medium text-info">{kpis.avgCasesPerClient}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">أداء القضايا</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">معدل الإنجاز</span>
                  <span className="font-medium text-success">
                    {cases.length > 0 ? Math.round((kpis.completedCases / cases.length) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">القضايا النشطة</span>
                  <span className="font-medium text-primary">{kpis.activeCases}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">معدل النجاح</span>
                  <span className="font-medium text-warning">{kpis.winRate}%</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">التحويل والنمو</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">معدل التحويل</span>
                  <span className="font-medium text-info">{kpis.conversionRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">العملاء المحتملين النشطين</span>
                  <span className="font-medium text-primary">
                    {prospects.filter(p => p.prospectStatus !== 'غير مناسب' && p.prospectStatus !== 'تم الرفض').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">القيمة المتوقعة الإجمالية</span>
                  <span className="font-medium text-success">
                    {prospects.reduce((sum, p) => sum + (p.expectedValue || 0), 0).toLocaleString()} ر.س
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">الأنشطة الحديثة</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {getFilteredData().activities.slice(0, 10).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{activity.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{activity.userName}</span>
                    <span>•</span>
                    <span>{format(activity.timestamp, 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}