import React from 'react';
import { ArrowRight, Building2, Mail, Pencil, Phone, User, Video } from 'lucide-react';
import { Prospect } from '../../types';
import { format } from 'date-fns';
import ProfileAvatar from '../Common/ProfileAvatar';
import { Money } from '@/registry/naf/currency/money';
import { formatDate, formatPhone } from '@/registry/naf/lib/format';

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
      case 'مهتم': return 'bg-primary-soft text-primary-strong';
      case 'تم التواصل': return 'bg-warning-soft text-warning-strong';
      case 'بانتظار توقيع': return 'bg-success-soft text-success-strong';
      case 'غير مناسب': return 'bg-destructive-soft text-destructive-strong';
      case 'تم الرفض': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
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
    <div className="bg-card rounded-lg shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
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
              className="text-lg font-semibold text-primary hover:text-primary-strong hover:underline text-start"
            >
              {prospect.fullName}
            </button>
            <p className="text-sm text-muted-foreground">{getTypeLabel(prospect.clientType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(prospect.prospectStatus)}`}>
            {prospect.prospectStatus}
          </span>
          {onCreateMeeting && (
            <button
              onClick={() => onCreateMeeting(prospect)}
              className="text-primary hover:text-primary-strong p-1"
              title="إنشاء اجتماع Zoom"
            >
              <Video className="h-4 w-4" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(prospect)}
              className="text-muted-foreground hover:text-foreground p-1"
              title="تعديل"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span><bdi>{formatPhone(prospect.phone)}</bdi></span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>{prospect.email}</span>
        </div>
        {prospect.expectedValue && (
          <p className="text-sm text-muted-foreground">
            القيمة المتوقعة: <Money value={prospect.expectedValue} />
          </p>
        )}
        {prospect.followUpDate && (
          <p className="text-sm text-muted-foreground">
            موعد المتابعة: {format(prospect.followUpDate, 'dd/MM/yyyy')}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          تاريخ الإضافة: {format(prospect.joinDate, 'dd/MM/yyyy')}
        </p>
      </div>

      {prospect.notes && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{prospect.notes}</p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <button
            onClick={() => onViewDetails(prospect)}
            className="text-primary hover:text-primary-strong text-sm font-medium hover:underline"
          >
            عرض التفاصيل
          </button>
          {canEdit && (
            <button
              onClick={() => onEdit(prospect)}
              className="text-muted-foreground hover:text-foreground p-1"
              title="تعديل"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {canConvert && (
          <button
            onClick={() => onConvert(prospect)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isReadyToConvert 
                ? 'bg-success hover:bg-success/90 text-success-foreground' 
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            <ArrowRight className="h-4 w-4" />
            تحويل إلى عميل
          </button>
        )}
      </div>

      {prospect.clientType === 'company' && prospect.commercialRegister && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            س.ت: {prospect.commercialRegister}
          </span>
        </div>
      )}
    </div>
  );
}