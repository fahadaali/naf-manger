import React, { useState } from 'react';
import { XMarkIcon, UserIcon, ChartBarIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { Marketer, Case, MarketerStats } from '../../types';
import { format } from 'date-fns';
import { db } from '../../data/database';
import ProfilePictureUpload from '../Common/ProfilePictureUpload';
import ProfileAvatar from '../Common/ProfileAvatar';

interface MarketerModalProps {
  marketer?: Marketer;
  onClose: () => void;
  onSave?: (marketerData: Partial<Marketer>) => void;
  isEditing?: boolean;
}

export default function MarketerModal({ marketer, onClose, onSave, isEditing = false }: MarketerModalProps) {
  const [formData, setFormData] = useState({
    fullName: marketer?.fullName || '',
    idNumber: marketer?.idNumber || '',
    phone: marketer?.phone || '',
    email: marketer?.email || '',
    relationshipType: marketer?.relationshipType || 'freelancer',
    status: marketer?.status || 'active',
    startDate: marketer?.startDate ? format(marketer.startDate, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0],
    notes: marketer?.notes || '',
    profilePicture: marketer?.profilePicture || ''
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

    if (!formData.startDate) {
      newErrors.startDate = 'تاريخ بدء التعاون مطلوب';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const marketerData: Partial<Marketer> = {
      fullName: formData.fullName,
      idNumber: formData.idNumber,
      phone: formData.phone,
      email: formData.email,
      relationshipType: formData.relationshipType as Marketer['relationshipType'],
      status: formData.status as Marketer['status'],
      startDate: new Date(formData.startDate),
      notes: formData.notes,
      createdDate: marketer?.createdDate || new Date(),
      updatedDate: new Date(),
      profilePicture: formData.profilePicture || undefined
    };

    onSave?.(marketerData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isEditing && marketer) {
    // View mode
    const stats = db.getMarketerStats(marketer.id);
    const marketerCases = db.getCases().filter(c => (c as any).marketerId === marketer.id);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UserIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{marketer.fullName}</h2>
                <p className="text-sm text-slate-600">تفاصيل المسوّق والأداء</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Marketer Information */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                المعلومات الأساسية
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">الاسم الكامل</label>
                  <p className="text-slate-900">{marketer.fullName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">الصورة الشخصية</label>
                  <div className="mt-2">
                    <ProfileAvatar 
                      src={marketer.profilePicture} 
                      name={marketer.fullName} 
                      size="lg" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">رقم الهوية</label>
                  <p className="text-slate-900">{marketer.idNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">رقم الجوال</label>
                  <p className="text-slate-900">{marketer.phone}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">البريد الإلكتروني</label>
                  <p className="text-slate-900">{marketer.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">نوع العلاقة</label>
                  <p className="text-slate-900">
                    {marketer.relationshipType === 'employee' ? 'موظف' :
                     marketer.relationshipType === 'freelancer' ? 'مستقل' : 'شركة خارجية'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">تاريخ بدء التعاون</label>
                  <p className="text-slate-900">{format(marketer.startDate, 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">الحالة</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    marketer.status === 'active' ? 'bg-green-100 text-green-800' :
                    marketer.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {marketer.status === 'active' ? 'نشط' :
                     marketer.status === 'suspended' ? 'موقوف' : 'سابق'}
                  </span>
                </div>
              </div>

              {marketer.notes && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700">الملاحظات</label>
                  <p className="text-slate-900 whitespace-pre-wrap">{marketer.notes}</p>
                </div>
              )}
            </div>

            {/* Performance Dashboard */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5" />
                لوحة الأداء
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.totalCases}</p>
                  <p className="text-sm text-slate-600">إجمالي القضايا</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.completedCases}</p>
                  <p className="text-sm text-slate-600">المكتملة</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{stats.conversionRate}%</p>
                  <p className="text-sm text-slate-600">معدل النجاح</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{stats.averageCaseValue.toLocaleString()}</p>
                  <p className="text-sm text-slate-600">متوسط قيمة القضية</p>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <CurrencyDollarIcon className="h-5 w-5" />
                الملخص المالي
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">إجمالي الإيرادات</label>
                  <p className="text-xl font-bold text-green-600">{stats.totalRevenue.toLocaleString()} ر.س</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">العمولة المستحقة</label>
                  <p className="text-xl font-bold text-blue-600">{stats.totalCommissionEarned.toLocaleString()} ر.س</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">العمولة المدفوعة</label>
                  <p className="text-xl font-bold text-purple-600">{stats.totalCommissionPaid.toLocaleString()} ر.س</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">العمولة المتبقية</label>
                  <p className="text-xl font-bold text-amber-600">{stats.remainingCommission.toLocaleString()} ر.س</p>
                </div>
              </div>
            </div>

            {/* Cases List */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-3">قائمة القضايا</h3>
              {marketerCases.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border border-slate-200 rounded-lg">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">رقم القضية</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">العميل</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">الحالة</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">المبلغ الإجمالي</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">المحصل</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">العمولة المدفوعة</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {marketerCases.map((case_) => (
                        <tr key={case_.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-blue-600">{case_.caseNumber}</td>
                          <td className="px-4 py-3 text-sm text-slate-900">{case_.clientName}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              case_.status === 'completed' ? 'bg-green-100 text-green-800' :
                              case_.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {case_.status === 'completed' ? 'مكتملة' :
                               case_.status === 'in-progress' ? 'قيد المعالجة' : 'منظورة'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-900">
                            {(case_ as any).paymentStatus?.totalAmount?.toLocaleString() || '0'} ر.س
                          </td>
                          <td className="px-4 py-3 text-sm text-green-600 font-medium">
                            {(case_ as any).paymentStatus?.collectedAmount?.toLocaleString() || '0'} ر.س
                          </td>
                          <td className="px-4 py-3 text-sm text-purple-600 font-medium">
                            {(case_ as any).totalCommissionPaid?.toLocaleString() || '0'} ر.س
                          </td>
                          <td className="px-4 py-3 text-sm text-amber-600 font-medium">
                            {(case_ as any).remainingCommission?.toLocaleString() || '0'} ر.س
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">لا توجد قضايا مرتبطة بهذا المسوّق</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit/Create mode
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-slate-900">
            {marketer ? 'تعديل المسوّق' : 'إضافة مسوّق جديد'}
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
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  errors.fullName ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.fullName && (
                <p className="text-red-600 text-sm mt-1">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                رقم الهوية / الإقامة *
              </label>
              <input
                type="text"
                value={formData.idNumber}
                onChange={(e) => handleInputChange('idNumber', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
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
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
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
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  errors.email ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.email && (
                <p className="text-red-600 text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                نوع العلاقة
              </label>
              <select
                value={formData.relationshipType}
                onChange={(e) => handleInputChange('relationshipType', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="employee">موظف</option>
                <option value="freelancer">مستقل</option>
                <option value="external_company">شركة خارجية</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                حالة المسوّق
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="active">نشط</option>
                <option value="suspended">موقوف</option>
                <option value="former">سابق</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                تاريخ بدء التعاون *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  errors.startDate ? 'border-red-300' : 'border-slate-300'
                }`}
              />
              {errors.startDate && (
                <p className="text-red-600 text-sm mt-1">{errors.startDate}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              الملاحظات
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
            >
              {marketer ? 'حفظ التغييرات' : 'إضافة المسوّق'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}