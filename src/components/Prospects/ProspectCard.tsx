import React from 'react';
import { UserIcon, BuildingOfficeIcon, PhoneIcon, EnvelopeIcon, ArrowRightIcon, PencilIcon } from '@heroicons/react/24/outline';
import { VideoCameraIcon } from '@heroicons/react/24/outline';
import { Prospect } from '../../types';
import { format } from 'date-fns';
import ProfileAvatar from '../Common/ProfileAvatar';

interface ProspectCardProps {
  prospect: Prospect;
  onViewDetails: (prospect: Prospect) => void;
  onEdit: (prospect: Prospect) => void;
  onConvert: (prospect: Prospect) => void;
  onCreateMeeting?: (prospect: Prospect) => void;
  canEdit: boolean;
  canConvert: boolean;
}

export default function ProspectCard({ prospect, onViewDetails, onEdit, onConvert, onCreateMeeting, canEdit, canConvert }: ProspectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'مهتم': return 'bg-blue-100 text-blue-800';
      case 'تم التواصل': return 'bg-yellow-100 text-yellow-800';
      case 'بانتظار توقيع': return 'bg-green-100 text-green-800';
      case 'غير مناسب': return 'bg-red-100 text-red-800';
      case 'تم الرفض': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'individual': return 'فرد';
      case 'company': return 'شركة';
      case 'association': return 'جمعية';
      case 'government': return 'جهة حكومية';
      default: return type;
    }
  };

  const isReadyToConvert = prospect.prospectStatus === 'بانتظار توقيع';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <ProfileAvatar 
            src={prospect.profilePicture} 
            name={prospect.fullName} 
            size="lg" 
          />
          <div>
            <button 
              onClick={() => onViewDetails(prospect)}
              className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline text-right"
            >
              {prospect.fullName}
            </button>
            <p className="text-sm text-slate-500">{getTypeLabel(prospect.clientType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(prospect.prospectStatus)}`}>
            {prospect.prospectStatus}
          </span>
          {onCreateMeeting && (
            <button
              onClick={() => onCreateMeeting(prospect)}
              className="text-blue-600 hover:text-blue-800 p-1"
              title="إنشاء اجتماع Zoom"
            >
              <VideoCameraIcon className="h-4 w-4" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(prospect)}
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
          <span>{prospect.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <EnvelopeIcon className="h-4 w-4" />
          <span>{prospect.email}</span>
        </div>
        {prospect.expectedValue && (
          <p className="text-sm text-slate-600">
            القيمة المتوقعة: {prospect.expectedValue.toLocaleString()} ريال
          </p>
        )}
        {prospect.followUpDate && (
          <p className="text-sm text-slate-600">
            موعد المتابعة: {format(prospect.followUpDate, 'dd/MM/yyyy')}
          </p>
        )}
        <p className="text-xs text-slate-500">
          تاريخ الإضافة: {format(prospect.joinDate, 'dd/MM/yyyy')}
        </p>
      </div>

      {prospect.notes && (
        <p className="text-sm text-slate-600 mb-4 line-clamp-2">{prospect.notes}</p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <button
            onClick={() => onViewDetails(prospect)}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline"
          >
            عرض التفاصيل
          </button>
          {canEdit && (
            <button
              onClick={() => onEdit(prospect)}
              className="text-slate-600 hover:text-slate-800 p-1"
              title="تحرير"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {canConvert && (
          <button
            onClick={() => onConvert(prospect)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isReadyToConvert 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <ArrowRightIcon className="h-4 w-4" />
            تحويل إلى عميل
          </button>
        )}
      </div>

      {prospect.clientType === 'company' && prospect.commercialRegister && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <span className="text-xs text-slate-500">
            س.ت: {prospect.commercialRegister}
          </span>
        </div>
      )}
    </div>
  );
}