// الوسيط — يحمي كل مسار لم يُعلَن عاماً.
//
// وأي مسار جديد محميٌّ افتراضياً: القائمة العامة تُكتب صراحةً في الحزمة
// (`DEFAULT_PUBLIC_PATHS`) ولا تُشتقّ من امتداد ولا من نمط. ونحن لا نكتب
// قائمةً خاصة بنا هنا عمداً — من كتبها بنفسه نسي `‎/auth/backchannel-logout`
// منها، فمرّ إشعارُ خروج المركز على الوسيط ورُدّ بتحويلة، وقرأ المركزُ
// فشلَه نجاحاً وبقيت الجلسة حيّة بلا سطر خطأ في أي سجلّ.

import { pagesMiddleware } from 'naf-auth';

import { platformConfig } from './_lib/config.js';

export const onRequest = (context) => pagesMiddleware(platformConfig(context.env))(context);
