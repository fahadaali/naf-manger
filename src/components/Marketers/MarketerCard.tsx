import { useState, useEffect } from 'react';
import { Archive, ChartColumn, CircleCheck, CircleSlash, Mail, Pencil, Phone, Trash2 } from 'lucide-react';
import { Marketer, MarketerStats } from '../../types';
import ProfileAvatar from '../Common/ProfileAvatar';
import { db } from '../../data/database';
import { Money } from '@/registry/naf/currency/money';
import { formatDate, formatNumber, formatPhone } from '@/registry/naf/lib/format';
import { relationshipTypeLabel } from '../../lib/labels';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Card } from '@/registry/naf/ui/card';

interface MarketerCardProps {
  marketer: Marketer;
  onViewDetails: (marketer: Marketer) => void;
  onEdit: (marketer: Marketer) => void;
  /* الحذفُ اختياريّ: يُمرَّر لمن يملكه وحده. ولا أرشفةَ للمسوّقين —
     لا عمودَ لها في جدولهم — فالتصحيحُ حذفٌ أو تبديلُ الحالة إلى «سابق». */
  onDelete?: (marketer: Marketer) => void;
  canEdit: boolean;
}

export default function MarketerCard({ marketer, onViewDetails, onEdit, onDelete, canEdit }: MarketerCardProps) {
  const [stats, setStats] = useState<MarketerStats>({
    totalCases: 0,
    completedCases: 0,
    wonCases: 0,
    lostCases: 0,
    totalRevenue: 0,
    totalCommissionEarned: 0,
    totalCommissionPaid: 0,
    remainingCommission: 0,
    conversionRate: 0,
    averageCaseValue: 0
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        /* الحسابُ في الخادم لا هنا: كانت البطاقة تجلب قضايا المسوّق
           ودفعاتِه كلَّها لتعدّها، فشبكةٌ من عشر بطاقات عشرون نداءً. */
        setStats(await db.getMarketerStats(marketer.id));
      } catch (error) {
        console.error('Error loading marketer stats:', error);
        // استخدام قيم افتراضية في حالة الخطأ
        setStats({
          totalCases: 0,
          completedCases: 0,
          wonCases: 0,
          lostCases: 0,
          totalRevenue: 0,
          totalCommissionEarned: 0,
          totalCommissionPaid: 0,
          remainingCommission: 0,
          conversionRate: 0,
          averageCaseValue: 0
        });
      }
    };
    
    loadStats();
  }, [marketer.id]);

  /* المفاتيح بقيم Marketer['status'] الإنجليزية لا بتسمياتها العربية:
     كانت الخريطة مفهرسة بالعربية والقيمة الواردة إنجليزية، فلا تطابق
     أبداً — فيسقط كل مسوّق إلى الحالة الأخيرة وتظهر الشارة تحمل
     «active» و«suspended» حرفياً. */
  const STATUS = {
    active: { variant: 'success' as const, Icon: CircleCheck, label: 'نشط' },
    suspended: { variant: 'default' as const, Icon: CircleSlash, label: 'معطّل' },
    former: { variant: 'default' as const, Icon: Archive, label: 'سابق' }
  };

  const statusOf = (status: string) =>
    STATUS[status as keyof typeof STATUS] ?? STATUS.former;

  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <ProfileAvatar 
            src={marketer.profilePicture} 
            name={marketer.fullName} 
            size="lg" 
          />
          <div>
            <button 
              onClick={() => onViewDetails(marketer)}
              className="text-lg font-semibold text-primary hover:text-primary-strong hover:underline text-start"
            >
              {marketer.fullName}
            </button>
            <p className="text-sm text-muted-foreground">{relationshipTypeLabel(marketer.relationshipType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const { variant, Icon, label } = statusOf(marketer.status);
            return (
              <Badge variant={variant}>
                <Icon aria-hidden="true" />
                {label}
              </Badge>
            );
          })()}
          {canEdit && (
            <Button onClick={() => onEdit(marketer)} title="تعديل" variant="ghost" size="icon-sm">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              onClick={() => onDelete(marketer)}
              className="text-destructive hover:text-destructive-strong"
              title="حذف"
              variant="ghost"
              size="icon-sm"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span><bdi>{formatPhone(marketer.phone)}</bdi></span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>{marketer.email}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          بدء التعاون: <bdi>{formatDate(marketer.startDate)}</bdi>
        </p>
      </div>

      {/* Performance Stats */}
      <div className="bg-muted rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <ChartColumn className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">الأداء</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">القضايا</p>
            <p className="font-semibold text-foreground"><bdi>{formatNumber(stats.totalCases)}</bdi></p>
          </div>
          <div>
            <p className="text-muted-foreground">المكتملة</p>
            <p className="font-semibold text-success"><bdi>{formatNumber(stats.completedCases)}</bdi></p>
          </div>
          <div>
            <p className="text-muted-foreground">الإيرادات</p>
            <p className="font-semibold text-primary"><Money value={stats.totalRevenue} /></p>
          </div>
          <div>
            <p className="text-muted-foreground">العمولة المتبقية</p>
            <p className="font-semibold text-warning"><Money value={stats.remainingCommission} /></p>
          </div>
        </div>
      </div>

      {marketer.notes && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{marketer.notes}</p>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={() => onViewDetails(marketer)}
          className="text-primary hover:text-primary-strong text-sm font-medium hover:underline"
        >
          عرض التفاصيل
        </button>
        <div className="text-xs text-muted-foreground">
          معدل النجاح: <bdi>{formatNumber(stats.conversionRate)}%</bdi>
        </div>
      </div>
    </Card>
  );
}