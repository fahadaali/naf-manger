import React from 'react';
import { UserIcon, BuildingOfficeIcon, PhoneIcon, EnvelopeIcon, PencilIcon } from '@heroicons/react/24/outline';
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
      case 'current': return 'bg-green-100 text-green-800';
      case 'former': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
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
              className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline text-right"
            >
              {client.fullName}
            </button>
            <p className="text-sm text-slate-500">{getTypeLabel(client.clientType)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
            {getStatusLabel(client.status)}
          </span>
          {onCreateMeeting && (
            <button
              onClick={() => onCreateMeeting(client)}
              className="text-blue-600 hover:text-blue-800 p-1"
              title="إنشاء اجتماع Zoom"
            >
              <VideoCameraIcon className="h-4 w-4" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(client)}
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
          <span>{client.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <EnvelopeIcon className="h-4 w-4" />
          <span>{client.email}</span>
        </div>
        <p className="text-xs text-slate-500">
          عميل منذ: {format(client.joinDate, 'dd/MM/yyyy')}
        </p>
      </div>

      {client.notes && (
        <p className="text-sm text-slate-600 mb-4 line-clamp-2">{client.notes}</p>
      )}

      <div className="flex justify-between items-center">
        <button
          onClick={() => onViewDetails(client)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          عرض التفاصيل
        </button>
        {client.clientType === 'company' && client.commercialRegister && (
          <span className="text-xs text-slate-500">
            س.ت: {client.commercialRegister}
          </span>
        )}
      </div>
    </div>
  );
}