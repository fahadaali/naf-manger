import React from 'react';
import { ArrowRight, CircleSlash, CircleX, Clock, FileCheck, Info, Mail, Pencil, Phone, Video } from 'lucide-react';
import { Prospect } from '../../types';
import { format } from 'date-fns';
import ProfileAvatar from '../Common/ProfileAvatar';
import { Money } from '@/registry/naf/currency/money';
import { formatPhone } from '@/registry/naf/lib/format';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Card } from '@/registry/naf/ui/card';

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
  const STATUS = {
    'مهتم': { variant: 'primary' as const, Icon: Info },
    'تم التواصل': { variant: 'warning' as const, Icon: Clock },
    'بانتظار توقيع': { variant: 'success' as const, Icon: FileCheck },
    'غير مناسب': { variant: 'destructive' as const, Icon: CircleSlash },
    'تم الرفض': { variant: 'default' as const, Icon: CircleX }
  };

  const statusOf = (status: string) =>
    STATUS[status as keyof typeof STATUS] ?? STATUS['تم الرفض'];

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
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <ProfileAvatar 
            src={prospect.profilePicture} 
            name={prospect.fullName} 
            size="lg" 
          />
          <div>
            <Button onClick={() => onViewDetails(prospect)} className="justify-start text-start" variant="link" size="lg">
              {prospect.fullName}
            </Button>
            <p className="text-sm text-muted-foreground">{getTypeLabel(prospect.clientType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const { variant, Icon } = statusOf(prospect.prospectStatus);
            return (
              <Badge variant={variant}>
                <Icon aria-hidden="true" />
                {prospect.prospectStatus}
              </Badge>
            );
          })()}
          {onCreateMeeting && (
            <Button onClick={() => onCreateMeeting(prospect)} className="text-primary hover:text-primary-strong" title="إنشاء اجتماع Zoom" variant="ghost" size="icon-sm">
              <Video className="h-4 w-4" />
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => onEdit(prospect)} title="تعديل" variant="ghost" size="icon-sm">
              <Pencil className="h-4 w-4" />
            </Button>
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
            <Button onClick={() => onEdit(prospect)} title="تعديل" variant="ghost" size="icon-sm">
              <Pencil className="h-4 w-4" />
            </Button>
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
    </Card>
  );
}