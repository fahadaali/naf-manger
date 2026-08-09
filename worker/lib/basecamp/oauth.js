// تصريحُ بيسكامب — OAuth 2 بتدفّق `web_server`.
//
// ═══ لماذا تدفّقٌ ببشرٍ في الوسط ═══
//
// بيسكامب لا تصدر رموزاً خادمٍ-إلى-خادم كما يفعل Zoom. فلا سبيل إلى
// قراءة الحساب إلا أن يفتح صاحبُه صفحةَ التصريح مرّةً ويأذن. وبعدها
// يعيش الإذن برمز تجديد، ويُجدَّد رمزُ الوصول آلياً بلا فتحِ شيء.
//
// ورمزُ الوصول يعيش أسبوعين، فيُجدَّد قبل انتهائه بساعة — لا عنده: مزامنةٌ
// تبدأ ورمزُها على وشك الانتهاء تسقط في منتصفها.

import { open, seal } from './secrets.js';

const LAUNCHPAD = 'https://launchpad.37signals.com';

/** مهلةُ `state` في الخبيئة — دقائقُ تكفي لصفحة إذن، ولا تبقى ذخيرةً. */
const STATE_TTL = 600;

/** يُجدَّد قبل الانتهاء بساعة. */
const RENEW_MARGIN = 3600;

const KV_PREFIX = 'basecamp:state:';

/** هل ضُبطت أسرارُ التطبيق؟ غيابُ أحدها غيابُ الربط. */
export function credentials(env) {
  const clientId = env.BASECAMP_CLIENT_ID;
  const clientSecret = env.BASECAMP_CLIENT_SECRET;
  const tokenKey = env.BASECAMP_TOKEN_KEY;
  if (!clientId || !clientSecret || !tokenKey) return null;
  return { clientId, clientSecret, tokenKey };
}

/** عنوانُ العودة يُشتقّ من عنوان الطلب لا يُكتب ثابتاً: نطاقُ الاختبار غيرُ نطاق الإنتاج. */
export const redirectUri = (url) => `${url.origin}/api/basecamp/callback`;

/**
 * رابطُ صفحة الإذن، ومعه `state` عشوائيٌّ يُحفظ في الخبيئة.
 *
 * و`state` ليس زينة: بدونه يستطيع موقعٌ خبيث أن يقود متصفّح المسؤول إلى
 * مسار العودة برمزِ تصريحٍ لحسابِ بيسكامب يملكه المهاجم — فيُربط حسابُ
 * المكتب بحسابٍ غريب. والمقارنةُ عند العودة تمنع ذلك.
 */
export async function beginAuthorization(env, url, userId) {
  const config = credentials(env);
  if (!config) return null;

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const state = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await env.AUTH_KV.put(`${KV_PREFIX}${state}`, userId, { expirationTtl: STATE_TTL });

  const target = new URL(`${LAUNCHPAD}/authorization/new`);
  target.searchParams.set('type', 'web_server');
  target.searchParams.set('client_id', config.clientId);
  target.searchParams.set('redirect_uri', redirectUri(url));
  target.searchParams.set('state', state);
  return target.toString();
}

/** يستهلك `state` مرّةً واحدة — ويردّ من بدأه. */
export async function consumeState(env, state) {
  if (!state) return null;
  const key = `${KV_PREFIX}${state}`;
  const userId = await env.AUTH_KV.get(key);
  if (userId) await env.AUTH_KV.delete(key);
  return userId;
}

/** مبادلةُ رمز التصريح برمزَي وصولٍ وتجديد. */
export async function exchangeCode(env, url, code) {
  const config = credentials(env);
  if (!config) return null;

  const target = new URL(`${LAUNCHPAD}/authorization/token`);
  target.searchParams.set('type', 'web_server');
  target.searchParams.set('client_id', config.clientId);
  target.searchParams.set('client_secret', config.clientSecret);
  target.searchParams.set('redirect_uri', redirectUri(url));
  target.searchParams.set('code', code);

  const response = await fetch(target, { method: 'POST' });
  if (!response.ok) {
    /* لا يُسجَّل الجسم: قد يحمل صدى السرّ أو الرمز. والحالة تكفي للتشخيص. */
    console.error('Basecamp: تعذّرت مبادلة الرمز —', response.status);
    return null;
  }
  return response.json();
}

/** رمزٌ جديد برمز التجديد. */
async function refresh(env, refreshToken) {
  const config = credentials(env);
  if (!config) return null;

  const target = new URL(`${LAUNCHPAD}/authorization/token`);
  target.searchParams.set('type', 'refresh');
  target.searchParams.set('refresh_token', refreshToken);
  target.searchParams.set('client_id', config.clientId);
  target.searchParams.set('client_secret', config.clientSecret);

  const response = await fetch(target, { method: 'POST' });
  if (!response.ok) {
    console.error('Basecamp: تعذّر تجديد الرمز —', response.status);
    return null;
  }
  return response.json();
}

/** أيُّ حسابٍ يملكه هذا الرمز — يُنادى مرّةً عند الربط. */
export async function identify(accessToken) {
  const response = await fetch(`${LAUNCHPAD}/authorization.json`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'NAF Manager (support@naflaw.sa)',
      accept: 'application/json',
    },
  });
  if (!response.ok) {
    console.error('Basecamp: تعذّرت قراءة الهوية —', response.status);
    return null;
  }

  const payload = await response.json();
  /* حساباتُ `bc3` وحدها: الحساب القديم (`bcx`) واجهتُه أخرى، وربطُه هنا
     يسقط عند أول نداء برسالةٍ لا تقول السبب. */
  const account = (payload.accounts ?? []).find((entry) => entry.product === 'bc3');
  if (!account) return null;
  return { accountId: String(account.id), accountName: account.name ?? '' };
}

/** يحفظ الاتّصال — صفٌّ واحد يُكتب فوقه. */
export async function saveConnection(env, { accountId, accountName, tokens, userId }) {
  const config = credentials(env);
  if (!config) return false;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + Number(tokens.expires_in ?? 1209600);

  const [access, refreshSealed] = await Promise.all([
    seal(config.tokenKey, tokens.access_token),
    seal(config.tokenKey, tokens.refresh_token),
  ]);

  await env.DB.prepare(
    `INSERT INTO basecamp_connection
       (id, account_id, account_name, access_token, refresh_token, expires_at,
        connected_by, connected_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET account_id    = excluded.account_id,
                                   account_name  = excluded.account_name,
                                   access_token  = excluded.access_token,
                                   refresh_token = excluded.refresh_token,
                                   expires_at    = excluded.expires_at,
                                   connected_by  = excluded.connected_by,
                                   connected_at  = excluded.connected_at,
                                   last_sync_error = NULL`,
  )
    .bind(accountId, accountName, access, refreshSealed, expiresAt, userId, now)
    .run();

  return true;
}

/**
 * الاتّصال جاهزاً للاستعمال: `{ accountId, accountName, token }`.
 *
 * يجدّد الرمزَ عند اللزوم ويحفظ الجديد. ويردّ `null` مع سببٍ مقروء حين
 * لا يكون هناك ربطٌ صالح — والشاشة تترجم السبب بدل أن تقول «تعذّر».
 */
export async function activeConnection(env) {
  const config = credentials(env);
  if (!config) return { error: 'not_configured' };

  const row = await env.DB.prepare(
    `SELECT account_id, account_name, access_token, refresh_token, expires_at, sync_enabled
     FROM basecamp_connection WHERE id = 1`,
  ).first();
  if (!row) return { error: 'not_connected' };

  const now = Math.floor(Date.now() / 1000);

  if (row.expires_at - now > RENEW_MARGIN) {
    const token = await open(config.tokenKey, row.access_token);
    /* تعذُّرُ الفكّ يعني مفتاحاً بُدِّل — والرمز المحفوظ صار حرفاً لا يُقرأ.
       فيُطلَب ربطٌ جديد صراحةً، لا يُترك النداءُ يسقط ٤٠١ فيبدو عطلَ شبكة. */
    if (!token) return { error: 'key_changed' };
    return {
      accountId: row.account_id,
      accountName: row.account_name,
      token,
      syncEnabled: row.sync_enabled === 1,
    };
  }

  const refreshToken = await open(config.tokenKey, row.refresh_token);
  if (!refreshToken) return { error: 'key_changed' };

  const renewed = await refresh(env, refreshToken);
  if (!renewed?.access_token) return { error: 'refresh_failed' };

  /* بيسكامب قد لا تردّ رمزَ تجديدٍ جديداً — والقديم يبقى صالحاً حينئذٍ.
     فحفظُ `undefined` مكانَه يقطع الربط في المرّة التالية. */
  const nextRefresh = renewed.refresh_token ?? refreshToken;
  const expiresAt = now + Number(renewed.expires_in ?? 1209600);

  const [access, refreshSealed] = await Promise.all([
    seal(config.tokenKey, renewed.access_token),
    seal(config.tokenKey, nextRefresh),
  ]);

  await env.DB.prepare(
    `UPDATE basecamp_connection
     SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = 1`,
  )
    .bind(access, refreshSealed, expiresAt)
    .run();

  return {
    accountId: row.account_id,
    accountName: row.account_name,
    token: renewed.access_token,
    syncEnabled: row.sync_enabled === 1,
  };
}
