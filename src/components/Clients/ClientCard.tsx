import { Archive, CircleCheck, Mail, Pencil, Phone, Video } from 'lucide-react';
import { Client } from '../../types';
import ProfileAvatar from '../Common/ProfileAvatar';
import RowCheckbox from '../Common/RowCheckbox';
import { formatDate, formatPhone } from '@/registry/naf/lib/format';
import { clientTypeLabel } from '../../lib/labels';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Card } from '@/registry/naf/ui/card';

interface ClientCardProps {
  client: Client;
  onViewDetails: (client: Client) => void;
  onEdit: (client: Client) => void;
  onCreateMeeting?: (client: Client) => void;
  canEdit: boolean;
  /* التحديدُ اختياريّ: البطاقة تُستعمل في شاشةٍ فيها تحديدٌ جماعي وفي
     غيرها. وحين يغيب `onSelect` لا يُعرض مربّعٌ أصلاً. */
  selected?: boolean;
  onSelect?: () => void;
}

export default function ClientCard({
  client,
  onViewDetails,
  onEdit,
  onCreateMeeting,
  canEdit,
  selected,
  onSelect,
}: ClientCardProps) {
  /* الحالة أيقونةٌ ونصٌّ ولون معاً — §٦ تُلزم بالثلاثة، وكان اللون
     والنصّ وحدهما. المقابلات مسجَّلة في naf-icons.md. */
  const STATUS = {
    current: { variant: 'success' as const, Icon: CircleCheck, label: 'حالي' },
    former: { variant: 'default' as const, Icon: Archive, label: 'سابق' }
  };

  const statusOf = (status: string) =>
    STATUS[status as keyof typeof STATUS] ?? STATUS.former;

  return (
    <Card
      className={`p-6 hover:shadow-md transition-shadow ${
        selected ? 'ring-2 ring-primary' : ''
      } ${client.archivedAt ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {onSelect && (
            <RowCheckbox
              checked={Boolean(selected)}
              onChange={onSelect}
              label={`حدّد ${client.fullName}`}
            />
          )}
          <ProfileAvatar
            src={client.profilePicture}
            name={client.fullName}
            size="lg"
          />
          <div>
            <Button onClick={() => onViewDetails(client)} className="justify-start text-start" variant="link" size="lg">
              {client.fullName}
            </Button>
            <p className="text-sm text-muted-foreground">{clientTypeLabel(client.clientType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* المؤرشفُ يُقال صراحةً: بطاقةٌ باهتةٌ وحدها تُقرأ خطأً في العرض. */}
          {client.archivedAt && (
            <Badge variant="default">
              <Archive aria-hidden="true" />
              مؤرشف
            </Badge>
          )}
          {(() => {
            const { variant, Icon, label } = statusOf(client.status);
            return (
              <Badge variant={variant}>
                <Icon aria-hidden="true" />
                {label}
              </Badge>
            );
          })()}
          {onCreateMeeting && (
            <Button onClick={() => onCreateMeeting(client)} className="text-primary hover:text-primary-strong" title="إنشاء اجتماع Zoom" variant="ghost" size="icon-sm">
              <Video className="h-4 w-4" />
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => onEdit(client)} title="تعديل" variant="ghost" size="icon-sm">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span><bdi>{formatPhone(client.phone)}</bdi></span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>{client.email}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          عميل منذ: <bdi>{formatDate(client.joinDate)}</bdi>
        </p>
      </div>

      {client.notes && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{client.notes}</p>
      )}

      <div className="flex justify-between items-center">
        <Button onClick={() => onViewDetails(client)} variant="link" size="sm">
          عرض التفاصيل
        </Button>
        {client.clientType === 'company' && client.commercialRegister && (
          <span className="text-xs text-muted-foreground">
            السجل التجاري: <bdi>{client.commercialRegister}</bdi>
          </span>
        )}
      </div>
    </Card>
  );
}