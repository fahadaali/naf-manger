// اكتشافُ المشاريع وتصنيفُها.
//
// ═══ ما يميّز مشروعَ العميل ═══
//
// حسابُ المكتب فيه مشاريعُ إدارةٍ داخلية ومشاريعُ عملاء، ولا يفرّق بينها
// اسمٌ ولا مجلَّد. والذي يفرّق: **مشروعُ العميل فيه ملفُّ «بيانات المشروع»**،
// وهو موجودٌ في كل مشروعٍ يتعلّق بعملٍ لعميل.
//
// فوجودُ الملفّ يرجّح `client`، وغيابُه `internal`.
//
// ═══ والترجيحُ ليس حكماً ═══
//
// مشروعٌ داخليٌّ قد يحمل الملفّ نموذجاً، ومشروعُ عميلٍ قديم قد يخلو منه.
// فالتصنيف الآليّ اقتراحٌ يراجعه من يفتح الشاشة — ومتى حكم بيده لم
// يُنقَض حكمُه في مسحٍ لاحق. وذلك ما يقوله `decided_by` حين يمتلئ.
//
// ═══ والعنوانُ يتبدّل ═══
//
// كان الملفّ «ملخص القضية» فصار «بيانات المشروع». وعنوانٌ واحدٌ مكتوبٌ في
// الشيفرة يجعل إعادةَ تسميةٍ في بيسكامب تُطفئ الاستيرادَ كلَّه صامتاً —
// المشاريعُ تظهر بلا ملفّ، ولا يقول أحدٌ لِمَ.
//
// فالعناوينُ المقبولة قائمةٌ تُعدَّل من الشاشة، وفيها الاسمان معاً: الجاري
// والقديم — لأنّ مشاريعَ سنينَ ماضية لم يُعَد تسميةُ ملفّاتها.

import { getJson, listAll } from './api.js';
import { openReview } from './reviews.js';

/**
 * العناوينُ المقبولة — أوّلُها الاسمُ الجاري وما بعده ما كان قبله.
 *
 * وهي افتراضٌ يُبنى عليه: المعتمَدُ ما في `system_settings` إن كُتب.
 */
export const DEFAULT_DOC_TITLES = ['بيانات المشروع', 'ملخص القضية'];

const DOC_TITLES_KEY = 'basecamp_doc_titles';

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

/** أهذا أحدُ عناوين ملفّ بيانات المشروع؟ */
export function isDocumentTitle(title, titles = DEFAULT_DOC_TITLES) {
  const normalized = normalizeArabic(title);
  if (!normalized) return false;
  return titles.some((accepted) => normalizeArabic(accepted) === normalized);
}

/** العناوينُ المقبولة كما ضبطها المكتب — أو الافتراض. */
export async function readDocTitles(env) {
  const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = ?`)
    .bind(DOC_TITLES_KEY)
    .first();
  if (!row?.value) return [...DEFAULT_DOC_TITLES];
  try {
    const stored = JSON.parse(row.value);
    const clean = Array.isArray(stored)
      ? stored.map((title) => String(title ?? '').trim()).filter(Boolean)
      : [];
    return clean.length ? clean : [...DEFAULT_DOC_TITLES];
  } catch {
    return [...DEFAULT_DOC_TITLES];
  }
}

export async function writeDocTitles(env, titles, userId) {
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                    updated_by = excluded.updated_by,
                                    updated_at = excluded.updated_at`,
  )
    .bind(DOC_TITLES_KEY, JSON.stringify(titles), userId, Math.floor(Date.now() / 1000))
    .run();
}

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
 *
 * ═══ وملفٌّ عُرف مرّةً لا يضيع بإعادة تسمية ═══
 *
 * معرّفُ الملفّ عند بيسكامب لا يتبدّل بتبدّل عنوانه. فإن لم يُطابق عنوانٌ،
 * وكان لهذا المشروع ملفٌّ معروفٌ من مسحٍ سابق ولا يزال في الخزانة — فهو
 * هو، أُعيدت تسميتُه. ويُردّ مع `renamed` ليُقال في الشاشة، فيُضاف
 * العنوانُ الجديد إلى المقبولة بدل أن ينقطع الاستيراد بلا سبب ظاهر.
 *
 * ولا نداءَ إضافياً في ذلك: المسرَدُ نفسُه الذي بُحث فيه عن العنوان.
 */
async function findProjectDocument(accountId, token, projectId, vaultId, options = {}) {
  const { titles = DEFAULT_DOC_TITLES, knownDocId = null } = options;
  const base = `/buckets/${projectId}/vaults/${vaultId}`;
  const seen = [];

  const { items: documents } = await listAll(accountId, token, `${base}/documents.json`);
  const direct = documents.find((document) => isDocumentTitle(document.title, titles));
  if (direct) return { document: direct, renamed: false };
  seen.push(...documents);

  const { items: folders } = await listAll(accountId, token, `${base}/vaults.json`);
  for (const folder of folders) {
    const { items: nested } = await listAll(
      accountId,
      token,
      `/buckets/${projectId}/vaults/${folder.id}/documents.json`,
    );
    const found = nested.find((document) => isDocumentTitle(document.title, titles));
    if (found) return { document: found, renamed: false };
    seen.push(...nested);
  }

  if (knownDocId) {
    const same = seen.find((document) => String(document.id) === String(knownDocId));
    if (same) return { document: same, renamed: true };
  }

  return { document: null, renamed: false };
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

  const titles = await readDocTitles(env);

  const summary = {
    scanned: 0, client: 0, internal: 0, failed: 0, incomplete: !active.complete,
    /* ملفّاتٌ عُرفت بمعرّفها بعد أن تبدّل عنوانُها — تُعدّ لتُقال في الشاشة:
       «هذه ملفّاتُها أُعيدت تسميتُها، فأضِف العنوان الجديد». */
    renamed: 0,
    renamedTitles: [],
  };

  for (const { project, status } of projects) {
    const projectId = String(project.id);
    const previous = existing.get(projectId);
    summary.scanned++;

    let vaultId = null;
    let document = null;
    let error = null;

    try {
      vaultId = findVault(project);
      if (vaultId) {
        const found = await findProjectDocument(accountId, token, projectId, vaultId, {
          titles,
          knownDocId: previous?.doc_id ?? null,
        });
        document = found.document;
        if (found.renamed) {
          summary.renamed++;
          const title = String(document?.title ?? '').trim();
          if (title && !summary.renamedTitles.includes(title)) summary.renamedTitles.push(title);
        }
      }
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

    /* ═══ ومشروعٌ جديد يُسأل عن تصنيفه مرّةً ═══
       الترجيحُ بوجود الملفّ اقتراحٌ لا حكم — ومشروعٌ داخليٌّ يحمل الملفّ
       نموذجاً يصير «عميلاً» ولا يقول أحدٌ ذلك. فيُفتح له صفٌّ يُحسم في
       ضغطة ويثبت.

       **وللجديد وحده**: حسابٌ فيه ثلاثمئة مشروعٍ قائم لا يُغرق شاشةَ
       المراجعة بثلاثمئة سؤالٍ في أوّل نشرة. وما مضى صُنّف ومرّ. */
    if (!previous) {
      await openReview(env, {
        kind: 'project_kind',
        projectId,
        subject: project.name ?? '',
        fingerprint: kind,
        detail: { guessed: kind, hasDocument: Boolean(document) },
      }).catch((error) => {
        console.error('Basecamp: تعذّر فتح صفّ تصنيف —', error?.message ?? error);
      });
    }

    await env.DB.prepare(
      `INSERT INTO basecamp_projects
         (project_id, name, app_url, status, vault_id, doc_id, doc_title, doc_updated_at,
          kind, last_error, created_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET name           = excluded.name,
                                             app_url        = excluded.app_url,
                                             status         = excluded.status,
                                             vault_id       = excluded.vault_id,
                                             doc_id         = excluded.doc_id,
                                             doc_title      = excluded.doc_title,
                                             doc_updated_at = excluded.doc_updated_at,
                                             kind           = excluded.kind,
                                             last_error     = excluded.last_error,
                                             created_on     = excluded.created_on,
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
        document?.title ?? null,
        document?.updated_at ?? null,
        kind,
        error,
        /* تاريخُ إنشاء المشروع عندهم — يصير «عميلاً منذ». وكان يُكتب تاريخَ
           الاستيراد، فيظهر موكّلٌ منذ سنين عميلاً منذ اليوم. */
        project.created_at ?? null,
        now,
        now,
      )
      .run();
  }

  return summary;
}

/** نصُّ ملفّ المشروع كما هو — لبناء خريطة الحقول على الواقع لا على تخمين. */
export async function readProjectDocument(connection, projectId, documentId) {
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
