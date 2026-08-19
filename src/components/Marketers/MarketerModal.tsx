import React, { useEffect, useState } from 'react';
import { Archive, Banknote, ChartColumn, CircleCheck, CircleSlash, TriangleAlert, User } from 'lucide-react';
import { Case, CommissionPayment, Marketer, MarketerStats } from '../../types';
/* date-fns هنا لقيمة <input type="date"> وحدها: الوسم يقبل yyyy-MM-dd
   ولا يقبل غيرها، وهي صيغة نقل لا صيغة عرض. كل تاريخ يقرؤه المستخدم
   يمرّ بـ formatDate من naf-format. */
import { format } from 'date-fns';
import { db } from '../../data/database';
import ProfilePictureUpload from '../Common/ProfilePictureUpload';
import ProfileAvatar from '../Common/ProfileAvatar';
import { Money } from '@/registry/naf/currency/money';
import { formatDate, formatNumber, formatPhone } from '@/registry/naf/lib/format';
import { useSettingList } from '../../lib/use-settings';
import { marketerStatusLabel, relationshipTypeLabel } from '../../lib/labels';
import { caseStatusBadge } from '../../lib/case-badges';
import { Dialog, DialogContent, DialogTitle } from '@/registry/naf/ui/dialog';
import { Textarea } from '@/registry/naf/ui/textarea';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Alert } from '@/registry/naf/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/registry/naf/ui/table';

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

  // من «تكوين النظام» لا من نصوصٍ في التصيير.
  const relationshipTypes = useSettingList('relationshipTypes', formData.relationshipType);
  const marketerStatuses = useSettingList('marketerStatuses', formData.status);

  /* ═══ الأداء والقضايا يُجلبان، ولا يُقرآن من وعد ═══
   *
   * كانا يُقرآن في التصيير هكذا:
   *     const stats = db.getMarketerStats(marketer.id);
   *     const marketerCases = db.getCases().filter(...);
   * والدالّتان غير متزامنتين، فالعائد وعدٌ لا بيانات: `‎.filter‎` عليه
   * يرمي `TypeError` في أثناء التصيير — فتُهدم الشجرة كلُّها إلى صفحة
   * بيضاء أوّلَ ما يُفتح «تفاصيل المسوّق»، و`stats.totalCases` تقرأ
   * `undefined` فتظهر الأرقام فارغة.
   *
   * فالجلبُ في تأثير، والحالةُ تبدأ بأصفار — كما في `MarketerCard`.
   */
  const [stats, setStats] = useState<MarketerStats>({
    totalCases: 0,
    completedCases: 0,
    wonCases: 0,
    lostCases: 0,
    totalRevenue: 0,
    totalCommissionEarned: 0,
    totalCommissionPaid: 0,
    remainingCommission: 0,
    conversionRate: 0,
    averageCaseValue: 0
  });
  const [marketerCases, setMarketerCases] = useState<Case[]>([]);
  const [payments, setPayments] = useState<CommissionPayment[]>([]);

  const marketerId = marketer?.id;
  const viewing = !isEditing && Boolean(marketerId);

  /* نموذجُ تسجيل دفعة — مفتوحٌ عند الطلب لا دائماً: الجدولُ هو المقصود
     والتسجيلُ حدثٌ نادر. */
  const [paying, setPaying] = useState(false);
  const [payment, setPayment] = useState({ caseId: '', amount: '', paymentDate: '', notes: '' });
  const [paymentError, setPaymentError] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const load = async (id: string) => {
    const [marketerStats, allCases, allPayments] = await Promise.all([
      db.getMarketerStats(id),
      db.getCases(),
      db.getCommissionPayments(id),
    ]);
    return {
      stats: marketerStats,
      cases: allCases.filter((c) => c.marketerId === id && !c.archivedAt),
      payments: allPayments,
    };
  };

  useEffect(() => {
    if (!viewing || !marketerId) return;

    // مقياسٌ يمنع كتابةَ نتيجةِ مسوّقٍ سابق فوق حالة اللاحق إن تبدّل قبل وصولها.
    let alive = true;

    load(marketerId)
      .then((result) => {
        if (!alive) return;
        setStats(result.stats);
        setMarketerCases(result.cases);
        setPayments(result.payments);
      })
      .catch((error) => {
        console.error('Error loading marketer details:', error);
        if (alive) {
          setMarketerCases([]);
          setPayments([]);
        }
      });

    return () => {
      alive = false;
    };
  }, [viewing, marketerId]);

  /* ═══ المدفوعُ لكلِّ قضية ═══
   *
   * كان الجدولُ يقرأ `case_.totalCommissionPaid` و`case_.remainingCommission`
   * — حقلين مصرَّحين في النوع ولا يكتبهما شيء — فيعرض العمودان **٠٫٠٠ ﷼**
   * لكلّ قضية أبداً. والمدفوعُ يُجمع الآن من الدفعات المسجَّلة نفسها.
   */
  const paidByCase = payments.reduce<Record<string, number>>((sum, entry) => {
    sum[entry.caseId] = (sum[entry.caseId] ?? 0) + entry.amount;
    return sum;
  }, {});

  /** العمولةُ المستحقّة على قضيةٍ بعينها — كما تُحسب في الخادم للمجموع. */
  const earnedOn = (case_: Case): number => {
    const commission = case_.commissionStructure;
    if (!commission) return 0;
    const collected = case_.paymentStatus?.collectedAmount ?? 0;
    return commission.type === 'percentage'
      ? (collected * (commission.value ?? 0)) / 100
      : (commission.value ?? 0);
  };

  const recordPayment = async () => {
    if (!marketerId) return;
    setPaymentError('');

    const amount = parseFloat(payment.amount);
    if (!payment.caseId) return setPaymentError('اختر القضية');
    if (!Number.isFinite(amount) || amount <= 0) return setPaymentError('أدخل مبلغاً أكبر من صفر');

    setSavingPayment(true);
    try {
      await db.createCommissionPayment({
        marketerId,
        caseId: payment.caseId,
        amount,
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
        notes: payment.notes || undefined,
      } as Omit<CommissionPayment, 'id'>);

      const result = await load(marketerId);
      setStats(result.stats);
      setMarketerCases(result.cases);
      setPayments(result.payments);

      setPayment({ caseId: '', amount: '', paymentDate: '', notes: '' });
      setPaying(false);
    } catch (error) {
      console.error('تعذّر تسجيل الدفعة:', error);
      setPaymentError('تعذّر تسجيل الدفعة. أعد المحاولة');
    } finally {
      setSavingPayment(false);
    }
  };

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
    // View mode — `stats` و`marketerCases` من التأثير أعلاه.
    return (
      <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent className="max-w-6xl max-h-full overflow-y-auto p-0">
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-soft rounded-lg">
                <User className="h-6 w-6 text-info-strong" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">{marketer.fullName}</DialogTitle>
                <p className="text-sm text-muted-foreground">تفاصيل المسوّق والأداء</p>
              </div>
            </div>
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
                  <p className="text-foreground"><bdi>{formatDate(marketer.startDate)}</bdi></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">الحالة</label>
                  {(() => {
                    const map = {
                      active: { variant: 'success' as const, Icon: CircleCheck, label: 'نشط' },
                      suspended: { variant: 'default' as const, Icon: CircleSlash, label: 'معطّل' }
                    };
                    const { variant, Icon, label } =
                      map[marketer.status as keyof typeof map] ??
                      { variant: 'default' as const, Icon: Archive, label: 'سابق' };
                    return (
                      <Badge variant={variant}>
                        <Icon aria-hidden="true" />
                        {label}
                      </Badge>
                    );
                  })()}
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
                  <p className="text-2xl font-bold text-primary"><bdi>{formatNumber(stats.totalCases)}</bdi></p>
                  <p className="text-sm text-muted-foreground">إجمالي القضايا</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-success"><bdi>{formatNumber(stats.completedCases)}</bdi></p>
                  <p className="text-sm text-muted-foreground">المكتملة</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground"><bdi>{formatNumber(stats.conversionRate)}%</bdi></p>
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
                  <Table className="rounded-lg">
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم القضية</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>المبلغ الإجمالي</TableHead>
                        <TableHead>المحصل</TableHead>
                        <TableHead>العمولة المدفوعة</TableHead>
                        <TableHead>المتبقي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketerCases.map((case_) => (
                        <TableRow key={case_.id}>
                          <TableCell className="text-primary"><bdi>{case_.caseNumber}</bdi></TableCell>
                          <TableCell className="text-foreground">{case_.clientName}</TableCell>
                          <TableCell>
                            {(() => {
                          /* كانت هنا خريطةٌ ثالثة بثلاث حالاتٍ ثمّ
                             `?? map.pending` — فالقضيةُ **المؤجَّلة** تُعرض
                             «منظورة» بشارةٍ برتقالية. والشارةُ الآن من
                             `lib/case-badges.ts`، موضعاً واحداً للثلاث شاشات. */
                          const { variant, Icon, label } = caseStatusBadge(case_.status);
                          return (
                            <Badge variant={variant}>
                              <Icon aria-hidden="true" />
                              {label}
                            </Badge>
                          );
                        })()}
                          </TableCell>
                          <TableCell className="text-foreground">
                            <Money value={case_.paymentStatus?.totalAmount ?? 0} />
                          </TableCell>
                          <TableCell className="text-success">
                            <Money value={case_.paymentStatus?.collectedAmount ?? 0} />
                          </TableCell>
                          <TableCell className="text-info">
                            <Money value={paidByCase[case_.id] ?? 0} />
                          </TableCell>
                          <TableCell className="text-warning">
                            <Money value={earnedOn(case_) - (paidByCase[case_.id] ?? 0)} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">لم تُربَط أي قضية بهذا المسوّق بعد.</p>
              )}
            </div>

            {/* ═══ دفعاتُ العمولة ═══
                كان الجدولُ في القاعدة والموردُ في الـWorker ولا شاشةَ تسجّل
                دفعةً — فبطاقتا «المدفوع» و«المتبقّي» رقمان لا يتحرّكان أبداً.
                والتسجيلُ من هنا، والمجموعُ يُقرأ من الصفوف نفسها. */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Banknote className="h-5 w-5" />
                  دفعات العمولة
                </h3>
                {marketerCases.length > 0 && (
                  <Button
                    type="button"
                    onClick={() => { setPaying((open) => !open); setPaymentError(''); }}
                    variant={paying ? 'ghost' : 'outline'}
                    size="sm"
                  >
                    {paying ? 'إلغاء' : 'تسجيل دفعة'}
                  </Button>
                )}
              </div>

              {paying && (
                <div className="bg-muted rounded-lg p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">القضية</label>
                      <Select
                        value={payment.caseId}
                        onChange={(e) => setPayment((prev) => ({ ...prev, caseId: e.target.value }))}
                      >
                        <option value="">اختر القضية</option>
                        {marketerCases.map((case_) => (
                          <option key={case_.id} value={case_.id}>
                            {case_.caseNumber} — {case_.clientName}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">المبلغ بالريال</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={payment.amount}
                        onChange={(e) => setPayment((prev) => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">تاريخ الدفع</label>
                      <Input
                        type="date"
                        value={payment.paymentDate}
                        onChange={(e) => setPayment((prev) => ({ ...prev, paymentDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">ملاحظات</label>
                    <Input
                      type="text"
                      value={payment.notes}
                      onChange={(e) => setPayment((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="اختياري — رقم الحوالة مثلاً"
                    />
                  </div>

                  {paymentError && (
                    <Alert variant="destructive">
                      <TriangleAlert aria-hidden="true" />
                      <span>{paymentError}</span>
                    </Alert>
                  )}

                  <div className="flex justify-end">
                    <Button type="button" onClick={recordPayment} disabled={savingPayment}>
                      {savingPayment ? 'جارٍ التسجيل' : 'تسجيل الدفعة'}
                    </Button>
                  </div>
                </div>
              )}

              {payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table className="rounded-lg">
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>القضية</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((entry) => {
                        const related = marketerCases.find((c) => c.id === entry.caseId);
                        return (
                          <TableRow key={entry.id}>
                            <TableCell><bdi>{formatDate(entry.paymentDate)}</bdi></TableCell>
                            <TableCell className="text-primary">
                              <bdi>{related?.caseNumber ?? '—'}</bdi>
                            </TableCell>
                            <TableCell className="text-info"><Money value={entry.amount} /></TableCell>
                            <TableCell className="text-muted-foreground">{entry.notes || '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  لم تُسجَّل دفعةُ عمولةٍ بعد.
                </p>
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
        <DialogContent className="max-w-2xl max-h-full overflow-y-auto p-0">
        <div className="flex items-center justify-between p-6 border-b">
          <DialogTitle className="text-xl font-bold">
            {marketer ? 'تعديل المسوّق' : 'إضافة مسوّق جديد'}
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
                رقم الهوية / الإقامة *
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
                نوع العلاقة
              </label>
              <Select
                value={formData.relationshipType}
                onChange={(e) => handleInputChange('relationshipType', e.target.value)}
              >
                {relationshipTypes.map((type) => (
                  <option key={type} value={type}>{relationshipTypeLabel(type)}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                حالة المسوّق
              </label>
              <Select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
              >
                {marketerStatuses.map((status) => (
                  <option key={status} value={status}>{marketerStatusLabel(status)}</option>
                ))}
              </Select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                تاريخ بدء التعاون *
              </label>
              <Input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
               aria-invalid={!!errors.startDate} />
              {errors.startDate && (
                <p className="text-destructive text-sm mt-1">{errors.startDate}</p>
              )}
            </div>
          </div>

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

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" onClick={onClose} variant="ghost">
              إلغاء
            </Button>
            <button
              type="submit"
              className="bg-info hover:bg-info/90 text-info-foreground px-6 py-2 rounded-lg"
            >
              {marketer ? 'حفظ التغييرات' : 'إضافة المسوّق'}
            </button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
  );
}