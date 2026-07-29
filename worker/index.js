// نقطة دخول المنصة — Worker واحد يحمل الحارس والمسارات والأصول الساكنة.
//
// وترتيب هذا الملفّ هو الحراسة نفسها: ما قبل `authenticate` مكشوف، وما
// بعده محميّ. فكل مسارٍ يُضاف يقع بعده ما لم يُقصد غير ذلك صراحةً.

import { authenticate, handleBackchannelLogout, handleCallback, handleLogout } from 'naf-auth';

import { platformConfig } from '../functions/_lib/config.js';
import { readMember, serveFile, uploadFile } from '../functions/_lib/handlers.js';

const FILES_PREFIX = '/api/files/';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const config = platformConfig(env);

    /* ═══ مسارات الدخول تسبق الحارس ═══
       الثلاثة في `DEFAULT_PUBLIC_PATHS` داخل الحزمة، فلو تركناها له
       لمرّت عامّةً ثم لم يعالجها أحد. وحراسةُ إشعار الخروج الخلفي توقيعُ
       المركز لا جلسةُ متصفّح — المنادي خادمٌ ولا كوكي معه — وهو يفحص
       طريقته بنفسه ويردّ ٤٠٥ على غير POST. */
    if (url.pathname === '/auth/callback') {
      return handleCallback(request, env, config);
    }
    if (url.pathname === '/auth/backchannel-logout') {
      return handleBackchannelLogout(request, env, config);
    }
    if (url.pathname === '/auth/logout') {
      if (request.method !== 'POST') {
        return Response.json({ ok: false, error: 'method_not_allowed' }, {
          status: 405,
          headers: { allow: 'POST' },
        });
      }
      return handleLogout(request, env, config);
    }

    /* ═══ الحارس ═══
       يعيد إمّا ردّاً جاهزاً — تحويلةً إلى المركز أو رفضاً أو ٤٠١ — وإمّا
       العضو. والتحقّق من الرمز يقع في كل طلب محميّ لا عند الاستقبال وحده،
       فمن أُوقف مركزياً لا يبقى داخلاً ما بقي كوكيه. */
    const result = await authenticate(request, env, config);
    if (result.response) return result.response;

    /* مسارٌ عامّ: `‎/denied` و`‎/health` والأصول. ولا عضو معه. */
    if (result.public) {
      if (url.pathname === '/health') {
        return Response.json({ ok: true });
      }
      return env.ASSETS.fetch(request);
    }

    const user = result.user;

    if (url.pathname === '/api/me' && request.method === 'GET') {
      return readMember(env, user);
    }
    if (url.pathname === '/api/files' && request.method === 'POST') {
      return uploadFile(request, env, user);
    }
    if (url.pathname.startsWith(FILES_PREFIX) && request.method === 'GET') {
      return serveFile(env, url.pathname.slice(FILES_PREFIX.length));
    }

    /* مسارٌ تحت `‎/api/` لا معالج له يُردّ JSON لا صفحة: من ناداه `fetch`
       ينتظر JSON، وصفحةُ الواجهة تُسقط تحليله بخطأ لا صلة له بالسبب. */
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    /* وما بقي واجهةٌ: الأصول، وكلُّ مسارٍ آخر يعود `index.html` بحكم
       `not_found_handling` — فتوجيهُ اللوحة في المتصفّح كما كان. */
    return env.ASSETS.fetch(request);
  },
};
