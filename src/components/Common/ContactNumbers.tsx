import { Phone, Plus, Trash2 } from 'lucide-react';

import { ContactNumber } from '../../types';
import { useSettingList } from '../../lib/use-settings';
import { Button } from '@/registry/naf/ui/button';
import { Input } from '@/registry/naf/ui/input';
import { Select } from '@/registry/naf/ui/select';

/* ═══ أرقامُ ملفّ العميل ═══
 *
 * عمودٌ واحد للجوّال كان يُسقط ما في ملفّات المكتب فعلاً: جوّالُ الموكّل
 * وجوّالُ وكيله وجوّالُ أبيه. فيُكتب أوّلُها ويُترك الباقي — ثم يُحتاج
 * إليه فلا يوجد.
 *
 * والصفةُ لازمةٌ مع الرقم لا زينة: رقمٌ بلا صفةٍ في ملفّ موكّل يُتصل به
 * ولا يُعرف من يردّ. ومفرداتُها من «تكوين النظام» — يزيد المكتب فيها
 * «شريك» أو «محاسب» بلا نشرِ شيفرة.
 */
export default function ContactNumbers({
  value,
  onChange,
}: {
  value: ContactNumber[];
  onChange: (next: ContactNumber[]) => void;
}) {
  const relations = useSettingList('contactRelations');
  const fallback = relations[0] ?? 'أصيل';

  /* ═══ الخيارات تُحسب مرّةً لا داخل الحلقة ═══
     الخطّافات لا تُنادى في تكرار — عددُها يجب أن يثبت بين تصييرين.
     والاتّحاد يضمّ ما في الإعدادات وما هو محفوظ في الصفوف: صفةٌ رُفعت من
     القائمة بعد حفظها تبقى معروضةً، وإلا بدا الحقل فارغاً وحُفظ غيرُ ما كان. */
  const options = [...new Set([...relations, ...value.map((entry) => entry.relation)])].filter(Boolean);

  const update = (index: number, patch: Partial<ContactNumber>) => {
    onChange(value.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-foreground">أرقام أخرى</label>
        <Button
          type="button"
          onClick={() => onChange([...value, { number: '', relation: fallback }])}
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          أضف رقماً
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          لا أرقام إضافية. أضف رقمَ وكيلٍ أو قريبٍ ليُعرف لمن الرقم حين يُتصل به.
        </p>
      ) : (
        value.map((entry, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground flex-none" aria-hidden="true" />
            <Input
              type="tel"
              inputMode="tel"
              value={entry.number}
              onChange={(event) => update(index, { number: event.target.value })}
              placeholder="05xxxxxxxx"
              className="flex-1 min-w-36"
              dir="ltr"
            />
            <Select
              value={entry.relation || fallback}
              onChange={(event) => update(index, { relation: event.target.value })}
              className="flex-1 min-w-32"
            >
              {options.map((relation) => (
                <option key={relation} value={relation}>{relation}</option>
              ))}
            </Select>
            <Input
              value={entry.name ?? ''}
              onChange={(event) => update(index, { name: event.target.value })}
              placeholder="الاسم (اختياري)"
              className="flex-1 min-w-32"
            />
            <Button
              type="button"
              onClick={() => onChange(value.filter((_, at) => at !== index))}
              variant="outline"
              size="sm"
              aria-label="احذف الرقم"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
