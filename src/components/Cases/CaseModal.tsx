import React, { useState, useEffect } from 'react';
import { ExternalLink, HandHeart, Sparkles } from 'lucide-react';
import { Attachment, Case, Client, Marketer, FeeStructure, MemberEntry, OpposingParty, PaymentStatus, CommissionStructure } from '../../types';
import AttachmentList from '../Common/AttachmentList';
import CasePayments from './CasePayments';
import OpposingParties from './OpposingParties';
import { db } from '../../data/database';
import { useSettingList } from '../../lib/use-settings';
import { caseStatusLabel, collectionStatusLabel, feeTypeLabel } from '../../lib/labels';
import { caseOutcomeBadge, caseStatusBadge } from '../../lib/status-badges';
import { Money } from '@/registry/naf/currency/money';
import { formatDate } from '@/registry/naf/lib/format';
import { Dialog, DialogContent, DialogTitle } from '@/registry/naf/ui/dialog';
import { Textarea } from '@/registry/naf/ui/textarea';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';

/** حالةُ التحصيل من الرقمين — مرآةُ `collectionStatusOf` في `worker/lib/payments.js`. */
function derivedCollectionStatus(total: number, collected: number): PaymentStatus['collectionStatus'] {
  if (collected <= 0) return 'unpaid';
  if (total > 0 && collected >= total) return 'fully_paid';
  return 'partially_paid';
}

interface CaseModalProps {
  case?: Case;
  onClose: () => void;
  onSave?: (caseData: Partial<Case>) => void;
  isEditing?: boolean;
}

export default function CaseModal({ case: existingCase, onClose, onSave, isEditing = false }: CaseModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  /* الأعضاء المفعَّلون — للمحامي المسؤول وفريقه. */
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [formData, setFormData] = useState({
    caseNumber: existingCase?.caseNumber || '',
    caseType: existingCase?.caseType || 'قضية تجارية',
    clientId: existingCase?.clientId || '',
    summary: existingCase?.summary || '',
    /* حاشيةٌ على القضية غيرُ موضوعها — ويستوردها ربطُ بيسكامب من
       «بيانات المشروع». وحقلٌ يُستورَد ولا تُظهره شاشةٌ بيانٌ مخبوء. */
    notes: existingCase?.notes || '',
    status: existingCase?.status || 'pending',
    basecampUrl: existingCase?.basecampUrl || '',
    outcome: existingCase?.outcome || '',
    // Marketer fields
    marketerId: existingCase?.marketerId || '',
    lawyerId: existingCase?.lawyerId || '',
    proBonoValue: existingCase?.proBonoValue?.toString() || '',
    proBonoHours: existingCase?.proBonoHours?.toString() || '',
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

  // قائمةٌ لا نصّ، فخارج `formData` الذي يقبل النصّ وحده.
  const [attachments, setAttachments] = useState<Attachment[]>(existingCase?.attachments ?? []);
  /* قائمةٌ لا نصّ، فخارج `formData` كالمرفقات. */
  const [opposingParties, setOpposingParties] = useState<OpposingParty[]>(existingCase?.opposingParties ?? []);
  const [team, setTeam] = useState<string[]>(existingCase?.team ?? []);

  /* المنسدلات من «تكوين النظام» لا من نصوصٍ في التصيير. والقيمةُ المحفوظة
     تُمرَّر فتبقى ظاهرةً حتى لو حُذفت من التكوين بعد حفظها. */
  const caseTypes = useSettingList('caseTypes', formData.caseType);
  const caseStatuses = useSettingList('caseStatuses', formData.status);
  const feeTypes = useSettingList('feeTypes', formData.feeType);

  useEffect(() => {
    // تحميل قائمة العملاء
    const loadData = async () => {
      try {
        const allClients = await db.getClients();
        setClients(allClients);
        
        // تحميل قائمة المسوّقين النشطين
        const allMarketers = await db.getMarketers();
        setMarketers(allMarketers.filter(m => m.status === 'active'));
        setMembers(await db.getDirectory());
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
      newErrors.summary = 'موضوع المشروع مطلوب';
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
    
    /* ═══ والتطوّعيةُ بلا مال ═══
       لا أتعابَ ولا تحصيلَ ولا عمولة: تُصفَّر هنا، فلا يبقى في صفّها مبلغٌ
       كُتب قبل أن تُعلَّم تطوّعاً فيُحسب إيراداً في مكانٍ ما. */
    const proBono = formData.feeType === 'pro_bono';

    // Build payment status
    const totalAmount = proBono ? 0 : parseFloat(formData.totalAmount) || 0;
    const collectedAmount = proBono ? 0 : parseFloat(formData.collectedAmount) || 0;
    const paymentStatus: PaymentStatus = {
      totalAmount,
      collectedAmount,
      remainingAmount: totalAmount - collectedAmount,
      /* والحالةُ تُشتقّ من الرقمين كما يشتقّها الخادم — وهو يكتبها ثانيةً
         من سجلّ الدفعات بعد الحفظ، فما يُرسل هنا لا يُعتمد. */
      collectionStatus: derivedCollectionStatus(totalAmount, collectedAmount)
    };
    
    // Build commission structure
    const commissionStructure: CommissionStructure | undefined = formData.marketerId && !proBono ? {
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
      commissionStructure,
      attachments,
      lawyerId: formData.lawyerId || null,
      /* والمسؤولُ ليس من فريقه — هو فوقه. */
      team: team.filter((id) => id && id !== formData.lawyerId),
      /* قيمةُ التطوّعي وساعاتُه للتطوّعية وحدها؛ وغيرُها يُفرَّغ فلا يُجمع. */
      proBonoValue: proBono && formData.proBonoValue ? parseFloat(formData.proBonoValue) : null,
      proBonoHours: proBono && formData.proBonoHours ? parseFloat(formData.proBonoHours) : null,
      /* طرفٌ بلا اسمٍ يُطرح: سطرٌ أُضيف ولم يُملأ ليس خصماً. */
      opposingParties: opposingParties
        .map((party) => ({ name: party.name.trim(), ...(party.idNumber?.trim() ? { idNumber: party.idNumber.trim() } : {}) }))
        .filter((party) => party.name)
    };

    onSave?.(caseData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
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
                  <p className="text-foreground">{caseStatusBadge(existingCase.status).label}</p>
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
                      const { variant, Icon, label } = caseOutcomeBadge(existingCase.outcome);
                      return (
                        <Badge variant={variant}>
                          <Icon aria-hidden="true" />
                          {label}
                        </Badge>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* موضوع المشروع */}
            <div className="bg-primary-soft rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">موضوع المشروع</h3>
              <p className="text-foreground whitespace-pre-wrap">{existingCase.summary}</p>
            </div>

            {(existingCase.lawyerId || (existingCase.team ?? []).length > 0) && (
              <div className="bg-muted rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-3">المحامي المسؤول</h3>
                <p className="text-foreground">
                  {members.find((member) => member.id === existingCase.lawyerId)?.name ?? (existingCase.lawyerId ? '—' : 'بلا محامٍ')}
                </p>
                {(existingCase.team ?? []).length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    الفريق: {(existingCase.team ?? []).map((id) => members.find((member) => member.id === id)?.name ?? '—').join('، ')}
                  </p>
                )}
              </div>
            )}

            {existingCase.feeStructure?.type === 'pro_bono' && (existingCase.proBonoValue || existingCase.proBonoHours) && (
              <div className="bg-muted rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-3">قيمة العمل التطوّعي</h3>
                <p className="text-foreground">
                  {existingCase.proBonoValue ? <Money value={existingCase.proBonoValue} /> : '—'}
                  {existingCase.proBonoHours ? <span className="text-muted-foreground"> · <bdi>{existingCase.proBonoHours}</bdi> ساعة</span> : null}
                </p>
              </div>
            )}

            {(existingCase.opposingParties ?? []).length > 0 && (
              <div className="bg-muted rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-3">الأطراف الخصم</h3>
                <ul className="space-y-1 text-foreground">
                  {(existingCase.opposingParties ?? []).map((party, index) => (
                    <li key={index}>
                      {party.name}
                      {party.idNumber && <span className="text-muted-foreground"> · <bdi>{party.idNumber}</bdi></span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {existingCase.notes && (
              <div className="bg-muted rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-3">الملاحظات</h3>
                <p className="text-foreground whitespace-pre-wrap">{existingCase.notes}</p>
              </div>
            )}

            {/* ═══ الملخّصُ الآليّ ═══
                مسمّىً بذلك عمداً: نصٌّ صاغه طرازٌ، ومن يقرؤه بعد شهرٍ يجب أن
                يعرف أنّ محامياً لم يكتبه. ولا يُحرَّر من هنا — يُعاد كتابتُه
                من مصدره حين يتبدّل. */}
            {existingCase.aiSummary && (
              <div className="bg-info-soft rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  ملخّصٌ آليّ
                </h3>
                <p className="text-xs text-muted-foreground mb-2">
                  كتبه الطراز من بيانات القضية — يُقرأ ولا يُعتمد بلا مراجعة.
                </p>
                <p className="text-foreground whitespace-pre-wrap">{existingCase.aiSummary}</p>
              </div>
            )}

            {/* أوراق القضية */}
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-lg font-semibold text-foreground mb-3">أوراق القضية</h3>
              <AttachmentList value={existingCase.attachments ?? []} readOnly />
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

          {/* ═══ المحامي المسؤول وفريقُه ═══
              واحدٌ مسؤول، ومن يعاونه إن وُجد. والرؤيةُ لا تتبدّل به —
              الكلُّ يرى الكلّ، وللمحامي تصفيةُ «قضاياي». */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">المحامي المسؤول</label>
              <Select value={formData.lawyerId} onChange={(e) => handleInputChange('lawyerId', e.target.value)}>
                <option value="">بلا محامٍ</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.name || member.id}</option>
                ))}
              </Select>
            </div>
            <div>
              <p className="block text-sm font-medium text-foreground mb-2">الفريق (اختياري)</p>
              <div className="flex flex-wrap gap-2">
                {members.filter((member) => member.id !== formData.lawyerId).map((member) => {
                  const on = team.includes(member.id);
                  return (
                    <Button
                      key={member.id}
                      type="button"
                      size="sm"
                      variant={on ? 'default' : 'outline'}
                      aria-pressed={on}
                      onClick={() => setTeam((current) => on ? current.filter((id) => id !== member.id) : [...current, member.id])}
                    >
                      {member.name || member.id}
                    </Button>
                  );
                })}
              </div>
            </div>
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
              {/* من «تكوين النظام» كبقية المنسدلات — وكانت الثلاثةُ مكتوبةً
                  هنا بينما القائمةُ المكوَّنة تحمل مفرداتٍ أخرى لا يقرؤها أحد. */}
              <Select
                value={formData.feeType}
                onChange={(e) => handleInputChange('feeType', e.target.value)}
              >
                {feeTypes.map((type) => (
                  <option key={type} value={type}>{feeTypeLabel(type)}</option>
                ))}
              </Select>
            </div>

            {formData.feeType === 'pro_bono' && (
              <div className="flex items-start gap-2 p-3 bg-card rounded border">
                <HandHeart className="h-5 w-5 text-primary mt-0.5" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  قضيةٌ يقدّمها المكتب مجاناً تطوّعاً — بلا أتعابٍ ولا تحصيلٍ ولا عمولة،
                  ولا تدخل الإيرادات.
                </p>
              </div>
            )}

            {/* ═══ قيمةُ العمل التطوّعي ═══
                ما كان المكتب سيتقاضاه — تقديراً — وساعاتُه إن عُدّت. وبهما يُبنى
                تقريرُ المسؤولية الاجتماعية. */}
            {formData.feeType === 'pro_bono' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">القيمة التقديرية بالريال</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.proBonoValue}
                    onChange={(e) => handleInputChange('proBonoValue', e.target.value)}
                    placeholder="15000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">الساعات (اختياري)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.proBonoHours}
                    onChange={(e) => handleInputChange('proBonoHours', e.target.value)}
                    placeholder="20"
                  />
                </div>
              </div>
            )}

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
          {formData.feeType !== 'pro_bono' && (
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

              {/* ═══ المحصَّلُ مجموعُ الدفعات لا رقمٌ يُكتب ═══
                  كان حقلاً يُكتب بيد، فيُكتب فوقه ويضيع ما قبله. وصار يُقرأ من
                  سجلّ الدفعات أدناه — والخادمُ يكتبه، والشاشةُ تعرضه. */}
              <div>
                <p className="block text-sm font-medium text-foreground mb-2">المبلغ المحصَّل</p>
                <p className="py-2 text-foreground font-medium">
                  <Money value={parseFloat(formData.collectedAmount) || 0} />
                </p>
              </div>

              <div>
                <p className="block text-sm font-medium text-foreground mb-2">حالة التحصيل</p>
                <p className="py-2 text-foreground">
                  {collectionStatusLabel(derivedCollectionStatus(
                    parseFloat(formData.totalAmount) || 0,
                    parseFloat(formData.collectedAmount) || 0,
                  ))}
                </p>
              </div>
            </div>

            {formData.totalAmount && (
              <div className="p-3 bg-card rounded border">
                <p className="text-sm text-muted-foreground">
                  المبلغ المتبقي: <span className="font-medium text-destructive">
                    <Money value={Math.max((parseFloat(formData.totalAmount) || 0) - (parseFloat(formData.collectedAmount) || 0), 0)} />
                  </span>
                </p>
              </div>
            )}

            {existingCase?.id ? (
              <CasePayments
                caseId={existingCase.id}
                onCollectedChange={(collected) => handleInputChange('collectedAmount', String(collected))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">تُسجَّل الدفعات بعد حفظ القضية.</p>
            )}
          </div>

          )}

          {/* Commission Structure (only if marketer is selected) */}
          {formData.marketerId && formData.feeType !== 'pro_bono' && (
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
              موضوع المشروع *
            </label>
            <Textarea
              value={formData.summary}
              onChange={(e) => handleInputChange('summary', e.target.value)}
              rows={4}
              placeholder="وصف مختصر لموضوع المشروع..."
             aria-invalid={!!errors.summary} />
            {errors.summary && (
              <p className="text-destructive text-sm mt-1">{errors.summary}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              الملاحظات
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              placeholder="حاشيةٌ على القضية — غيرُ الموضوع..."
            />
          </div>

          {/* ═══ الأطرافُ الخصم ═══
              وبها يُفحص تعارضُ المصالح: كلُّ طرفٍ يُسأل عنه أموكّلٌ هو عندنا،
              وكلُّ موكّلٍ جديد يُسأل عنه أخصمٌ هو في قضيةٍ عندنا. */}
          <div>
            <p className="block text-sm font-medium text-foreground mb-2">الأطراف الخصم</p>
            <OpposingParties value={opposingParties} onChange={setOpposingParties} clientId={formData.clientId || undefined} />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              أوراق القضية
            </label>
            <AttachmentList value={attachments} onChange={setAttachments} />
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