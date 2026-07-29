// غلاف Pages للعضو الحالي. المنطق في `_lib/handlers.js` يشاركه Worker.

import { readMember } from '../_lib/handlers.js';

export const onRequestGet = (context) => readMember(context.env, context.data.user);
