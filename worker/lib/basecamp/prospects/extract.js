// بطاقةٌ كتبها إنسانٌ في بيسكامب بنصٍّ حرّ — يُستخرج منها ما ينقص.
//
// الحدودُ حدودُ `ai/extract.js` نفسُها، والنداءُ نداؤها: الطرازُ يُسأل عن
// الفارغ وحده، وكلُّ قيمةٍ يردّها تُطابَق بالنصّ حرفاً (`appearsIn`) ثم تمرّ
// على مدقّقي الحقول (`coerceField`). فما لم يُكتب في البطاقة أو تعليقاتها
// لا يدخل ملفَّ العميل — والفراغُ أسلمُ من اسمٍ مؤلَّف.

import { extractFields } from '../../ai/extract.js';
import { coerceField, FIELD_LABELS } from './card-format.js';

/* ما يُطلب من الطراز. والحالةُ ليست منها — العمودُ يقولها. والملاحظاتُ ليست
   منها كذلك — النصُّ الحرّ نفسُه يُحفظ ملاحظةً، فلا يُلخَّص فيضيع منه شيء. */
export const EXTRACTABLE = [
  'fullName', 'phone', 'email', 'clientType', 'idNumber', 'commercialRegister', 'source', 'expectedValue',
  'followUpDate',
];

const HINTS = {
  clientType: 'نوع العميل: فرد أو شركة أو جمعية أو جهة حكومية — كما ورد في النص',
  expectedValue: 'القيمة المتوقعة للعقد أو الأتعاب بالريال — الرقم كما ورد',
  followUpDate: 'موعد المتابعة — التاريخ كما ورد',
  fullName: 'اسم العميل أو المنشأة كما ورد',
};

/**
 * يستخرج الحقولَ الفارغة من نصّ البطاقة وتعليقاتها.
 *
 * `missing` الحقولُ التي بقيت فارغة بعد القراءة بالقاعدة. والمردودُ
 * `{ field: canonicalValue }` لما وُجد وصحّ وحده.
 */
export async function extractProspect(env, { text, missing }) {
  const wanted = (missing ?? []).filter((field) => EXTRACTABLE.includes(field));
  if (!String(text ?? '').trim() || !wanted.length) return {};

  const labels = Object.fromEntries(wanted.map((field) => [field, HINTS[field] ?? FIELD_LABELS[field] ?? field]));
  const raw = await extractFields(env, { text, wanted, labels });

  const out = {};
  for (const [field, value] of Object.entries(raw ?? {})) {
    const coerced = field === 'fullName' ? String(value).trim() : coerceField(field, value);
    if (coerced) out[field] = coerced;
  }
  return out;
}
