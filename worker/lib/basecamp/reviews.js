// ما يستحقّ نظرَ إنسان — يُجمع ولا يوقف شيئاً.
//
// ═══ القاعدة التي يقوم عليها هذا الملفّ ═══
//
// **المزامنةُ لا تنتظر أحداً.** تكتب ما تكتب، وتفتح صفّاً لما يستحقّ
// نظراً، وتمضي. فمكتبٌ لا يفتح الشاشة شهراً تبقى استيراداتُه جارية،
// وتنتظره أسئلتُه مجموعةً حين يفتحها.
//
// وكانت هذه التنبيهاتُ نصّاً في ناتج المعاينة: يراه من شغّل معاينةً،
// ويتبخّر مع الدورة. فمن يعتمد على الجدولة لا يراه، ومن يريد أن يراه
// يُشغّل معاينةً في كل مرّة.
//
// ═══ والقرارُ يُحسم مرّةً ═══
//
// `UNIQUE (project_id, kind, fingerprint)` — الصفُّ يُفتح مرّةً لكل
// (مشروعٍ + نوعِ سؤالٍ + قيمةٍ سُئل عنها). ومتى حُسم بقي محسوماً، ولا
// تُعيد الدورةُ التالية فتحَه ولو بقي الحالُ كما هو.
//
// وذلك يجعل «راجعتُه» فعلاً ينتهي، لا سؤالاً يُعاد كلَّ ساعة.

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** أنواعُ الأسئلة، ووجهُها العربي في الشاشة. */
export const REVIEW_KINDS = {
  project_kind: 'تصنيفُ المشروع',
  case_type: 'نوعُ القضية',
  unresolved_value: 'لفظٌ لم يُفهم',
  similar_client: 'عميلٌ يشبه عميلاً',
  generated_number: 'رقمُ قضيةٍ مولَّد',
};

/**
 * يفتح صفّاً — أو لا يفعل شيئاً إن كان مفتوحاً أو محسوماً.
 *
 * `ON CONFLICT DO NOTHING` هو الحارس: المزامنةُ كلَّ ساعة تمرّ على الحال
 * نفسِه فتحاول فتحَه، ولولاها لامتلأ الجدولُ بأربعٍ وعشرين نسخةً في اليوم
 * — أو لعاد سؤالٌ حُسم بالأمس.
 */
export async function openReview(env, item) {
  await env.DB.prepare(
    `INSERT INTO basecamp_reviews
       (id, kind, project_id, case_id, client_id, subject, detail, fingerprint, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, kind, fingerprint) DO NOTHING`,
  )
    .bind(
      crypto.randomUUID(),
      item.kind,
      item.projectId,
      item.caseId ?? null,
      item.clientId ?? null,
      item.subject ?? '',
      JSON.stringify(item.detail ?? {}),
      item.fingerprint,
      nowSeconds(),
    )
    .run();
}

/** ما لم يُحسم بعد. */
export async function listOpen(env) {
  const { results } = await env.DB.prepare(
    `SELECT r.*, p.name AS project_name, p.app_url, p.kind AS project_current_kind,
            c.case_number, c.case_type, l.full_name AS client_name
     FROM basecamp_reviews r
     LEFT JOIN basecamp_projects p ON p.project_id = r.project_id
     LEFT JOIN cases   c ON c.id = r.case_id
     LEFT JOIN clients l ON l.id = r.client_id
     WHERE r.resolved_at IS NULL
     ORDER BY r.created_at DESC`,
  ).all();

  return (results ?? []).map((row) => {
    let detail = {};
    try { detail = JSON.parse(row.detail ?? '{}') ?? {}; } catch { detail = {}; }
    return {
      id: row.id,
      kind: row.kind,
      kindLabel: REVIEW_KINDS[row.kind] ?? row.kind,
      projectId: row.project_id,
      projectName: row.project_name ?? '',
      appUrl: row.app_url ?? '',
      projectKind: row.project_current_kind ?? null,
      caseId: row.case_id ?? null,
      caseNumber: row.case_number ?? null,
      caseType: row.case_type ?? null,
      clientId: row.client_id ?? null,
      clientName: row.client_name ?? null,
      subject: row.subject ?? '',
      detail,
      createdAt: row.created_at,
    };
  });
}

export async function countOpen(env) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM basecamp_reviews WHERE resolved_at IS NULL`,
  ).first();
  return row?.n ?? 0;
}

export async function closeReview(env, id, { resolution, userId }) {
  const result = await env.DB.prepare(
    `UPDATE basecamp_reviews SET resolved_at = ?, resolution = ?, decided_by = ?
     WHERE id = ? AND resolved_at IS NULL`,
  )
    .bind(nowSeconds(), resolution, userId, id)
    .run();
  return Boolean(result.meta?.changes);
}

/**
 * دمجُ عميلٍ في آخر — حين يقول صاحبُ المكتب «هما واحد».
 *
 * ═══ ولماذا أرشفةٌ لا حذف ═══
 *
 * تُنقل القضايا والمشاريع إلى الباقي، ويُملأ فارغُه ممّا في المدموج، ثمّ
 * **يُؤرشف المدموج ولا يُحذف**. فحذفُه يُشعل `ON DELETE CASCADE` على ما
 * بقي مشيراً إليه، وقرارُ دمجٍ خاطئ لا يُستدرَك بعده. والأرشفةُ تُخرجه من
 * القوائم وتُبقيه صفّاً يُرجَع.
 */
export async function mergeClients(env, { keepId, mergeId }) {
  if (!keepId || !mergeId || keepId === mergeId) return false;

  const keep = await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(keepId).first();
  const merge = await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`).bind(mergeId).first();
  if (!keep || !merge) return false;

  const now = nowSeconds();

  /* القضايا تنتقل باسم الباقي: `client_name` عمودٌ محفوظ لا مشتقّ. */
  await env.DB.prepare(
    `UPDATE cases SET client_id = ?, client_name = ?, updated_at = ? WHERE client_id = ?`,
  )
    .bind(keepId, keep.full_name, now, mergeId)
    .run();

  await env.DB.prepare(`UPDATE basecamp_projects SET client_id = ? WHERE client_id = ?`)
    .bind(keepId, mergeId)
    .run();

  /* ويُملأ فارغُ الباقي ممّا في المدموج — ولا يُدهس ما فيه قيمة. */
  const fill = {};
  for (const column of ['id_number', 'id_type', 'phone', 'email', 'commercial_register',
    'legal_representative', 'notes']) {
    if (!keep[column] && merge[column]) fill[column] = merge[column];
  }
  /* و«عميلٌ منذ» أقدمُ التاريخين. */
  if (merge.join_date && (!keep.join_date || merge.join_date < keep.join_date)) {
    fill.join_date = merge.join_date;
  }

  const numbers = (raw) => { try { return JSON.parse(raw ?? '[]') ?? []; } catch { return []; } };
  const have = new Set(numbers(keep.contacts).map((entry) => entry.number));
  const added = numbers(merge.contacts).filter((entry) => !have.has(entry.number));
  if (added.length) fill.contacts = JSON.stringify([...numbers(keep.contacts), ...added]);

  if (Object.keys(fill).length) {
    const columns = Object.keys(fill);
    await env.DB.prepare(
      `UPDATE clients SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    )
      .bind(...columns.map((c) => fill[c]), now, keepId)
      .run();
  }

  /* ورقمُ الهوية فريدٌ في المخطَّط: يُفرَّغ من المدموج قبل أرشفته، وإلا
     منع القيدُ نقلَه إلى الباقي في دمجٍ لاحق. */
  await env.DB.prepare(
    `UPDATE clients SET id_number = NULL, archived_at = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(now, now, mergeId)
    .run();

  return true;
}
