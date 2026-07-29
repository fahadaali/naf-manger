// إشعار الخروج الخلفي — يناديه المركز خادماً لخادم عند خروج العضو منه،
// فيُنهي جلساته في هذه المنصة.
//
// وحراستُه توقيعُ المركز لا جلسةُ متصفّح: المنادي خادمٌ ولا كوكي معه.
// ولذلك المسار في `DEFAULT_PUBLIC_PATHS` داخل الحزمة — واسمُه عقدٌ لا خيار،
// مشتقٌّ في المركز حرفياً.
//
// والردّ يُفحص بعقده لا بحالته: المركز يشترط `{ ok: true, ended: <عدد> }`.

import { pagesBackchannelLogout } from 'naf-auth';

import { platformConfig } from '../_lib/config.js';

export const onRequest = (context) =>
  pagesBackchannelLogout(platformConfig(context.env))(context);
