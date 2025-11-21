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
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { supabase } from '../../lib/supabase';
import { Client, Prospect, Case, ActivityLog } from '../../types';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

export default function Analytics() {
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
      
      // جلب البيانات مباشرة من Supabase
      const [
        { data: clientsData, error: clientsError },
        { data: prospectsData, error: prospectsError },
        { data: casesData, error: casesError },
        { data: activitiesData, error: activitiesError }
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('cases').select('*'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false })
      ]);
      
      // التحقق من الأخطاء
      if (clientsError) console.error('Error fetching clients:', clientsError);
      if (prospectsError) console.error('Error fetching prospects:', prospectsError);
      if (casesError) console.error('Error fetching cases:', casesError);
      if (activitiesError) console.error('Error fetching activities:', activitiesError);
      
      // تحويل البيانات إلى التنسيق المطلوب
      const transformedClients = (clientsData || []).map(c => ({
        id: c.id,
        fullName: c.full_name,
        idNumber: c.id_number,
        phone: c.phone,
        email: c.email,
        joinDate: new Date(c.join_date),
        clientType: c.client_type,
        status: c.status,
        notes: c.notes,
        attachments: c.attachments || [],
        commercialRegister: c.commercial_register,
        legalRepresentative: c.legal_representative,
        profilePicture: c.profile_picture
      }));

      const transformedProspects = (prospectsData || []).map(p => ({
        id: p.id,
        fullName: p.full_name,
        idNumber: p.id_number,
        phone: p.phone,
        email: p.email,
        joinDate: new Date(p.join_date),
        clientType: p.client_type,
        prospectStatus: p.prospect_status,
        notes: p.notes,
        attachments: p.attachments || [],
        commercialRegister: p.commercial_register,
        legalRepresentative: p.legal_representative,
        profilePicture: p.profile_picture,
        source: p.source,
        expectedValue: p.expected_value,
        followUpDate: p.follow_up_date ? new Date(p.follow_up_date) : undefined,
        assignedTo: p.assigned_to
      }));

      const transformedCases = (casesData || []).map(c => ({
        id: c.id,
        caseNumber: c.case_number,
        caseType: c.case_type,
        clientId: c.client_id,
        clientName: c.client_name,
        summary: c.summary,
        status: c.status,
        outcome: c.outcome,
        basecampUrl: c.basecamp_url,
        createdDate: new Date(c.created_at),
        updatedDate: new Date(c.updated_at),
        marketerId: c.marketer_id,
        marketerName: c.marketer_name,
        feeStructure: c.fee_structure,
        paymentStatus: c.payment_status,
        commissionStructure: c.commission_structure
      }));

      const transformedActivities = (activitiesData || []).map(a => ({
        id: a.id,
        type: a.type,
        description: a.description,
        userId: a.user_id,
        userName: a.user_name,
        entityId: a.entity_id,
        entityType: a.entity_type,
        timestamp: new Date(a.created_at),
        details: a.details
      }));
      
      setClients(transformedClients);
      setProspects(transformedProspects);
      setCases(transformedCases);
      setActivities(transformedActivities);
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
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
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
        backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'],
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
        backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
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
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4
        },
        {
          label: 'القضايا الجديدة',
          data: monthlyData.map(m => m.cases),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4
        },
        {
          label: 'العملاء المحتملين',
          data: monthlyData.map(m => m.prospects),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
        backgroundColor: '#3b82f6',
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
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
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
        backgroundColor: '#3b82f6',
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">جاري تحميل البيانات التحليلية...</p>
        </div>
      </div>
    );
  }

  const kpis = getKPIs();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">التحليلات والإحصائيات</h1>
            <p className="text-blue-100">تحليل شامل لأداء المكتب وإحصائيات مفصلة</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-white text-slate-900 px-4 py-2 rounded-lg border-0 focus:ring-2 focus:ring-blue-300"
            >
              <option value="7">آخر 7 أيام</option>
              <option value="30">آخر 30 يوم</option>
              <option value="90">آخر 3 أشهر</option>
              <option value="365">آخر سنة</option>
            </select>
            <button
              onClick={exportAnalytics}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              تصدير
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserGroupIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">العملاء الجدد</p>
              <p className="text-2xl font-bold text-slate-900">{kpis.totalClients}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">العملاء المحتملين</p>
              <p className="text-2xl font-bold text-slate-900">{kpis.totalProspects}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">القضايا الجديدة</p>
              <p className="text-2xl font-bold text-slate-900">{kpis.totalCases}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">معدل الربح</p>
              <p className="text-2xl font-bold text-slate-900">{kpis.winRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">توزيع العملاء حسب النوع</h3>
              <div className="h-64">
                <Doughnut data={getClientTypeDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">حالة القضايا</h3>
              <div className="h-64">
                <Doughnut data={getCaseStatusDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </>
        )}

        {selectedMetric === 'clients' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">توزيع العملاء حسب النوع</h3>
              <div className="h-64">
                <Bar data={getClientTypeDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">إحصائيات العملاء</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                  <span className="text-slate-700">إجمالي العملاء</span>
                  <span className="font-bold text-slate-900">{clients.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                  <span className="text-slate-700">العملاء الحاليين</span>
                  <span className="font-bold text-green-600">{clients.filter(c => c.status === 'current').length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                  <span className="text-slate-700">متوسط القضايا لكل عميل</span>
                  <span className="font-bold text-blue-600">{kpis.avgCasesPerClient}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded">
                  <span className="text-slate-700">معدل التحويل</span>
                  <span className="font-bold text-purple-600">{kpis.conversionRate}%</span>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedMetric === 'cases' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">أنواع القضايا</h3>
              <div className="h-64">
                <Bar data={getCaseTypeDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">معدل النجاح</h3>
              <div className="h-64">
                <Doughnut data={getWinRateAnalysis()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </>
        )}

        {selectedMetric === 'prospects' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">حالة العملاء المحتملين</h3>
              <div className="h-64">
                <Doughnut data={getProspectStatusDistribution()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">قمع التحويل</h3>
              <div className="h-64">
                <Bar data={getConversionFunnel()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </>
        )}

        {selectedMetric === 'trends' && (
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">الاتجاهات الشهرية</h3>
              <div className="h-80">
                <Line data={getMonthlyTrendsChart()} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Analytics Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">تحليل مفصل</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-slate-900">أداء العملاء</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">نمو العملاء (شهرياً)</span>
                  <span className="font-medium text-green-600">+{Math.round(kpis.totalClients / 6)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">معدل الاحتفاظ</span>
                  <span className="font-medium text-blue-600">
                    {Math.round((clients.filter(c => c.status === 'current').length / clients.length) * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">متوسط القضايا لكل عميل</span>
                  <span className="font-medium text-purple-600">{kpis.avgCasesPerClient}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-slate-900">أداء القضايا</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">معدل الإنجاز</span>
                  <span className="font-medium text-green-600">
                    {cases.length > 0 ? Math.round((kpis.completedCases / cases.length) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">القضايا النشطة</span>
                  <span className="font-medium text-blue-600">{kpis.activeCases}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">معدل النجاح</span>
                  <span className="font-medium text-amber-600">{kpis.winRate}%</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-slate-900">التحويل والنمو</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">معدل التحويل</span>
                  <span className="font-medium text-purple-600">{kpis.conversionRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">العملاء المحتملين النشطين</span>
                  <span className="font-medium text-blue-600">
                    {prospects.filter(p => p.prospectStatus !== 'غير مناسب' && p.prospectStatus !== 'تم الرفض').length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">القيمة المتوقعة الإجمالية</span>
                  <span className="font-medium text-green-600">
                    {prospects.reduce((sum, p) => sum + (p.expectedValue || 0), 0).toLocaleString()} ر.س
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">الأنشطة الحديثة</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {getFilteredData().activities.slice(0, 10).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{activity.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
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