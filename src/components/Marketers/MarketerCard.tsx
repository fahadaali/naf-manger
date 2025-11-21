import React from 'react';
import { useState, useEffect } from 'react';
import { UserIcon, PhoneIcon, EnvelopeIcon, PencilIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { Marketer, MarketerStats } from '../../types';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import ProfileAvatar from '../Common/ProfileAvatar';

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
        // جلب إحصائيات المسوّق من Supabase
        const [
          { data: cases, error: casesError },
          { data: commissions, error: commissionsError }
        ] = await Promise.all([
          supabase.from('cases').select('*').eq('marketer_id', marketer.id),
          supabase.from('commission_payments').select('*').eq('marketer_id', marketer.id)
        ]);

        if (casesError) throw casesError;
        if (commissionsError) throw commissionsError;

        const casesData = cases || [];
        const commissionsData = commissions || [];

        // حساب الإحصائيات
        const totalCases = casesData.length;
        const completedCases = casesData.filter(c => c.status === 'completed').length;
        const wonCases = casesData.filter(c => c.outcome === 'won').length;
        const lostCases = casesData.filter(c => c.outcome === 'lost').length;
        
        const totalRevenue = casesData.reduce((sum, c) => {
          const paymentStatus = c.payment_status;
          return sum + (paymentStatus?.collectedAmount || 0);
        }, 0);
        
        const totalCommissionPaid = commissionsData.reduce((sum, c) => sum + (c.amount || 0), 0);
        
        // حساب العمولة المستحقة
        const totalCommissionEarned = casesData.reduce((sum, c) => {
          const commissionStructure = c.commission_structure;
          const paymentStatus = c.payment_status;
          if (commissionStructure && paymentStatus) {
            if (commissionStructure.type === 'percentage') {
              return sum + ((paymentStatus.collectedAmount || 0) * (commissionStructure.value || 0) / 100);
            } else {
              return sum + (commissionStructure.value || 0);
            }
          }
          return sum;
        }, 0);
        
        const remainingCommission = totalCommissionEarned - totalCommissionPaid;
        const conversionRate = completedCases > 0 ? Math.round((wonCases / completedCases) * 100) : 0;
        const averageCaseValue = totalCases > 0 ? Math.round(totalRevenue / totalCases) : 0;

        setStats({
          totalCases,
          completedCases,
          wonCases,
          lostCases,
          totalRevenue,
          totalCommissionEarned,
          totalCommissionPaid,
          remainingCommission,
          conversionRate,
          averageCaseValue
        });
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
      case 'نشط': return 'bg-green-100 text-green-800';
      case 'موقوف': return 'bg-yellow-100 text-yellow-800';
      case 'سابق': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    return status;
  };

  const getTypeLabel = (type: string) => {
    return type;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
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
              className="text-lg font-semibold text-purple-600 hover:text-purple-800 hover:underline text-right"
            >
              {marketer.fullName}
            </button>
            <p className="text-sm text-slate-500">{getTypeLabel(marketer.relationshipType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(marketer.status)}`}>
            {getStatusLabel(marketer.status)}
          </span>
          {canEdit && (
            <button
              onClick={() => onEdit(marketer)}
              className="text-slate-600 hover:text-slate-800 p-1"
              title="تحرير"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <PhoneIcon className="h-4 w-4" />
          <span>{marketer.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <EnvelopeIcon className="h-4 w-4" />
          <span>{marketer.email}</span>
        </div>
        <p className="text-xs text-slate-500">
          بدء التعاون: {format(marketer.startDate, 'dd/MM/yyyy')}
        </p>
      </div>

      {/* Performance Stats */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <ChartBarIcon className="h-4 w-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">الأداء</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-slate-500">القضايا</p>
            <p className="font-semibold text-slate-900">{stats.totalCases}</p>
          </div>
          <div>
            <p className="text-slate-500">المكتملة</p>
            <p className="font-semibold text-green-600">{stats.completedCases}</p>
          </div>
          <div>
            <p className="text-slate-500">الإيرادات</p>
            <p className="font-semibold text-blue-600">{stats.totalRevenue.toLocaleString()} ر.س</p>
          </div>
          <div>
            <p className="text-slate-500">العمولة المتبقية</p>
            <p className="font-semibold text-amber-600">{stats.remainingCommission.toLocaleString()} ر.س</p>
          </div>
        </div>
      </div>

      {marketer.notes && (
        <p className="text-sm text-slate-600 mb-4 line-clamp-2">{marketer.notes}</p>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={() => onViewDetails(marketer)}
          className="text-purple-600 hover:text-purple-800 text-sm font-medium hover:underline"
        >
          عرض التفاصيل
        </button>
        <div className="text-xs text-slate-500">
          معدل النجاح: {stats.conversionRate}%
        </div>
      </div>
    </div>
  );
}