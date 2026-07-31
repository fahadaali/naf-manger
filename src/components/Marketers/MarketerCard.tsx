import React from 'react';
import { useState, useEffect } from 'react';
import { UserIcon, PhoneIcon, EnvelopeIcon, PencilIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { Marketer, MarketerStats } from '../../types';
import { format } from 'date-fns';
import ProfileAvatar from '../Common/ProfileAvatar';
import { db } from '../../data/database';

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'نشط': return 'bg-success-soft text-success-strong';
      case 'موقوف': return 'bg-warning-soft text-warning-strong';
      case 'سابق': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    return status;
  };

  const getTypeLabel = (type: string) => {
    return type;
  };

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
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
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(marketer.status)}`}>
            {getStatusLabel(marketer.status)}
          </span>
          {canEdit && (
            <button
              onClick={() => onEdit(marketer)}
              className="text-muted-foreground hover:text-foreground p-1"
              title="تحرير"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PhoneIcon className="h-4 w-4" />
          <span>{marketer.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <EnvelopeIcon className="h-4 w-4" />
          <span>{marketer.email}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          بدء التعاون: {format(marketer.startDate, 'dd/MM/yyyy')}
        </p>
      </div>

      {/* Performance Stats */}
      <div className="bg-muted rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <ChartBarIcon className="h-4 w-4 text-muted-foreground" />
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
            <p className="font-semibold text-primary">{stats.totalRevenue.toLocaleString()} ر.س</p>
          </div>
          <div>
            <p className="text-muted-foreground">العمولة المتبقية</p>
            <p className="font-semibold text-warning">{stats.remainingCommission.toLocaleString()} ر.س</p>
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
    </div>
  );
}