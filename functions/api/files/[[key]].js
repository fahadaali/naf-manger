// غلاف Pages لتقديم ملفّ. المنطق في `_lib/handlers.js` يشاركه Worker.

import { serveFile } from '../../_lib/handlers.js';

export function onRequestGet(context) {
  // أجزاء المسار تعود مصفوفةً من الالتقاط الجامع، والمفتاح هو وصلُها.
  const parts = context.params.key;
  return serveFile(context.env, Array.isArray(parts) ? parts.join('/') : String(parts ?? ''));
}
