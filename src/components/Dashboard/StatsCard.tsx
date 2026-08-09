import type { LucideIcon } from 'lucide-react';
import { Card } from '@/registry/naf/ui/card';
import { formatNumber } from '@/registry/naf/lib/format';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: {
    value: number;
    label: string;
  };
}

export default function StatsCard({ title, value, icon: Icon, color, trend }: StatsCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {/* العزل والتنسيق هنا لا عند كل نداء: البطاقة تعرض القيمة في
              موضع واحد، فالقاعدة تُطبَّق مرّة وتنتفع بها كل شاشة. */}
          <p className="text-2xl font-bold text-foreground mt-1">
            <bdi>{typeof value === 'number' ? formatNumber(value) : value}</bdi>
          </p>
          {trend && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className={`font-medium ${trend.value >= 0 ? 'text-success' : 'text-destructive'}`}>
                <bdi>{trend.value >= 0 ? '+' : ''}{formatNumber(trend.value)}%</bdi>
              </span>
              {' '}
              {trend.label}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-background" />
        </div>
      </div>
    </Card>
  );
}