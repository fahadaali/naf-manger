import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Client, Case } from '../../types';
import { format } from 'date-fns';
import { mockCases } from '../../data/mockData';
import ProfilePictureUpload from '../Common/ProfilePictureUpload';
import ProfileAvatar from '../Common/ProfileAvatar';
import { formatDate, formatPhone } from '@/registry/naf/lib/format';

interface ClientModalProps {
  client?: Client;
  onClose: () => void;
  onSave?: (clientData: Partial<Client>) => void;
  isEditing?: boolean;
}

export default function ClientModal({ client, onClose, onSave, isEditing = false }: ClientModalProps) {
  const [formData, setFormData] = useState({
    fullName: client?.fullName || '',
    idNumber: client?.idNumber || '',
    phone: client?.phone || '',
    email: client?.email || '',
    clientType: client?.clientType || 'individual',
    status: client?.status || 'current',
    notes: client?.notes || '',
    commercialRegister: client?.commercialRegister || '',
    legalRepresentativeName: client?.legalRepresentative?.name || '',
    legalRepresentativeId: client?.legalRepresentative?.idNumber || '',
    legalRepresentativeContact: client?.legalRepresentative?.contact || '',
    profilePicture: client?.profilePicture || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'الاسم الكامل مطلوب';
    }

    if (!formData.idNumber.trim()) {
      newErrors.idNumber = 'رقم الهوية مطلوب';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'رقم الجوال مطلوب';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'البريد الإلكتروني مطلوب';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'البريد الإلكتروني غير صحيح';
    }

    if (formData.clientType === 'company' && !formData.commercialRegister.trim()) {
      newErrors.commercialRegister = 'السجل التجاري مطلوب للشركات';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const clientData: Partial<Client> = {
      fullName: formData.fullName,
      idNumber: formData.idNumber,
      phone: formData.phone,
      email: formData.email,
      clientType: formData.clientType as Client['clientType'],
      status: formData.status as Client['status'],
      notes: formData.notes,
      joinDate: client?.joinDate || new Date(),
      attachments: client?.attachments || [],
      profilePicture: formData.profilePicture || undefined
    };

    if (formData.clientType === 'company') {
      clientData.commercialRegister = formData.commercialRegister;
      if (formData.legalRepresentativeName) {
        clientData.legalRepresentative = {
          name: formData.legalRepresentativeName,
          idNumber: formData.legalRepresentativeId,
          contact: formData.legalRepresentativeContact
        };
      }
    }

    onSave?.(clientData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isEditing && client) {
    // View mode
    const clientCases = mockCases.filter(c => c.clientId === client.id);
    const wonCases = clientCases.filter(c => c.outcome === 'won').length;
    const lostCases = clientCases.filter(c => c.outcome === 'lost').length;
    const pendingCases = clientCases.filter(c => c.status === 'pending' || c.status === 'in-progress').length;

    return (
      <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
        <div className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-bold text-foreground">تفاصيل العميل</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Client Information */}
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">المعلومات الأساسية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">الاسم الكامل</label>
                  <p className="text-foreground">{client.fullName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">الصورة الشخصية</label>
                  <div className="mt-2">
                    <ProfileAvatar 
                      src={client.profilePicture} 
                      name={client.fullName} 
                      size="lg" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">رقم الهوية</label>
                  <p className="text-foreground">{client.idNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">رقم الجوال</label>
                  <p className="text-foreground"><bdi>{formatPhone(client.phone)}</bdi></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">البريد الإلكتروني</label>
                  <p className="text-foreground">{client.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">تاريخ الانضمام</label>
                  <p className="text-foreground">{format(client.joinDate, 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">نوع العميل</label>
                  <p className="text-foreground">{client.clientType}</p>
                </div>
              </div>

              {client.clientType === 'company' && client.legalRepresentative && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium text-foreground mb-2">الممثل القانوني</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground">الاسم</label>
                      <p className="text-foreground">{client.legalRepresentative.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">رقم الهوية</label>
                      <p className="text-foreground">{client.legalRepresentative.idNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">وسيلة التواصل</label>
                      <p className="text-foreground">{client.legalRepresentative.contact}</p>
                    </div>
                  </div>
                </div>
              )}

              {client.notes && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-foreground">الملاحظات</label>
                  <p className="text-foreground">{client.notes}</p>
                </div>
              )}
            </div>

            {/* Cases Statistics */}
            <div className="bg-primary-soft rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">إحصائيات القضايا</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{clientCases.length}</p>
                  <p className="text-sm text-muted-foreground">إجمالي القضايا</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-warning">{pendingCases}</p>
                  <p className="text-sm text-muted-foreground">المنظورة</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{wonCases}</p>
                  <p className="text-sm text-muted-foreground">الرابحة</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">{lostCases}</p>
                  <p className="text-sm text-muted-foreground">الخاسرة</p>
                </div>
              </div>
            </div>

            {/* Cases List */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">قائمة القضايا</h3>
              {clientCases.length > 0 ? (
                <div className="space-y-3">
                  {clientCases.map((case_) => (
                    <div key={case_.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-foreground"><bdi>{case_.caseNumber}</bdi></h4>
                          <p className="text-sm text-muted-foreground">{case_.caseType}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          case_.status === 'completed' ? 'bg-success-soft text-success-strong' :
                          case_.status === 'in-progress' ? 'bg-primary-soft text-primary-strong' :
                          'bg-warning-soft text-warning-strong'
                        }`}>
                          {case_.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{case_.summary}</p>
                      {case_.basecampUrl && (
                        <a
                          href={case_.basecampUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary-strong text-sm"
                        >
                          رابط Basecamp
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">لم تُربَط أي قضية بهذا العميل بعد. أضف أول قضية.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit/Create mode
  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg max-w-full sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            {client ? 'تعديل العميل' : 'إضافة عميل جديد'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Profile Picture Section */}
          <div className="flex justify-center">
            <ProfilePictureUpload
              currentPicture={formData.profilePicture}
              onPictureChange={(picture) => handleInputChange('profilePicture', picture || '')}
              size="lg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                الاسم الكامل *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                  errors.fullName ? 'border-destructive/30' : 'border-border'
                }`}
              />
              {errors.fullName && (
                <p className="text-destructive text-sm mt-1">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                رقم الهوية *
              </label>
              <input
                type="text"
                value={formData.idNumber}
                onChange={(e) => handleInputChange('idNumber', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                  errors.idNumber ? 'border-destructive/30' : 'border-border'
                }`}
              />
              {errors.idNumber && (
                <p className="text-destructive text-sm mt-1">{errors.idNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                رقم الجوال *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                  errors.phone ? 'border-destructive/30' : 'border-border'
                }`}
              />
              {errors.phone && (
                <p className="text-destructive text-sm mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                البريد الإلكتروني *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                  errors.email ? 'border-destructive/30' : 'border-border'
                }`}
              />
              {errors.email && (
                <p className="text-destructive text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                نوع العميل
              </label>
              <select
                value={formData.clientType}
                onChange={(e) => handleInputChange('clientType', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="individual">فرد</option>
                <option value="company">شركة</option>
                <option value="association">جمعية</option>
                <option value="government">جهة حكومية</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                حالة العميل
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="current">حالي</option>
                <option value="former">سابق</option>
              </select>
            </div>
          </div>

          {formData.clientType === 'company' && (
            <div className="space-y-4 p-4 bg-primary-soft rounded-lg">
              <h4 className="font-medium text-foreground">معلومات الشركة</h4>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  السجل التجاري *
                </label>
                <input
                  type="text"
                  value={formData.commercialRegister}
                  onChange={(e) => handleInputChange('commercialRegister', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                    errors.commercialRegister ? 'border-destructive/30' : 'border-border'
                  }`}
                />
                {errors.commercialRegister && (
                  <p className="text-destructive text-sm mt-1">{errors.commercialRegister}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    اسم الممثل القانوني
                  </label>
                  <input
                    type="text"
                    value={formData.legalRepresentativeName}
                    onChange={(e) => handleInputChange('legalRepresentativeName', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    رقم هوية الممثل القانوني
                  </label>
                  <input
                    type="text"
                    value={formData.legalRepresentativeId}
                    onChange={(e) => handleInputChange('legalRepresentativeId', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    وسيلة التواصل
                  </label>
                  <input
                    type="text"
                    value={formData.legalRepresentativeContact}
                    onChange={(e) => handleInputChange('legalRepresentativeContact', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              الملاحظات
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="ملاحظات إضافية..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg"
            >
              {client ? 'حفظ التغييرات' : 'إضافة العميل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}