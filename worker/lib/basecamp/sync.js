// محرّكُ المزامنة — يخطّط ثم ينفّذ، والمعاينةُ هي التخطيطُ بلا تنفيذ.
//
// ═══ لماذا خطّةٌ منفصلة عن تنفيذها ═══
//
// «ما الذي سيقع؟» و«أَوقِعْه» سؤالان على المعطيات نفسها. ولو كُتبا مرّتين
// لافترقا: تُعرض معاينةٌ ثم يقع غيرُها. فالخطّة تُبنى مرّةً، وتُعرض كما
// هي، ثم تُنفَّذ كما عُرضت.
//
// ═══ والدمجُ ثلاثيّ ═══
//
// لكل حقلٍ ثلاثُ قيم: ما في المنصة الآن، وما كتبته المزامنة آخرَ مرّة
// (`synced_values`)، وما في بيسكامب الآن. ومنها يُعرف من تحرّك:
//
//   المنصة كما تركناها + بيسكامب تبدّل  →  يُكتب بلا إزعاج
//   المنصة تبدّلت (يدٌ مسّته) + بيسكامب كما هو  →  يُترك، المنصة أحدث
//   تبدّل الطرفان  →  تعارضٌ يُسجَّل بالقيمتين، ولا يُكتب
//
// وهذا ما اختاره صاحبُ المكتب صراحةً على «بيسكامب يفوز دائماً»: تصحيحٌ
// يُمحى صامتاً في بيانات موكّلين أسوأُ من تعارضٍ ينتظر قراراً.

import { BasecampError } from './api.js';
import { readSummaryDocument } from './discover.js';
import { DEFAULT_FIELD_MAP, parseSummary } from './parse.js';
import { normalizeArabic } from './discover.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

const FIELD_MAP_KEY = 'basecamp_field_map';

/** الحقول التي تملكها المزامنة. وما عداها للمنصة وحدها. */
export const CLIENT_FIELDS = ['fullName', 'idNumber', 'phone', 'email', 'clientType', 'commercialRegister'];
export const CASE_FIELDS = ['caseNumber', 'caseType', 'summary', 'status', 'outcome'];

/* الأتعاب والعمولات والمسوّق لا تُمسّ: ليست في «ملخص القضية»، وتُدار في
   المنصة وحدها. وذكرُها هنا صراحةً أوضحُ من أن تُعرف بغيابها. */

export async function readFieldMap(env) {
  const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = ?`)
    .bind(FIELD_MAP_KEY)
    .first();
  if (!row?.value) return { ...DEFAULT_FIELD_MAP };
  try {
    const stored = JSON.parse(row.value);
    return stored && typeof stored === 'object' && Object.keys(stored).length
      ? stored
      : { ...DEFAULT_FIELD_MAP };
  } catch {
    return { ...DEFAULT_FIELD_MAP };
  }
}

export async function writeFieldMap(env, map, userId) {
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                    updated_by = excluded.updated_by,
                                    updated_at = excluded.updated_at`,
  )
    .bind(FIELD_MAP_KEY, JSON.stringify(map), userId, nowSeconds())
    .run();
}

const safeJson = (text) => {
  try { return JSON.parse(text ?? 'null'); } catch { return null; }
};

/**
 * رقمٌ بديلٌ ثابتٌ حين لا يحمله الملفّ.
 *
 * والثباتُ شرط: مزامنةٌ ثانية يجب أن تجد الصفَّ نفسه لا أن تُنشئ ثانياً.
 * فيُشتقّ من معرّف المشروع في بيسكامب — وهو لا يتبدّل.
 *
 * ويُعلَّم في المعاينة صراحةً: رقمُ هويةٍ مولَّدٌ ليس رقمَ هوية، وصاحبُ
 * المكتب يصحّحه بعد النقل. وإسقاطُ القضية بدله يُضيع ما جيء لأجله.
 */
const fallbackNumber = (prefix, projectId) => `${prefix}-${projectId}`;

/**
 * يبحث عن عميلٍ مطابق — بالهوية أوّلاً ثم بالاسم الموحَّد.
 *
 * والاسمُ ثانياً لا أوّلاً: الهويةُ فريدةٌ في المخطَّط، والاسمُ يتشابه.
 * لكنّ ملفّاً بلا رقمِ هوية لا يعني عميلاً جديداً — وهو ما يفعله إنسانٌ
 * حين يقرأ اسماً يعرفه.
 */
async function findClient(env, { idNumber, fullName }) {
  if (idNumber) {
    const byId = await env.DB.prepare(`SELECT * FROM clients WHERE id_number = ?`)
      .bind(idNumber)
      .first();
    if (byId) return { row: byId, matchedBy: 'idNumber' };
  }

  const { results } = await env.DB.prepare(`SELECT * FROM clients`).all();
  const target = normalizeArabic(fullName ?? '');
  if (!target) return null;

  const byName = (results ?? []).find((client) => normalizeArabic(client.full_name) === target);
  return byName ? { row: byName, matchedBy: 'fullName' } : null;
}

/** خطّةُ مشروعٍ واحد: ماذا سيقع له ولماذا. */
async function planProject(env, connection, row, fieldMap, seen) {
  const plan = {
    projectId: row.project_id,
    projectName: row.name,
    appUrl: row.app_url,
    actions: [],       // create_client | link_client | create_case | update_case | none
    warnings: [],
    conflicts: [],
    error: null,
    client: null,
    case: null,
  };

  if (!row.doc_id) {
    plan.error = 'no_summary';
    return plan;
  }

  let document;
  try {
    document = await readSummaryDocument(connection, row.project_id, row.doc_id);
  } catch (readError) {
    plan.error = readError instanceof BasecampError ? readError.code : 'read_failed';
    return plan;
  }

  const parsed = parseSummary(document.content, fieldMap);
  plan.unmapped = parsed.unmapped;

  if (!parsed.client.fullName) {
    plan.error = 'no_client_name';
    return plan;
  }

  // ── العميل ──
  const wanted = { ...parsed.client };
  if (!wanted.idNumber) {
    wanted.idNumber = fallbackNumber('BC', row.project_id);
    plan.warnings.push('رقم الهوية مولَّد — يحتاج تصحيحاً');
  }

  /* ═══ ما ستُنشئه خطّةٌ سابقة موجودٌ في حكم هذه ═══

     الخطط تُبنى كلُّها على حالةِ القاعدة قبل أي كتابة. فمشروعان لعميلٍ
     واحد يخطّطان «أنشئ عميلاً» كلاهما — ثم يسقط الثاني بقيد التفرّد على
     رقم الهوية. وتقول المعاينةُ «عميلان جديدان» ويقع عميلٌ واحد وخطأ.

     فما تنوي خطّةٌ سابقة إنشاءه يُحسب موجوداً: يصير الثاني «ربطاً»،
     فتصدق المعاينةُ ويصحّ التنفيذ. وهي حالةُ «قضاياه المتعددة» نفسها. */
  const match = await findClient(env, wanted);
  const pendingKey = normalizeArabic(wanted.fullName);
  const pending = !match && seen.clients.has(pendingKey);

  if (match?.matchedBy === 'fullName') plan.warnings.push('طوبق العميل بالاسم لا بالهوية');
  if (pending) plan.warnings.push('يُربط بعميلٍ يُنشئه مشروعٌ آخر في هذه الدفعة');

  plan.client = {
    id: match?.row?.id ?? null,
    values: wanted,
    action: match || pending ? 'link_client' : 'create_client',
  };
  plan.actions.push(plan.client.action);
  seen.clients.add(pendingKey);
  if (wanted.idNumber) seen.clients.add(`#${wanted.idNumber}`);

  // ── القضية ──
  const caseValues = { ...parsed.case };
  if (!caseValues.caseNumber) {
    caseValues.caseNumber = fallbackNumber('بيسكامب', row.project_id);
    plan.warnings.push('رقم القضية مولَّد — يحتاج تصحيحاً');
  }
  if (!caseValues.caseType) caseValues.caseType = 'غير محدّد';

  /* القضيةُ تُطابَق برقمها، ثم بالمشروع المربوط سابقاً — فتغييرُ رقمِ
     القضية في الملفّ يُحدِّث القضيةَ نفسَها ولا يُنشئ ثانية. */
  if (seen.cases.has(caseValues.caseNumber)) {
    /* مشروعان يحملان رقم القضية نفسَه: أحدهما سيدهس الآخر أو يسقط بقيد
       التفرّد. وهو تضاربٌ في ملفّاتهم لا في شيفرتنا — فيُسمّى ويُترك
       لصاحبه، ولا يُحسم بالتخمين. */
    plan.error = 'duplicate_case_number';
    return plan;
  }
  seen.cases.add(caseValues.caseNumber);

  let existingCase = await env.DB.prepare(`SELECT * FROM cases WHERE case_number = ?`)
    .bind(caseValues.caseNumber)
    .first();

  if (!existingCase && row.case_id) {
    existingCase = await env.DB.prepare(`SELECT * FROM cases WHERE id = ?`).bind(row.case_id).first();
    if (existingCase) plan.warnings.push('تبدّل رقم القضية في الملفّ');
  }

  const synced = safeJson(row.synced_values) ?? {};

  if (!existingCase) {
    plan.case = { id: null, values: caseValues, action: 'create_case', changes: caseValues };
    plan.actions.push('create_case');
    return plan;
  }

  /* ═══ الدمجُ الثلاثي ═══ */
  const changes = {};
  const COLUMN = {
    caseNumber: 'case_number', caseType: 'case_type', summary: 'summary',
    status: 'status', outcome: 'outcome',
  };

  for (const field of CASE_FIELDS) {
    const incoming = caseValues[field];
    if (incoming === undefined) continue;

    const current = existingCase[COLUMN[field]] ?? '';
    const lastSynced = synced[field];

    if (String(current) === String(incoming)) continue;   // لا فرق

    const platformTouched = lastSynced !== undefined && String(current) !== String(lastSynced);
    const basecampChanged = lastSynced === undefined || String(incoming) !== String(lastSynced);

    if (!basecampChanged) continue;                        // بيسكامب كما هو

    if (platformTouched) {
      plan.conflicts.push({ field, platformValue: String(current), basecampValue: String(incoming) });
      continue;
    }
    changes[field] = incoming;
  }

  plan.case = {
    id: existingCase.id,
    values: caseValues,
    action: Object.keys(changes).length ? 'update_case' : 'none',
    changes,
  };
  plan.actions.push(plan.case.action);
  return plan;
}

/** خطّةٌ لكل مشروعٍ مصنَّف «عميل». */
export async function buildPlan(env, connection) {
  const fieldMap = await readFieldMap(env);
  const { results } = await env.DB.prepare(
    `SELECT * FROM basecamp_projects WHERE kind = 'client' ORDER BY name`,
  ).all();

  const seen = { clients: new Set(), cases: new Set() };
  const plans = [];
  for (const row of results ?? []) {
    plans.push(await planProject(env, connection, row, fieldMap, seen));
  }

  const summary = {
    projects: plans.length,
    createClients: plans.filter((p) => p.client?.action === 'create_client').length,
    linkClients: plans.filter((p) => p.client?.action === 'link_client').length,
    createCases: plans.filter((p) => p.case?.action === 'create_case').length,
    updateCases: plans.filter((p) => p.case?.action === 'update_case').length,
    unchanged: plans.filter((p) => p.case?.action === 'none').length,
    conflicts: plans.reduce((n, p) => n + p.conflicts.length, 0),
    failed: plans.filter((p) => p.error).length,
    warnings: plans.reduce((n, p) => n + p.warnings.length, 0),
  };

  return { summary, plans };
}

/* ═══ التنفيذ ═══ */

const CLIENT_COLUMN = {
  fullName: 'full_name', idNumber: 'id_number', phone: 'phone', email: 'email',
  clientType: 'client_type', commercialRegister: 'commercial_register',
};
const CASE_COLUMN = {
  caseNumber: 'case_number', caseType: 'case_type', summary: 'summary',
  status: 'status', outcome: 'outcome',
};

async function applyPlan(env, plan, actorId) {
  const now = nowSeconds();
  const result = { projectId: plan.projectId, created: [], updated: [], error: plan.error };
  if (plan.error) return result;

  // ── العميل ──
  /* ويُعاد البحث هنا لا يُكتفى بما في الخطّة: خطّةٌ سابقة في هذه الدفعة
     قد أنشأت العميل بعد أن بُنيت هذه. وهذا هو الحارس الأخير قبل قيد
     التفرّد — والخطّةُ تصحّ بلا حاجةٍ إليه، لكنّه أرخصُ من صفٍّ ساقط. */
  let clientId = plan.client.id;
  if (!clientId) {
    const late = await findClient(env, plan.client.values);
    if (late) clientId = late.row.id;
  }
  if (!clientId) {
    clientId = crypto.randomUUID();
    const values = plan.client.values;
    await env.DB.prepare(
      `INSERT INTO clients (id, full_name, id_number, phone, email, client_type, commercial_register,
                            status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'current', ?, ?)`,
    )
      .bind(
        clientId,
        values.fullName,
        values.idNumber,
        values.phone ?? '',
        values.email ?? '',
        values.clientType ?? 'individual',
        values.commercialRegister ?? null,
        now,
        now,
      )
      .run();
    result.created.push('client');
  }

  // ── القضية ──
  let caseId = plan.case?.id ?? null;
  if (plan.case?.action === 'create_case') {
    caseId = crypto.randomUUID();
    const values = plan.case.values;
    await env.DB.prepare(
      `INSERT INTO cases (id, case_number, case_type, client_id, client_name, summary, status,
                          outcome, basecamp_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        caseId,
        values.caseNumber,
        values.caseType,
        clientId,
        plan.client.values.fullName,
        values.summary ?? '',
        values.status ?? 'pending',
        values.outcome ?? null,
        plan.appUrl,
        now,
        now,
      )
      .run();
    result.created.push('case');
  } else if (plan.case?.action === 'update_case' && caseId) {
    const changes = plan.case.changes;
    const columns = Object.keys(changes).map((field) => CASE_COLUMN[field]);
    /* ورابطُ بيسكامب يُحدَّث دائماً مع أي كتابة: المشروع قد يُنقل فيتبدّل
       عنوانُه، والرابطُ في الشاشة يجب أن يفتح ما يفتحه اليوم. */
    columns.push('basecamp_url', 'updated_at');
    const assignments = columns.map((column) => `${column} = ?`).join(', ');
    await env.DB.prepare(`UPDATE cases SET ${assignments} WHERE id = ?`)
      .bind(...Object.keys(changes).map((f) => changes[f]), plan.appUrl, now, caseId)
      .run();
    result.updated.push(...Object.keys(changes));
  } else if (caseId) {
    await env.DB.prepare(`UPDATE cases SET basecamp_url = ? WHERE id = ?`)
      .bind(plan.appUrl, caseId)
      .run();
  }

  // ── التعارضات: تُسجَّل ولا تُكتب ──
  for (const conflict of plan.conflicts) {
    /* الصفُّ المفتوح على الحقل نفسه يُحدَّث لا يُكرَّر: مزامنةٌ كلَّ ساعة
       على تعارضٍ لم يُحسم تُنشئ أربعاً وعشرين نسخةً في اليوم. */
    const open = await env.DB.prepare(
      `SELECT id FROM basecamp_conflicts
       WHERE project_id = ? AND field = ? AND resolved_at IS NULL`,
    )
      .bind(plan.projectId, conflict.field)
      .first();

    if (open) {
      await env.DB.prepare(
        `UPDATE basecamp_conflicts SET platform_value = ?, basecamp_value = ?, detected_at = ?
         WHERE id = ?`,
      )
        .bind(conflict.platformValue, conflict.basecampValue, now, open.id)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO basecamp_conflicts
           (id, project_id, case_id, field, platform_value, basecamp_value, detected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(crypto.randomUUID(), plan.projectId, caseId, conflict.field,
          conflict.platformValue, conflict.basecampValue, now)
        .run();
    }
  }

  /* صورةُ ما كُتب — وهي الطرف الثالث في الدمج القادم. وتُحفظ قيمُ بيسكامب
     كلُّها لا المتبدّلة وحدها: بها يُعرف لاحقاً ما تحرّك عندهم وما سكن. */
  const snapshot = {};
  for (const field of CASE_FIELDS) {
    if (plan.case?.values?.[field] !== undefined) snapshot[field] = plan.case.values[field];
  }

  await env.DB.prepare(
    `UPDATE basecamp_projects
     SET client_id = ?, case_id = ?, synced_values = ?, last_synced_at = ?, last_error = NULL,
         updated_at = ?
     WHERE project_id = ?`,
  )
    .bind(clientId, caseId, JSON.stringify(snapshot), now, now, plan.projectId)
    .run();

  return result;
}

/** ينفّذ الخطّة كلَّها. والمشروعُ الساقط لا يوقف من بعده. */
export async function runSync(env, connection, { actorId, actorName, source }) {
  const { summary, plans } = await buildPlan(env, connection);
  const results = [];
  let failed = 0;

  for (const plan of plans) {
    try {
      results.push(await applyPlan(env, plan, actorId));
    } catch (applyError) {
      failed++;
      const reason = applyError?.message ?? String(applyError);
      console.error('Basecamp: تعذّر تطبيق مشروع', plan.projectId, '—', reason);
      await env.DB.prepare(
        `UPDATE basecamp_projects SET last_error = ?, updated_at = ? WHERE project_id = ?`,
      )
        .bind(reason.slice(0, 300), nowSeconds(), plan.projectId)
        .run()
        .catch(() => {});
      results.push({ projectId: plan.projectId, error: 'apply_failed' });
    }
  }

  const applied = {
    ...summary,
    failed: summary.failed + failed,
    clientsCreated: results.filter((r) => r.created?.includes('client')).length,
    casesCreated: results.filter((r) => r.created?.includes('case')).length,
    casesUpdated: results.filter((r) => r.updated?.length).length,
  };

  await env.DB.prepare(
    `UPDATE basecamp_connection SET last_sync_at = ?, last_sync_error = NULL WHERE id = 1`,
  )
    .bind(nowSeconds())
    .run();

  await env.DB.prepare(
    `INSERT INTO activity_logs (id, type, description, user_id, user_name, entity_type, details, created_at)
     VALUES (?, 'basecamp', ?, ?, ?, 'basecamp', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      `مزامنةُ بيسكامب (${source}): ${applied.clientsCreated} عميلاً و${applied.casesCreated} قضيةً جديدة، و${applied.casesUpdated} محدَّثة`,
      actorId,
      actorName ?? '',
      JSON.stringify(applied),
      nowSeconds(),
    )
    .run()
    .catch(() => {});

  return applied;
}
