// غلاف Pages لرفع ملفّ. المنطق في `_lib/handlers.js` يشاركه Worker.

import { uploadFile } from '../_lib/handlers.js';

export const onRequestPost = (context) =>
  uploadFile(context.request, context.env, context.data.user);
