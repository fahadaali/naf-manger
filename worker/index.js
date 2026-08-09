// نقطة دخول المنصة — Worker واحد يحمل الحارس والمسارات والأصول الساكنة.
//
// وترتيب هذا الملفّ هو الحراسة نفسها: ما قبل `authenticate` مكشوف، وما
// بعده محميّ. فكل مسارٍ يُضاف يقع بعده ما لم يُقصد غير ذلك صراحةً.

import { authenticate, handleBackchannelLogout, handleCallback, handleLogout } from 'naf-auth';

import { platformConfig } from './lib/config.js';
import { readMember, serveFile, updateMe, uploadFile } from './lib/handlers.js';
import { handleResource } from './lib/crud.js';
import { createMeeting, listMeetings } from './lib/meetings.js';
import { readInsights } from './lib/insights.js';
import {
  classifyProject,
  disconnect,
  finishConnect,
  listProjects,
  readSample,
  readStatus,
  rescan,
  startConnect,
} from './lib/basecamp/handlers.js';
import {
  createReport,
  deleteReport,
  listReports,
  previewReport,
  runReport,
  updateReport,
} from './lib/reports.js';
import {
  createDisplayToken,
  deleteDisplayToken,
  listDisplayTokens,
  readDisplayStats,
} from './lib/display.js';
import {
  convertProspect,
  exportAll,
  listMembers,
  readMarketerStats,
  readSettings,
  readStats,
  updateMember,
  writeSettings,
} from './lib/queries.js';

const FILES_PREFIX = '/api/files/';
const DISPLAY_API_PREFIX = '/api/display/';

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

    /* ═══ شاشات العرض تسبق الحارس ═══
       شاشةٌ معلَّقة في ممرّ لا تسجّل دخولاً، فحراستُها رمزٌ في المسار لا
       كوكي. وموضعُ ذلك هنا — قبل `authenticate` — لا في `publicPrefixes`:
       ترتيبُ هذا الملفّ هو الحراسة، وما يُستثنى يُرى فيه لا في إعداد.

       وما يُقرأ به إحصاءاتٌ مجمَّعة وحدها، وقراءةً فقط. التفصيل في
       `lib/display.js`. */
    if (url.pathname.startsWith(DISPLAY_API_PREFIX) && request.method === 'GET') {
      const token = url.pathname.slice(DISPLAY_API_PREFIX.length);
      return readDisplayStats(env, token);
    }
    /* وصفحةُ الشاشة نفسها: `not_found_handling` يعيد `index.html`، واللوحة
       توجّه نفسها منه وتقرأ رمزَها من المسار. */
    if (url.pathname === '/display' || url.pathname.startsWith('/display/')) {
      return env.ASSETS.fetch(request);
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

    if (url.pathname === '/api/me') {
      if (request.method === 'GET') return readMember(env, user);
      /* والكتابة على النفس لا تحتاج تصريحاً: العضو يملك صورتَه وتفضيلاتِ
         إشعاراته. وما لا يملكه — دورَه وحالةَ تفعيله — لا يقبله المعالج
         أصلاً، ومسارُه `‎/api/members/:id‎` وهو محروس. */
      if (request.method === 'PATCH') return updateMe(request, env, user);
    }
    if (url.pathname === '/api/files' && request.method === 'POST') {
      return uploadFile(request, env, user);
    }
    if (url.pathname.startsWith(FILES_PREFIX) && request.method === 'GET') {
      return serveFile(env, url.pathname.slice(FILES_PREFIX.length));
    }

    /* ═══ الموارد ═══
       الأفعالُ الخاصة أوّلاً — لأن `‎/api/prospects/:id/convert` يطابق
       شكلَ المورد كذلك، ولو تُرك له لعُومل `convert` معرّفَ صفّ. */
    const segments = url.pathname.split('/').filter(Boolean); // ['api', name, id, verb]

    if (segments[0] === 'api') {
      const [, name, id, verb] = segments;

      if (name === 'stats' && !id && request.method === 'GET') {
        return readStats(env);
      }
      if (name === 'settings' && !id) {
        if (request.method === 'GET') return readSettings(env);
        if (request.method === 'PATCH' || request.method === 'PUT') {
          return writeSettings(request, env, user);
        }
      }
      if (name === 'members') {
        if (!id && request.method === 'GET') return listMembers(env, user);
        if (id && (request.method === 'PATCH' || request.method === 'PUT')) {
          return updateMember(request, env, user, id);
        }
      }
      /* رموز شاشات العرض — إنشاءً وسرداً وإبطالاً. للمسؤول وحده، والفحص
         في `lib/display.js` لا هنا. (والقراءةُ بالرمز تسبق الحارس أعلاه.) */
      if (name === 'display-tokens') {
        if (!id && request.method === 'GET') return listDisplayTokens(env, user);
        if (!id && request.method === 'POST') return createDisplayToken(request, env, user);
        if (id && request.method === 'DELETE') return deleteDisplayToken(env, user, id);
      }
      /* الاجتماعات — تُنشأ عند Zoom من هنا لا من المتصفّح: سرُّ المزوّد
         لا يُشحن في حزمةٍ يقرؤها كل زائر. */
      if (name === 'meetings' && !id) {
        if (request.method === 'GET') return listMeetings(env, user, url);
        if (request.method === 'POST') return createMeeting(request, env, user);
      }
      /* التقارير المخصّصة. و`preview` و`run` أفعالٌ خاصة تسبق شكلَ المورد
         كما يسبقه `convert` — ولولا ذلك عُومل `preview` معرّفَ صفّ. */
      if (name === 'reports') {
        if (id === 'preview' && !verb && request.method === 'POST') {
          return previewReport(request, env, user);
        }
        if (id && verb === 'run' && request.method === 'GET') return runReport(env, user, id);
        if (!id && request.method === 'GET') return listReports(env, user);
        if (!id && request.method === 'POST') return createReport(request, env, user);
        if (id && !verb && request.method === 'PATCH') return updateReport(request, env, user, id);
        if (id && !verb && request.method === 'DELETE') return deleteReport(env, user, id);
      }
      /* استبصارات التحليلات — Workers AI داخل الـWorker. وما يُمرَّر إليه
         أرقامٌ مجمَّعة وحدها، والتفصيل في `lib/insights.js`. */
      if (name === 'insights' && !id && request.method === 'GET') {
        return readInsights(request, env, user, url);
      }
      /* ═══ بيسكامب ═══
         الاتّجاه واحد: يُقرأ منه ولا يُكتب فيه. وكلُّ ما هنا للمسؤول وحده،
         والفحصُ في `basecamp/handlers.js` لا هنا. و`callback` تحويلُ متصفّح
         لا نداءُ `fetch` — لكنه بعد الحارس كغيره، لأنّ من يعود من صفحة
         الإذن يحمل جلسته. */
      if (name === 'basecamp') {
        if (id === 'status' && request.method === 'GET') return readStatus(env, user);
        if (id === 'connect' && request.method === 'GET') {
          return startConnect(request, env, user, url);
        }
        if (id === 'callback' && request.method === 'GET') {
          return finishConnect(request, env, user, url);
        }
        if (id === 'connection' && request.method === 'DELETE') return disconnect(env, user);
        if (id === 'scan' && request.method === 'POST') return rescan(env, user);
        if (id === 'sample' && request.method === 'GET') return readSample(env, user, url);
        if (id === 'projects' && !verb && request.method === 'GET') return listProjects(env, user);
        if (id === 'projects' && verb && request.method === 'PATCH') {
          return classifyProject(request, env, user, verb);
        }
      }
      if (name === 'export' && !id && request.method === 'GET') {
        return exportAll(env, user);
      }
      if (name === 'prospects' && id && verb === 'convert' && request.method === 'POST') {
        return convertProspect(env, user, id);
      }
      if (name === 'marketers' && id && verb === 'stats' && request.method === 'GET') {
        return readMarketerStats(env, user, id);
      }

      // المسارات العامة للموارد: قائمةٌ أو صفّ. وما زاد على ذلك ليس مساراً.
      if (name && !verb) {
        return handleResource(request, env, user, name, id);
      }

      /* مسارٌ تحت `‎/api/` لا معالج له يُردّ JSON لا صفحة: من ناداه `fetch`
         ينتظر JSON، وصفحةُ الواجهة تُسقط تحليله بخطأ لا صلة له بالسبب. */
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    /* وما بقي واجهةٌ: الأصول، وكلُّ مسارٍ آخر يعود `index.html` بحكم
       `not_found_handling` — فتوجيهُ اللوحة في المتصفّح كما كان. */
    return env.ASSETS.fetch(request);
  },
};
