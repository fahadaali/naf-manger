import { Archive, ArrowRight, Mail, Pencil, Phone, Video } from 'lucide-react';
import { Prospect } from '../../types';
import ProfileAvatar from '../Common/ProfileAvatar';
import RowCheckbox from '../Common/RowCheckbox';
import { Money } from '@/registry/naf/currency/money';
import { formatDate, formatPhone } from '@/registry/naf/lib/format';
import { clientTypeLabel } from '../../lib/labels';
import { prospectStatusBadge } from '../../lib/status-badges';
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
  /* التحديدُ اختياريّ كما في بطاقة العميل: البطاقة تُستعمل في شاشةٍ فيها
     تحديدٌ جماعي وفي غيرها. وحين يغيب `onSelect` لا يُعرض مربّعٌ أصلاً. */
  selected?: boolean;
  onSelect?: () => void;
}

export default function ProspectCard({
  prospect,
  onViewDetails,
  onEdit,
  onConvert,
  onCreateMeeting,
  canEdit,
  canConvert,
  selected,
  onSelect,
}: ProspectCardProps) {
  /* الشارةُ من `lib/status-badges.ts` — موضعٌ واحد تقرؤه البطاقةُ والنافذة.
     وحالةٌ لا تعرفها تأخذ علامةَ استفهام لا شارةَ «تم الرفض»:
     `prospectStatuses` قائمةٌ يحرّرها المسؤول، فحالةٌ يضيفها كانت تُعرض
     مرفوضةً — وهي ليست كذلك. */
  const statusOf = prospectStatusBadge;

  const isReadyToConvert = prospect.prospectStatus === 'بانتظار توقيع';

  return (
    <Card className={`p-6 hover:shadow-md transition-shadow ${
      selected ? 'ring-2 ring-primary' : ''
    } ${prospect.archivedAt ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {onSelect && (
            <RowCheckbox
              checked={Boolean(selected)}
              onChange={onSelect}
              label={`تحديد ${prospect.fullName}`}
            />
          )}
          <ProfileAvatar 
            src={prospect.profilePicture} 
            name={prospect.fullName} 
            size="lg" 
          />
          <div>
            <Button onClick={() => onViewDetails(prospect)} className="justify-start text-start" variant="link" size="lg">
              {prospect.fullName}
            </Button>
            <p className="text-sm text-muted-foreground">{clientTypeLabel(prospect.clientType)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {prospect.archivedAt && (
            <Badge variant="default">
              <Archive aria-hidden="true" />
              مؤرشف
            </Badge>
          )}
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
            موعد المتابعة: <bdi>{formatDate(prospect.followUpDate)}</bdi>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          تاريخ الإضافة: <bdi>{formatDate(prospect.joinDate)}</bdi>
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
            السجل التجاري: <bdi>{prospect.commercialRegister}</bdi>
          </span>
        </div>
      )}
    </Card>
  );
}