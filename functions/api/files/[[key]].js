// تقديم ملفّ من حاوية R2.
//
// المسار تحت `‎/api/` فالوسيط يحرسه: هذه ملفّات عملاء ومرفقات قضايا، ولا
// تُقدَّم لمن لا جلسةَ له. ورابطُ الملفّ ليس سرّاً يحرسه — المفتاح عشوائي
// لكن الحراسة هي الجلسة لا الجهل بالمفتاح.

import { isValidKey, serveHeaders } from '../../_lib/files.js';

export async function onRequestGet(context) {
  // أجزاء المسار تعود مصفوفةً من الالتقاط الجامع، والمفتاح هو وصلُها.
  const parts = context.params.key;
  const key = Array.isArray(parts) ? parts.join('/') : String(parts ?? '');

  if (!isValidKey(key)) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const object = await context.env.FILES.get(key);
  if (!object) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const kind = key.slice(0, key.indexOf('/'));
  const headers = new Headers(serveHeaders(object.httpMetadata?.contentType ?? '', kind));

  /* `etag` يجعل المتصفّح يسأل بدل أن ينزّل ثانيةً. ولا `last-modified`
     معه: واحدُهما يكفي، والزيادة تُكبّر الترويسة بلا أثر. */
  headers.set('etag', object.httpEtag);

  return new Response(object.body, { headers });
}
