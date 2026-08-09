// غلافُ نداء واجهة بيسكامب.
//
// ثلاثةُ أشياء تُلزمها الواجهة ويسقط من أهملها:
//
// ١) **ترويسة `User-Agent` باسمٍ وبريد.** بيسكامب تردّ ٤٠٣ على من لا يعرّف
//    نفسه، ورسالتُها لا تقول إنّ العلّة ترويسةٌ ناقصة.
// ٢) **حدُّ ٥٠ نداءً كلّ ١٠ ثوانٍ لكل عنوان.** وتجاوزُه ٤٢٩ ومعه
//    `Retry-After` بالثواني. ومسحُ خمسين مشروعاً يقرأ لكلٍّ مستنداتِه —
//    فالحدُّ يُبلَغ فعلاً لا نظرياً.
// ٣) **التصفّح بترويسة `Link`** (RFC 5988) لا ببناء `?page=` باليد: الشكل
//    يخصّ بيسكامب وقد يتبدّل، والترويسة عقدُها المعلن.

const API_ROOT = 'https://3.basecampapi.com';

/* اسمٌ وبريدٌ في `User-Agent` — تطلبهما بيسكامب صراحةً لتعرف من ينادي.
   والبريد بريدُ المنصة لا بريدَ عضوٍ بعينه. */
const USER_AGENT = 'NAF Manager (support@naflaw.sa)';

/** أعلى ما يُنتظر عند ٤٢٩، بالثواني. وما زاد يُقرأ خطأً لا انتظاراً. */
const MAX_RETRY_WAIT = 30;

/** كم مرّةً يُعاد النداء الواحد قبل أن يُسلَّم بسقوطه. */
const MAX_ATTEMPTS = 3;

const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

/* ═══ التقطيع قبل الحدّ لا بعده ═══

   الحدّ ٥٠ نداءً كلّ ١٠ ثوانٍ. ومسحُ خمسين مشروعاً يقرأ لكلٍّ أدواتِه ثمّ
   مستنداتِه — مئةٌ ونيّف من النداءات. فبلوغُ الحدّ حتمي.

   والانتظارُ عند ٤٢٩ علاجٌ بعد وقوعٍ يضيّع رحلةً كاملة. فيُقطَّع النداءُ
   قبله: نافذةٌ منزلقة تُبقيه تحت ٤٠ — هامشٌ دون الحدّ، لأنّ الحدّ لكل
   عنوانٍ لا لكل Worker، وقد يشاركنا فيه نداءٌ آخر من العُقدة نفسها. */
const WINDOW_SECONDS = 10;
const WINDOW_LIMIT = 40;
let recentCalls = [];

async function pace() {
  const now = Date.now();
  recentCalls = recentCalls.filter((at) => now - at < WINDOW_SECONDS * 1000);

  if (recentCalls.length >= WINDOW_LIMIT) {
    const oldest = recentCalls[0];
    const wait = (WINDOW_SECONDS * 1000 - (now - oldest)) / 1000;
    if (wait > 0) await sleep(wait);
    recentCalls = recentCalls.filter((at) => Date.now() - at < WINDOW_SECONDS * 1000);
  }

  recentCalls.push(Date.now());
}

export class BasecampError extends Error {
  constructor(code, status) {
    super(`basecamp: ${code} (${status ?? '—'})`);
    this.code = code;
    this.status = status ?? null;
  }
}

/**
 * نداءٌ واحد — يعالج ٤٢٩ و٥xx بإعادةٍ متباعدة، ويردّ الباقي كما هو.
 *
 * و٤٠١ لا يُعاد: رمزٌ منتهٍ لا يصلحه انتظار، وعلاجُه التجديد في الطبقة
 * التي تملك الرمز لا هنا.
 */
async function callOnce(url, token, attempt) {
  await pace();

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      'user-agent': USER_AGENT,
      accept: 'application/json',
    },
  });

  if (response.status === 401) throw new BasecampError('unauthorized', 401);
  if (response.status === 403) throw new BasecampError('forbidden', 403);
  if (response.status === 404) throw new BasecampError('not_found', 404);

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= MAX_ATTEMPTS) {
      throw new BasecampError(response.status === 429 ? 'rate_limited' : 'provider_failed', response.status);
    }
    /* `Retry-After` بالثواني حين تُرسله. وحين لا تُرسله — أو ترسل قيمةً
       لا تُقرأ — يُتراجع تصاعدياً: ٢ ثمّ ٤. */
    const advertised = Number(response.headers.get('retry-after'));
    const wait = Number.isFinite(advertised) && advertised > 0
      ? Math.min(advertised, MAX_RETRY_WAIT)
      : 2 ** attempt;
    await sleep(wait);
    return null; // إشارةُ «أعِد»
  }

  if (!response.ok) throw new BasecampError('provider_failed', response.status);
  return response;
}

/** نداءٌ يردّ الردّ بعد استيفاء الإعادات. */
export async function call(accountId, token, path) {
  const url = path.startsWith('http') ? path : `${API_ROOT}/${accountId}${path}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await callOnce(url, token, attempt);
    if (response) return response;
  }
  throw new BasecampError('rate_limited', 429);
}

/** نداءٌ يردّ JSON. */
export async function getJson(accountId, token, path) {
  const response = await call(accountId, token, path);
  return response.json();
}

/**
 * عنوانُ الصفحة التالية من ترويسة `Link`.
 *
 * الشكل: `<https://…?page=2>; rel="next"` وقد تحمل الترويسة أكثرَ من وصلة
 * مفصولةً بفواصل — فيُلتقط ما `rel` فيه `next` وحده.
 */
export function nextLink(header) {
  if (!header) return null;
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (match) return match[1];
  }
  return null;
}

/**
 * يجمع صفحاتِ مسردٍ كلَّها.
 *
 * و`limit` سقفٌ للصفحات لا للصفوف: حسابٌ ضخمٌ أو ترويسةٌ دائرية تجعل
 * الحلقة لا تنتهي، والـWorker له حدُّ زمن. وبلوغُ السقف يُقال في السجلّ
 * ولا يُبتلع — «قرأتُ كلَّ شيء» و«توقّفتُ عند حدّ» لا يستويان.
 */
export async function listAll(accountId, token, path, { maxPages = 20 } = {}) {
  const items = [];
  let target = path;
  let pages = 0;

  while (target && pages < maxPages) {
    const response = await call(accountId, token, target);
    const page = await response.json();
    if (Array.isArray(page)) items.push(...page);
    target = nextLink(response.headers.get('link'));
    pages++;
  }

  if (target) {
    console.warn('Basecamp: بلغ المسرد سقف الصفحات ولم يكتمل —', path);
  }

  return { items, complete: !target };
}
