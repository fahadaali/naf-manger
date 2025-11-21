import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Prospect } from '../../types';
import { format } from 'date-fns';
import { mockSystemSettings } from '../../data/mockData';
import ProfilePictureUpload from '../Common/ProfilePictureUpload';
import ProfileAvatar from '../Common/ProfileAvatar';

interface ProspectModalProps {
  prospect?: Prospect;
  onClose: () => void;
  onSave?: (prospectData: Partial<Prospect>) => void;
  isEditing?: boolean;
}

export default function ProspectModal({ prospect, onClose, onSave, isEditing = false }: ProspectModalProps) {
  const [formData, setFormData] = useState({
    fullName: prospect?.fullName || '',
    idNumber: prospect?.idNumber || '',
    phone: prospect?.phone || '',
    email: prospect?.email || '',
    clientType: prospect?.clientType || 'individual',
    prospectStatus: prospect?.prospectStatus || 'مهتم',
    notes: prospect?.notes || '',
    commercialRegister: prospect?.commercialRegister || '',
    legalRepresentativeName: prospect?.legalRepresentative?.name || '',
    legalRepresentativeId: prospect?.legalRepresentative?.idNumber || '',
    legalRepresentativeContact: prospect?.legalRepresentative?.contact || '',
    source: prospect?.source || '',
    expectedValue: prospect?.expectedValue?.toString() || '',
    followUpDate: prospect?.followUpDate ? format(prospect.followUpDate, 'yyyy-MM-dd') : '',
    assignedTo: prospect?.assignedTo || '',
    profilePicture: prospect?.profilePicture || ''
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

    const prospectData: Partial<Prospect> = {
      fullName: formData.fullName,
      idNumber: formData.idNumber,
      phone: formData.phone,
      email: formData.email,
      clientType: formData.clientType as Prospect['clientType'],
      prospectStatus: formData.prospectStatus,
      notes: formData.notes,
      joinDate: prospect?.joinDate || new Date(),
      attachments: prospect?.attachments || [],
      profilePicture: formData.profilePicture || undefined,
      source: formData.source,
      expectedValue: formData.expectedValue ? parseFloat(formData.expectedValue) : undefined,
      followUpDate: formData.followUpDate ? new Date(formData.followUpDate) : undefined,
      assignedTo: formData.assignedTo || undefined
    };

    if (formData.clientType === 'company') {
      prospectData.commercialRegister = formData.commercialRegister;
      if (formData.legalRepresentativeName) {
        prospectData.legalRepresentative = {
          name: formData.legalRepresentativeName,
          idNumber: formData.legalRepresentativeId,
          contact: formData.legalRepresentativeContact
        };
      }
    }

    onSave?.(prospectData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isEditing && prospect) {
    // View mode
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-full sm:max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">تفاصيل العميل المحتمل</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">المعلومات الأساسية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">الاسم الكامل</label>
                  <p className="text-slate-900">{prospect.fullName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">الصورة الشخصية</label>
                  <div className="mt-2">
                    <ProfileAvatar 
                      src={prospect.profilePicture} 
                      name={prospect.fullName} 
                      size="lg" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">رقم الهوية</label>
                  <p className="text-slate-900">{prospect.idNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">رقم الجوال</label>
                  <p className="text-slate-900">{prospect.phone}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">البريد الإلكتروني</label>
                  <p className="text-slate-900">{prospect.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">تاريخ الإضافة</label>
                  <p className="text-slate-900">{format(prospect.joinDate, 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">نوع العميل</label>
                  <p className="text-slate-900">{prospect.clientType}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">الحالة</label>
                  <p className="text-slate-900">{prospect.prospectStatus}</p>
                </div>
                {prospect.source && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">مصدر العميل</label>
                    <p className="text-slate-900">{prospect.source}</p>
                  </div>
                )}
              </div>

              {prospect.clientType === 'company' && prospect.legalRepresentative && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium text-slate-900 mb-2">الممثل القانوني</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">الاسم</label>
                      <p className="text-slate-900">{prospect.legalRepresentative.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">رقم الهوية</label>
                      <p className="text-slate-900">{prospect.legalRepresentative.idNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">وسيلة التواصل</label>
                      <p className="text-slate-900">{prospect.legalRepresentative.contact}</p>
                    </div>
                  </div>
                </div>
              )}

              {prospect.notes && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700">الملاحظات</label>
                  <p className="text-slate-900">{prospect.notes}</p>
                </div>
              )}
            </div>

            {/* Prospect Specific Information */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">معلومات العميل المحتمل</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prospect.expectedValue && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">القيمة المتوقعة</label>
                    <p className="text-slate-900">{prospect.expectedValue.toLocaleString()} ريال</p>
                  </div>
                )}
                {prospect.followUpDate && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">موعد المتابعة</label>
                    <p className="text-slate-900">{format(prospect.followUpDate, 'dd/MM/yyyy')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit/Create mode
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-full sm:max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            {prospect ? 'تعديل العميل المحتمل' : 'إضافة عميل محتمل جديد'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full"
          >
            <XMarkIcon className="h-6 w-6" />
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
              <label className="block text-sm font-medium text-slate-700 mb-2">
                الاسم الكامل *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.fullName ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.fullName && (
                <p className="text-red-600 text-sm mt-1">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                رقم الهوية *
              </label>
              <input
                type="text"
                value={formData.idNumber}
                onChange={(e) => handleInputChange('idNumber', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.idNumber ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.idNumber && (
                <p className="text-red-600 text-sm mt-1">{errors.idNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                رقم الجوال *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.phone ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.phone && (
                <p className="text-red-600 text-sm mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                البريد الإلكتروني *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.email ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                نوع العميل
              </label>
              <select
                value={formData.clientType}
                onChange={(e) => handleInputChange('clientType', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="individual">فرد</option>
                <option value="company">شركة</option>
                <option value="association">جمعية</option>
                <option value="government">جهة حكومية</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                حالة العميل المحتمل
              </label>
              <select
                value={formData.prospectStatus}
                onChange={(e) => handleInputChange('prospectStatus', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {mockSystemSettings.prospectStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                مصدر العميل
              </label>
              <select
                value={formData.source}
                onChange={(e) => handleInputChange('source', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">اختر المصدر</option>
                {mockSystemSettings.prospectSources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                القيمة المتوقعة (ريال)
              </label>
              <input
                type="number"
                value={formData.expectedValue}
                onChange={(e) => handleInputChange('expectedValue', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                موعد المتابعة
              </label>
              <input
                type="date"
                value={formData.followUpDate}
                onChange={(e) => handleInputChange('followUpDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {formData.clientType === 'company' && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-slate-900">معلومات الشركة</h4>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  السجل التجاري *
                </label>
                <input
                  type="text"
                  value={formData.commercialRegister}
                  onChange={(e) => handleInputChange('commercialRegister', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                    errors.commercialRegister ? 'border-red-300' : 'border-slate-300'
                  }`}
                />
                {errors.commercialRegister && (
                  <p className="text-red-600 text-sm mt-1">{errors.commercialRegister}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    اسم الممثل القانوني
                  </label>
                  <input
                    type="text"
                    value={formData.legalRepresentativeName}
                    onChange={(e) => handleInputChange('legalRepresentativeName', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    رقم هوية الممثل القانوني
                  </label>
                  <input
                    type="text"
                    value={formData.legalRepresentativeId}
                    onChange={(e) => handleInputChange('legalRepresentativeId', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    وسيلة التواصل
                  </label>
                  <input
                    type="text"
                    value={formData.legalRepresentativeContact}
                    onChange={(e) => handleInputChange('legalRepresentativeContact', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              الملاحظات
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="ملاحظات إضافية..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              {prospect ? 'حفظ التغييرات' : 'إضافة العميل المحتمل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}