-- naf-auth — جدول الأعضاء المحلي. منقولٌ عن `naf-auth/migrations/members.sql`
-- كما توجب الخطوة الثالثة في `README` الحزمة.
--
-- والمخطّط هو الافتراضي حرفياً: العضوية تبدأ من الصفر ولا تُرحَّل حسابات،
-- فلا أعمدة `MEMBERS_*` في `wrangler.toml` ولا خريطةَ أسماء.
--
-- وهذا الجدول هو مرجعُ العضوية الوحيد في المنصة: من دخل أُدرج صفُّه هنا،
-- ومنه يُقرأ دورُه وحالةُ تفعيله في كل طلبٍ محروس.

CREATE TABLE IF NOT EXISTS members (
  user_id      TEXT PRIMARY KEY,   -- sub القادم من المركز
  display_name TEXT,
  email        TEXT,
  role         TEXT NOT NULL DEFAULT 'staff',   -- admin | lawyer | staff
  perms        TEXT,               -- JSON للصلاحيات الدقيقة — NULL يعني «افتراضُ الدور»
  is_active    INTEGER NOT NULL DEFAULT 1,
  last_seen_at INTEGER,
  created_at   INTEGER NOT NULL
);

-- البحث بالبريد: يقرؤه شرطُ الآدمن الأول عند أول دخول.
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);

-- ملاحظة على الدور: لا قيد CHECK عليه عمداً — وهو نصّ الحزمة نفسه.
-- المصادقة مركزية والصلاحيات موزّعة، فمفردات الأدوار تخصّ كل منصة،
-- وقيدٌ هنا يمنع منصة من استعمال أدوارها هي.
--
-- والافتراضي هنا `staff` لا `viewer` لأن هذه مفردات هذه المنصة. والقيمة
-- في هذا السطر احتياطٌ لإدراجٍ لا يذكر العمود؛ ومن يُدرج فعلاً هو
-- `upsertMember` وهو يكتب `DEFAULT_ROLE` صراحةً. فالموضعان يتفقان.
