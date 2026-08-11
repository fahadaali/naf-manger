// التلخيصُ الآليّ عند الاستيراد — Workers AI داخل الـWorker نفسه.
//
// ═══ ما يُمرَّر إلى الطراز، وما لا يُمرَّر ═══
//
// شاشةُ التحليلات (`lib/insights.js`) لا تُمرِّر إلا أرقاماً مجمَّعة: لا
// اسمَ موكّلٍ ولا نصَّ قضية. وهذا الملفّ **يُمرِّر نصَّ القضية** — لأنّ
// المطلوب تلخيصُه، ولا يُلخَّص ما لا يُقرأ. وهو تبدّلٌ في نطاق ما يخرج،
// فيُقال صراحةً هنا وفي README وفي الشاشة، ولا يُكتشف من الشيفرة.
//
// والاستدلال على شبكة Cloudflare نفسِها التي تحمل القاعدة — ارتباط `[ai]`
// لا مفتاحُ مزوّدٍ خارجيّ ولا رحلةُ خروج. ويُطفأ من الشاشة متى شاء صاحبُ
// المكتب.
//
// ولا يُمرَّر ما لا يُحتاج إليه: **رقمُ الهوية لا يخرج**، ولا الجوّال، ولا
// البريد، ولا مبلغُ أتعاب. الاسمُ ونوعُ القضية وموضوعُها وحالتُها — وهي
// ما يُبنى منه ملخّص.
//
// ═══ ولا يُخترع حقل ═══
//
// الطراز يُلخّص ما أُعطي ويقترح نوعاً **من قائمة المكتب وحدها**. ولا يملأ
// اسماً ولا رقماً ولا تاريخاً — تلك بياناتُ موكّلين، تُقرأ بقاعدةٍ تُخطئ
// خطأً ظاهراً أو تصيب (`basecamp/parse.js`)، لا بترجيحٍ يُنتج قيمةً معقولة
// لم تُكتب قطّ.
//
// وسقوطُ الاستدلال لا يُسقط الاستيراد: يُردّ `null` ويمضي، فالقضيةُ تُكتب
// بلا ملخّص — والملخّصُ زينةٌ على بياناتٍ صحيحة، لا شرطٌ لها.

const SETTINGS_KEY = 'ai_import';

/** الطراز نفسُه الذي تستعمله الاستبصارات — والعربيةُ من لغاته المعلنة. */
const DEFAULT_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

/**
 * سقفُ الاستدلالات في الدورة الواحدة.
 *
 * أوّلُ مزامنةٍ على حسابٍ فيه ثلاثمئة مشروع تطلب ثلاثمئة استدلال: تبلغ
 * حدَّ النداءات، وتُطيل الدورة حتى تُقطع. فتُلخَّص دفعةٌ في كل دورة،
 * والباقي في التي تليها — وبصمةُ ما لُخِّص تمنع إعادته. والمتروكُ يُقال
 * في الحصيلة ولا يُبتلع.
 */
export const RUN_BUDGET = 25;

/** حصيلةُ دورة: كم لُخِّص، وكم أُجِّل، وكم سقط. */
export const newBudget = (limit = RUN_BUDGET) => ({
  limit,
  used: 0,
  deferred: 0,
  failed: 0,
  spend() {
    if (this.used >= this.limit) { this.deferred++; return false; }
    this.used++;
    return true;
  },
});

/**
 * أمشغَّلٌ التلخيصُ الآليّ؟
 *
 * والغيابُ يعني «نعم»: الميزةُ تعمل من أوّل نشرة، ويُطفئها من لا يريدها.
 * وغيابُ ارتباط `[ai]` يعني «لا» مهما قال الإعداد — إعدادٌ مفتوحٌ على
 * ارتباطٍ غائب يسقط في كل دورة.
 */
export async function aiEnabled(env) {
  if (!env?.AI) return false;
  const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = ?`)
    .bind(SETTINGS_KEY)
    .first();
  if (!row?.value) return true;
  try {
    return JSON.parse(row.value)?.enabled !== false;
  } catch {
    return true;
  }
}

export async function setAiEnabled(env, enabled, userId) {
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                    updated_by = excluded.updated_by,
                                    updated_at = excluded.updated_at`,
  )
    .bind(SETTINGS_KEY, JSON.stringify({ enabled: enabled === true }), userId,
      Math.floor(Date.now() / 1000))
    .run();
}

/**
 * ═══ البصمةُ على المعنى لا على الحروف ═══
 *
 * بها يُعرف أنّ الملخّص لا يزال على مصدره، فلا يُعاد الاستدلال على ما لم
 * يتبدّل. وهي على **جوهر** النصّ لا على رسمه:
 *
 * محامٍ يفتح الملفّ فيصلح مسافةً، أو يضع فاصلةً، أو يشكّل حرفاً، أو يكتب
 * «إجراءات» بعد «اجراءات» — فتتبدّل الحروفُ ولا يتبدّل المعنى. وبصمةٌ
 * حرفيةٌ تُعيد تلخيصَ الملفّ كلِّه لأجل مسافة، كلَّ ساعة، وتُنتج النصَّ
 * نفسَه.
 *
 * فتُرفع الحركاتُ والتطويل، وتُوحَّد صورُ الألف والياء والتاء المربوطة،
 * وتُطرح علاماتُ الترقيم والمسافاتُ الزائدة. وما بقي بعد ذلك تبدُّلٌ في
 * الكلام نفسِه — وهو وحده يستحقّ صياغةً جديدة.
 */
const meaningful = (text) =>
  String(text ?? '')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[.,،؛;:!؟?"'`()[\]{}«»\-–—_*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export async function fingerprint(value) {
  /* والبنيةُ تُسطَّح بمفاتيحها مرتَّبةً: ترتيبُ الحقول في الكائن ليس من
     المعنى في شيء، وتبدُّلُه يُنتج بصمةً أخرى لنصٍّ واحد. */
  const source = typeof value === 'string'
    ? meaningful(value)
    : Object.keys(value ?? {})
      .sort()
      .map((key) => `${key}=${meaningful(
        typeof value[key] === 'object' ? JSON.stringify(value[key]) : value[key],
      )}`)
      .join('\n');

  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return [...new Uint8Array(buffer)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/* نداءٌ واحد إلى الطراز. ولا يرمي: كلُّ سقوطٍ يُردّ `null` ويُسجَّل. */
async function ask(env, system, user, { maxTokens = 300 } = {}) {
  const model = env.AI_MODEL || DEFAULT_MODEL;
  try {
    const output = await env.AI.run(model, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      /* حرارةٌ منخفضة: المطلوب وصفٌ لما أُعطي لا صياغةٌ بديعة. */
      temperature: 0.1,
    });
    const text = typeof output === 'string'
      ? output
      : (output?.response ?? output?.result?.response);
    return typeof text === 'string' ? text : null;
  } catch (error) {
    console.error('Workers AI: تعذّر التلخيص —', error?.message ?? error);
    return null;
  }
}

/* الطُّرز تُحيط ردَّها بسياجٍ أو تسبقه بمقدّمة — والمقدّمةُ في حقلِ ملفّ
   موكّل ركامٌ يُقرأ كأنه منه. فتُقصّ، ويُقصّ الطول. */
function cleanText(text, limit) {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  let body = (fenced ? fenced[1] : text).trim();

  body = body
    .replace(/^(?:الملخّ?ص|الخلاصة|الجواب|ملخص)\s*[:：]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!body) return null;
  return body.length > limit ? `${body.slice(0, limit).trimEnd()}…` : body;
}

const CASE_SYSTEM = `أنت مساعدٌ في مكتب محاماة سعودي. تُعطى بيانات قضيةٍ واحدة، فتكتب ملخّصاً بالغَ الاختصار يقرؤه المحامي في سطر.

القواعد:
- بالعربية الفصحى، جملتان على الأكثر، وأقلُّ من أربعين كلمة.
- لا تذكر إلا ما في المعطيات. **ولا تخترع اسماً ولا رقماً ولا تاريخاً ولا مبلغاً ولا مادّةً نظامية.**
- إن كانت المعطيات لا تكفي لملخّص فاكتب: لا يكفي ما في الملفّ.
- لا تُصدِّر جوابك بعنوان ولا بمقدّمة، ولا تضع سياجاً حول النصّ.
- لا تُبدِ رأياً في القضية ولا تتوقّع نتيجتَها.`;

/**
 * ملخّصُ قضيةٍ واحدة.
 *
 * ويُعطى الطرازُ ما يُبنى منه ملخّصٌ وحدَه: النوعُ والموضوعُ والحالةُ
 * والنتيجةُ والملاحظات. ولا رقمَ هويةٍ ولا جوّالَ ولا بريدَ ولا أتعاب.
 */
export async function summarizeCase(env, kase) {
  const facts = {
    العميل: kase.clientName || undefined,
    نوع_القضية: kase.caseType || undefined,
    الموضوع: kase.summary || undefined,
    الحالة: kase.status || undefined,
    النتيجة: kase.outcome || undefined,
    الملاحظات: kase.notes || undefined,
  };
  /* بلا موضوعٍ ولا ملاحظاتٍ لا يوجد ما يُلخَّص: النوعُ والحالةُ ظاهران في
     الشاشة، وإعادةُ قولهما جملةً ركامٌ يدفع ثمنَ استدلال. */
  if (!facts.الموضوع && !facts.الملاحظات) return null;

  return cleanText(await ask(env, CASE_SYSTEM, JSON.stringify(facts)), 400);
}

const CLIENT_SYSTEM = `أنت مساعدٌ في مكتب محاماة سعودي. تُعطى قائمةَ قضايا موكّلٍ واحد، فتكتب سطراً أو سطرين يقولان: كم قضية له، وفي أيّ الأنواع، وأين وصلت.

القواعد:
- بالعربية الفصحى، جملتان على الأكثر، وأقلُّ من أربعين كلمة.
- الأعدادُ من المعطيات لا من التقدير، والأرقام غربية (3) لا هندية.
- **لا تخترع قضيةً ولا رقماً ولا تاريخاً**، ولا تذكر ما ليس في القائمة.
- لا تُبدِ رأياً في الموكّل ولا في قضاياه.
- لا تُصدِّر جوابك بعنوان ولا بمقدّمة، ولا تضع سياجاً حول النصّ.`;

/** ملخّصُ قضايا موكّلٍ مجتمعةً. */
export async function summarizeClient(env, client) {
  if (!client.cases?.length) return null;
  const facts = {
    الموكل: client.fullName || undefined,
    نوع_العميل: client.clientType || undefined,
    عدد_القضايا: client.cases.length,
    القضايا: client.cases.map((entry) => ({
      النوع: entry.caseType || undefined,
      الحالة: entry.status || undefined,
      النتيجة: entry.outcome || undefined,
      الموضوع: entry.summary ? String(entry.summary).slice(0, 200) : undefined,
    })),
  };
  return cleanText(await ask(env, CLIENT_SYSTEM, JSON.stringify(facts), { maxTokens: 260 }), 400);
}

const TYPE_SYSTEM = `أنت مصنِّفٌ في مكتب محاماة سعودي. تُعطى نصَّ ملفّ قضية وقائمةَ أنواع القضايا المعتمدة في المكتب، فتختار أقربَها.

القواعد:
- **اختر من القائمة حرفاً بحرف، ولا تقترح نوعاً خارجها.**
- إن لم يترجّح نوعٌ فأجب بكلمة واحدة: لا-أعرف
- أجب بالنوع وحده، بلا شرحٍ ولا مقدّمةٍ ولا علاماتِ ترقيم.`;

/**
 * نوعُ القضية حين يخلو منه الملفّ.
 *
 * ولا يُقترح إلا من قائمة المكتب في «تكوين النظام» — والردُّ يُطابَق بها
 * بعد التوحيد، فما ليس فيها يُردّ `null`. أي أنّ أسوأ ما يقع أن يبقى
 * الحقلُ «غير محدّد» كما كان، لا أن يظهر نوعٌ اخترعه طراز.
 */
export async function suggestCaseType(env, { text, options }) {
  const list = (options ?? []).map((entry) => String(entry ?? '').trim()).filter(Boolean);
  if (!list.length || !String(text ?? '').trim()) return null;

  const answer = await ask(
    env,
    TYPE_SYSTEM,
    JSON.stringify({ الأنواع_المعتمدة: list, نص_الملف: String(text).slice(0, 2000) }),
    { maxTokens: 40 },
  );
  const cleaned = cleanText(answer, 80);
  if (!cleaned) return null;

  /* المطابقةُ بالتوحيد العربي: الطراز قد يردّ «قضيه عماليه» عن «قضية
     عمالية» — وهي هي. وما لا يطابق واحداً من القائمة يُردّ. */
  const normalize = (value) => String(value).replace(/[ً-ْٰ]/g, '').replace(/ـ/g, '')
    .replace(/[آأإٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ').trim().toLowerCase();

  const wanted = normalize(cleaned);
  return list.find((entry) => normalize(entry) === wanted) ?? null;
}
