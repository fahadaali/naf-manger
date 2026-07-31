import React, { useState, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Case, Client, Marketer, FeeStructure, PaymentStatus, CommissionStructure } from '../../types';
import { format } from 'date-fns';
import { db } from '../../data/database';

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
    marketerId: (existingCase as any)?.marketerId || '',
    // Fee structure fields
    feeType: (existingCase as any)?.feeStructure?.type || 'advance_only',
    advanceFeeType: (existingCase as any)?.feeStructure?.advance?.feeType || 'fixed_amount',
    advanceFeeValue: (existingCase as any)?.feeStructure?.advance?.value?.toString() || '',
    advanceBaseAmount: (existingCase as any)?.feeStructure?.advance?.baseAmount?.toString() || '',
    deferredFeeType: (existingCase as any)?.feeStructure?.deferred?.feeType || 'fixed_amount',
    deferredFeeValue: (existingCase as any)?.feeStructure?.deferred?.value?.toString() || '',
    deferredBaseAmount: (existingCase as any)?.feeStructure?.deferred?.baseAmount?.toString() || '',
    // Payment status fields
    totalAmount: (existingCase as any)?.paymentStatus?.totalAmount?.toString() || '',
    collectedAmount: (existingCase as any)?.paymentStatus?.collectedAmount?.toString() || '',
    collectionStatus: (existingCase as any)?.paymentStatus?.collectionStatus || 'unpaid',
    // Commission fields
    commissionType: (existingCase as any)?.commissionStructure?.type || 'percentage',
    commissionValue: (existingCase as any)?.commissionStructure?.value?.toString() || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

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
      <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
        <div className="bg-card rounded-lg max-w-full sm:max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">تفاصيل القضية</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Case Information */}
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">معلومات القضية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">رقم القضية</label>
                  <p className="text-foreground font-medium">{existingCase.caseNumber}</p>
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
                  <p className="text-foreground">{format(existingCase.createdDate, 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">آخر تحديث</label>
                  <p className="text-foreground">{format(existingCase.updatedDate, 'dd/MM/yyyy')}</p>
                </div>
                {existingCase.outcome && (
                  <div>
                    <label className="block text-sm font-medium text-foreground">نتيجة القضية</label>
                    <p className="text-foreground">{getOutcomeLabel(existingCase.outcome)}</p>
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
              <button
                onClick={onClose}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                إغلاق
              </button>
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
            {existingCase ? 'تعديل القضية' : 'إضافة قضية جديدة'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                رقم القضية *
              </label>
              <input
                type="text"
                value={formData.caseNumber}
                onChange={(e) => handleInputChange('caseNumber', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                  errors.caseNumber ? 'border-destructive/30' : 'border-border'
                }`}
                placeholder="NAF-2024-001"
              />
              {errors.caseNumber && (
                <p className="text-destructive text-sm mt-1">{errors.caseNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                نوع القضية *
              </label>
              <select
                value={formData.caseType}
                onChange={(e) => handleInputChange('caseType', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="قضية تجارية">قضية تجارية</option>
                <option value="قضية عمالية">قضية عمالية</option>
                <option value="قضية مدنية">قضية مدنية</option>
                <option value="قضية جزائية">قضية جزائية</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                العميل *
              </label>
              <select
                value={formData.clientId}
                onChange={(e) => handleInputChange('clientId', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                  errors.clientId ? 'border-destructive/30' : 'border-border'
                }`}
              >
                <option value="">اختر العميل</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName}
                  </option>
                ))}
              </select>
              {errors.clientId && (
                <p className="text-destructive text-sm mt-1">{errors.clientId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                حالة القضية
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="pending">منظورة</option>
                <option value="in-progress">قيد المعالجة</option>
                <option value="completed">مكتملة</option>
                <option value="postponed">مؤجلة</option>
              </select>
            </div>

            {formData.status === 'completed' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  نتيجة القضية
                </label>
                <select
                  value={formData.outcome}
                  onChange={(e) => handleInputChange('outcome', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">اختر النتيجة</option>
                  <option value="won">رابحة</option>
                  <option value="lost">خاسرة</option>
                  <option value="settled">تسوية</option>
                </select>
              </div>
            )}
          </div>

          {/* Marketer Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              المسوّق (اختياري)
            </label>
            <select
              value={formData.marketerId}
              onChange={(e) => handleInputChange('marketerId', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">بدون مسوّق</option>
              {marketers.map((marketer) => (
                <option key={marketer.id} value={marketer.id}>
                  {marketer.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Fee Structure */}
          <div className="space-y-4 p-4 bg-primary-soft rounded-lg">
            <h4 className="font-medium text-foreground">هيكل الأتعاب القانونية</h4>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                نوع الأتعاب
              </label>
              <select
                value={formData.feeType}
                onChange={(e) => handleInputChange('feeType', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="advance_only">مقدم فقط</option>
                <option value="deferred_only">مؤخر فقط</option>
                <option value="advance_and_deferred">مقدم ومؤخر</option>
              </select>
            </div>

            {/* Advance Fee */}
            {(formData.feeType === 'advance_only' || formData.feeType === 'advance_and_deferred') && (
              <div className="space-y-3 p-3 bg-card rounded border">
                <h5 className="font-medium text-foreground">الأتعاب المقدمة</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">النوع</label>
                    <select
                      value={formData.advanceFeeType}
                      onChange={(e) => handleInputChange('advanceFeeType', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="fixed_amount">مبلغ ثابت</option>
                      <option value="percentage">نسبة مئوية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {formData.advanceFeeType === 'percentage' ? 'النسبة (%)' : 'المبلغ (ر.س)'}
                    </label>
                    <input
                      type="number"
                      value={formData.advanceFeeValue}
                      onChange={(e) => handleInputChange('advanceFeeValue', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={formData.advanceFeeType === 'percentage' ? '10' : '5000'}
                    />
                  </div>
                  {formData.advanceFeeType === 'percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">المبلغ الأساسي (ر.س)</label>
                      <input
                        type="number"
                        value={formData.advanceBaseAmount}
                        onChange={(e) => handleInputChange('advanceBaseAmount', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded focus-visible:ring-2 focus-visible:ring-ring"
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
                    <select
                      value={formData.deferredFeeType}
                      onChange={(e) => handleInputChange('deferredFeeType', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="fixed_amount">مبلغ ثابت</option>
                      <option value="percentage">نسبة مئوية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {formData.deferredFeeType === 'percentage' ? 'النسبة (%)' : 'المبلغ (ر.س)'}
                    </label>
                    <input
                      type="number"
                      value={formData.deferredFeeValue}
                      onChange={(e) => handleInputChange('deferredFeeValue', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={formData.deferredFeeType === 'percentage' ? '15' : '10000'}
                    />
                  </div>
                  {formData.deferredFeeType === 'percentage' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">المبلغ الأساسي (ر.س)</label>
                      <input
                        type="number"
                        value={formData.deferredBaseAmount}
                        onChange={(e) => handleInputChange('deferredBaseAmount', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded focus-visible:ring-2 focus-visible:ring-ring"
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
                  المبلغ الإجمالي (ر.س)
                </label>
                <input
                  type="number"
                  value={formData.totalAmount}
                  onChange={(e) => handleInputChange('totalAmount', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="50000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  المبلغ المحصل (ر.س)
                </label>
                <input
                  type="number"
                  value={formData.collectedAmount}
                  onChange={(e) => handleInputChange('collectedAmount', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="30000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  حالة التحصيل
                </label>
                <select
                  value={formData.collectionStatus}
                  onChange={(e) => handleInputChange('collectionStatus', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="unpaid">غير مدفوع</option>
                  <option value="partially_paid">مدفوع جزئياً</option>
                  <option value="fully_paid">مدفوع بالكامل</option>
                </select>
              </div>
            </div>
            
            {formData.totalAmount && formData.collectedAmount && (
              <div className="p-3 bg-card rounded border">
                <p className="text-sm text-muted-foreground">
                  المبلغ المتبقي: <span className="font-medium text-destructive">
                    {(parseFloat(formData.totalAmount) - parseFloat(formData.collectedAmount)).toLocaleString()} ر.س
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
                  <select
                    value={formData.commissionType}
                    onChange={(e) => handleInputChange('commissionType', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="fixed_amount">مبلغ ثابت</option>
                    <option value="percentage">نسبة مئوية</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {formData.commissionType === 'percentage' ? 'النسبة (%)' : 'المبلغ (ر.س)'}
                  </label>
                  <input
                    type="number"
                    value={formData.commissionValue}
                    onChange={(e) => handleInputChange('commissionValue', e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={formData.commissionType === 'percentage' ? '10' : '5000'}
                  />
                </div>
              </div>
              
              {formData.commissionType === 'percentage' && formData.commissionValue && formData.collectedAmount && (
                <div className="p-3 bg-card rounded border">
                  <p className="text-sm text-muted-foreground">
                    العمولة المحسوبة: <span className="font-medium text-info">
                      {((parseFloat(formData.collectedAmount) * parseFloat(formData.commissionValue)) / 100).toLocaleString()} ر.س
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
            <textarea
              value={formData.summary}
              onChange={(e) => handleInputChange('summary', e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus-visible:ring-2 focus-visible:ring-ring ${
                errors.summary ? 'border-destructive/30' : 'border-border'
              }`}
              placeholder="وصف مختصر للقضية..."
            />
            {errors.summary && (
              <p className="text-destructive text-sm mt-1">{errors.summary}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              رابط Basecamp (اختياري)
            </label>
            <input
              type="url"
              value={formData.basecampUrl}
              onChange={(e) => handleInputChange('basecampUrl', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="https://basecamp.com/projects/..."
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
              {existingCase ? 'حفظ التغييرات' : 'إضافة القضية'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}