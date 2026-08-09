/* خطّافُ استيراد: يحوّل `naf-auth` إلى البديل في الاختبار وحده.
 *
 * ولا يمسّ المستودع: لا حزمةً تُبدَّل ولا ملفّاً يُعدَّل. فما يُبنى ويُنشر
 * هو ما في `package.json` حرفاً، والتحويل يعيش في عملية الاختبار فقط.
 */
import { pathToFileURL } from 'node:url';

const STUB = pathToFileURL(new URL('./naf-auth-stub.mjs', import.meta.url).pathname).href;

export function resolve(specifier, context, nextResolve) {
  if (specifier === 'naf-auth') return { url: STUB, shortCircuit: true };
  return nextResolve(specifier, context);
}
