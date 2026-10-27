// فحصُ تعارض المصالح — قبل أن يُقبل موكّلٌ أو يُسمّى خصم.
//
// ═══ السؤالان ═══
//
//   `asOpponent` — أهذا الاسمُ خصمٌ في قضيةٍ لموكّلٍ عندنا؟ يُسأل عند إضافة
//                  عميلٍ أو عميلٍ محتمل.
//   `asClient`   — أهذا الاسمُ موكّلٌ عندنا؟ يُسأل عند تسمية خصمٍ في قضية.
//
// ═══ والجوابُ تنبيهٌ لا منع ═══
//
// التعارضُ قرارٌ مهنيّ: قد تكون القضيةُ القديمة منتهية، وقد يكون الاسمُ
// اسمَ غيره. فيُقال «هذا الاسمُ خصمٌ في القضية كذا» ويُترك الحكمُ لمن
// يقرأ — والإنشاءُ لا يُمنع.
//
// **ورقمُ الهوية قاطع، والاسمُ يُراجَع.** «محمد القحطاني» اسمُ عشرة، فمطابقةُ
// الاسم تُقال بصفتها (`matchBy: 'name'`) ولا تُقرأ حكماً. والمقارنةُ موحَّدةٌ
// كما في هوية الموكّل (`basecamp/names.js`): «عبد الله» و«عبدالله» واحد،
// والاسمُ المختصر من الأتمّ — والأخُ ليس أخاه.

import { normalizeArabic } from './basecamp/discover.js';
import { nameRelation } from './basecamp/names.js';
import { toLatinDigits } from './digits.js';

const fail = (error, status) => Response.json({ ok: false, error }, { status });

const digitsOf = (value) => toLatinDigits(String(value ?? '')).replace(/\D/g, '');

const safeList = (raw) => {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** أهما واحد؟ بالهوية قطعاً، أو بالاسم ترجيحاً — أو لا. */
function relate({ name, idNumber }, other) {
  const mine = digitsOf(idNumber);
  const theirs = digitsOf(other.idNumber);
  if (mine.length >= 7 && mine === theirs) return 'idNumber';
  if (!name || !other.name) return null;
  if (normalizeArabic(name) === normalizeArabic(other.name)) return 'name';
  return nameRelation(name, other.name) === 'different' ? null : 'name';
}

/**
 * يفحص اسماً ورقماً في الجهتين.
 *
 * والمؤرشفُ داخلٌ في الفحص بخلاف الإحصاء: قضيةٌ أُخرجت من شاشتها لم تُمحَ
 * من ذمّة المكتب، والتعارضُ معها تعارض. ويُعلَّم `archived` ليُقرأ بقدره.
 */
export async function checkConflicts(env, { name = '', idNumber = '', excludeClientId = null, excludeCaseId = null }) {
  const subject = { name: String(name).trim(), idNumber: String(idNumber).trim() };
  if (!subject.name && digitsOf(subject.idNumber).length < 7) return { asOpponent: [], asClient: [] };

  const [{ results: cases }, { results: clients }] = await Promise.all([
    env.DB.prepare(
      `SELECT id, case_number, client_id, client_name, opposing_parties, archived_at
         FROM cases WHERE opposing_parties IS NOT NULL AND opposing_parties <> '[]'`,
    ).all(),
    env.DB.prepare(`SELECT id, full_name, id_number, commercial_register, archived_at FROM clients`).all(),
  ]);

  const asOpponent = [];
  for (const row of cases ?? []) {
    if (row.client_id === excludeClientId || row.id === excludeCaseId) continue;
    for (const party of safeList(row.opposing_parties)) {
      const matchBy = relate(subject, { name: party?.name, idNumber: party?.idNumber });
      if (!matchBy) continue;
      asOpponent.push({
        caseId: row.id,
        caseNumber: row.case_number,
        clientId: row.client_id,
        clientName: row.client_name,
        party: party.name,
        matchBy,
        archived: Boolean(row.archived_at),
      });
      break;
    }
  }

  const asClient = [];
  for (const row of clients ?? []) {
    if (row.id === excludeClientId) continue;
    const matchBy = relate(subject, { name: row.full_name, idNumber: row.id_number })
      ?? relate(subject, { name: '', idNumber: row.commercial_register });
    if (!matchBy) continue;
    asClient.push({ clientId: row.id, clientName: row.full_name, matchBy, archived: Boolean(row.archived_at) });
  }

  /* الهويةُ أوّلاً: هي القاطعة، والاسمُ بعدها. */
  const rank = (entry) => (entry.matchBy === 'idNumber' ? 0 : 1);
  asOpponent.sort((one, other) => rank(one) - rank(other));
  asClient.sort((one, other) => rank(one) - rank(other));
  return { asOpponent, asClient };
}

/**
 * `GET /api/conflicts?name=&idNumber=&excludeClient=&excludeCase=`
 *
 * ويُحرس بقراءة القضايا أو العملاء: الجوابُ أرقامُ قضايا وأسماءُ موكّلين،
 * ومن لا يقرأ أيّاً منهما لا يقرؤها من هنا.
 */
export async function readConflicts(env, user, url) {
  const allowed = user.permissions?.cases?.read || user.permissions?.clients?.read || user.permissions?.prospects?.read;
  if (!allowed) return fail('forbidden', 403);

  const params = url.searchParams;
  const result = await checkConflicts(env, {
    name: params.get('name') ?? '',
    idNumber: params.get('idNumber') ?? '',
    excludeClientId: params.get('excludeClient') || null,
    excludeCaseId: params.get('excludeCase') || null,
  });
  return Response.json({ ok: true, data: result });
}
