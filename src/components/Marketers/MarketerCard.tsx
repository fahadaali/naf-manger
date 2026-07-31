import React from 'react';
import { useState, useEffect } from 'react';
import { Archive, ChartColumn, CircleCheck, CircleSlash, Mail, Pencil, Phone } from 'lucide-react';
import { Marketer, MarketerStats } from '../../types';
import { format } from 'date-fns';
import ProfileAvatar from '../Common/ProfileAvatar';
import { db } from '../../data/database';
import { Money } from '@/registry/naf/currency/money';
import { formatPhone } from '@/registry/naf/lib/format';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Card } from '@/registry/naf/ui/card';

interface MarketerCardProps {
  marketer: Marketer;
  onViewDetails: (marketer: Marketer) => void;
  onEdit: (marketer: Marketer) => void;
  canEdit: boolean;
}

export default function MarketerCard({ marketer, onViewDetails, onEdit, canEdit }: MarketerCardProps) {
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

  const STATUS = {
    'نشط': { variant: 'success' as const, Icon: CircleCheck },
    'موقوف': { variant: 'warning' as const, Icon: CircleSlash },
    'سابق': { variant: 'default' as const, Icon: Archive }
  };

  const statusOf = (status: string) =>
    STATUS[status as keyof typeof STATUS] ?? STATUS['سابق'];

  const getStatusLabel = (status: string) => {
    return status;
  };

  const getTypeLabel = (type: string) => {
    return type;
  };

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
              className="text-lg font-semibold text-info hover:text-info-strong hover:underline text-start"
            >
              {marketer.fullName}
            </button>
            <p className="text-sm text-muted-foreground">{getTypeLabel(marketer.relationshipType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const { variant, Icon } = statusOf(marketer.status);
            return (
              <Badge variant={variant}>
                <Icon aria-hidden="true" />
                {getStatusLabel(marketer.status)}
              </Badge>
            );
          })()}
          {canEdit && (
            <Button onClick={() => onEdit(marketer)} title="تعديل" variant="ghost" size="icon-sm">
              <Pencil className="h-4 w-4" />
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
          بدء التعاون: {format(marketer.startDate, 'dd/MM/yyyy')}
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
            <p className="font-semibold text-foreground">{stats.totalCases}</p>
          </div>
          <div>
            <p className="text-muted-foreground">المكتملة</p>
            <p className="font-semibold text-success">{stats.completedCases}</p>
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
          className="text-info hover:text-info-strong text-sm font-medium hover:underline"
        >
          عرض التفاصيل
        </button>
        <div className="text-xs text-muted-foreground">
          معدل النجاح: {stats.conversionRate}%
        </div>
      </div>
    </Card>
  );
}