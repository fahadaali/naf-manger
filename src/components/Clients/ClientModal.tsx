import React, { useEffect, useState } from 'react';
import { CircleCheck, Clock, LoaderCircle } from 'lucide-react';
import { Attachment, Case, Client } from '../../types';
import { db } from '../../data/database';
import ProfilePictureUpload from '../Common/ProfilePictureUpload';
import ProfileAvatar from '../Common/ProfileAvatar';
import AttachmentList from '../Common/AttachmentList';
import { formatDate, formatNumber, formatPhone } from '@/registry/naf/lib/format';
import { clientTypeLabel } from '../../lib/labels';
import { useSettingList } from '../../lib/use-settings';
import { Dialog, DialogContent, DialogTitle } from '@/registry/naf/ui/dialog';
import { Textarea } from '@/registry/naf/ui/textarea';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';

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

  /* المرفقات خارج `formData`: قائمةٌ لا نصّ، و`handleInputChange` يقبل
     نصّاً وحده. */
  const [attachments, setAttachments] = useState<Attachment[]>(client?.attachments ?? []);

  // من «تكوين النظام» لا من نصوصٍ في التصيير.
  const clientTypes = useSettingList('clientTypes', formData.clientType);

  /* ═══ قضايا العميل من القاعدة لا من ملفّ العيّنات ═══
   *
   * كان هنا `mockCases.filter(c => c.clientId === client.id)` — قضايا
   * مفبركة في `src/data/mockData.ts` تُعرض قضايا هذا العميل، ومنها تُحسب
   * «رابحة» و«خاسرة» و«منظورة» وتُعرض أرقاماً في شاشة تفاصيله.
   *
   * فإن لم يصادف معرّفُ عميلٍ حقيقيّ معرّفَ عيّنة ظهرت الشاشةُ فارغةً أبداً؛
   * وإن صادفه عُرضت عليه قضايا ليست له. */
  const [clientCases, setClientCases] = useState<Case[]>([]);
  const clientId = client?.id;
  const viewing = !isEditing && Boolean(clientId);

  useEffect(() => {
    if (!viewing || !clientId) return;
    let alive = true;

    db.getCasesByClient(clientId)
      .then((rows) => { if (alive) setClientCases(rows); })
      .catch((error) => {
        console.error('تعذّر جلب قضايا العميل:', error);
        if (alive) setClientCases([]);
      });

    return () => { alive = false; };
  }, [viewing, clientId]);

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
      attachments,
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
    // View mode — `clientCases` من التأثير أعلاه.
    const wonCases = clientCases.filter(c => c.outcome === 'won').length;
    const lostCases = clientCases.filter(c => c.outcome === 'lost').length;
    const pendingCases = clientCases.filter(c => c.status === 'pending' || c.status === 'in-progress').length;

    return (
      <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-4xl max-h-full overflow-y-auto p-0">
          <div className="flex items-center justify-between p-6 border-b">
            <DialogTitle className="text-xl font-bold">تفاصيل العميل</DialogTitle>
          </div>

          <div className="p-6 space-y-6">
            {/* Client Information */}
            {/* المرفقات — للعرض والتنزيل، ولا تُحرَّر في وضع القراءة. */}
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">المرفقات</h3>
              <AttachmentList value={client.attachments ?? []} readOnly />
            </div>

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
                  <p className="text-foreground"><bdi>{formatDate(client.joinDate)}</bdi></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">نوع العميل</label>
                  <p className="text-foreground">{clientTypeLabel(client.clientType)}</p>
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
                  <p className="text-2xl font-bold text-primary-strong"><bdi>{formatNumber(clientCases.length)}</bdi></p>
                  <p className="text-sm text-muted-foreground">إجمالي القضايا</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-warning"><bdi>{formatNumber(pendingCases)}</bdi></p>
                  <p className="text-sm text-muted-foreground">المنظورة</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success"><bdi>{formatNumber(wonCases)}</bdi></p>
                  <p className="text-sm text-muted-foreground">الرابحة</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive"><bdi>{formatNumber(lostCases)}</bdi></p>
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
                        {(() => {
                          const s = case_.status;
                          const map = {
                            completed: { variant: 'success' as const, Icon: CircleCheck, label: 'مكتملة' },
                            'in-progress': { variant: 'primary' as const, Icon: LoaderCircle, label: 'قيد المعالجة' },
                            pending: { variant: 'warning' as const, Icon: Clock, label: 'منظورة' }
                          };
                          const { variant, Icon, label } =
                            map[s as keyof typeof map] ?? map.pending;
                          return (
                            <Badge variant={variant}>
                              <Icon aria-hidden="true" />
                              {label}
                            </Badge>
                          );
                        })()}
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
        </DialogContent>
      </Dialog>
    );
  }

  // Edit/Create mode
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-full sm:max-w-2xl max-h-full overflow-y-auto p-0">
        <div className="flex items-center justify-between p-6 border-b">
          <DialogTitle className="text-lg sm:text-xl font-bold">
            {client ? 'تعديل العميل' : 'إضافة عميل جديد'}
          </DialogTitle>
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
              <Input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
               aria-invalid={!!errors.fullName} />
              {errors.fullName && (
                <p className="text-destructive text-sm mt-1">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                رقم الهوية *
              </label>
              <Input
                type="text"
                value={formData.idNumber}
                onChange={(e) => handleInputChange('idNumber', e.target.value)}
               aria-invalid={!!errors.idNumber} />
              {errors.idNumber && (
                <p className="text-destructive text-sm mt-1">{errors.idNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                رقم الجوال *
              </label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
               aria-invalid={!!errors.phone} />
              {errors.phone && (
                <p className="text-destructive text-sm mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                البريد الإلكتروني *
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
               aria-invalid={!!errors.email} />
              {errors.email && (
                <p className="text-destructive text-sm mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                نوع العميل
              </label>
              <Select
                value={formData.clientType}
                onChange={(e) => handleInputChange('clientType', e.target.value)}
              >
                {clientTypes.map((type) => (
                  <option key={type} value={type}>{clientTypeLabel(type)}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                حالة العميل
              </label>
              <Select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
              >
                <option value="current">حالي</option>
                <option value="former">سابق</option>
              </Select>
            </div>
          </div>

          {formData.clientType === 'company' && (
            <div className="space-y-4 p-4 bg-primary-soft rounded-lg">
              <h4 className="font-medium text-foreground">معلومات الشركة</h4>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  السجل التجاري *
                </label>
                <Input
                  type="text"
                  value={formData.commercialRegister}
                  onChange={(e) => handleInputChange('commercialRegister', e.target.value)}
                 aria-invalid={!!errors.commercialRegister} />
                {errors.commercialRegister && (
                  <p className="text-destructive text-sm mt-1">{errors.commercialRegister}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    اسم الممثل القانوني
                  </label>
                  <Input
                    type="text"
                    value={formData.legalRepresentativeName}
                    onChange={(e) => handleInputChange('legalRepresentativeName', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    رقم هوية الممثل القانوني
                  </label>
                  <Input
                    type="text"
                    value={formData.legalRepresentativeId}
                    onChange={(e) => handleInputChange('legalRepresentativeId', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    وسيلة التواصل
                  </label>
                  <Input
                    type="text"
                    value={formData.legalRepresentativeContact}
                    onChange={(e) => handleInputChange('legalRepresentativeContact', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              الملاحظات
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              placeholder="ملاحظات إضافية"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              المرفقات
            </label>
            <AttachmentList value={attachments} onChange={setAttachments} />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" onClick={onClose} variant="ghost">
              إلغاء
            </Button>
            <Button type="submit">
              {client ? 'حفظ التغييرات' : 'إضافة العميل'}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
  );
}