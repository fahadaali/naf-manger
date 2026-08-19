/* ============================================================
   التسميات العربية لقيم التعداد.

   كل خريطة هنا نسخةٌ حرفية من جدولٍ مسجَّل في `naf-terms.md` §٣
   «حالات إدارة المكتب» — والمصدر هناك لا هنا. إن اختلف الملفّان
   فالسجلّ هو الصواب وهذا الملفّ هو الخطأ.

   وُضعت في موضع واحد لأن الخريطة نفسها كانت مكتوبة في خمس شاشات
   بصيغة `switch`، وشاشتان منها نسيتا الترجمة أصلاً فعرضتا القيمة
   الإنجليزية للمستخدم: «individual» في نافذة العميل، و«employee»
   في بطاقة المسوّق. وخريطةٌ في خمسة مواضع تُنسى في السادس.

   القيمة غير المعروفة تُعاد كما هي: إظهار المفتاح الخام أصدق من
   إخفائه، ويُرى في المراجعة بدل أن يصمت.
   ============================================================ */

const CLIENT_TYPE: Record<string, string> = {
  individual: 'فرد',
  company: 'شركة',
  association: 'جمعية',
  government: 'جهة حكومية',
}

const RELATIONSHIP_TYPE: Record<string, string> = {
  employee: 'موظف',
  freelancer: 'مستقل',
  external_company: 'شركة خارجية',
}

const CASE_STATUS: Record<string, string> = {
  pending: 'منظورة',
  'in-progress': 'قيد المعالجة',
  completed: 'مكتملة',
  postponed: 'مؤجلة',
}

const CASE_OUTCOME: Record<string, string> = {
  won: 'رابحة',
  lost: 'خاسرة',
  settled: 'تسوية',
}

const MARKETER_STATUS: Record<string, string> = {
  active: 'نشط',
  suspended: 'معطّل',
  former: 'سابق',
}

const CLIENT_STATUS: Record<string, string> = {
  current: 'حالي',
  former: 'سابق',
}

const COMMISSION_TYPE: Record<string, string> = {
  fixed_amount: 'مبلغ ثابت',
  percentage: 'نسبة مئوية',
}

const COLLECTION_STATUS: Record<string, string> = {
  unpaid: 'غير مدفوع',
  partially_paid: 'مدفوع جزئياً',
  fully_paid: 'مدفوع كاملاً',
}

/* بنيةُ الأتعاب — مقدَّمٌ ومؤخَّر. وهي غيرُ `COMMISSION_TYPE`: تلك تقول
   «كيف يُحسب المبلغ» وهذه تقول «متى يُستحقّ». وكانت قائمةُ `feeTypes` في
   الافتراضات تحمل الأولى بينما شاشةُ القضية تكتب الثانية — فالقائمةُ
   تُحرَّر ولا يقرؤها أحد، وشاشةُ التكوين تترجم ثالثةً لا تطابق أيّاً منهما. */
const FEE_TYPE: Record<string, string> = {
  advance_only: 'مقدَّم فقط',
  deferred_only: 'مؤخَّر فقط',
  advance_and_deferred: 'مقدَّم ومؤخَّر',
}

/* دورُ العضو — وكانت هذه الخريطة مكتوبةً في `Header` و`UserManagement`
   كلتيهما، وهو عين ما أُنشئ هذا الملفّ لإنهائه. */
const ROLE: Record<string, string> = {
  admin: 'مسؤول النظام',
  lawyer: 'محامٍ',
  staff: 'إداري',
}

const label = (map: Record<string, string>) => (value?: string) =>
  (value && map[value]) || value || ''

export const clientTypeLabel = label(CLIENT_TYPE)
export const relationshipTypeLabel = label(RELATIONSHIP_TYPE)
export const caseStatusLabel = label(CASE_STATUS)
export const caseOutcomeLabel = label(CASE_OUTCOME)
export const marketerStatusLabel = label(MARKETER_STATUS)
export const clientStatusLabel = label(CLIENT_STATUS)
export const commissionTypeLabel = label(COMMISSION_TYPE)
export const collectionStatusLabel = label(COLLECTION_STATUS)
export const feeTypeLabel = label(FEE_TYPE)
export const roleLabel = label(ROLE)
