import React, { useState } from 'react';
import { Banknote, ChartColumn, User, X } from 'lucide-react';
import { Marketer, Case, MarketerStats } from '../../types';
import { format } from 'date-fns';
import { db } from '../../data/database';
import ProfilePictureUpload from '../Common/ProfilePictureUpload';
import ProfileAvatar from '../Common/ProfileAvatar';
import { Money } from '@/registry/naf/currency/money';
import { formatDate, formatDateTime, formatNumber, formatPhone, formatTime } from '@/registry/naf/lib/format';

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
      <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
        <div className="bg-card rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-soft rounded-lg">
                <User className="h-6 w-6 text-info" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{marketer.fullName}</h2>
                <p className="text-sm text-muted-foreground">تفاصيل المسوّق والأداء</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Marketer Information */}
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <User className="h-5 w-5" />
                المعلومات الأساسية
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">الاسم الكامل</label>
                  <p className="text-foreground">{marketer.fullName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">الصورة الشخصية</label>
                  <div className="mt-2">
                    <ProfileAvatar 
                      src={marketer.profilePicture} 
                      name={marketer.fullName} 
                      size="lg" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">رقم الهوية</label>
                  <p className="text-foreground">{marketer.idNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">رقم الجوال</label>
                  <p className="text-foreground"><bdi>{formatPhone(marketer.phone)}</bdi></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">البريد الإلكتروني</label>
                  <p className="text-foreground">{marketer.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">نوع العلاقة</label>
                  <p className="text-foreground">
                    {marketer.relationshipType === 'employee' ? 'موظف' :
                     marketer.relationshipType === 'freelancer' ? 'مستقل' : 'شركة خارجية'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">تاريخ بدء التعاون</label>
                  <p className="text-foreground">{format(marketer.startDate, 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">الحالة</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    marketer.status === 'active' ? 'bg-success-soft text-success-strong' :
                    marketer.status === 'suspended' ? 'bg-warning-soft text-warning-strong' :
                    'bg-muted text-foreground'
                  }`}>
                    {marketer.status === 'active' ? 'نشط' :
                     marketer.status === 'suspended' ? 'موقوف' : 'سابق'}
                  </span>
                </div>
              </div>

              {marketer.notes && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-foreground">الملاحظات</label>
                  <p className="text-foreground whitespace-pre-wrap">{marketer.notes}</p>
                </div>
              )}
            </div>

            {/* Performance Dashboard */}
            <div className="bg-primary-soft rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <ChartColumn className="h-5 w-5" />
                لوحة الأداء
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{stats.totalCases}</p>
                  <p className="text-sm text-muted-foreground">إجمالي القضايا</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{stats.completedCases}</p>
                  <p className="text-sm text-muted-foreground">المكتملة</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-warning">{stats.conversionRate}%</p>
                  <p className="text-sm text-muted-foreground">معدل النجاح</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-info"><bdi>{formatNumber(stats.averageCaseValue)}</bdi></p>
                  <p className="text-sm text-muted-foreground">متوسط قيمة القضية</p>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-success-soft rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                الملخص المالي
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">إجمالي الإيرادات</label>
                  <p className="text-xl font-bold text-success"><Money value={stats.totalRevenue} /></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">العمولة المستحقة</label>
                  <p className="text-xl font-bold text-primary"><Money value={stats.totalCommissionEarned} /></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">العمولة المدفوعة</label>
                  <p className="text-xl font-bold text-info"><Money value={stats.totalCommissionPaid} /></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">العمولة المتبقية</label>
                  <p className="text-xl font-bold text-warning"><Money value={stats.remainingCommission} /></p>
                </div>
              </div>
            </div>

            {/* Cases List */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">قائمة القضايا</h3>
              {marketerCases.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border border-border rounded-lg">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">رقم القضية</th>
                        <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">العميل</th>
                        <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">الحالة</th>
                        <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">المبلغ الإجمالي</th>
                        <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">المحصل</th>
                        <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">العمولة المدفوعة</th>
                        <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {marketerCases.map((case_) => (
                        <tr key={case_.id} className="hover:bg-muted">
                          <td className="px-4 py-3 text-sm font-medium text-primary tabular-nums"><bdi>{case_.caseNumber}</bdi></td>
                          <td className="px-4 py-3 text-sm text-foreground tabular-nums">{case_.clientName}</td>
                          <td className="px-4 py-3 tabular-nums">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              case_.status === 'completed' ? 'bg-success-soft text-success-strong' :
                              case_.status === 'in-progress' ? 'bg-primary-soft text-primary-strong' :
                              'bg-warning-soft text-warning-strong'
                            }`}>
                              {case_.status === 'completed' ? 'مكتملة' :
                               case_.status === 'in-progress' ? 'قيد المعالجة' : 'منظورة'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground tabular-nums">
                            <Money value={(case_ as any).paymentStatus?.totalAmount ?? 0} />
                          </td>
                          <td className="px-4 py-3 text-sm text-success font-medium tabular-nums">
                            <Money value={(case_ as any).paymentStatus?.collectedAmount ?? 0} />
                          </td>
                          <td className="px-4 py-3 text-sm text-info font-medium tabular-nums">
                            <Money value={(case_ as any).totalCommissionPaid ?? 0} />
                          </td>
                          <td className="px-4 py-3 text-sm text-warning font-medium tabular-nums">
                            <Money value={(case_ as any).remainingCommission ?? 0} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">لم تُربَط أي قضية بهذا المسوّق بعد.</p>
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
      <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-foreground">
            {marketer ? 'تعديل المسوّق' : 'إضافة مسوّق جديد'}
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
                رقم الهوية / الإقامة *
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
                نوع العلاقة
              </label>
              <select
                value={formData.relationshipType}
                onChange={(e) => handleInputChange('relationshipType', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="employee">موظف</option>
                <option value="freelancer">مستقل</option>
                <option value="external_company">شركة خارجية</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                حالة المسوّق
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="active">نشط</option>
                <option value="suspended">موقوف</option>
                <option value="former">سابق</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                تاريخ بدء التعاون *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                  errors.startDate ? 'border-destructive/30' : 'border-border'
                }`}
              />
              {errors.startDate && (
                <p className="text-destructive text-sm mt-1">{errors.startDate}</p>
              )}
            </div>
          </div>

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
              className="bg-info hover:bg-info/90 text-info-foreground px-6 py-2 rounded-lg"
            >
              {marketer ? 'حفظ التغييرات' : 'إضافة المسوّق'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}