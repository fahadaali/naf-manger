import { Plus, X } from 'lucide-react';
import { OpposingParty } from '../../types';
import ConflictWarning from '../Common/ConflictWarning';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';

interface OpposingPartiesProps {
  value: OpposingParty[];
  onChange: (next: OpposingParty[]) => void;
  /** موكّلُ القضية نفسُها — لا يُنبَّه عليه. */
  clientId?: string;
}

/**
 * ═══ الأطرافُ الخصم ═══
 *
 * طرفٌ أو أكثر، ولكلٍّ اسمُه ورقمُ هويته أو سجلّه إن عُرف — وبالرقم يُقطع
 * التعارض. وكلُّ طرفٍ يُفحص: أموكّلٌ هو عندنا؟
 */
export default function OpposingParties({ value, onChange, clientId }: OpposingPartiesProps) {
  const update = (index: number, patch: Partial<OpposingParty>) =>
    onChange(value.map((party, at) => (at === index ? { ...party, ...patch } : party)));

  return (
    <div className="space-y-3">
      {value.map((party, index) => (
        <div key={index} className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="text"
              value={party.name}
              onChange={(e) => update(index, { name: e.target.value })}
              placeholder="اسم الطرف"
              aria-label="اسم الطرف الخصم"
            />
            <Input
              type="text"
              inputMode="numeric"
              value={party.idNumber ?? ''}
              onChange={(e) => update(index, { idNumber: e.target.value })}
              placeholder="الهوية أو السجل (اختياري)"
              aria-label="رقم هوية الطرف الخصم أو سجله"
              className="max-w-52"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(value.filter((_, at) => at !== index))}
              aria-label="حذف الطرف"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <ConflictWarning name={party.name} idNumber={party.idNumber} ask="asClient" excludeClient={clientId} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, { name: '' }])}>
        <Plus aria-hidden="true" />
        إضافة طرف
      </Button>
    </div>
  );
}
