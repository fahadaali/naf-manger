import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { CustomReport, MemberEntry } from '../../types';
import { db } from '../../data/database';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';

type Schedule = NonNullable<CustomReport['schedule']>;

const FREQUENCY: Record<Schedule['frequency'], string> = {
  daily: 'يومياً — الثامنة صباحاً',
  weekly: 'أسبوعياً — صباحَ الأحد',
  monthly: 'شهرياً — أوّلَ الشهر',
};

/**
 * ═══ الإرسالُ الدوريّ ═══
 *
 * يُرسل التقريرُ بالبريد في موعده: أوّلُ خمسين صفاً في الرسالة، وكلُّه CSV
 * مرفقاً. والمستلمُ عضوٌ يملك قراءةَ التقارير — والبريدُ الخارجيّ للمسؤول وحده.
 */
export default function ReportSchedule({
  value,
  onChange,
  isAdmin,
}: {
  value: Schedule;
  onChange: (next: Schedule) => void;
  isAdmin: boolean;
}) {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [external, setExternal] = useState('');

  useEffect(() => {
    db.getDirectory().then(setMembers);
  }, []);

  const toggle = (id: string) =>
    onChange({
      ...value,
      recipients: value.recipients.includes(id)
        ? value.recipients.filter((entry) => entry !== id)
        : [...value.recipients, id],
    });

  const addExternal = () => {
    const email = external.trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || value.recipients.includes(email)) return;
    onChange({ ...value, recipients: [...value.recipients, email] });
    setExternal('');
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="rounded border-border text-primary focus-visible:ring-ring"
        />
        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm text-foreground">إرسالُه دورياً بالبريد</span>
      </label>

      {value.enabled && (
        <>
          <Select
            value={value.frequency}
            onChange={(e) => onChange({ ...value, frequency: e.target.value as Schedule['frequency'] })}
            aria-label="التكرار"
            className="max-w-xs"
          >
            {Object.entries(FREQUENCY).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>

          <div>
            <p className="text-sm font-medium text-foreground mb-2">المستلمون</p>
            <div className="flex flex-wrap gap-2">
              {members.map((member) => {
                const on = value.recipients.includes(member.id);
                return (
                  <Button
                    key={member.id}
                    type="button"
                    size="sm"
                    variant={on ? 'default' : 'outline'}
                    aria-pressed={on}
                    onClick={() => toggle(member.id)}
                  >
                    {member.name || member.id}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              من لا يملك قراءة التقارير، أو لا يرى هذا التقرير، لا يتلقّاه.
            </p>
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="email"
                  dir="ltr"
                  value={external}
                  onChange={(e) => setExternal(e.target.value)}
                  placeholder="بريد خارجي (للمسؤول وحده)"
                  className="max-w-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addExternal}>إضافة</Button>
              </div>
              {value.recipients.filter((entry) => entry.includes('@')).map((email) => (
                <p key={email} className="text-sm text-foreground flex items-center gap-2">
                  <bdi dir="ltr">{email}</bdi>
                  <Button type="button" variant="ghost" size="sm" onClick={() => toggle(email)}>حذف</Button>
                </p>
              ))}
            </div>
          )}

          {value.lastSentAt && (
            <p className="text-xs text-muted-foreground">آخرُ إرسال: <bdi>{new Date(value.lastSentAt).toLocaleString('ar-SA-u-nu-latn')}</bdi></p>
          )}
        </>
      )}
    </div>
  );
}
