// مسارات `‎/api/basecamp/*‎`.
//
// كلُّها للمسؤول وحده: الربطُ يفتح حسابَ بيسكامب للمكتب كلَّه قراءةً،
// والتصنيفُ يقرّر أيُّ مشروعٍ تُنقل بياناتُه إلى قاعدة العملاء. وليس ذلك
// من `settings.update` ولا من `clients.create` — بل من ملكِ المنصة.

import { BasecampError } from './api.js';
import { readSummaryDocument, scanProjects } from './discover.js';
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
    },
  });
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

  const tokens = await exchangeCode(env, url, code);
  if (!tokens?.access_token) return back('exchange_failed');

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
      `مُسحت مشاريع بيسكامب: ${summary.scanned} مشروعاً، منها ${summary.client} لعملاء`,
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
    `SELECT p.project_id, p.name, p.app_url, p.status, p.doc_id, p.doc_updated_at,
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
      hasSummary: Boolean(row.doc_id),
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
 * نصُّ «ملخص القضية» كما هو.
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
  if (!row.doc_id) return fail('no_summary', 404);

  const connection = await activeConnection(env);
  if (connection.error) {
    return fail(connection.error, CONNECTION_ERRORS.has(connection.error) ? 503 : 502);
  }

  try {
    const document = await readSummaryDocument(connection, row.project_id, row.doc_id);
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
