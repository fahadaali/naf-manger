// مسار الاستقبال — يبادل رمز العبور، وينشئ العضو عند أول دخول، ثم يفتح
// جلسة المنصة.
//
// ورمز العبور يعيش ستين ثانية ويُستهلك مرة واحدة، فإعادةُ استعماله تفشل
// حتماً ولا يُعاد بها المحاولة.

import { pagesCallback } from 'naf-auth';

import { platformConfig } from '../_lib/config.js';

export const onRequest = (context) => pagesCallback(platformConfig(context.env))(context);
