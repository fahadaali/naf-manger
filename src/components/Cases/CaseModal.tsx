import React, { useState, useEffect } from 'react';
import { CircleCheck, CircleX, ExternalLink, Handshake } from 'lucide-react';
import { Case, Client, Marketer, FeeStructure, PaymentStatus, CommissionStructure } from '../../types';
import { db } from '../../data/database';
import { useSettingList } from '../../lib/use-settings';
import { caseStatusLabel } from '../../lib/labels';
import { Money } from '@/registry/naf/currency/money';
import { formatDate } from '@/registry/naf/lib/format';
import { Dialog, DialogContent, DialogTitle } from '@/registry/naf/ui/dialog';
import { Textarea } from '@/registry/naf/ui/textarea';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';

interface CaseModalProps {
  case?: Case;
  onClose: () => void;
  onSave?: (caseData: Partial<Case>) => void;
  isEditing?: boolean;
}

export default function CaseModal({ case: existingCase, onClose, onSave, isEditing = false }: CaseModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [formData, setFormData] = useState({
    caseNumber: existingCase?.caseNumber || '',
    caseType: existingCase?.caseType || 'قضية تجارية',
    clientId: existingCase?.clientId || '',
    summary: existingCase?.summary || '',
    status: existingCase?.status || 'pending',
    basecampUrl: existingCase?.basecampUrl || '',
    outcome: existingCase?.outcome || '',
    // Marketer fields
    marketerId: existingCase?.marketerId || '',
    // Fee structure fields
    feeType: existingCase?.feeStructure?.type || 'advance_only',
    advanceFeeType: existingCase?.feeStructure?.advance?.feeType || 'fixed_amount',
    advanceFeeValue: existingCase?.feeStructure?.advance?.value?.toString() || '',
    advanceBaseAmount: existingCase?.feeStructure?.advance?.baseAmount?.toString() || '',
    deferredFeeType: existingCase?.feeStructure?.deferred?.feeType || 'fixed_amount',
    deferredFeeValue: existingCase?.feeStructure?.deferred?.value?.toString() || '',
    deferredBaseAmount: existingCase?.feeStructure?.deferred?.baseAmount?.toString() || '',
    // Payment status fields
    totalAmount: existingCase?.paymentStatus?.totalAmount?.toString() || '',
    collectedAmount: existingCase?.paymentStatus?.collectedAmount?.toString() || '',
    collectionStatus: existingCase?.paymentStatus?.collectionStatus || 'unpaid',
    // Commission fields
    commissionType: existingCase?.commissionStructure?.type || 'percentage',
    commissionValue: existingCase?.commissionStructure?.value?.toString() || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  /* المنسدلات من «تكوين النظام» لا من نصوصٍ في التصيير. والقيمةُ المحفوظة
     تُمرَّر فتبقى ظاهرةً حتى لو حُذفت من التكوين بعد حفظها. */
  const caseTypes = useSettingList('caseTypes', formData.caseType);
  const caseStatuses = useSettingList('caseStatuses', formData.status);

  useEffect(() => {
    // تحميل قائمة العملاء
    const loadData = async () => {
      try {
        const allClients = await db.getClients();
        setClients(allClients);
        
        // تحميل قائمة المسوّقين النشطين
        const allMarketers = await db.getMarketers();
        setMarketers(allMarketers.filter(m => m.status === 'active'));
      } catch (error) {
        console.error('Error loading data:', error);
        setClients([]);
        setMarketers([]);
      }
    };
    
    loadData();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.caseNumber.trim()) {
      newErrors.caseNumber = 'رقم القضية مطلوب';
    }

    if (!formData.clientId) {
      newErrors.clientId = 'يجب اختيار عميل';
    }

    if (!formData.summary.trim()) {
      newErrors.summary = 'ملخص القضية مطلوب';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const selectedClient = clients.find(c => c.id === formData.clientId);
    
    // Build fee structure
    const feeStructure: FeeStructure = {
      type: formData.feeType as FeeStructure['type']
    };
    
    if (formData.feeType === 'advance_only' || formData.feeType === 'advance_and_deferred') {
      feeStructure.advance = {
        feeType: formData.advanceFeeType as 'fixed_amount' | 'percentage',
        value: parseFloat(formData.advanceFeeValue) || 0,
        baseAmount: formData.advanceFeeType === 'percentage' ? parseFloat(formData.advanceBaseAmount) || 0 : undefined
      };
    }
    
    if (formData.feeType === 'deferred_only' || formData.feeType === 'advance_and_deferred') {
      feeStructure.deferred = {
        feeType: formData.deferredFeeType as 'fixed_amount' | 'percentage',
        value: parseFloat(formData.deferredFeeValue) || 0,
        baseAmount: formData.deferredFeeType === 'percentage' ? parseFloat(formData.deferredBaseAmount) || 0 : undefined
      };
    }
    
    // Build payment status
    const totalAmount = parseFloat(formData.totalAmount) || 0;
    const collectedAmount = parseFloat(formData.collectedAmount) || 0;
    const paymentStatus: PaymentStatus = {
      totalAmount,
      collectedAmount,
      remainingAmount: totalAmount - collectedAmount,
      collectionStatus: formData.collectionStatus as PaymentStatus['collectionStatus']
    };
    
    // Build commission structure
    const commissionStructure: CommissionStructure | undefined = formData.marketerId ? {
      type: formData.commissionType as 'fixed_amount' | 'percentage',
      value: parseFloat(formData.commissionValue) || 0,
      baseAmount: formData.commissionType === 'percentage' ? collectedAmount : undefined
    } : undefined;
    
    const caseData: any = {
      ...formData,
      clientName: selectedClient?.fullName || '',
      createdDate: existingCase?.createdDate || new Date(),
      updatedDate: new Date(),
      outcome: formData.outcome || undefined,
      marketerId: formData.marketerId || undefined,
      marketerName: formData.marketerId ? marketers.find(m => m.id === formData.marketerId)?.fullName : undefined,
      feeStructure,
      paymentStatus,
      commissionStructure
    };

    onSave?.(caseData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'مكتملة';
      case 'in-progress': return 'قيد المعالجة';
      case 'pending': return 'منظورة';
      case 'postponed': return 'مؤجلة';
      default: return status;
    }
  };

  const getOutcomeLabel = (outcome?: string) => {
    switch (outcome) {
      case 'won': return 'رابحة';
      case 'lost': return 'خاسرة';
      case 'settled': return 'تسوية';
      default: return '';
    }
  };

  // View mode
  if (!isEditing && existingCase) {
    return (
      <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-full sm:max-w-4xl max-h-full overflow-y-auto p-0">
          <div className="flex items-center justify-between p-6 border-b">
            <DialogTitle className="text-lg sm:text-xl font-bold">تفاصيل القضية</DialogTitle>
          </div>

          <div className="p-6 space-y-6">
            {/* Case Information */}
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">معلومات القضية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">رقم القضية</label>
                  <p className="text-foreground font-medium"><bdi>{existingCase.caseNumber}</bdi></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">نوع القضية</label>
                  <p className="text-foreground">{existingCase.caseType}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">العميل</label>
                  <p className="text-foreground">{existingCase.clientName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">الحالة</label>
                  <p className="text-foreground">{getStatusLabel(existingCase.status)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">تاريخ الإنشاء</label>
                  <p className="text-foreground"><bdi>{formatDate(existingCase.createdDate)}</bdi></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">آخر تحديث</label>
                  <p className="text-foreground"><bdi>{formatDate(existingCase.updatedDate)}</bdi></p>
                </div>
                {existingCase.outcome && (
                  <div>
                    <label className="block text-sm font-medium text-foreground">نتيجة القضية</label>
                    {(() => {
                      /* المقابلات مسجَّلة في naf-icons.md تحت «نتيجة القضية».
                         §٦: لا تُبلَّغ الحالة بالنصّ وحده ولا باللون وحده. */
                      const map = {
                        won: { variant: 'success' as const, Icon: CircleCheck },
                        lost: { variant: 'destructive' as const, Icon: CircleX },
                        settled: { variant: 'warning' as const, Icon: Handshake }
                      };
                      const { variant, Icon } =
                        map[existingCase.outcome as keyof typeof map] ?? map.settled;
                      return (
                        <Badge variant={variant}>
                          <Icon aria-hidden="true" />
                          {getOutcomeLabel(existingCase.outcome)}
                        </Badge>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Case Summary */}
            <div className="bg-primary-soft rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">ملخص القضية</h3>
              <p className="text-foreground whitespace-pre-wrap">{existingCase.summary}</p>
            </div>

            {/* Basecamp Link */}
            {existingCase.basecampUrl && (
              <div className="bg-warning-soft rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-3">رابط Basecamp</h3>
                <a
                  href={existingCase.basecampUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary-strong font-medium"
                >
                  <ExternalLink className="w-5 h-5" aria-hidden="true" />
                  فتح المشروع في Basecamp
                </a>
              </div>
            )}
          </div>

          <div className="border-t border-border px-6 py-4">
            <div className="flex justify-end">
              <Button onClick={onClose} variant="ghost">
                إغلاق
              </Button>
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
            {existingCase ? 'تعديل القضية' : 'إضافة قضية جديدة'}
          </DialogTitle>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                رقم القضية *
              </label>
              <Input
                type="text"
                value={formData.caseNumber}
                onChange={(e) => handleInputChange('caseNumber', e.target.value)}
                placeholder="NAF-2024-001"
               aria-invalid={!!errors.caseNumber} />
              {errors.caseNumber && (
                <p className="text-destructive text-sm mt-1">{errors.caseNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                نوع القضية *
              </label>
              <Select
                value={formData.caseType}
                onChange={(e) => handleInputChange('caseType', e.target.value)}
              >
                {caseTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                العميل *
              </label>
              <Select
                value={formData.clientId}
                onChange={(e) => handleInputChange('clientId', e.target.value)}
               aria-invalid={!!errors.clientId}>
                <option value="">اختر العميل</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName}
                  </option>
                ))}
              </Select>
              {errors.clientId && (
                <p className="text-destructive text-sm mt-1">{errors.clientId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                حالة القضية
              </label>
              <Select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
              >
                {caseStatuses.map((status) => (
                  <option key={status} value={status}>{caseStatusLabel(status)}</option>
                ))}
              </Select>
            </div>

            {formData.status === 'completed' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  نتيجة القضية
                </label>
                <Select
                  value={formData.outcome}
                  onChange={(e) => handleInputChange('outcome', e.target.value)}
                >
                  <option value="">اختر النتيجة</option>
                  <option value="won">رابحة</option>
                  <option value="lost">خاسرة</option>
                  <option value="settled">تسوية</option>
                </Select>
              </div>
            )}
          </div>

          {/* Marketer Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              المسوّق (اختياري)
            </label>
            <Select
              value={formData.marketerId}
              onChange={(e) => handleInputChange('marketerId', e.target.value)}
            >
              <option value="">بدون مسوّق</option>
              {marketers.map((marketer) => (
                <option key={marketer.id} value={marketer.id}>
                  {marketer.fullName}
                </option>
              ))}
            </Select>
          </div>

          {/* Fee Structure */}
          <div className="space-y-4 p-4 bg-primary-soft rounded-lg">
            <h4 className="font-medium text-foreground">هيكل الأتعاب القانونية</h4>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                نوع الأتعاب
              </label>
              <Select
                value={formData.feeType}
                onChange={(e) => handleInputChange('feeType', e.target.value)}
              >
                <option value="advance_only">مقدم فقط</option>
                <option value="deferred_only">مؤخر فقط</option>
                <option value="advance_and_deferred">مقدم ومؤخر</option>
              </Select>
            </div>

            {/* Advance Fee */}
            {(formData.feeType === 'advance_only' || formData.feeType === 'advance_and_deferred') && (
              <div className="space-y-3 p-3 bg-card rounded border">
                <h5 className="font-medium text-foreground">الأتعاب المقدمة</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">النوع</label>
                    <Select
                      value={formData.advanceFeeType}
                      onChange={(e) => handleInputChange('advanceFeeType', e.target.value)}
                    >
                      <option value="fixed_amount">مبلغ ثابت</option>
                      <option value="percentage">نسبة مئوية</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {formData.advanceFeeType === 'percentage' ? 'النسبة (%)' : 'المبلغ بالريال'}
                    </label>
                    <Input
                      type="number"
                      value={formData.advanceFeeValue}
                      onChange={(e) => handleInputChange('advanceFeeValue', e.target.value)}
                      placeholder={formData.advanceFeeType === 'percentage' ? '10' : '5000'}
                    />
                  </div>
                  {formData.advanceFeeType === 'percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">المبلغ الأساسي بالريال</label>
                      <Input
                        type="number"
                        value={formData.advanceBaseAmount}
                        onChange={(e) => handleInputChange('advanceBaseAmount', e.target.value)}
                        placeholder="100000"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Deferred Fee */}
            {(formData.feeType === 'deferred_only' || formData.feeType === 'advance_and_deferred') && (
              <div className="space-y-3 p-3 bg-card rounded border">
                <h5 className="font-medium text-foreground">الأتعاب المؤخرة</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">النوع</label>
                    <Select
                      value={formData.deferredFeeType}
                      onChange={(e) => handleInputChange('deferredFeeType', e.target.value)}
                    >
                      <option value="fixed_amount">مبلغ ثابت</option>
                      <option value="percentage">نسبة مئوية</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {formData.deferredFeeType === 'percentage' ? 'النسبة (%)' : 'المبلغ بالريال'}
                    </label>
                    <Input
                      type="number"
                      value={formData.deferredFeeValue}
                      onChange={(e) => handleInputChange('deferredFeeValue', e.target.value)}
                      placeholder={formData.deferredFeeType === 'percentage' ? '15' : '10000'}
                    />
                  </div>
                  {formData.deferredFeeType === 'percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">المبلغ الأساسي بالريال</label>
                      <Input
                        type="number"
                        value={formData.deferredBaseAmount}
                        onChange={(e) => handleInputChange('deferredBaseAmount', e.target.value)}
                        placeholder="100000"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment Status */}
          <div className="space-y-4 p-4 bg-success-soft rounded-lg">
            <h4 className="font-medium text-foreground">حالة التحصيل من العميل</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  المبلغ الإجمالي بالريال
                </label>
                <Input
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => handleInputChange('totalAmount', e.target.value)}
                  placeholder="50000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  المبلغ المحصل بالريال
                </label>
                <Input
                  type="number"
                  value={formData.collectedAmount}
                  onChange={(e) => handleInputChange('collectedAmount', e.target.value)}
                  placeholder="30000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  حالة التحصيل
                </label>
                <Select
                  value={formData.collectionStatus}
                  onChange={(e) => handleInputChange('collectionStatus', e.target.value)}
                >
                  <option value="unpaid">غير مدفوع</option>
                  <option value="partially_paid">مدفوع جزئياً</option>
                  <option value="fully_paid">مدفوع بالكامل</option>
                </Select>
              </div>
            </div>
            
            {formData.totalAmount && formData.collectedAmount && (
              <div className="p-3 bg-card rounded border">
                <p className="text-sm text-muted-foreground">
                  المبلغ المتبقي: <span className="font-medium text-destructive">
                    <Money value={(parseFloat(formData.totalAmount) - parseFloat(formData.collectedAmount))} />
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Commission Structure (only if marketer is selected) */}
          {formData.marketerId && (
            <div className="space-y-4 p-4 bg-info-soft rounded-lg">
              <h4 className="font-medium text-foreground">هيكل عمولة المسوّق</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    نوع العمولة
                  </label>
                  <Select
                    value={formData.commissionType}
                    onChange={(e) => handleInputChange('commissionType', e.target.value)}
                  >
                    <option value="fixed_amount">مبلغ ثابت</option>
                    <option value="percentage">نسبة مئوية</option>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {formData.commissionType === 'percentage' ? 'النسبة (%)' : 'المبلغ بالريال'}
                  </label>
                  <Input
                    type="number"
                    value={formData.commissionValue}
                    onChange={(e) => handleInputChange('commissionValue', e.target.value)}
                    placeholder={formData.commissionType === 'percentage' ? '10' : '5000'}
                  />
                </div>
              </div>
              
              {formData.commissionType === 'percentage' && formData.commissionValue && formData.collectedAmount && (
                <div className="p-3 bg-card rounded border">
                  <p className="text-sm text-muted-foreground">
                    العمولة المحسوبة: <span className="font-medium text-info">
                      <Money value={((parseFloat(formData.collectedAmount) * parseFloat(formData.commissionValue)) / 100)} />
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              ملخص القضية *
            </label>
            <Textarea
              value={formData.summary}
              onChange={(e) => handleInputChange('summary', e.target.value)}
              rows={4}
              placeholder="وصف مختصر للقضية..."
             aria-invalid={!!errors.summary} />
            {errors.summary && (
              <p className="text-destructive text-sm mt-1">{errors.summary}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              رابط Basecamp (اختياري)
            </label>
            <Input
              type="url"
              value={formData.basecampUrl}
              onChange={(e) => handleInputChange('basecampUrl', e.target.value)}
              placeholder="https://basecamp.com/projects/..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" onClick={onClose} variant="ghost">
              إلغاء
            </Button>
            <Button type="submit">
              {existingCase ? 'حفظ التغييرات' : 'إضافة القضية'}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
  );
}