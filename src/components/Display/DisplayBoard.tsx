import { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

import { DashboardStats } from '../../types';
import { useChartPalette } from '../../lib/chart-tokens';
import { formatNumber } from '@/registry/naf/lib/format';
import { NafLogo } from '@/registry/naf/brand/naf-logo';
import { caseStatusLabel, clientTypeLabel } from '../../lib/labels';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

/* ═══ شاشة العرض ═══
 *
 * صفحةٌ تُعلَّق في ممرّ المكتب: لا شريطَ جانبيّ ولا تنقّل ولا دخول. تقرأ
 * `‎/api/display/<token>/…` وهو مسارٌ عامّ يسبق الحارس، ولا يردّ إلا
 * إحصاءاتٍ مجمَّعة — لا اسمَ عميلٍ ولا رقمَ قضية ولا مبلغ.
 *
 * وحجمُ الخطّ كبير عمداً: تُقرأ من بعيد.
 */

const REFRESH_MS = 60_000;

export default function DisplayBoard({ token }: { token: string }) {
  const palette = useChartPalette();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const response = await fetch(`/api/display/${encodeURIComponent(token)}/stats`);
        if (!response.ok) throw new Error(String(response.status));
        const body = await response.json();
        if (!alive) return;
        setStats(body.data);
        setUpdatedAt(new Date());
        setError('');
      } catch {
        /* رابطٌ أُبطل أو شبكةٌ انقطعت. والأرقام المعروضة تبقى — شاشةٌ تُفرَّغ
           عند أول انقطاعٍ أسوأ من شاشةٍ تقول متى قرأت آخر مرّة. */
        if (alive) setError('تعذّر التحديث');
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [token]);

  if (!stats) {
    return (
      <div dir="rtl" className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-2xl text-muted-foreground">
          {error ? 'الرابط غير صالح أو أُبطل' : 'جارٍ التحميل'}
        </p>
      </div>
    );
  }

  const tiles = [
    { label: 'العملاء', value: stats.totalClients, tone: 'text-chart-1' },
    { label: 'العملاء المحتملين', value: stats.totalProspects, tone: 'text-chart-2' },
    { label: 'القضايا', value: stats.totalCases, tone: 'text-chart-3' },
    { label: 'القضايا المنظورة', value: stats.pendingCases, tone: 'text-chart-4' },
    { label: 'معدّل الربح', value: `${formatNumber(stats.winRate)}%`, tone: 'text-chart-5' },
    { label: 'معدّل التحويل', value: `${formatNumber(stats.conversionRate)}%`, tone: 'text-primary' }
  ];

  /* والفئاتُ من الأرقام نفسها لا مكتوبةً هنا: هذه الشاشة عامّةٌ بلا جلسة،
     فلا تقرأ «تكوين النظام» — لكنّ المفاتيح الواردة تكفي، ونوعٌ خامس
     يُضاف يظهر فيها كما يظهر في اللوحة. */
  const clientTypes = Object.keys(stats.clientsByType);
  const caseStatuses = Object.keys(stats.casesByStatus);

  const clientTypeData = {
    labels: clientTypes.map(clientTypeLabel),
    datasets: [{
      data: clientTypes.map((type) => stats.clientsByType[type] ?? 0),
      backgroundColor: palette.slice(0, clientTypes.length),
      borderWidth: 0
    }]
  };

  const caseStatusData = {
    labels: caseStatuses.map(caseStatusLabel),
    datasets: [{
      label: 'عدد القضايا',
      data: caseStatuses.map((status) => stats.casesByStatus[status] ?? 0),
      backgroundColor: palette[1],
      borderRadius: 4
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { font: { size: 16 } } } }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background p-8 flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <NafLogo variant="mark" className="h-12" />
        <div className="text-start">
          <p className="text-sm text-muted-foreground">
            {error ? 'تعذّر التحديث — آخر قراءة' : 'آخر تحديث'}
            {updatedAt && (
              <>
                {' '}
                <bdi>
                  {updatedAt.getHours().toString().padStart(2, '0')}:
                  {updatedAt.getMinutes().toString().padStart(2, '0')}
                </bdi>
              </>
            )}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className={`text-6xl font-bold ${tile.tone}`}>
              <bdi>{typeof tile.value === 'number' ? formatNumber(tile.value) : tile.value}</bdi>
            </p>
            <p className="text-xl text-muted-foreground mt-3">{tile.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-80">
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
          <h2 className="text-xl font-semibold text-foreground mb-4">توزيع العملاء</h2>
          <div className="flex-1 min-h-64">
            <Doughnut data={clientTypeData} options={chartOptions} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
          <h2 className="text-xl font-semibold text-foreground mb-4">حالة القضايا</h2>
          <div className="flex-1 min-h-64">
            <Bar data={caseStatusData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
