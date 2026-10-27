-- العملاء المحتملون ← لوحةُ بطاقات بيسكامب، في الاتّجاهين.
--
-- ═══ الاتّجاهُ هنا اثنان ═══
--
-- ربطُ المشاريع (`0009`) يقرأ ولا يكتب. وهذا غيره: مشروعُ «إدارة العملاء»
-- في بيسكامب لوحةُ بطاقات (Card Table)، أعمدتُها حالاتُ العميل المحتمل،
-- وكلُّ بطاقةٍ عميلٌ محتمل. فما يُنشأ أو يُنقل أو يُعلَّق عليه في أحد
-- الطرفين يظهر في الآخر.
--
-- ═══ الصورةُ المحفوظة طرفٌ ثالث ═══
--
-- `bc_synced_values` ما اتّفق عليه الطرفان آخرَ مرّة. فحقلٌ تبدّل في طرفٍ
-- وحده يُنقل، وحقلٌ تبدّل في الطرفين معاً يُسجَّل اختلافاً ولا يُكتب.

ALTER TABLE prospects ADD COLUMN bc_card_id       TEXT;
ALTER TABLE prospects ADD COLUMN bc_column_id     TEXT;
ALTER TABLE prospects ADD COLUMN bc_app_url       TEXT;
ALTER TABLE prospects ADD COLUMN bc_synced_values TEXT;     -- JSON
ALTER TABLE prospects ADD COLUMN bc_updated_at    TEXT;     -- ISO كما تكتبه بيسكامب

-- `ALTER TABLE … ADD COLUMN` لا يقبل `UNIQUE` في SQLite، فالتفرّدُ فهرس.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_bc_card ON prospects(bc_card_id);

-- والتحويلُ إلى عميل يحذف صفَّ المحتمل — فيُحفظ رقمُ البطاقة في العميل،
-- وإلا ضاع الرابطُ بين الملفّ وتاريخه في بيسكامب.
ALTER TABLE clients ADD COLUMN bc_card_id TEXT;

-- ── التعليقات ──
-- تعليقاتٌ لا ملاحظة: الملاحظةُ حقلٌ يُكتب فوقه، والتعليقُ سجلٌّ يُضاف إليه.
-- وتُنسخ في الطرفين، و`bc_comment_id` يمنع نسخها مرّتين.
CREATE TABLE IF NOT EXISTS prospect_comments (
  id              TEXT PRIMARY KEY,
  prospect_id     TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  author_name     TEXT NOT NULL DEFAULT '',
  author_user_id  TEXT,                         -- members.user_id، فارغٌ لما جاء من بيسكامب
  source          TEXT NOT NULL DEFAULT 'platform',  -- platform | basecamp
  bc_comment_id   TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prospect_comments_prospect
  ON prospect_comments(prospect_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_comments_bc
  ON prospect_comments(bc_comment_id);

-- ── اللوحة ──
-- صفٌّ واحد: مشروعٌ واحد للعملاء المحتملين في حسابٍ واحد.
CREATE TABLE IF NOT EXISTS basecamp_prospect_board (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  project_id      TEXT NOT NULL,
  project_name    TEXT NOT NULL DEFAULT '',
  card_table_id   TEXT NOT NULL,
  -- حالةُ المنصة ← معرّفُ العمود. والعمودُ الأخير «تحوّل إلى عميل» مفتاحُه `__converted`.
  column_map      TEXT NOT NULL DEFAULT '{}',   -- JSON
  webhook_id      TEXT,
  -- سرٌّ في مسار الـWebhook: بيسكامب لا توقّع ما ترسله، فالحارسُ عنوانٌ لا يُخمَّن.
  webhook_secret  TEXT NOT NULL,
  configured_by   TEXT NOT NULL,
  configured_at   INTEGER NOT NULL,
  last_sync_at    INTEGER,
  last_sync_error TEXT
);

-- ── بطاقاتُ من حُذفوا ──
-- حذفُ العميل المحتمل في المنصة لا يحذف بطاقته في بيسكامب. ولولا هذا الجدول
-- لقرأت المزامنةُ التالية البطاقةَ «بلا عميل» فأعادته — فيعود من حُذف.
CREATE TABLE IF NOT EXISTS basecamp_prospect_tombstones (
  card_id     TEXT PRIMARY KEY,
  deleted_at  INTEGER NOT NULL
);

-- ── الاختلافاتُ في الجدول القائم ──
-- جدولُ `basecamp_conflicts` واحدٌ للمشاريع وللبطاقات، فالشاشةُ واحدة.
-- وصفُّ العميل المحتمل يُعرف بهذا العمود، وحقلُه بسابقة `prospect.`.
ALTER TABLE basecamp_conflicts ADD COLUMN prospect_id TEXT;
