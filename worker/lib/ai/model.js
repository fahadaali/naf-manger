// نداءُ الطراز — واحدٌ لكلّ ما في المنصة من ذكاءٍ اصطناعي.
//
// ═══ مستويان ═══
//
//   `fast`  — Claude Haiku: ربطُ دفعات وافق، والتصنيف، واستخراجُ الحقول،
//             واقتراحُ ربط العناوين، وفهمُ الألفاظ. أسئلةٌ مغلقة قصيرة.
//   `write` — Claude Sonnet: ملخّصُ القضية والعميل، والموضوعُ المقترح،
//             والاستبصارات. صياغةٌ عربية يقرؤها المحامي.
//
// ═══ والاحتياط ═══
//
// بلا `ANTHROPIC_API_KEY` يعود النداءُ إلى Workers AI (ارتباط `[ai]`) كما كان
// — فلا يتعطّل شيءٌ قبل إضافة المفتاح، ولا بعد سقوطٍ عارض. والطرازان
// يُبدَّلان بلا نشر شيفرة: `AI_MODEL_FAST` و`AI_MODEL_WRITE`.
//
// ═══ وما يخرج ═══
//
// مع المفتاح تخرج النصوصُ إلى Anthropic بدل بقائها في شبكة Cloudflare. وما
// يُمرَّر هو ما كان يُمرَّر: لا رقمَ هويةٍ ولا جوّال (انظر كلَّ مستدعٍ).
//
// ولا يرمي أبداً: كلُّ سقوطٍ يُردّ `null` ويُسجَّل، والمستدعي يقرّر.

import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODELS = { fast: 'claude-haiku-5-5', write: 'claude-sonnet-5-5' };
const WORKERS_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

/** أيُّ طرازٍ متاح؟ — وهو ما تعرضه الشاشات. */
export function modelInfo(env, tier = 'fast') {
  if (env?.ANTHROPIC_API_KEY) {
    const model = (tier === 'write' ? env.AI_MODEL_WRITE : env.AI_MODEL_FAST) || CLAUDE_MODELS[tier] || CLAUDE_MODELS.fast;
    return { provider: 'anthropic', model };
  }
  if (env?.AI) return { provider: 'workers-ai', model: env.AI_MODEL || WORKERS_MODEL };
  return null;
}

export const modelAvailable = (env) => Boolean(env?.ANTHROPIC_API_KEY || env?.AI);

const textOf = (content) =>
  (Array.isArray(content) ? content : [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

async function askClaude(env, { tier, model, system, user, maxTokens }) {
  /* و`fetch` يُمرَّر نداءً متأخّراً: الاختباراتُ تستبدل `globalThis.fetch`. */
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    maxRetries: 1,
    fetch: (...args) => globalThis.fetch(...args),
  });

  /* التفكيرُ مطفأٌ والجهدُ منخفض: أسئلةٌ قصيرةٌ بأجوبةٍ قصيرة، وتفكيرٌ يأكل
     من `max_tokens` يقطع الجوابَ قبل أن يُكتب. وعلى Sonnet يُطفأ بـ
     `between_tools` (و`disabled` يُردّ ٤٠٠ عليه). ولا `temperature`: إصدارُ
     الواجهة الحاليّ يردّها. */
  const response = tier === 'write'
    ? await client.beta.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      thinking: { type: 'between_tools' },
      output_config: { effort: 'low' },
      /* رفضُ مصنِّف الأمان يُعاد على طرازٍ احتياطيّ في النداء نفسِه. */
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    : await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
    });

  if (response.stop_reason === 'refusal') {
    console.error('Claude: رُفض الطلب —', response.stop_details?.category ?? 'بلا تصنيف');
    return null;
  }
  return textOf(response.content) || null;
}

async function askWorkers(env, { system, user, maxTokens, temperature }) {
  const output = await env.AI.run(env.AI_MODEL || WORKERS_MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
    temperature,
  });
  const text = typeof output === 'string' ? output : (output?.response ?? output?.result?.response);
  return typeof text === 'string' ? text : null;
}

/**
 * نداءٌ واحد — نصُّ الجواب أو `null`.
 *
 * و`temperature` لـWorkers AI وحده (Claude بلا حرارة في إصدار الواجهة الحاليّ).
 */
export async function complete(env, { tier = 'fast', system, user, maxTokens = 300, temperature = 0 }) {
  const info = modelInfo(env, tier);
  if (!info) return null;

  if (info.provider === 'anthropic') {
    try {
      const text = await askClaude(env, { tier, model: info.model, system, user, maxTokens });
      if (text !== null) return text;
    } catch (error) {
      console.error('Claude: تعذّر الاستدلال —', error?.status ?? '', error?.message ?? error);
    }
    /* سقوطُ Claude يعود إلى Workers AI إن وُجد: سؤالٌ أُجيب أنفعُ من سؤالٍ سقط. */
    if (!env.AI) return null;
  }

  try {
    return await askWorkers(env, { system, user, maxTokens, temperature });
  } catch (error) {
    console.error('Workers AI: تعذّر الاستدلال —', error?.message ?? error);
    return null;
  }
}
