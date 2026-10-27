import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ConflictCheck } from '../../types';
import { db } from '../../data/database';
import { Alert } from '@/registry/naf/ui/alert';

interface ConflictWarningProps {
  name: string;
  idNumber?: string;
  /** أيُّ السؤالين: أخصمٌ هو في قضيةٍ عندنا؟ أم موكّلٌ عندنا؟ */
  ask: 'asOpponent' | 'asClient';
  excludeClient?: string;
  excludeCase?: string;
}

/* الفحصُ بعد سكونِ الكتابة لا مع كلّ حرف: اسمٌ من أربع كلمات أربعون نداءً. */
const QUIET_MS = 500;

/**
 * ═══ تنبيهُ تعارض المصالح ═══
 *
 * يُقال ولا يمنع: قد تكون القضيةُ منتهية، وقد يكون الاسمُ اسمَ غيره. ورقمُ
 * الهوية قاطع، والاسمُ يُقال «يُراجَع» — «محمد القحطاني» اسمُ عشرة.
 */
export default function ConflictWarning({ name, idNumber, ask, excludeClient, excludeCase }: ConflictWarningProps) {
  const [result, setResult] = useState<ConflictCheck | null>(null);

  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.split(/\s+/).length < 2 && (idNumber ?? '').replace(/\D/g, '').length < 7) {
      setResult(null);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      db.checkConflicts({ name: trimmed, idNumber, excludeClient, excludeCase })
        .then((data) => { if (alive) setResult(data); });
    }, QUIET_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [name, idNumber, excludeClient, excludeCase]);

  const matches = result?.[ask] ?? [];
  if (!matches.length) return null;

  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden="true" />
      <div className="space-y-1 text-sm">
        <p className="font-medium">
          {ask === 'asOpponent' ? 'تعارضُ مصالحٍ محتمل — هذا الاسمُ خصمٌ في:' : 'هذا الطرفُ موكّلٌ عندنا:'}
        </p>
        <ul className="space-y-0.5">
          {matches.slice(0, 5).map((match, index) => (
            <li key={`${match.caseId ?? match.clientId}-${index}`}>
              {ask === 'asOpponent' ? (
                <>القضية <bdi>{match.caseNumber}</bdi> لموكّلنا «{match.clientName}»</>
              ) : (
                <>«{match.clientName}»</>
              )}
              {' — '}
              {match.matchBy === 'idNumber' ? 'برقم الهوية' : 'بالاسم — يُراجَع'}
              {match.archived && ' · مؤرشف'}
            </li>
          ))}
        </ul>
      </div>
    </Alert>
  );
}
