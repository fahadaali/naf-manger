// مسارات `‎/api/basecamp/*‎`.
//
// كلُّها للمسؤول وحده: الربطُ يفتح حسابَ بيسكامب للمكتب كلَّه قراءةً،
// والتصنيفُ يقرّر أيُّ مشروعٍ تُنقل بياناتُه إلى قاعدة العملاء. وليس ذلك
// من `settings.update` ولا من `clients.create` — بل من ملكِ المنصة.

import { BasecampError } from './api.js';
import {
  DEFAULT_DOC_TITLES,
  readDocTitles,
  readProjectDocument,
  scanProjects,
  writeDocTitles,
} from './discover.js';
import { DEFAULT_FIELD_MAP, TARGETS } from './parse.js';
import { buildPlan, readFieldMap, runSync, writeFieldMap } from './sync.js';
import { aiEnabled, setAiEnabled } from '../ai/summarize.js';
import {
  activeConnection,
  beginAuthorization,
  consumeState,
  credentials,
  exchangeCode,
  identify,
  saveConnection,
} from './oauth.js';

const fail = (error, status) => Response.json({ ok: false, error }, { status });

const nowSeconds = () => Math.floor(Date.now() / 1000);

const isAdmin = (user) => user.role === 'admin';

/* رمزُ الحالة يُترجَم في الشاشة إلى جملةٍ عربية. والغرض ألّا يُقال «تعذّر»
   لثلاث علل مختلفة: تطبيقٌ لم يُسجَّل، وربطٌ لم يقع، ومفتاحٌ بُدِّل. */
const CONNECTION_ERRORS = new Set([
  'not_configured',
  'not_connected',
  'key_changed',
  'refresh_failed',
]);

/** حالةُ الربط — أوّلُ ما تنادِيه الشاشة. */
export async function readStatus(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  if (!credentials(env)) {
    return Response.json({ ok: true, data: { state: 'not_configured' } });
  }

  const row = await env.DB.prepare(
    `SELECT account_name, connected_at, sync_enabled, last_sync_at, last_sync_error
     FROM basecamp_connection WHERE id = 1`,
  ).first();

  if (!row) return Response.json({ ok: true, data: { state: 'not_connected' } });

  const counts = await env.DB.prepare(
    `SELECT
       COUNT(*)                                        AS total,
       SUM(CASE WHEN kind = 'client'   THEN 1 ELSE 0 END) AS clients,
       SUM(CASE WHEN kind = 'internal' THEN 1 ELSE 0 END) AS internal,
       SUM(CASE WHEN case_id IS NOT NULL THEN 1 ELSE 0 END) AS linked
     FROM basecamp_projects`,
  ).first();

  const open = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM basecamp_conflicts WHERE resolved_at IS NULL`,
  ).first();

  return Response.json({
    ok: true,
    data: {
      state: 'connected',
      accountName: row.account_name ?? '',
      connectedAt: row.connected_at,
      syncEnabled: row.sync_enabled === 1,
      lastSyncAt: row.last_sync_at ?? null,
      lastSyncError: row.last_sync_error ?? null,
      projects: {
        total: counts?.total ?? 0,
        client: counts?.clients ?? 0,
        internal: counts?.internal ?? 0,
        linked: counts?.linked ?? 0,
      },
      openConflicts: open?.n ?? 0,
      /* والتلخيصُ الآليّ: حالتُه تُقرأ مع حالة الربط لأنّ مفتاحَه في
         شاشتها — ونداءٌ ثانٍ لعلمٍ واحد نداءٌ زائد. */
      aiEnabled: await aiEnabled(env),
    },
  });
}

/**
 * تشغيلُ التلخيص الآليّ وإطفاؤه.
 *
 * وهو مفتاحٌ للمسؤول وحده: يقرّر أنّ نصوص القضايا تُمرَّر إلى الطراز —
 * وذلك أوسعُ ممّا يخرج اليوم إلى استبصارات التحليلات (أرقامٌ مجمَّعة
 * وحدها). فيُقال في الشاشة، ويُقرَّر بيد.
 */
export async function setAiImport(request, env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  const enabled = body?.enabled === true;

  await setAiEnabled(env, enabled, user.id);
  await logActivity(env, user, enabled ? 'شُغّل التلخيص الآليّ للاستيراد' : 'أُطفئ التلخيص الآليّ للاستيراد');
  return Response.json({ ok: true, data: { aiEnabled: enabled } });
}

/** يبدأ التصريح — تحويلٌ إلى صفحة إذن بيسكامب. */
export async function startConnect(request, env, user, url) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  const target = await beginAuthorization(env, url, user.id);
  if (!target) return fail('not_configured', 503);

  return Response.redirect(target, 302);
}

/**
 * العودة من بيسكامب.
 *
 * وهي تحويلُ متصفّح لا نداءُ `fetch`: فالردّ تحويلٌ إلى شاشة الإعدادات
 * برمزِ نتيجةٍ في العنوان، لا JSON يراه المستخدم نصّاً في صفحةٍ بيضاء.
 */
export async function finishConnect(request, env, user, url) {
  const back = (result) => Response.redirect(`${url.origin}/?basecamp=${result}`, 302);

  if (!isAdmin(user)) return back('forbidden');

  const error = url.searchParams.get('error');
  if (error) {
    /* رفضُ الإذن ليس عطلاً: يُقال ولا يُسجَّل خطأً. */
    return back('denied');
  }

  const code = url.searchParams.get('code');
  if (!code) return back('no_code');

  /* `state` يُقارن قبل أي مبادلة: بدونه يقود موقعٌ خبيث متصفّحَ المسؤول
     إلى هذا المسار برمزِ حسابٍ يملكه هو، فيُربط المكتب بحسابٍ غريب. */
  const starter = await consumeState(env, url.searchParams.get('state'));
  if (!starter || starter !== user.id) return back('bad_state');

  /* وسببُ السقوط يُنقل إلى الشاشة لا يُترك في سجلّ Cloudflare: من يربط
     حسابَه ليس من يفتح لوحةَ السجلّات، و«تعذّرت المبادلة» وحدها لا تُعين
     على شيء. والمنقول رمزٌ وحالةٌ لا جسمُ ردّ. */
  const exchange = await exchangeCode(env, url, code);
  if (exchange.error || !exchange.tokens?.access_token) {
    const { status, code: reason } = exchange.error ?? {};
    const detail = [status, reason].filter(Boolean).join('-');
    return back(detail ? `exchange_failed.${detail}` : 'exchange_failed');
  }

  const tokens = exchange.tokens;
  const account = await identify(tokens.access_token);
  if (!account) return back('no_account');

  const saved = await saveConnection(env, {
    accountId: account.accountId,
    accountName: account.accountName,
    tokens,
    userId: user.id,
  });
  if (!saved) return back('not_configured');

  await logActivity(env, user, `رُبط حساب بيسكامب «${account.accountName}»`);
  return back('connected');
}

/** فكُّ الارتباط — يمحو الرموز ويوقف الجدولة، ويُبقي ما استُورد. */
export async function disconnect(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  await env.DB.prepare(`DELETE FROM basecamp_connection WHERE id = 1`).run();

  /* ولا تُمحى `basecamp_projects`: فيها قرارُ تصنيفٍ بشريّ وربطُ قضايا،
     وإعادةُ الربط بعد ساعةٍ لا يجوز أن تُلغي ذلك كلَّه. */
  await logActivity(env, user, 'فُكّ ارتباط بيسكامب');
  return Response.json({ ok: true, data: { state: 'not_connected' } });
}

/** مسحُ الحساب — يُحدِّث قائمة المشاريع وتصنيفَها. ولا يكتب في العملاء ولا القضايا. */
export async function rescan(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  const connection = await activeConnection(env);
  if (connection.error) {
    return fail(connection.error, CONNECTION_ERRORS.has(connection.error) ? 503 : 502);
  }

  try {
    const summary = await scanProjects(env, connection);
    await env.DB.prepare(`UPDATE basecamp_connection SET last_sync_error = NULL WHERE id = 1`).run();
    await logActivity(
      env,
      user,
      `مُسحت مشاريع بيسكامب: ${summary.scanned} مشروعاً، منها ${summary.client} لعملاء` +
        (summary.renamed ? `، و${summary.renamed} ملفّاً أُعيدت تسميتُه` : ''),
    );
    return Response.json({ ok: true, data: summary });
  } catch (scanError) {
    const code = scanError instanceof BasecampError ? scanError.code : 'scan_failed';
    await env.DB.prepare(`UPDATE basecamp_connection SET last_sync_error = ? WHERE id = 1`)
      .bind(code)
      .run();
    console.error('Basecamp: تعذّر المسح —', code);
    return fail(code, 502);
  }
}

/** المشاريع وتصنيفها. */
export async function listProjects(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT p.project_id, p.name, p.app_url, p.status, p.doc_id, p.doc_title, p.doc_updated_at,
            p.kind, p.decided_by, p.client_id, p.case_id, p.last_synced_at, p.last_error,
            c.case_number, c.client_name
     FROM basecamp_projects p
     LEFT JOIN cases c ON c.id = p.case_id
     ORDER BY p.kind = 'internal', p.name`,
  ).all();

  return Response.json({
    ok: true,
    data: (results ?? []).map((row) => ({
      projectId: row.project_id,
      name: row.name,
      appUrl: row.app_url,
      status: row.status,
      hasDocument: Boolean(row.doc_id),
      /* واسمُ الملفّ كما هو عندهم: مشروعان أحدُهما «بيانات المشروع»
         والآخر «ملخص القضية» — والفرقُ يُرى بدل أن يُخمَّن. */
      docTitle: row.doc_title ?? null,
      docUpdatedAt: row.doc_updated_at ?? null,
      kind: row.kind,
      decidedByHand: Boolean(row.decided_by),
      clientId: row.client_id ?? null,
      caseId: row.case_id ?? null,
      caseNumber: row.case_number ?? null,
      clientName: row.client_name ?? null,
      lastSyncedAt: row.last_synced_at ?? null,
      lastError: row.last_error ?? null,
    })),
  });
}

/** تصنيفٌ باليد — ويثبت، فلا ينقضه مسحٌ لاحق. */
export async function classifyProject(request, env, user, projectId) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  const kind = body?.kind;
  if (kind !== 'client' && kind !== 'internal') return fail('invalid_kind', 400);

  const result = await env.DB.prepare(
    `UPDATE basecamp_projects SET kind = ?, decided_by = ?, updated_at = ? WHERE project_id = ?`,
  )
    .bind(kind, user.id, nowSeconds(), projectId)
    .run();

  if (!result.meta?.changes) return fail('not_found', 404);
  return Response.json({ ok: true, data: { projectId, kind, decidedByHand: true } });
}

/**
 * نصُّ «بيانات المشروع» كما هو.
 *
 * وهو ما تُبنى عليه خريطةُ الحقول: عناوينُ الحقول تُقرأ من ملفٍّ حقيقي لا
 * تُخمَّن. والمسار يخدم شاشةَ الإعدادات في مرحلة الإعداد وحدها.
 */
export async function readSample(env, user, url) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  const projectId = url.searchParams.get('project');
  if (!projectId) return fail('project_required', 400);

  const row = await env.DB.prepare(
    `SELECT project_id, name, doc_id FROM basecamp_projects WHERE project_id = ?`,
  )
    .bind(projectId)
    .first();

  if (!row) return fail('not_found', 404);
  if (!row.doc_id) return fail('no_document', 404);

  const connection = await activeConnection(env);
  if (connection.error) {
    return fail(connection.error, CONNECTION_ERRORS.has(connection.error) ? 503 : 502);
  }

  try {
    const document = await readProjectDocument(connection, row.project_id, row.doc_id);
    return Response.json({
      ok: true,
      data: { projectId: row.project_id, projectName: row.name, ...document },
    });
  } catch (readError) {
    const code = readError instanceof BasecampError ? readError.code : 'read_failed';
    console.error('Basecamp: تعذّرت قراءة الملخّص —', code);
    return fail(code, 502);
  }
}

/* ═══ خريطةُ الحقول وعناوينُ الملفّ ═══
   اسمُ الملفّ في بيسكامب وعناوينُ حقوله يبدّلهما المكتب — وقد بدّل الاسم
   من «ملخص القضية» إلى «بيانات المشروع». فيُضبطان من الشاشة لا بنشرِ
   شيفرة، وفي نداءٍ واحد لأنهما يُراجَعان معاً. */
export async function readMap(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);
  return Response.json({
    ok: true,
    data: {
      map: await readFieldMap(env),
      targets: TARGETS,
      defaults: DEFAULT_FIELD_MAP,
      titles: await readDocTitles(env),
      defaultTitles: DEFAULT_DOC_TITLES,
    },
  });
}

export async function writeMap(request, env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  if (!body?.map || typeof body.map !== 'object') return fail('invalid_body', 400);

  /* لا يُحفظ إلا ما يشير إلى حقلٍ معروف: مدخلٌ يشير إلى `case.xyz` يمرّ
     صامتاً ثم لا يُكتب شيء، وصاحبُه يظنّ أنه ربط. */
  const clean = {};
  for (const [label, target] of Object.entries(body.map)) {
    const name = String(label ?? '').trim().slice(0, 80);
    if (!name || !(target in TARGETS)) continue;
    clean[name] = target;
  }

  await writeFieldMap(env, clean, user.id);

  /* والعناوين اختيارية في الجسم: من يحفظ الخريطة وحدها لا تُمحى عناوينُه.
     وقائمةٌ فارغة تُردّ إلى الافتراض — لا تُحفظ فارغةً، فحسابٌ بلا عنوانٍ
     مقبول لا يجد ملفّاً في مشروعٍ واحد. */
  let titles = null;
  if (Array.isArray(body.titles)) {
    const cleanTitles = [];
    for (const title of body.titles) {
      const name = String(title ?? '').trim().slice(0, 120);
      if (name && !cleanTitles.includes(name)) cleanTitles.push(name);
    }
    titles = cleanTitles.length ? cleanTitles : [...DEFAULT_DOC_TITLES];
    await writeDocTitles(env, titles, user.id);
  }

  return Response.json({ ok: true, data: { map: clean, titles: titles ?? await readDocTitles(env) } });
}

/* ═══ المعاينة ═══
   تشغيلٌ جافّ: تقرأ الملفّات وتبني الخطّة وتردّها، ولا تكتب في `clients`
   ولا `cases` حرفاً. وهي الشرط قبل أول كتابة. */
export async function preview(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  const connection = await activeConnection(env);
  if (connection.error) {
    return fail(connection.error, CONNECTION_ERRORS.has(connection.error) ? 503 : 502);
  }

  try {
    const { summary, plans } = await buildPlan(env, connection);
    return Response.json({ ok: true, data: { summary, plans: plans.map(shapePlan) } });
  } catch (planError) {
    const code = planError instanceof BasecampError ? planError.code : 'preview_failed';
    console.error('Basecamp: تعذّرت المعاينة —', code);
    return fail(code, 502);
  }
}

/* ═══ التنفيذ ═══ */
export async function sync(env, user, { source = 'يدوي' } = {}) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  const connection = await activeConnection(env);
  if (connection.error) {
    return fail(connection.error, CONNECTION_ERRORS.has(connection.error) ? 503 : 502);
  }

  try {
    const applied = await runSync(env, connection, {
      actorId: user.id,
      actorName: user.name,
      source,
    });
    return Response.json({ ok: true, data: applied });
  } catch (syncError) {
    const code = syncError instanceof BasecampError ? syncError.code : 'sync_failed';
    console.error('Basecamp: تعذّرت المزامنة —', code);
    await env.DB.prepare(`UPDATE basecamp_connection SET last_sync_error = ? WHERE id = 1`)
      .bind(code)
      .run()
      .catch(() => {});
    return fail(code, 502);
  }
}

/**
 * تشغيلُ المزامنة الآلية.
 *
 * ولا تُفتح إلا بعد مزامنةٍ يدويةٍ ناجحة: المعاينةُ ثم التأكيدُ ثم الآلية.
 * وجدولةٌ تبدأ الكتابة في قاعدة موكّلين قبل أن يرى صاحبُها ما ستكتبه
 * خطأٌ لا يُصلَح بعده.
 */
export async function setAutoSync(request, env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  const enabled = body?.enabled === true;

  if (enabled) {
    const row = await env.DB.prepare(
      `SELECT last_sync_at FROM basecamp_connection WHERE id = 1`,
    ).first();
    if (!row) return fail('not_connected', 503);
    if (!row.last_sync_at) return fail('sync_first', 409);
  }

  const result = await env.DB.prepare(
    `UPDATE basecamp_connection SET sync_enabled = ? WHERE id = 1`,
  )
    .bind(enabled ? 1 : 0)
    .run();
  if (!result.meta?.changes) return fail('not_connected', 503);

  await logActivity(env, user, enabled ? 'فُتحت مزامنة بيسكامب الآلية' : 'أُوقفت مزامنة بيسكامب الآلية');
  return Response.json({ ok: true, data: { syncEnabled: enabled } });
}

/* ═══ الاختلافات ═══ */
export async function listConflicts(env, user) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT c.*, p.name AS project_name, k.case_number
     FROM basecamp_conflicts c
     LEFT JOIN basecamp_projects p ON p.project_id = c.project_id
     LEFT JOIN cases k ON k.id = c.case_id
     WHERE c.resolved_at IS NULL
     ORDER BY c.detected_at DESC`,
  ).all();

  return Response.json({
    ok: true,
    data: (results ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name ?? '',
      caseId: row.case_id ?? null,
      caseNumber: row.case_number ?? null,
      field: row.field,
      platformValue: row.platform_value ?? '',
      basecampValue: row.basecamp_value ?? '',
      detectedAt: row.detected_at,
    })),
  });
}

const CASE_COLUMN = {
  caseNumber: 'case_number', caseType: 'case_type', summary: 'summary',
  status: 'status', outcome: 'outcome', notes: 'notes',
};

/* وحقولُ العميل تُسمّى في صفّ التعارض بسابقةِ `client.` — فالجدول واحد
   لهما، والسابقةُ تقول أيَّ صفٍّ يُكتب حين يُحسم. */
const CLIENT_COLUMN = {
  fullName: 'full_name', idNumber: 'id_number', idType: 'id_type', phone: 'phone',
  email: 'email', clientType: 'client_type', commercialRegister: 'commercial_register',
  notes: 'notes',
};

/**
 * حسمُ اختلاف.
 *
 * `basecamp` يكتب قيمتَهم ويحدّث الصورة المحفوظة معاً — ولولا الثانية
 * لعاد التعارضُ نفسُه في المزامنة التالية، لأنّ المنصة ستبدو «مسّتها يد».
 * و`platform` و`ignored` يُغلقان الصفَّ ويثبّتان قيمة بيسكامب في الصورة،
 * فلا يُسأل عنها ثانيةً ما لم تتبدّل عندهم.
 */
export async function resolveConflict(request, env, user, conflictId) {
  if (!isAdmin(user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  const choice = body?.resolution;
  if (!['basecamp', 'platform', 'ignored'].includes(choice)) return fail('invalid_resolution', 400);

  const row = await env.DB.prepare(
    `SELECT * FROM basecamp_conflicts WHERE id = ? AND resolved_at IS NULL`,
  )
    .bind(conflictId)
    .first();
  if (!row) return fail('not_found', 404);

  const now = nowSeconds();
  const isClientField = row.field.startsWith('client.');
  const field = isClientField ? row.field.slice('client.'.length) : row.field;

  const project = await env.DB.prepare(
    `SELECT synced_values, client_id FROM basecamp_projects WHERE project_id = ?`,
  )
    .bind(row.project_id)
    .first();

  if (choice === 'basecamp') {
    if (isClientField && project?.client_id && CLIENT_COLUMN[field]) {
      await env.DB.prepare(
        `UPDATE clients SET ${CLIENT_COLUMN[field]} = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(row.basecamp_value, now, project.client_id)
        .run();
    } else if (!isClientField && row.case_id && CASE_COLUMN[field]) {
      await env.DB.prepare(`UPDATE cases SET ${CASE_COLUMN[field]} = ?, updated_at = ? WHERE id = ?`)
        .bind(row.basecamp_value, now, row.case_id)
        .run();
    }
  }

  /* والصورةُ تُحدَّث في بابها: حقلُ العميل في `client` وحقلُ القضية في
     `case`. وصورةٌ قديمة (حقولُ قضيةٍ مبسوطة) تُرفع إلى الشكل الجديد هنا
     كما ترفعها المزامنة. */
  let stored = {};
  try { stored = JSON.parse(project?.synced_values ?? '{}') ?? {}; } catch { stored = {}; }
  const snapshot = ('case' in stored || 'client' in stored)
    ? { case: stored.case ?? {}, client: stored.client ?? {} }
    : { case: stored, client: {} };

  if (isClientField) snapshot.client[field] = row.basecamp_value;
  else snapshot.case[field] = row.basecamp_value;

  await env.DB.prepare(
    `UPDATE basecamp_projects SET synced_values = ?, updated_at = ? WHERE project_id = ?`,
  )
    .bind(JSON.stringify(snapshot), now, row.project_id)
    .run();

  await env.DB.prepare(
    `UPDATE basecamp_conflicts SET resolved_at = ?, resolution = ? WHERE id = ?`,
  )
    .bind(now, choice, conflictId)
    .run();

  return Response.json({ ok: true, data: { id: conflictId, resolution: choice } });
}

/** الخطّة كما تُعرض — بلا ما لا تحتاجه الشاشة. */
function shapePlan(plan) {
  return {
    projectId: plan.projectId,
    projectName: plan.projectName,
    appUrl: plan.appUrl,
    error: plan.error,
    warnings: plan.warnings,
    conflicts: plan.conflicts,
    unmapped: (plan.unmapped ?? []).map((entry) => entry.label),
    client: plan.client
      ? {
          action: plan.client.action,
          fullName: plan.client.values.fullName,
          idNumber: plan.client.values.idNumber ?? null,
          idType: plan.client.values.idType ?? null,
          phone: plan.client.values.phone ?? null,
          clientType: plan.client.values.clientType ?? null,
          /* ومسؤولُ التواصل اسمُه وحده في المعاينة: العمودُ بنيةٌ، وعرضُ
             JSON خاماً في جدولٍ ركامٌ لا يُقرأ. */
          representative: readRepresentativeName(plan.client.values.legalRepresentative),
          /* الملاحظاتُ تُعرض مقصوصة: المعاينةُ جدولٌ، وفقرةٌ كاملة فيه
             تدفع بقيّةَ الصفوف تحت الطيّ. والنصُّ كلُّه في الملفّ. */
          notes: shorten(plan.client.values.notes),
          /* عددُ الأرقام يُعرض: من يرى «٣ أرقام» يعرف أنّ أرقام الأهل
             التُقطت، ومن يرى «١» يراجع ملفَّه. */
          contacts: (plan.client.values.contacts ?? []).length,
          changes: Object.keys(plan.client.changes ?? {}),
        }
      : null,
    case: plan.case
      ? { action: plan.case.action, caseNumber: plan.case.values.caseNumber,
          caseType: plan.case.values.caseType,
          /* والنوعُ المقترَح آلياً يُعلَّم: يُقرأ في الشاشة ويُصحَّح قبل
             أن يُبنى عليه ترتيبٌ أو تقرير. */
          caseTypeSuggested: plan.caseTypeSuggested === true,
          status: plan.case.values.status ?? null,
          outcome: plan.case.values.outcome ?? null,
          notes: shorten(plan.case.values.notes),
          changes: Object.keys(plan.case.changes ?? {}) }
      : null,
  };
}

/* مسؤولُ التواصل نصُّ JSON في الخطّة — اسمُه وحده يُعرض. */
const readRepresentativeName = (value) => {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed?.name ? String(parsed.name).slice(0, 80) : null;
  } catch {
    return null;
  }
};

const shorten = (text, limit = 120) => {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return null;
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
};

/* سجلُّ الأنشطة القائم يحمل عملَ المزامنة كذلك — فلا جدولَ سجلٍّ ثانٍ،
   وما يقع في المنصة يُقرأ كلُّه من شاشةٍ واحدة. */
async function logActivity(env, user, description) {
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, type, description, user_id, user_name, entity_type, created_at)
     VALUES (?, 'basecamp', ?, ?, ?, 'basecamp', ?)`,
  )
    .bind(crypto.randomUUID(), description, user.id, user.name ?? '', nowSeconds())
    .run()
    .catch((logError) => {
      /* السجلّ لا يُسقط العملية: ربطٌ نجح ثم تعذّر تسجيلُه ربطٌ ناجح. */
      console.error('تعذّر تسجيل النشاط:', logError?.message ?? logError);
    });
}
