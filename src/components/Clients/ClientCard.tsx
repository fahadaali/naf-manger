import React from 'react';
import {
  PhoneIcon
} from '@heroicons/react/24/outline';
import { Building2, Mail, Pencil, User } from 'lucide-react';
import { VideoCameraIcon } from '@heroicons/react/24/outline';
import { Client } from '../../types';
import { format } from 'date-fns';
import ProfileAvatar from '../Common/ProfileAvatar';

interface ClientCardProps {
  client: Client;
  onViewDetails: (client: Client) => void;
  onEdit: (client: Client) => void;
  onCreateMeeting?: (client: Client) => void;
  canEdit: boolean;
}

export default function ClientCard({ client, onViewDetails, onEdit, onCreateMeeting, canEdit }: ClientCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'bg-success-soft text-success-strong';
      case 'former': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'current': return 'حالي';
      case 'former': return 'سابق';
      default: return status;
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

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <ProfileAvatar 
            src={client.profilePicture} 
            name={client.fullName} 
            size="lg" 
          />
          <div>
            <button 
              onClick={() => onViewDetails(client)}
              className="text-lg font-semibold text-primary hover:text-primary-strong hover:underline text-start"
            >
              {client.fullName}
            </button>
            <p className="text-sm text-muted-foreground">{getTypeLabel(client.clientType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
            {getStatusLabel(client.status)}
          </span>
          {onCreateMeeting && (
            <button
              onClick={() => onCreateMeeting(client)}
              className="text-primary hover:text-primary-strong p-1"
              title="إنشاء اجتماع Zoom"
            >
              <VideoCameraIcon className="h-4 w-4" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(client)}
              className="text-muted-foreground hover:text-foreground p-1"
              title="تحرير"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PhoneIcon className="h-4 w-4" />
          <span>{client.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          <span>{client.email}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          عميل منذ: {format(client.joinDate, 'dd/MM/yyyy')}
        </p>
      </div>

      {client.notes && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{client.notes}</p>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={() => onViewDetails(client)}
          className="text-primary hover:text-primary-strong text-sm font-medium"
        >
          عرض التفاصيل
        </button>
        {client.clientType === 'company' && client.commercialRegister && (
          <span className="text-xs text-muted-foreground">
            س.ت: {client.commercialRegister}
          </span>
        )}
      </div>
    </div>
  );
}