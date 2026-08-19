// سجلُّ الأنشطة — يُكتب من موضعٍ واحد يمرّ به كل فعلٍ على مورد.
//
// ═══ لماذا هنا لا في الشاشات ═══
//
// شاشةُ لوحة التحكّم تعرض «النشاط الأخير»، و`ActivityFeed` يبني أيقوناتِه
// وألوانَه على ثمانية أنواع: `client_created` و`case_updated`
// و`user_login` وأخواتها. **ولم يكن يُكتب منها واحد.** الكتابةُ الوحيدة
// من الواجهة كانت تحويلَ محتملٍ إلى عميل، ومن الخادم مزامنةَ بيسكامب —
// فإنشاءُ عميلٍ وتعديلُ قضيةٍ وحذفُها وأرشفتُها لا تترك أثراً، وفروعُ
// `switch` في المكوّن ميتةٌ كلُّها.
//
// وموضعُه `crud.js` لا الشاشات: الشاشةُ تُنسى — وقد نُسيت في كل موضعٍ إلا
// واحد — والمسارُ لا يُنسى، فكلُّ كتابةٍ تمرّ به.
//
// ═══ ولا يُسقط الفعلَ الذي وقع ═══
//
// أثرٌ تعذّر تسجيلُه لا يُبطل عمليةً نجحت. فالكتابةُ تُبلَع أخطاؤها
// وتُسجَّل في السجلّ، كما تفعل `logActivity` في `basecamp/handlers.js`.

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** اسمُ الكيان في الرسالة، ونوعُه في العمود. */
const ENTITY = {
  clients: { one: 'العميل', type: 'client' },
  prospects: { one: 'العميل المحتمل', type: 'prospect' },
  cases: { one: 'القضية', type: 'case' },
  marketers: { one: 'المسوّق', type: 'marketer' },
  commissions: { one: 'دفعة العمولة', type: 'commission' },
};

/** فعلُ الرسالة ونوعُ السطر. */
const VERB = {
  create: { past: 'أُضيف', suffix: 'created' },
  update: { past: 'عُدِّل', suffix: 'updated' },
  delete: { past: 'حُذف', suffix: 'deleted' },
  archive: { past: 'أُرشف', suffix: 'archived' },
  restore: { past: 'أُرجع من الأرشيف', suffix: 'restored' },
};

/* ما يُعرَف به الصفُّ في الرسالة: اسمُ الموكّل، ورقمُ القضية. ويُقرأ من
   الصفّ كما ردّته `toClient` — لا من الجسم الوارد، فقد يخلو منه. */
function nameOf(row) {
  if (!row) return '';
  return String(row.caseNumber ?? row.fullName ?? '').trim();
}

/** اسمُ العضو وقت الفعل — نصٌّ محفوظ لا مشتقّ، فيبقى صادقاً بعد تغيّره. */
async function displayName(env, userId) {
  try {
    const row = await env.DB.prepare(`SELECT display_name FROM members WHERE user_id = ?`)
      .bind(userId)
      .first();
    return row?.display_name ?? '';
  } catch {
    return '';
  }
}

/**
 * يسجّل أثراً.
 *
 * `count` للأفعال الجماعية: «أُرشف ١٢ عميلاً» سطرٌ واحد لا اثنا عشر —
 * والسجلُّ يُقرأ، فإغراقُه بصفٍّ لكل صفٍّ يُخفي ما عداه.
 */
export async function logActivity(env, user, { resource, action, row, count }) {
  const entity = ENTITY[resource];
  const verb = VERB[action];
  if (!entity || !verb) return;

  const name = nameOf(row);
  const subject = count && count > 1
    ? `${count} من ${entity.one}`
    : name
      ? `${entity.one} «${name}»`
      : entity.one;

  const userName = await displayName(env, user?.id);

  await env.DB.prepare(
    `INSERT INTO activity_logs (id, type, description, user_id, user_name, entity_id, entity_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      `${entity.type}_${verb.suffix}`,
      `${verb.past} ${subject}`,
      user?.id ?? '',
      userName,
      row?.id ?? null,
      entity.type,
      nowSeconds(),
    )
    .run()
    .catch((error) => {
      // أثرٌ تعذّر تسجيلُه لا يُسقط الفعل الذي وقع.
      console.error('تعذّر تسجيل النشاط:', error?.message ?? error);
    });
}
