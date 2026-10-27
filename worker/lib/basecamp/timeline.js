// الخطُّ الزمنيّ للقضية من مشروعها في بيسكامب — قراءةٌ لا كتابة.
//
// ═══ ما يُقرأ ═══
//
// `GET /projects/recordings.json?type=…&bucket=<المشروع>&sort=updated_at&direction=desc`
// لأنواعٍ أربعة: المهامّ والتعليقات والرسائل والملفّات. أوّلُ صفحةٍ من كلٍّ تكفي —
// المطلوبُ «آخرُ ما حدث» لا السجلُّ كلُّه — ثم تُدمج وتُرتَّب ويؤخذ أحدثُ عشرين.
//
// ═══ ولا يُنادى بيسكامب في كلّ فتحةِ نافذة ═══
//
// خبيئةٌ عشرَ دقائق في KV بمفتاح المشروع: من يفتح القضيةَ ويغلقها ويعيد فتحها
// لا يستهلك من حدّ النداءات (٥٠ كلَّ ١٠ ثوانٍ) ما تحتاجه المزامنة.
//
// والقارئُ متحمّل: حقلٌ غائبٌ عن الردّ يُترك فارغاً، ونوعٌ سقطت قراءتُه لا
// يُسقط الباقي.

import { getJson, BasecampError } from './api.js';
import { activeConnection } from './oauth.js';

const TYPES = [
  { type: 'Todo', label: 'مهمة' },
  { type: 'Comment', label: 'تعليق' },
  { type: 'Message', label: 'رسالة' },
  { type: 'Upload', label: 'ملف' },
];

const LIMIT = 20;
const CACHE_SECONDS = 600;

const fail = (error, status) => Response.json({ ok: false, error }, { status });

/* نصُّ التعليق HTML — يُجرَّد ويُقصّ، فلا يُعرض وسمٌ ولا يطول السطر. */
const plain = (html) =>
  String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

/** تسجيلةٌ من بيسكامب إلى حدثٍ في الخطّ — أو `null`. */
export function shapeRecording(recording, label) {
  if (!recording || typeof recording !== 'object') return null;
  const at = recording.updated_at ?? recording.created_at;
  if (!at) return null;
  const title = recording.title || recording.parent?.title || '';
  /* والرسالةُ والتعليقُ لهما نصٌّ يُقتطف؛ والتعليقُ يُسمّى بأصله («في: …»). */
  const hasBody = recording.type === 'Comment' || recording.type === 'Message';
  return {
    id: String(recording.id ?? ''),
    kind: recording.type ?? '',
    label: recording.type === 'Todo' && recording.completed ? 'مهمة أُنجزت' : label,
    title,
    parentTitle: recording.type === 'Comment' ? recording.parent?.title ?? '' : '',
    completed: recording.type === 'Todo' && Boolean(recording.completed),
    excerpt: hasBody ? plain(recording.content) : '',
    author: recording.creator?.name ?? '',
    at,
    url: recording.app_url ?? null,
  };
}

/** يقرأ أحدثَ ما في مشروعٍ واحد. */
export async function readTimeline(env, connection, projectId) {
  const settled = await Promise.allSettled(TYPES.map(({ type }) =>
    getJson(connection.accountId, connection.token,
      `/projects/recordings.json?type=${type}&bucket=${encodeURIComponent(projectId)}&sort=updated_at&direction=desc`)));

  const events = [];
  let failed = 0;
  settled.forEach((result, index) => {
    if (result.status !== 'fulfilled') { failed++; return; }
    for (const recording of Array.isArray(result.value) ? result.value : []) {
      const shaped = shapeRecording(recording, TYPES[index].label);
      if (shaped) events.push(shaped);
    }
  });
  /* والقراءاتُ الأربع سقطت كلُّها: سقوطٌ يُقال، لا خطٌّ فارغٌ يوهم أنّ شيئاً لم يقع. */
  if (failed === TYPES.length) {
    const reason = settled.find((result) => result.status === 'rejected')?.reason;
    throw reason instanceof BasecampError ? reason : new BasecampError('provider_failed', 502);
  }

  events.sort((one, other) => String(other.at).localeCompare(String(one.at)));
  return { events: events.slice(0, LIMIT), partial: failed > 0 };
}

/** `GET /api/cases/:id/timeline` — لمن يقرأ القضايا. */
export async function caseTimeline(env, user, caseId) {
  if (!user.permissions?.cases?.read) return fail('forbidden', 403);

  const project = await env.DB.prepare(
    `SELECT project_id, app_url FROM basecamp_projects WHERE case_id = ?`,
  )
    .bind(caseId)
    .first();
  if (!project) return Response.json({ ok: true, data: { linked: false, events: [] } });

  const key = `bc-timeline:${project.project_id}`;
  const cached = await env.AUTH_KV?.get(key, 'json').catch(() => null);
  if (cached) return Response.json({ ok: true, data: { linked: true, projectUrl: project.app_url, ...cached, cached: true } });

  const connection = await activeConnection(env);
  if (connection.error) return Response.json({ ok: true, data: { linked: true, projectUrl: project.app_url, events: [], error: connection.error } });

  try {
    const timeline = await readTimeline(env, connection, project.project_id);
    await env.AUTH_KV?.put(key, JSON.stringify(timeline), { expirationTtl: CACHE_SECONDS }).catch(() => {});
    return Response.json({ ok: true, data: { linked: true, projectUrl: project.app_url, ...timeline } });
  } catch (error) {
    const code = error instanceof BasecampError ? error.code : 'provider_failed';
    return Response.json({ ok: true, data: { linked: true, projectUrl: project.app_url, events: [], error: code } });
  }
}
