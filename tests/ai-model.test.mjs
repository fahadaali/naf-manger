/* ═══ نداءُ الطراز ═══
 *
 * ما يُحرَس هنا: مع المفتاح يُنادى Claude بطرازِ مستواه — Haiku للسريع
 * وSonnet للكاتب — بلا حرارة؛ وبلا مفتاحٍ يُستعمل Workers AI؛ وسقوطُ Claude
 * يعود إليه؛ والرفضُ والسقوطُ `null` لا رمي.
 */
let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { complete, modelInfo, modelAvailable } = await import('../worker/lib/ai/model.js');

let sent = [];
let reply = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'جواب' }] };
let status = 200;
globalThis.fetch = async (url, init) => {
  sent.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
  return new Response(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'x', usage: {}, ...reply }), {
    status, headers: { 'content-type': 'application/json' },
  });
};
let workers = 0;
const AI = { run: async () => { workers++; return { response: 'من Workers' }; } };

group('المستويان');
const env = { ANTHROPIC_API_KEY: 'sk-test', AI };
let text = await complete(env, { tier: 'fast', system: 'نظام', user: 'سؤال', maxTokens: 50 });
check('السريعُ على Haiku', sent[0]?.body.model === 'claude-haiku-5-5' && text === 'جواب', sent[0]?.body);
check('والنظامُ والسؤالُ في مكانهما',
  sent[0].body.system === 'نظام' && sent[0].body.messages[0].content === 'سؤال' && sent[0].body.max_tokens === 50);
check('بلا حرارة', !('temperature' in sent[0].body));

sent = [];
text = await complete(env, { tier: 'write', system: 'نظام', user: 'صغ', maxTokens: 300 });
check('والكاتبُ على Sonnet', sent[0]?.body.model === 'claude-sonnet-5-5' && text === 'جواب', sent[0]?.body);
check('ومعه الاحتياطُ عند الرفض', sent[0]?.body.fallbacks === 'default');
check('والنموذجُ يُبدَّل بمتغيّر',
  modelInfo({ ANTHROPIC_API_KEY: 'k', AI_MODEL_WRITE: 'claude-opus-5-5' }, 'write').model === 'claude-opus-5-5');

group('الاحتياط');
sent = [];
workers = 0;
text = await complete({ AI }, { system: 'س', user: 'ص' });
check('بلا مفتاحٍ يُستعمل Workers AI', text === 'من Workers' && workers === 1 && sent.length === 0);

status = 500;
workers = 0;
text = await complete(env, { system: 'س', user: 'ص' });
check('وسقوطُ Claude يعود إلى Workers AI', text === 'من Workers' && workers === 1, { text, workers });

text = await complete({ ANTHROPIC_API_KEY: 'k' }, { system: 'س', user: 'ص' });
check('وبلا احتياطٍ يُردّ null لا يُرمى', text === null);

status = 200;
reply = { stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [] };
text = await complete({ ANTHROPIC_API_KEY: 'k' }, { system: 'س', user: 'ص' });
check('والرفضُ null', text === null);

check('ولا طرازَ بلا مفتاحٍ ولا ارتباط', !modelAvailable({}) && (await complete({}, { system: 's', user: 'u' })) === null);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
