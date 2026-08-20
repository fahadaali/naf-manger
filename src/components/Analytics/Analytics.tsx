import { useEffect, useMemo, useState } from 'react';
import { ChartColumn, Download, FileText, TrendingUp, Users } from 'lucide-react';
import { useChartPalette, softFill } from '../../lib/chart-tokens';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { Client, Prospect, Case, ActivityLog } from '../../types';
import { subDays, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { db } from '../../data/database';
import { Money } from '@/registry/naf/currency/money';
import { formatDateTime, formatMonth, formatNumber } from '@/registry/naf/lib/format';
import { Select } from '@/registry/naf/ui/select';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import AiInsights from './AiInsights';
import { useSettingList } from '../../lib/use-settings';
import { saveText } from '../../lib/download';
import { caseStatusLabel, clientTypeLabel } from '../../lib/labels';

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

      /* ═══ المؤرشفُ خارج التحليلات ═══
         كما هو خارج لوحة التحكّم و`‎/api/stats‎`. وصفٌّ أُخرج من شاشته بقصد
         لا يُعدّ في تحليلٍ عنها — وأثقلُ من ذلك أنّ دمجَ عميلين مكرّرين
         يؤرشف المدموج، فكان الشخصُ نفسه يُعدّ مرّتين في كل رسمٍ هنا. */
      setClients(clientsData.filter((row) => !row.archivedAt));
      setProspects(prospectsData.filter((row) => !row.archivedAt));
      setCases(casesData.filter((row) => !row.archivedAt));
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

  /* ═══ الغربلة تقع مرّةً لا عند كل تصيير ═══
   *
   * كانت `getFilteredData()` تُنادى في كل رسمٍ وكل مؤشّر — ثمانَ مرّاتٍ
   * في التصيير الواحد — وتمرّ في كلٍّ منها على الجداول الأربعة كاملةً.
   * ومعها `getFilteredCases()` تمرّ على القضايا مرّةً أخرى بالشرط نفسه،
   * و`getMonthlyTrends()` ثمانَ عشرةَ مرّة. فكل ضغطةٍ على مُبدِّل المدى —
   * بل كلُّ تصييرٍ مهما كان سببُه — تعيد العدّ كلَّه من أوّله.
   *
   * والنتيجةُ محفوظة الآن بمدخلاتها: لا تُعاد إلا إن تبدّلت البيانات أو
   * المدى. ويلزم ذلك الرسومَ كذلك — `Chart.js` يقارن مرجعَ `data`،
   * فكائنٌ جديد في كل تصيير يُعيد بناء الرسم بلا داعٍ.
   *
   * و«الآن» تُثبَّت مع المدى: كانت تُقرأ في كل نداء، فتختلف حدودُ النافذة
   * بين رسمٍ وأخيه في الشاشة الواحدة.
   */
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    return { startDate: subDays(end, parseInt(dateRange)), endDate: end };
  }, [dateRange]);

  const filteredData = useMemo(() => ({
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
  }), [clients, prospects, cases, activities, startDate, endDate]);

  /* القضايا المغربلة هي نفسها في الموضعين — الشرط واحدٌ حرفاً بحرف — فلا
     تُغربل مرّتين. */
  const filteredCases = filteredData.cases;

  /* ═══ الشهور تُخطى بالتقويم لا بثلاثين يوماً ═══
   *
   * كان الحدُّ `subDays(now, i * 30)` — والشهرُ ليس ثلاثين يوماً. فالخطوةُ
   * تنزلق في كلّ شهرٍ من واحدٍ وثلاثين، فيتكرّر شهرٌ ويسقط آخر. في
   * `2026-03-31` كانت تخرج: نوفمبر، ديسمبر، **ديسمبر**، يناير، **مارس**،
   * مارس — فبراير غائبٌ كلُّه، وعدداه معدودان في غيره مرّتين.
   *
   * و`subMonths` تخطو شهراً تقويمياً واحداً، فالستّةُ ستّةٌ متتابعة أبداً. */
  const monthlyTrends = useMemo(() => {
    const months = [];
    const thisMonth = startOfMonth(new Date());

    for (let i = 5; i >= 0; i--) {
      const monthStart = subMonths(thisMonth, i);
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
        month: formatMonth(monthStart),
        clients: monthClients,
        cases: monthCases,
        prospects: monthProspects
      });
    }
    
    return months;
  }, [clients, prospects, cases]);

  /* ═══ الفئاتُ من «تكوين النظام» لا مكتوبةً هنا ═══
     كانت الأربعةُ بأسمائها، و`clientTypes` و`caseStatuses` قائمتان
     تُحرَّران — فنوعٌ خامس يُضاف لا يظهر، وأصحابُه يختفون من الرسم. وما
     وقع في الصفوف يُضمّ إلى المكوَّن فلا تنقص الحصيلة عن مجموعها. */
  const configuredTypes = useSettingList('clientTypes');
  const configuredStatuses = useSettingList('caseStatuses');
  const configuredProspectStatuses = useSettingList('prospectStatuses');

  const clientTypeDistribution = useMemo(() => {
    const rows = filteredData.clients;
    const types = [...new Set([...configuredTypes, ...rows.map((c) => c.clientType)])];

    return {
      labels: types.map(clientTypeLabel),
      datasets: [{
        data: types.map((type) => rows.filter((c) => c.clientType === type).length),
        backgroundColor: palette.slice(0, types.length),
        borderWidth: 0
      }]
    };
  }, [filteredData, palette, configuredTypes]);

  const caseStatusDistribution = useMemo(() => {
    const statuses = [...new Set([...configuredStatuses, ...filteredCases.map((c) => c.status)])];

    return {
      labels: statuses.map(caseStatusLabel),
      datasets: [{
        data: statuses.map((status) => filteredCases.filter((c) => c.status === status).length),
        backgroundColor: palette.slice(0, statuses.length),
        borderWidth: 0
      }]
    };
  }, [filteredCases, palette, configuredStatuses]);

  const prospectStatusDistribution = useMemo(() => {
    const filteredProspects = filteredData.prospects;
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
  }, [filteredData, palette]);

  const monthlyTrendsChart = useMemo(() => {
    const monthlyData = monthlyTrends;

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
  }, [monthlyTrends, palette]);

  const caseTypeDistribution = useMemo(() => {
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
  }, [filteredCases, palette]);

  const winRateAnalysis = useMemo(() => {
    const completedCases = filteredCases.filter(c => c.status === 'completed');
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
  }, [filteredCases, palette]);

  /* ═══ القمعُ يقرأ الحالاتِ المكوَّنة ═══
     كان يقارن ثلاثةَ نصوصٍ حرفية — «مهتم» و«تم التواصل» و«بانتظار توقيع»
     — و`prospectStatuses` قائمةٌ يحرّرها المسؤول. فتعديلُ صياغةِ حالةٍ
     يُصفّر عمودَها بلا خطأٍ ولا تنبيه. */
  const conversionFunnel = useMemo(() => {
    const statuses = [...new Set([...configuredProspectStatuses, ...prospects.map((p) => p.prospectStatus)])];

    return {
      labels: ['إجمالي العملاء المحتملين', ...statuses, 'تم التحويل'],
      datasets: [{
        label: 'عدد العملاء',
        data: [
          prospects.length,
          ...statuses.map((status) => prospects.filter((p) => p.prospectStatus === status).length),
          clients.length
        ],
        backgroundColor: palette[1],
        borderRadius: 4
      }]
    };
  }, [prospects, clients, palette, configuredProspectStatuses]);

  const kpis = useMemo(() => {
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
  }, [filteredData, filteredCases, prospects, clients, cases]);

  const exportAnalytics = () => {
    const analyticsData = {
      dateRange: `${dateRange} days`,
      generatedAt: new Date().toISOString(),
      kpis,
      clientTypeDistribution,
      caseStatusDistribution,
      prospectStatusDistribution,
      monthlyTrends,
      rawData: {
        clients: filteredData.clients,
        prospects: filteredData.prospects,
        cases: filteredCases,
        activities: filteredData.activities
      }
    };
    
    /* الحفظ من `download.ts` لا هنا: كانت هذه نسخةً ثالثة من الأسطر
       نفسها، وفيها الخطأان اللذان يُسقطان التنزيل على آيفون. */
    saveText(
      JSON.stringify(analyticsData, null, 2),
      `NAF_Law_Analytics_${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جارٍ تحميل البيانات التحليلية</p>
        </div>
      </div>
    );
  }

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
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)} className="border-0"
            >
              <option value="7">آخر 7 أيام</option>
              <option value="30">آخر 30 يوم</option>
              <option value="90">آخر 3 أشهر</option>
              <option value="365">آخر سنة</option>
            </Select>
            <Button onClick={exportAnalytics} className="text-primary" variant="outline">
              <Download className="h-5 w-5" />
              تصدير
            </Button>
          </div>
        </div>
      </div>

      {/* قراءةٌ في الأرقام — Workers AI. تسبق المؤشّرات لأنها خلاصتُها. */}
      <AiInsights />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-soft rounded-lg">
              <Users className="h-6 w-6 text-primary-strong" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">العملاء الجدد</p>
              <p className="text-2xl font-bold text-foreground"><bdi>{formatNumber(kpis.totalClients)}</bdi></p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info-soft rounded-lg">
              <TrendingUp className="h-6 w-6 text-info-strong" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">العملاء المحتملين</p>
              <p className="text-2xl font-bold text-foreground"><bdi>{formatNumber(kpis.totalProspects)}</bdi></p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-soft rounded-lg">
              <FileText className="h-6 w-6 text-success-strong" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">القضايا الجديدة</p>
              <p className="text-2xl font-bold text-foreground"><bdi>{formatNumber(kpis.totalCases)}</bdi></p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-soft rounded-lg">
              <ChartColumn className="h-6 w-6 text-warning-strong" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">معدل الربح</p>
              <p className="text-2xl font-bold text-foreground"><bdi>{formatNumber(kpis.winRate)}%</bdi></p>
            </div>
          </div>
        </Card>
      </div>

      {/* Metric Selector */}
      <Card className="p-4">
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
      </Card>

      {/* Charts based on selected metric */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {selectedMetric === 'overview' && (
          <>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">توزيع العملاء حسب النوع</h3>
              <div className="h-64">
                <Doughnut data={clientTypeDistribution} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
            
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">حالة القضايا</h3>
              <div className="h-64">
                <Doughnut data={caseStatusDistribution} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
          </>
        )}

        {selectedMetric === 'clients' && (
          <>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">توزيع العملاء حسب النوع</h3>
              <div className="h-64">
                <Bar data={clientTypeDistribution} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
            
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">إحصائيات العملاء</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-foreground">إجمالي العملاء</span>
                  <span className="font-bold text-foreground"><bdi>{formatNumber(clients.length)}</bdi></span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-foreground">العملاء الحاليين</span>
                  <span className="font-bold text-success"><bdi>{formatNumber(clients.filter(c => c.status === 'current').length)}</bdi></span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-foreground">متوسط القضايا لكل عميل</span>
                  <span className="font-bold text-primary">{kpis.avgCasesPerClient}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded">
                  <span className="text-foreground">معدل التحويل</span>
                  <span className="font-bold text-info"><bdi>{formatNumber(kpis.conversionRate)}%</bdi></span>
                </div>
              </div>
            </Card>
          </>
        )}

        {selectedMetric === 'cases' && (
          <>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">أنواع القضايا</h3>
              <div className="h-64">
                <Bar data={caseTypeDistribution} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
            
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">معدل النجاح</h3>
              <div className="h-64">
                <Doughnut data={winRateAnalysis} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
          </>
        )}

        {selectedMetric === 'prospects' && (
          <>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">حالة العملاء المحتملين</h3>
              <div className="h-64">
                <Doughnut data={prospectStatusDistribution} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
            
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">قمع التحويل</h3>
              <div className="h-64">
                <Bar data={conversionFunnel} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
          </>
        )}

        {selectedMetric === 'trends' && (
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">الاتجاهات الشهرية</h3>
              <div className="h-80">
                <Line data={monthlyTrendsChart} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Detailed Analytics Table */}
      <Card>
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
                  <span className="font-medium text-success"><bdi>+{formatNumber(Math.round(kpis.totalClients / 6))}%</bdi></span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">معدل الاحتفاظ</span>
                  <span className="font-medium text-primary">
                    <bdi>{formatNumber(clients.length > 0 ? Math.round((clients.filter(c => c.status === 'current').length / clients.length) * 100) : 0)}%</bdi>
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
                    <bdi>{formatNumber(cases.length > 0 ? Math.round((kpis.completedCases / cases.length) * 100) : 0)}%</bdi>
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">القضايا النشطة</span>
                  <span className="font-medium text-primary"><bdi>{formatNumber(kpis.activeCases)}</bdi></span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">معدل النجاح</span>
                  <span className="font-medium text-warning"><bdi>{formatNumber(kpis.winRate)}%</bdi></span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">التحويل والنمو</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">معدل التحويل</span>
                  <span className="font-medium text-info"><bdi>{formatNumber(kpis.conversionRate)}%</bdi></span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">العملاء المحتملين قيد المتابعة</span>
                  <span className="font-medium text-primary">
                    <bdi>{formatNumber(prospects.filter(p => p.prospectStatus !== 'غير مناسب' && p.prospectStatus !== 'تم الرفض').length)}</bdi>
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">القيمة المتوقعة الإجمالية</span>
                  <span className="font-medium text-success">
                    <Money value={prospects.reduce((sum, p) => sum + (p.expectedValue || 0), 0)} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">الأنشطة الحديثة</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {filteredData.activities.slice(0, 10).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{activity.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{activity.userName}</span>
                    <span>•</span>
                    <span><bdi>{formatDateTime(activity.timestamp)}</bdi></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}