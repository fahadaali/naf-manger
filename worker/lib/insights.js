// استبصارات التحليلات — Workers AI داخل الـWorker نفسه.
//
// ═══ لماذا Workers AI لا مزوّدٌ خارجي ═══
//
// الاستدلال يقع على شبكة Cloudflare نفسها التي تحمل المنصة وقاعدتَها:
// لا مفتاحَ مزوّدٍ يُدار ولا يُسرَّب، ولا رحلةَ خروجٍ إلى طرفٍ ثالث. وهو
// ارتباطٌ `[ai]` في `wrangler.toml` لا سرّ.
//
// ═══ وما يُرسَل إلى الطراز ═══
//
// **أرقامٌ مجمَّعة وحدها.** لا اسمَ عميل، ولا رقمَ هوية، ولا رقمَ قضية،
// ولا بريدَ أحد، ولا مبلغاً منسوباً إلى شخص. الخلاصةُ في `buildDigest`
// أدناه هي كلُّ ما يخرج — تُقرأ في سطرٍ واحد ويُرى فيها كلُّ حقل.
//
// وذلك شرطٌ لا تحسين: مكتبُ محاماة، وأسماءُ موكّليه وقضاياهم لا تُمرَّر
// إلى استدلالٍ لتُصاغ منها جملة. والأرقامُ تكفي لما يُطلب: أين يتسرّب
// المحتملون، وأيُّ نوعِ قضايا يربح، وأيُّ شهرٍ تراجع.

const fail = (error, status) => Response.json({ ok: false, error }, { status });

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * الطراز الافتراضي — والعربية من لغاته المعلنة رسمياً، وهو شرطٌ في منصةٍ
 * عربية كلِّها. ويُبدَّل من `AI_MODEL` في `wrangler.toml` بلا نشرِ شيفرة،
 * وهذا السطر شبكةُ أمانٍ لو غاب المتغيّر لا مكانَ الاختيار.
 */
const DEFAULT_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

/* الخبيئة تُقرأ ما دامت البصمة مطابقة. والمهلة حدٌّ أعلى لا شرطُ صحّة:
   أرقامٌ لم تتبدّل منذ أسبوع استبصارُها قائم، لكن نصّاً يبقى شهراً يشيخ. */
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * خلاصةُ الأرقام — وهي كلُّ ما يُمرَّر إلى الطراز.
 *
 * تُحسب في القاعدة بستّة استعلامات مجمَّعة، لا بجلب الجداول وعدِّها هنا:
 * مكتبٌ بآلاف القضايا ينقلها كلَّها إلى الـWorker في كل نداء.
 */
async function buildDigest(env) {
  const monthStart = (offset) => {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCMonth(d.getUTCMonth() - offset);
    return Math.floor(d.getTime() / 1000);
  };

  const sixMonthsAgo = monthStart(5);
  const today = new Date().toISOString().slice(0, 10);

  const [clients, prospects, cases, caseTypes, marketers, followUps] = await env.DB.batch([
    env.DB.prepare(`SELECT client_type, status, COUNT(*) n FROM clients GROUP BY client_type, status`),
    env.DB.prepare(`SELECT prospect_status, COUNT(*) n, SUM(COALESCE(expected_value,0)) v FROM prospects GROUP BY prospect_status`),
    env.DB.prepare(`SELECT status, outcome, COUNT(*) n FROM cases GROUP BY status, outcome`),
    env.DB.prepare(
      `SELECT case_type, COUNT(*) n,
              SUM(CASE WHEN outcome = 'won' THEN 1 ELSE 0 END) won,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) done
       FROM cases GROUP BY case_type`,
    ),
    env.DB.prepare(`SELECT status, COUNT(*) n FROM marketers GROUP BY status`),
    env.DB.prepare(
      `SELECT COUNT(*) n FROM prospects WHERE follow_up_date IS NOT NULL AND follow_up_date < ?`,
    ).bind(today),
  ]);

  /* الاتّجاه الشهري: ستّة أشهر بعددٍ لكل شهر. و`strftime` في SQLite يقرأ
     الثواني، والأعمدة `created_at` بها. */
  const [newClients, newCases, newProspects] = await env.DB.batch([
    env.DB.prepare(
      `SELECT strftime('%Y-%m', created_at, 'unixepoch') m, COUNT(*) n FROM clients
       WHERE created_at >= ? GROUP BY m ORDER BY m`,
    ).bind(sixMonthsAgo),
    env.DB.prepare(
      `SELECT strftime('%Y-%m', created_at, 'unixepoch') m, COUNT(*) n FROM cases
       WHERE created_at >= ? GROUP BY m ORDER BY m`,
    ).bind(sixMonthsAgo),
    env.DB.prepare(
      `SELECT strftime('%Y-%m', created_at, 'unixepoch') m, COUNT(*) n FROM prospects
       WHERE created_at >= ? GROUP BY m ORDER BY m`,
    ).bind(sixMonthsAgo),
  ]);

  const byMonth = (rows) =>
    Object.fromEntries((rows.results ?? []).map((r) => [r.m, r.n]));

  const clientsByType = {};
  let totalClients = 0;
  for (const row of clients.results ?? []) {
    clientsByType[row.client_type] = (clientsByType[row.client_type] ?? 0) + row.n;
    totalClients += row.n;
  }

  const prospectsByStatus = {};
  let totalProspects = 0;
  let expectedValueHalalas = 0;
  for (const row of prospects.results ?? []) {
    prospectsByStatus[row.prospect_status] = row.n;
    totalProspects += row.n;
    expectedValueHalalas += row.v ?? 0;
  }

  const casesByStatus = {};
  let totalCases = 0;
  let completed = 0;
  let won = 0;
  let lost = 0;
  for (const row of cases.results ?? []) {
    casesByStatus[row.status] = (casesByStatus[row.status] ?? 0) + row.n;
    totalCases += row.n;
    if (row.status === 'completed') completed += row.n;
    if (row.outcome === 'won') won += row.n;
    if (row.outcome === 'lost') lost += row.n;
  }

  const marketersByStatus = {};
  for (const row of marketers.results ?? []) marketersByStatus[row.status] = row.n;

  return {
    العملاء: { الإجمالي: totalClients, حسب_النوع: clientsByType },
    المحتملون: {
      الإجمالي: totalProspects,
      حسب_الحالة: prospectsByStatus,
      // ريالات لا هللات: العمود يخزّن هللاتٍ عدداً صحيحاً.
      القيمة_المتوقعة_ريال: Math.round(expectedValueHalalas / 100),
      متأخرو_المتابعة: followUps.results?.[0]?.n ?? 0,
    },
    القضايا: {
      الإجمالي: totalCases,
      حسب_الحالة: casesByStatus,
      المكتملة: completed,
      الرابحة: won,
      الخاسرة: lost,
      معدل_الربح: completed > 0 ? Math.round((won / completed) * 100) : 0,
      حسب_النوع: (caseTypes.results ?? []).map((r) => ({
        النوع: r.case_type,
        العدد: r.n,
        المكتملة: r.done,
        الرابحة: r.won,
      })),
    },
    المسوّقون: marketersByStatus,
    معدل_التحويل:
      totalClients + totalProspects > 0
        ? Math.round((totalClients / (totalClients + totalProspects)) * 100)
        : 0,
    الاتجاه_الشهري: {
      عملاء_جدد: byMonth(newClients),
      محتملون_جدد: byMonth(newProspects),
      قضايا_جديدة: byMonth(newCases),
    },
  };
}

/** بصمةٌ للخلاصة — مفتاحُ الخبيئة. */
async function hashDigest(digest) {
  const bytes = new TextEncoder().encode(JSON.stringify(digest));
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buffer)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const SYSTEM_PROMPT = `أنت محلّلٌ لمكتب محاماة سعودي. تُعطى أرقاماً مجمَّعة عن العملاء والعملاء المحتملين والقضايا، وتستخرج منها ملاحظاتٍ عملية.

القواعد:
- اكتب بالعربية الفصحى، بجملٍ قصيرة ومباشرة.
- كل ملاحظة تستند إلى رقمٍ في المعطيات وتذكره. ولا تخترع رقماً ليس فيها.
- لا تذكر أسماء أشخاص — المعطيات لا تحمل أسماء أصلاً.
- إن كانت المعطيات قليلة فقل ذلك بدل أن تستنتج منها.
- الأرقام غربية (123) لا هندية.

أعِد JSON فقط، بلا أي نصٍّ قبله أو بعده، بهذا الشكل:
{"insights":[{"title":"عنوان قصير","body":"شرحٌ في جملتين يذكر الرقم","tone":"info|warning|opportunity","action":"إجراءٌ مقترح في سطر"}]}

من ثلاث إلى خمس ملاحظات. و tone: "warning" لما يحتاج تدخّلاً، و"opportunity" لفرصةٍ ظاهرة، و"info" لما هو وصفٌ مفيد.`;

/* الردّ يُنقّى قبل التحليل: الطُّرز تُحيط JSON بسياجٍ ```json أو تسبقه
   بجملة، ومحلِّلٌ صارم يسقط على ذلك ويُضيع نتيجةً صالحة. */
function parseInsights(text) {
  if (typeof text !== 'string') return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let parsed;
  try {
    parsed = JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }

  const list = Array.isArray(parsed?.insights) ? parsed.insights : null;
  if (!list) return null;

  const TONES = ['info', 'warning', 'opportunity'];
  const clean = list
    .map((item) => ({
      title: String(item?.title ?? '').trim().slice(0, 120),
      body: String(item?.body ?? '').trim().slice(0, 600),
      tone: TONES.includes(item?.tone) ? item.tone : 'info',
      action: String(item?.action ?? '').trim().slice(0, 300),
    }))
    .filter((item) => item.title && item.body)
    .slice(0, 6);

  return clean.length ? clean : null;
}

/**
 * الاستبصارات.
 *
 * `refresh=1` يتخطّى الخبيئة — لمن أراد إعادة القراءة بعد تبديلٍ لا يظهر
 * في الأرقام (تصحيحُ حالةِ قضية مثلاً يبدّل البصمة، لكن قد يريد صياغةً أخرى).
 */
export async function readInsights(request, env, user, url) {
  if (!user.permissions?.analytics?.read) return fail('forbidden', 403);

  /* الارتباط غائبٌ يعني أن الميزة لم تُنشر بعد — رمزٌ مسجَّل تقرؤه الشاشة
     وتقول «غير مربوط»، لا خطأُ خادمٍ يوهم أن العطل عارض. */
  if (!env.AI) return fail('not_connected', 503);

  const digest = await buildDigest(env);
  const hash = await hashDigest(digest);
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const refresh = url.searchParams.get('refresh') === '1';

  if (!refresh) {
    const cached = await env.DB.prepare(
      `SELECT payload, digest, model, created_at FROM ai_insights WHERE digest_hash = ?`,
    )
      .bind(hash)
      .first();

    if (cached && nowSeconds() - cached.created_at < MAX_AGE_SECONDS) {
      return Response.json({
        ok: true,
        data: {
          insights: JSON.parse(cached.payload),
          digest: JSON.parse(cached.digest),
          model: cached.model,
          generatedAt: cached.created_at,
          cached: true,
        },
      });
    }
  }

  let output;
  try {
    output = await env.AI.run(model, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(digest) },
      ],
      max_tokens: 1200,
      temperature: 0.2,
    });
  } catch (error) {
    console.error('Workers AI: تعذّر الاستدلال —', error?.message ?? error);
    return fail('inference_failed', 502);
  }

  /* شكلُ الردّ يختلف بين طرازٍ وآخر: نصٌّ في `response` غالباً، وقد يأتي
     ملفوفاً. والقراءةُ تحتمل الشكلين بدل أن تفترض واحداً. */
  const text = typeof output === 'string' ? output : (output?.response ?? output?.result?.response);
  const insights = parseInsights(text);

  if (!insights) {
    console.error('Workers AI: ردٌّ لا يُقرأ JSON');
    return fail('unreadable_response', 502);
  }

  const createdAt = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO ai_insights (digest_hash, payload, digest, model, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(digest_hash) DO UPDATE SET payload = excluded.payload,
                                            digest = excluded.digest,
                                            model = excluded.model,
                                            created_at = excluded.created_at`,
  )
    .bind(hash, JSON.stringify(insights), JSON.stringify(digest), model, createdAt)
    .run();

  return Response.json({
    ok: true,
    data: { insights, digest, model, generatedAt: createdAt, cached: false },
  });
}
