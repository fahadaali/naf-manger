/* ═══ الخطُّ الزمنيّ من بيسكامب ═══
 *
 * ما يُحرَس هنا: قضيةٌ بلا مشروعٍ لا تنادي بيسكامب؛ والأنواعُ تُدمج وتُرتَّب
 * والأحدثُ أوّلاً؛ ونصُّ التعليق يُجرَّد من وسومه؛ ونوعٌ سقط لا يُسقط الباقي؛
 * والخبيئةُ تمنع النداءَ الثاني.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { readTimeline, caseTimeline, shapeRecording } = await import('../worker/lib/basecamp/timeline.js');
const bodyOf = async (response) => (typeof response.json === 'function' ? await response.json() : response.body);

group('التوحيد');
const comment = shapeRecording({
  id: 9, type: 'Comment', updated_at: '2026-10-20T10:00:00Z', parent: { title: 'المذكرة' },
  content: '<div>أُرسلت <strong>المذكرة</strong>&nbsp;للمحكمة</div>', creator: { name: 'سارة' }, app_url: 'https://x/9',
}, 'تعليق');
check('التعليقُ بعنوان أصله ونصٍّ مجرَّد',
  comment.title === 'المذكرة' && comment.excerpt === 'أُرسلت المذكرة للمحكمة' && comment.author === 'سارة', comment);
check('والمهمةُ المنجزة تُسمّى بذلك',
  shapeRecording({ id: 1, type: 'Todo', title: 'تقديم', completed: true, updated_at: 'x' }, 'مهمة').label === 'مهمة أُنجزت');
check('وتسجيلةٌ بلا تاريخٍ تُطرح', shapeRecording({ id: 2, type: 'Todo' }, 'مهمة') === null);

group('القراءة');
let calls = [];
const respond = (body, status = 200) => ({
  ok: status < 400, status, headers: new Map(), json: async () => body,
});
globalThis.fetch = async (url) => {
  calls.push(url);
  const type = new URL(url).searchParams.get('type');
  if (type === 'Todo') return respond([{ id: 1, type: 'Todo', title: 'قديمة', updated_at: '2026-10-01T00:00:00Z' }]);
  if (type === 'Comment') return respond([{ id: 2, type: 'Comment', content: 'جديد', updated_at: '2026-10-25T00:00:00Z' }]);
  if (type === 'Message') return respond({}, 404);
  return respond([{ id: 3, type: 'Upload', title: 'عقد.pdf', updated_at: '2026-10-10T00:00:00Z' }]);
};

const connection = { accountId: '9', token: 't' };
const timeline = await readTimeline({}, connection, '101');
check('الأنواعُ تُدمج والأحدثُ أوّلاً',
  timeline.events.map((event) => event.id).join() === '2,3,1', timeline.events.map((event) => event.id));
check('ونوعٌ سقط لا يُسقط الباقي، ويُقال', timeline.partial === true);
check('والنداءُ على المشروع نفسِه', calls.every((url) => url.includes('bucket=101')), calls);

globalThis.fetch = async () => respond({}, 500);
let threw = false;
try { await readTimeline({}, connection, '101'); } catch { threw = true; }
check('وسقوطُ الأنواع كلِّها يُرمى لا يُعرض خطّاً فارغاً', threw);

group('المسار');
const db = freshDatabase();
const now = Math.floor(Date.now() / 1000);
db.prepare(`INSERT INTO clients (id, full_name, created_at, updated_at) VALUES ('c', 'س', ?, ?)`).run(now, now);
db.prepare(
  `INSERT INTO cases (id, case_number, case_type, client_id, client_name, created_at, updated_at) VALUES
     ('k1', 'ق-1', 't', 'c', 'س', ?, ?), ('k2', 'ق-2', 't', 'c', 'س', ?, ?)`,
).run(now, now, now, now);
db.prepare(
  `INSERT INTO basecamp_projects (project_id, name, app_url, status, kind, case_id, created_at, updated_at)
   VALUES ('101', 'م', 'https://3.basecamp.com/1/projects/101', 'active', 'client', 'k1', ?, ?)`,
).run(now, now);
const env = makeEnv(db);
const reader = { permissions: { cases: { read: true } } };

calls = [];
globalThis.fetch = async (url) => { calls.push(url); return respond([]); };
let res = await caseTimeline(env, reader, 'k2');
check('قضيةٌ بلا مشروعٍ لا تنادي بيسكامب', (await bodyOf(res)).data.linked === false && calls.length === 0);

res = await caseTimeline(env, reader, 'k1');
const data = (await bodyOf(res)).data;
check('وبلا ربطٍ قائمٍ يُقال سببُه', data.linked === true && data.error === 'not_configured', data);

res = await caseTimeline(env, { permissions: {} }, 'k1');
check('ومن لا يقرأ القضايا لا يقرؤه', res.status === 403);

/* والخبيئة: ما خُبّئ يُردّ بلا نداء. */
await env.AUTH_KV.put('bc-timeline:101', JSON.stringify({ events: [{ id: 'z', label: 'مهمة', at: 'x' }], partial: false }));
calls = [];
res = await caseTimeline(env, reader, 'k1');
const cached = (await bodyOf(res)).data;
check('والمخبَّأُ يُردّ بلا نداء', cached.cached === true && cached.events[0].id === 'z' && calls.length === 0, cached);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
