/* ============================================================
   حقول التقارير — تسميةٌ عربية لكل معرّف.

   وهي مرآةُ `FIELDS` في `worker/lib/reports.js` — والخادم هو الحاكم:
   حقلٌ هنا ولا يعرفه هناك يُرفض الطلبُ به بـ`unknown_field`، وذلك
   الاتجاه الصحيح. فهذا الملفّ للعرض والاختيار، وذاك للسماح.
   ============================================================ */

import { ReportField } from '../types';

export const REPORT_FIELDS: Record<string, ReportField[]> = {
  clients: [
    { id: 'fullName', name: 'الاسم الكامل', type: 'text', source: 'clients' },
    { id: 'idNumber', name: 'رقم الهوية', type: 'text', source: 'clients' },
    { id: 'clientType', name: 'نوع العميل', type: 'select', source: 'clients', options: ['individual', 'company', 'association', 'government'] },
    { id: 'status', name: 'الحالة', type: 'select', source: 'clients', options: ['current', 'former'] },
    { id: 'joinDate', name: 'تاريخ الانضمام', type: 'date', source: 'clients' },
    { id: 'email', name: 'البريد الإلكتروني', type: 'text', source: 'clients' },
    { id: 'phone', name: 'رقم الجوال', type: 'text', source: 'clients' }
  ],
  prospects: [
    { id: 'fullName', name: 'الاسم الكامل', type: 'text', source: 'prospects' },
    { id: 'idNumber', name: 'رقم الهوية', type: 'text', source: 'prospects' },
    { id: 'prospectStatus', name: 'حالة العميل المحتمل', type: 'text', source: 'prospects' },
    { id: 'expectedValue', name: 'القيمة المتوقعة', type: 'number', source: 'prospects', aggregatable: true },
    { id: 'source', name: 'المصدر', type: 'text', source: 'prospects' },
    { id: 'joinDate', name: 'تاريخ الإضافة', type: 'date', source: 'prospects' },
    { id: 'followUpDate', name: 'موعد المتابعة', type: 'date', source: 'prospects' }
  ],
  cases: [
    { id: 'caseNumber', name: 'رقم القضية', type: 'text', source: 'cases' },
    { id: 'caseType', name: 'نوع القضية', type: 'text', source: 'cases' },
    { id: 'status', name: 'الحالة', type: 'select', source: 'cases', options: ['pending', 'in-progress', 'completed', 'postponed'] },
    { id: 'outcome', name: 'النتيجة', type: 'select', source: 'cases', options: ['won', 'lost', 'settled'] },
    { id: 'clientName', name: 'اسم العميل', type: 'text', source: 'cases' },
    { id: 'marketerName', name: 'المسوّق', type: 'text', source: 'cases' },
    { id: 'createdDate', name: 'تاريخ الإنشاء', type: 'date', source: 'cases' },
    { id: 'updatedDate', name: 'تاريخ التحديث', type: 'date', source: 'cases' }
  ]
};

/** تسميةُ المصدر — والمصادرُ ما في `REPORT_FIELDS` لا أكثر. */
export const SOURCE_LABEL: Record<string, string> = {
  clients: 'العملاء',
  prospects: 'العملاء المحتملين',
  cases: 'القضايا'
};

const AGG_LABEL: Record<string, string> = {
  count: 'العدد',
  sum: 'المجموع',
  avg: 'المتوسّط',
  min: 'الأدنى',
  max: 'الأعلى'
};

const BY_ID = new Map<string, string>();
for (const fields of Object.values(REPORT_FIELDS)) {
  for (const field of fields) BY_ID.set(field.id, field.name);
}

/**
 * تسميةُ عمودٍ في النتيجة.
 *
 * وأعمدةُ التجميع تعود بصيغة `<حقل>_<دالّة>` من الخادم، فتُقرأ جزأين.
 * والمعرّفُ المجهول يُعاد كما هو: إظهارُه أصدق من إخفائه.
 */
export function columnLabel(column: string): string {
  if (column === 'count') return AGG_LABEL.count;
  const direct = BY_ID.get(column);
  if (direct) return direct;

  const cut = column.lastIndexOf('_');
  if (cut > 0) {
    const field = BY_ID.get(column.slice(0, cut));
    const agg = AGG_LABEL[column.slice(cut + 1)];
    if (field && agg) return `${agg} — ${field}`;
  }
  return column;
}

/** خليّةٌ تُعرض. التواريخ تصل ISO من الخادم فتُقصّ إلى يومها. */
export function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10).split('-').join('/');
  }
  return String(value);
}
