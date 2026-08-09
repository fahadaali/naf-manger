// اكتشافُ المشاريع وتصنيفُها.
//
// ═══ ما يميّز مشروعَ العميل ═══
//
// حسابُ المكتب فيه مشاريعُ إدارةٍ داخلية ومشاريعُ عملاء، ولا يفرّق بينها
// اسمٌ ولا مجلَّد. والذي يفرّق: **مشروعُ العميل فيه ملفّ «ملخص القضية»**،
// وهو موجودٌ في كل مشروعٍ يتعلّق بعملٍ لعميل.
//
// فوجودُ الملفّ يرجّح `client`، وغيابُه `internal`.
//
// ═══ والترجيحُ ليس حكماً ═══
//
// مشروعٌ داخليٌّ قد يحمل الملفّ نموذجاً، ومشروعُ عميلٍ قديم قد يخلو منه.
// فالتصنيف الآليّ اقتراحٌ يراجعه من يفتح الشاشة — ومتى حكم بيده لم
// يُنقَض حكمُه في مسحٍ لاحق. وذلك ما يقوله `decided_by` حين يمتلئ.

import { getJson, listAll } from './api.js';

/** عنوانُ الملفّ الذي يُبحث عنه. */
export const SUMMARY_TITLE = 'ملخص القضية';

/**
 * توحيدُ النصّ العربي قبل المقارنة.
 *
 * «ملخّص القضيّة» و«ملخص القضيه» و«ملخـص القضية» عناوينُ واحدة كتبها
 * ثلاثةُ أشخاص. ومقارنةٌ حرفيةٌ تُسقط مشروعَ عميلٍ لأنّ كاتبَه شدّد حرفاً.
 *
 * فتُرفع الحركات والتطويل، وتُوحَّد صور الألف والياء والتاء المربوطة.
 */
export function normalizeArabic(text) {
  return String(text ?? '')
    .replace(/[ً-ْٰ]/g, '')  // الحركات والسكون والألف الخنجرية
    .replace(/ـ/g, '')                  // التطويل
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ ← ا
    .replace(/ى/g, 'ي')            // ى ← ي
    .replace(/ة/g, 'ه')            // ة ← ه
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const SUMMARY_NORMALIZED = normalizeArabic(SUMMARY_TITLE);

/** أهذا عنوانُ ملفّ ملخّص القضية؟ */
export const isSummaryTitle = (title) => normalizeArabic(title) === SUMMARY_NORMALIZED;

/** أداةُ «Docs & Files» في رصيف المشروع. */
export function findVault(project) {
  const entry = (project?.dock ?? []).find((tool) => tool.name === 'vault' && tool.enabled);
  return entry ? String(entry.id) : null;
}

/**
 * يبحث عن الملفّ في الخزانة، ثمّ في مجلَّداتها المباشرة.
 *
 * ومستوىً واحدٌ من العمق لا أكثر: بعضُ المكاتب تضع الملفّ في مجلَّد
 * «المستندات»، وقليلٌ يُغرقه أعمق. والنزولُ بلا حدٍّ يضاعف النداءات على
 * كل مشروع ويبلغ حدَّ بيسكامب بلا طائل.
 */
async function findSummaryDoc(accountId, token, projectId, vaultId) {
  const base = `/buckets/${projectId}/vaults/${vaultId}`;

  const { items: documents } = await listAll(accountId, token, `${base}/documents.json`);
  const direct = documents.find((document) => isSummaryTitle(document.title));
  if (direct) return direct;

  const { items: folders } = await listAll(accountId, token, `${base}/vaults.json`);
  for (const folder of folders) {
    const { items: nested } = await listAll(
      accountId,
      token,
      `/buckets/${projectId}/vaults/${folder.id}/documents.json`,
    );
    const found = nested.find((document) => isSummaryTitle(document.title));
    if (found) return found;
  }

  return null;
}

/**
 * يمسح الحساب ويحدّث `basecamp_projects`.
 *
 * والمشاريعُ المؤرشفة تُمسح كذلك: بياناتُ المكتب «من زمان»، وقضيةٌ أُغلقت
 * أُرشف مشروعُها — وإسقاطُها يُسقط أقدمَ ما يُراد نقلُه.
 */
export async function scanProjects(env, connection) {
  const { accountId, token } = connection;
  const now = Math.floor(Date.now() / 1000);

  const [active, archived] = await Promise.all([
    listAll(accountId, token, '/projects.json'),
    listAll(accountId, token, '/projects.json?status=archived'),
  ]);

  const projects = [
    ...active.items.map((project) => ({ project, status: 'active' })),
    ...archived.items.map((project) => ({ project, status: 'archived' })),
  ];

  /* القرارات السابقة تُقرأ دفعةً واحدة: خمسون استعلاماً منفرداً داخل
     الحلقة أبطأُ وأثقل على D1 من استعلامٍ واحد. */
  const { results: existingRows } = await env.DB.prepare(
    `SELECT project_id, kind, decided_by, doc_id, doc_updated_at FROM basecamp_projects`,
  ).all();
  const existing = new Map((existingRows ?? []).map((row) => [row.project_id, row]));

  const summary = { scanned: 0, client: 0, internal: 0, failed: 0, incomplete: !active.complete };

  for (const { project, status } of projects) {
    const projectId = String(project.id);
    const previous = existing.get(projectId);
    summary.scanned++;

    let vaultId = null;
    let document = null;
    let error = null;

    try {
      vaultId = findVault(project);
      if (vaultId) document = await findSummaryDoc(accountId, token, projectId, vaultId);
    } catch (scanError) {
      /* مشروعٌ واحدٌ يسقط لا يوقف المسح: يُسجَّل سببُه ويُمضى إلى ما بعده.
         وحسابٌ فيه مشروعٌ لا يُقرأ يبقى بقيّتُه مقروءة. */
      error = scanError?.code ?? 'scan_failed';
      summary.failed++;
    }

    /* الحكمُ اليدوي لا يُنقَض. وما لم يُحكَم يُرجَّح بوجود الملفّ. */
    const kind = previous?.decided_by
      ? previous.kind
      : document
        ? 'client'
        : 'internal';

    if (kind === 'client') summary.client++;
    else summary.internal++;

    await env.DB.prepare(
      `INSERT INTO basecamp_projects
         (project_id, name, app_url, status, vault_id, doc_id, doc_updated_at,
          kind, last_error, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET name           = excluded.name,
                                             app_url        = excluded.app_url,
                                             status         = excluded.status,
                                             vault_id       = excluded.vault_id,
                                             doc_id         = excluded.doc_id,
                                             doc_updated_at = excluded.doc_updated_at,
                                             kind           = excluded.kind,
                                             last_error     = excluded.last_error,
                                             updated_at     = excluded.updated_at`,
    )
      /* و`created_at` يُمرَّر في الإدراج ولا يُذكر في `DO UPDATE SET` —
         فيبقى على صفٍّ قائم تاريخُ أوّلِ رؤيةٍ له لا تاريخُ آخر مسح. */
      .bind(
        projectId,
        project.name ?? '',
        project.app_url ?? '',
        status,
        vaultId,
        document ? String(document.id) : null,
        document?.updated_at ?? null,
        kind,
        error,
        now,
        now,
      )
      .run();
  }

  return summary;
}

/** نصُّ ملفّ الملخّص كما هو — لبناء خريطة الحقول على الواقع لا على تخمين. */
export async function readSummaryDocument(connection, projectId, documentId) {
  const { accountId, token } = connection;
  const document = await getJson(
    accountId,
    token,
    `/buckets/${projectId}/documents/${documentId}.json`,
  );
  return {
    title: document.title ?? '',
    content: document.content ?? '',
    appUrl: document.app_url ?? '',
    updatedAt: document.updated_at ?? null,
  };
}
