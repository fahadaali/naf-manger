import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
} from 'chart.js';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import { Card } from '@/registry/naf/ui/card';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
);

/* ═══ الأنواع الستّة كلُّها تُرسم ═══
 *
 * كان هذا المكوّن يعرف نوعين — `doughnut` و`bar` — وباني التقارير يعرض
 * ستّةً والخادمُ يقبلها. فكان العارض يحوّل كلَّ ما ليس `bar` إلى
 * `doughnut`: من اختار «خطي» أو «دائري» أو «منطقة» يرى الرسم نفسه، وثلاثةٌ
 * من ستّة خيارٍ بلا أثر.
 *
 * و«منطقة» خطٌّ بتعبئةٍ تحته لا نوعٌ مستقلّ في Chart.js — وهو ما تعنيه
 * الكلمة، ويلزمه تسجيل `Filler`.
 */
export type ChartKind = 'table' | 'bar' | 'line' | 'pie' | 'doughnut' | 'area';

interface ChartCardProps {
  title: string;
  type: ChartKind;
  data: any;
  options?: any;
}

export default function ChartCard({ title, type, data, options }: ChartCardProps) {
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  const chartOptions = { ...defaultOptions, ...options };

  /* التعبئةُ خاصّيةُ مجموعةٍ لا خاصّيةُ رسم، فتُضاف هنا لا في كل مستدعٍ —
     ولا تُمسّ المجموعةُ الواردة: نسخةٌ منها تُبنى. */
  const filled =
    type === 'area'
      ? { ...data, datasets: (data?.datasets ?? []).map((set: any) => ({ ...set, fill: true })) }
      : data;

  const render = () => {
    switch (type) {
      case 'bar':
        return <Bar data={data} options={chartOptions} />;
      case 'line':
        return <Line data={data} options={chartOptions} />;
      case 'area':
        return <Line data={filled} options={chartOptions} />;
      case 'pie':
        return <Pie data={data} options={chartOptions} />;
      default:
        return <Doughnut data={data} options={chartOptions} />;
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      <div className="h-64">{render()}</div>
    </Card>
  );
}
