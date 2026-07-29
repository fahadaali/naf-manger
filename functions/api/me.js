// العضو الحالي — ما تقرؤه اللوحة عن صاحبها.
//
// المسار محميّ بالوسيط كغيره، فبلوغُه يعني أن الجلسة قائمة وأن الرمز
// تُحقّق منه في هذا الطلب نفسه وأن العضو موجودٌ ومفعَّل. فلا فحص هنا
// يعيد ما فُحص قبله.

import { permissionsFor } from '../_lib/roles.js';

/* الوسيط يضع `{ id, role, perms }` وحدها في `context.data.user` — وهي ما
   يحتاجه قرارُ الوصول ولا أكثر. أمّا الاسم والبريد فللعرض، فيُقرآن هنا
   من صفّ العضو. */
export async function onRequestGet(context) {
  const { id, role, perms } = context.data.user;

  const row = await context.env.DB.prepare(
    `SELECT display_name, email, created_at, last_seen_at
     FROM members WHERE user_id = ?`,
  )
    .bind(id)
    .first();

  return Response.json({
    ok: true,
    user: {
      id,
      role,
      name: row?.display_name ?? null,
      email: row?.email ?? null,
      permissions: permissionsFor(role, perms),
      createdAt: row?.created_at ?? null,
      lastSeenAt: row?.last_seen_at ?? null,
    },
  });
}
