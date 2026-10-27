import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/registry/naf/ui/card';
import { Growth } from '../../types';
import { formatNumber } from '@/registry/naf/lib/format';

/* و`against` ما يُقارَن به: «الشهر الماضي» بلا فترة، و«الفترة السابقة» بها. */
function trendLine(trend?: Growth, against = 'period') {
  if (!trend) return null;
  const vs = against === 'month' ? 'عن الشهر الماضي' : 'عن الفترة السابقة';
  const here = against === 'month' ? 'هذا الشهر' : 'في الفترة';

  if (trend.percent !== null && trend.percent !== undefined) {
    const up = trend.percent >= 0;
    return {
      up,
      figure: `${up ? '+' : '−'}${formatNumber(Math.abs(trend.percent))}%`,
      label: vs,
    };
  }

  /* لا نسبةَ من شهرٍ فارغ — لكنّ ثلاثةً جدداً خبرٌ يُقال. */
  if (trend.current > 0) {
    return { up: true, figure: `+${formatNumber(trend.current)}`, label: here };
  }

  return null;
}

interface StatsCardProps {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  color: string;
  /* ═══ المؤشّر يأتي محسوباً أو لا يأتي ═══
     كان هنا `{ value: number }` يُملأ برقمٍ مكتوبٍ في التصيير — «‎+١٢٪‎»
     لا تُقرأ من شيء ولا تتغيّر. والآن هو ما تردّه `‎/api/stats‎`: عددُ
     الشهرَين، والنسبةُ بينهما حين تصحّ. */
  trend?: Growth;
  /** ما يُقارَن به المؤشّر — `month` بلا فترةٍ مختارة. */
  against?: 'month' | 'period';
  /** نقرةٌ تفتح الشاشةَ المعنيّة — والبطاقةُ حينها زرّ. */
  onClick?: () => void;
}

export default function StatsCard({ title, value, icon: Icon, color, trend, against = 'month', onClick }: StatsCardProps) {
  /* ثلاث حالات، ولكلٍّ صيغتُها:
     نسبةٌ تصحّ         → «‎+٢٠٠٪ عن الشهر الماضي‎»
     شهرٌ سابق فارغ      → «‎+٣ هذا الشهر‎» — ولا قسمةَ على صفر
     لا هذا ولا ذاك      → لا سطر أصلاً، فالفراغُ أصدقُ من صفرٍ مصطنع */
  const line = trendLine(trend, against);

  const card = (
    <Card className={`p-6 h-full ${onClick ? 'transition-colors group-hover:bg-accent' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {/* العزل والتنسيق هنا لا عند كل نداء: البطاقة تعرض القيمة في
              موضع واحد، فالقاعدة تُطبَّق مرّة وتنتفع بها كل شاشة. */}
          <p className="text-2xl font-bold text-foreground mt-1">
            <bdi>{typeof value === 'number' ? formatNumber(value) : value}</bdi>
          </p>
          {line && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className={`font-medium ${line.up ? 'text-success' : 'text-destructive'}`}>
                <bdi>{line.figure}</bdi>
              </span>
              {' '}
              {line.label}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-background" />
        </div>
      </div>
    </Card>
  );

  /* زرٌّ لا بطاقةٌ تُنقر: يبلغه لوحُ المفاتيح ويُقرأ زرّاً. */
  return onClick ? (
    <button type="button" onClick={onClick} className="group block w-full text-start rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
      {card}
    </button>
  ) : card;
}
