/* يسجّل خطّاف الاستيراد قبل تحميل الاختبار. يُمرَّر بـ`node --import`. */
import { register } from 'node:module';

register('./loader.mjs', import.meta.url);
