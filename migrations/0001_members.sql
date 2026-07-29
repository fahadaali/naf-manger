-- naf-auth — جدول الأعضاء المحلي. منقولٌ عن `naf-auth/migrations/members.sql`
-- كما توجب الخطوة الثالثة في `README` الحزمة.
--
-- ولماذا المخطّط الافتراضي هنا وللمنصة نظام أعضاء قائم على Supabase:
-- القرار المعتمد أن تبدأ العضوية من الصفر — لا تُرحَّل حسابات `users` ولا
-- كلماتُ مرورها. فلا خطة ترحيل ولا أعمدة `MEMBERS_*` في `wrangler.toml`،
-- والمخطّط يبقى ما تفترضه الحزمة حرفياً.
--
-- وجدولُ `users` في Supabase لا يُمسّ بهذه الهجرة ولا بغيرها: هو في قاعدة
-- أخرى، ويبقى مصدرَ بيانات المنصة إلى أن تقع دفعةُ طبقة البيانات.

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
