import { useEffect, useState } from 'react';
import { Pencil, Plus, Scale, Trash2, TriangleAlert } from 'lucide-react';

import { db } from '../../data/database';
import { ApiError } from '../../data/api';
import { Lawyer, MemberEntry } from '../../types';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { Badge } from '@/registry/naf/ui/badge';
import { Input } from '@/registry/naf/ui/input';
import { Select } from '@/registry/naf/ui/select';
import { formatNumber } from '@/registry/naf/lib/format';

/* ═══ المحامون ═══
 *
 * المحامي المسؤول وفريقُه يُختارون من هذه القائمة — لا من حسابات المنصة: من
 * المحامين من لا يدخلها. ولكلٍّ حسابٌ اختياريّ، وبه تعمل «قضاياي» لصاحبه.
 * ومن عليه قضايا يُوقف ولا يُحذف: قضاياه تحمل معرّفَه.
 */

type Draft = Partial<Lawyer> & { name: string };

const EMPTY: Draft = { name: '', title: '', email: '', phone: '', memberId: null, isActive: true };

const ERRORS: Record<string, string> = {
  missing_field: 'الاسم مطلوب',
  member_taken: 'هذا الحساب مربوطٌ بمحامٍ آخر',
  invalid_reference: 'الحساب غير موجود',
  forbidden: 'لا تملك صلاحية تعديل الإعدادات',
};

export default function LawyersSettings() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => setLawyers(await db.getLawyers());

  useEffect(() => {
    load();
    db.getDirectory().then(setMembers).catch(() => setMembers([]));
  }, []);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      await db.saveLawyer(draft);
      setDraft(null);
      await load();
    } catch (cause) {
      setError((cause instanceof ApiError && ERRORS[cause.code]) || 'تعذّر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (lawyer: Lawyer) => {
    setBusy(true);
    setError('');
    try {
      await db.deleteLawyer(lawyer.id);
      await load();
    } catch {
      setError('تعذّر الحذف');
    } finally {
      setBusy(false);
    }
  };

  /* حسابٌ واحدٌ لمحامٍ واحد: المربوطُ بغيره لا يُعرض في القائمة. */
  const taken = new Set(lawyers.filter((lawyer) => lawyer.id !== draft?.id).map((lawyer) => lawyer.memberId).filter(Boolean));
  const field = (key: keyof Draft, value: string) => setDraft((current) => (current ? { ...current, [key]: value } : current));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-5 w-5" aria-hidden="true" />
            المحامون
          </h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            منهم يُختار المحامي المسؤول وفريقُه في كل قضية، ولو لم يكن له دخولٌ على المنصة. واربط من له حسابٌ بحسابه
            لتعمل له «قضاياي».
          </p>
        </div>
        <Button onClick={() => setDraft({ ...EMPTY })} disabled={busy}>
          <Plus aria-hidden="true" />
          إضافة محامٍ
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <span>{error}</span>
        </Alert>
      )}

      {draft && (
        <Card className="p-4 space-y-4">
          <h4 className="font-semibold text-foreground">{draft.id ? 'تعديل المحامي' : 'محامٍ جديد'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1 text-sm">
              <span className="text-foreground">الاسم *</span>
              <Input value={draft.name} onChange={(event) => field('name', event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-foreground">الصفة</span>
              <Input value={draft.title ?? ''} onChange={(event) => field('title', event.target.value)} placeholder="محامٍ، مستشار، متدرّب…" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-foreground">البريد</span>
              <Input type="email" dir="ltr" value={draft.email ?? ''} onChange={(event) => field('email', event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-foreground">الجوال</span>
              <Input dir="ltr" value={draft.phone ?? ''} onChange={(event) => field('phone', event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-foreground">حسابُه في المنصة</span>
              <Select
                value={draft.memberId ?? ''}
                onChange={(event) => setDraft({ ...draft, memberId: event.target.value || null })}
              >
                <option value="">بلا حساب</option>
                {members.filter((member) => !taken.has(member.id)).map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm self-end">
              <input
                type="checkbox"
                checked={draft.isActive !== false}
                onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
              />
              <span className="text-foreground">مفعَّل — يظهر في اختيار المحامي</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy || !draft.name.trim()}>حفظ</Button>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy}>إلغاء</Button>
          </div>
        </Card>
      )}

      {lawyers.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا محامين بعد.</p>
      ) : (
        <ul className="divide-y divide-border rounded border bg-card">
          {lawyers.map((lawyer) => (
            <li key={lawyer.id} className={`flex flex-wrap items-center justify-between gap-3 p-3 ${lawyer.isActive ? '' : 'opacity-60'}`}>
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {lawyer.name}
                  {lawyer.title && <span className="text-sm text-muted-foreground"> · {lawyer.title}</span>}
                </p>
                <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                  <span>{formatNumber(lawyer.openCases)} قضيةً جارية</span>
                  {lawyer.memberId
                    ? <Badge variant="outline">له حساب: {members.find((member) => member.id === lawyer.memberId)?.name ?? '—'}</Badge>
                    : <Badge variant="outline">بلا حساب</Badge>}
                  {!lawyer.isActive && <Badge variant="outline">موقوف</Badge>}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setDraft({ ...lawyer })} disabled={busy} aria-label={`تعديل ${lawyer.name}`}>
                  <Pencil aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(lawyer)} disabled={busy} aria-label={`حذف ${lawyer.name}`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">ومن عليه قضايا لا يُحذف — يُوقف فيختفي من الاختيار وتبقى قضاياه باسمه.</p>
    </div>
  );
}
