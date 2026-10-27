// «إعادة الاستيراد من الصفر» — يحذف القضايا التي أنشأها ربطُ بيسكامب ليُعاد
// استيرادُها برقم مشروعها.
//
// ═══ لماذا ═══
//
// كانت القضايا تُستورد برقم «رقم القضية» في «بيانات المشروع» — وهو رقمُها لدى
// الجهة المختصة، لا رقمُ المشروع. فصارت الأرقامُ مكرّرةً ومولَّدةً وتعارضاتٍ
// على ما ليس مفتاحاً. وقرارُ المكتب: تُحذف المستوردةُ وتُعاد برقم مشروعها
// (معرّفِه في بيسكامب).
//
// ═══ ما يُحذف وما يبقى ═══
//
// يُحذف: القضايا التي يربطها `basecamp_projects.case_id` وحدها، ومعها دفعاتُها
// وعمولاتُها (`ON DELETE CASCADE` — وتُحذف صراحةً هنا فلا يُتّكل على تفعيل
// القيود)، والاختلافاتُ وأسئلةُ المراجعة القديمة.
//
// ويبقى: **العملاء** (تعيد المزامنةُ ربطهم بالهوية والاسم)، وتصنيفُ المشاريع
// (عميل/داخلي وقرارُ من صنّف)، والمعجمُ المتعلَّم، ودفعاتُ وافق — ترجع «بلا
// قضية» وتُطابَق ثانيةً. وملفّاتُ المرفقات في R2 لا تُمسّ.
//
// ═══ والحذفُ بيد ═══
//
// `dryRun` يعدّ ولا يكتب. والتنفيذُ يشترط عبارةَ التأكيد حرفاً — والشاشةُ
// تشترط قبلها تنزيلَ نسخةٍ احتياطية. ولا يقع شيءٌ من هذا بالنشر.

const fail = (error, status) => Response.json({ ok: false, error }, { status });

export const RESET_PHRASE = 'أعد الاستيراد';

/* القضايا المستوردة: ما ربطه مشروعٌ بقضية. وجملةٌ ثابتةٌ من هذا الملفّ. */
const LINKED = `SELECT case_id FROM basecamp_projects WHERE case_id IS NOT NULL`;

async function countImpact(env) {
  const [cases, payments, commissions, wafeq, projects, conflicts, reviews] = await env.DB.batch([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN lawyer_id IS NOT NULL AND lawyer_id <> '' THEN 1 ELSE 0 END) AS with_lawyer,
              SUM(CASE WHEN fee_structure IS NOT NULL AND fee_structure <> '' THEN 1 ELSE 0 END) AS with_fees,
              SUM(CASE WHEN attachments IS NOT NULL AND attachments NOT IN ('', '[]') THEN 1 ELSE 0 END) AS with_attachments,
              SUM(CASE WHEN marketer_id IS NOT NULL AND marketer_id <> '' THEN 1 ELSE 0 END) AS with_marketer
         FROM cases WHERE id IN (${LINKED})`,
    ),
    env.DB.prepare(
      `SELECT COALESCE(source, 'manual') AS source, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount
         FROM client_payments WHERE case_id IN (${LINKED}) GROUP BY COALESCE(source, 'manual')`,
    ),
    env.DB.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM commission_payments WHERE case_id IN (${LINKED})`,
    ),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM wafeq_payments
        WHERE case_id IN (${LINKED}) OR suggested_case_id IN (${LINKED})`,
    ),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM basecamp_projects WHERE case_id IS NOT NULL OR client_id IS NOT NULL`),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM basecamp_conflicts`),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM basecamp_reviews WHERE kind <> 'project_kind'`),
  ]);

  const row = cases.results?.[0] ?? {};
  const bySource = Object.fromEntries((payments.results ?? []).map((entry) => [
    entry.source, { count: entry.n, amount: Number(entry.amount ?? 0) / 100 },
  ]));
  return {
    cases: row.total ?? 0,
    withLawyer: row.with_lawyer ?? 0,
    withFees: row.with_fees ?? 0,
    withAttachments: row.with_attachments ?? 0,
    withMarketer: row.with_marketer ?? 0,
    payments: bySource,
    commissions: {
      count: commissions.results?.[0]?.n ?? 0,
      amount: Number(commissions.results?.[0]?.amount ?? 0) / 100,
    },
    wafeqReturned: wafeq.results?.[0]?.n ?? 0,
    projects: projects.results?.[0]?.n ?? 0,
    conflicts: conflicts.results?.[0]?.n ?? 0,
    reviews: reviews.results?.[0]?.n ?? 0,
  };
}

/**
 * `POST /api/basecamp/reset { dryRun, confirm }` — للمسؤول وحده.
 */
export async function resetBasecampImport(request, env, user) {
  if (user.role !== 'admin') return fail('forbidden', 403);

  let body = {};
  try { body = (await request.json()) ?? {}; } catch { body = {}; }
  const impact = await countImpact(env);

  if (body.dryRun !== false) return Response.json({ ok: true, data: { dryRun: true, impact } });
  if (String(body.confirm ?? '').trim() !== RESET_PHRASE) return fail('confirmation_required', 400);

  const now = Math.floor(Date.now() / 1000);
  /* دفعةٌ واحدة: إمّا يقع كلُّه أو لا شيء. والترتيبُ له معنى — ما يقرأ
     `LINKED` قبل تصفير الربط الذي يقرؤه. */
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE wafeq_payments
          SET status = 'unmatched', case_id = NULL, suggested_case_id = NULL, payment_id = NULL,
              match_by = NULL, ai_fingerprint = NULL, decided_by = NULL,
              reason = 'أُعيد استيرادُ القضايا — تنتظر المطابقة', updated_at = ?
        WHERE case_id IN (${LINKED}) OR suggested_case_id IN (${LINKED})`,
    ).bind(now),
    /* وربطُ مشاريع وافق بهذه القضايا يزول معها — يُعاد بعد الاستيراد بالاسم أو بالتأكيد. */
    env.DB.prepare(`DELETE FROM wafeq_project_links WHERE case_id IN (${LINKED})`),
    env.DB.prepare(`DELETE FROM client_payments WHERE case_id IN (${LINKED})`),
    env.DB.prepare(`DELETE FROM commission_payments WHERE case_id IN (${LINKED})`),
    env.DB.prepare(`DELETE FROM cases WHERE id IN (${LINKED})`),
    env.DB.prepare(
      `UPDATE basecamp_projects
          SET case_id = NULL, client_id = NULL, synced_values = NULL, last_synced_at = NULL,
              last_error = NULL, updated_at = ?`,
    ).bind(now),
    env.DB.prepare(`DELETE FROM basecamp_conflicts`),
    env.DB.prepare(`DELETE FROM basecamp_reviews WHERE kind <> 'project_kind'`),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, type, description, user_id, user_name, entity_type, details, created_at)
       VALUES (?, 'basecamp', ?, ?, ?, 'basecamp', ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      `إعادةُ استيراد بيسكامب من الصفر: حُذفت ${impact.cases} قضيةً مستوردة، ورجعت ${impact.wafeqReturned} دفعةً من وافق بلا قضية`,
      user.id,
      user.name ?? '',
      JSON.stringify(impact),
      now,
    ),
  ]);

  return Response.json({ ok: true, data: { dryRun: false, impact } });
}
