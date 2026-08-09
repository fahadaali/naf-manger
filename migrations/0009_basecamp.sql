-- ربط بيسكامب: الاتّصال، وتصنيف المشاريع، وما اختلف.
--
-- ═══ الاتّجاه واحد ═══
--
-- من بيسكامب إلى المنصة، ولا يُكتب هناك حرفٌ واحد. فصلاحيةُ القراءة تكفي
-- هذا الربط، وخطأٌ في المنصة لا يُفسد وثيقةً أصلية عند العميل.

-- ── الاتّصال ──
-- صفٌّ واحد لا غير: المنصة تخدم مكتباً واحداً، وحسابُ بيسكامب واحد.
-- و`CHECK (id = 1)` يجعل ذلك شرطاً في القاعدة لا عُرفاً في الشيفرة.
CREATE TABLE IF NOT EXISTS basecamp_connection (
  id              INTEGER PRIMARY KEY CHECK (id = 1),

  account_id      TEXT NOT NULL,
  account_name    TEXT NOT NULL DEFAULT '',

  -- الرمزان معمَّيان بـ AES-GCM بمفتاح `BASECAMP_TOKEN_KEY`. وهذا يحمي من
  -- تسرّب نسخةٍ من القاعدة، لا من Workerٍ مخترَق — والفرق يُقال ولا يُدَّعى
  -- غيرُه. وتعذُّرُ فكِّ التعمية (تبدُّلُ المفتاح) يُقرأ «غير مربوط»
  -- ويُطلَب ربطٌ جديد، لا خطأَ خادمٍ غامض.
  access_token    TEXT NOT NULL,
  refresh_token   TEXT NOT NULL,
  expires_at      INTEGER NOT NULL,             -- ثوانٍ

  -- الجدولة لا تعمل قبل أن يصير هذا ١. ولا يصير إلا بتأكيدٍ بشريّ بعد
  -- معاينةٍ رآها. مستوردٌ آليٌّ يبدأ بالكتابة في قاعدة موكّلين بلا معاينة
  -- خطأٌ لا يُصلَح بعده.
  sync_enabled    INTEGER NOT NULL DEFAULT 0,

  connected_by    TEXT NOT NULL,                -- members.user_id
  connected_at    INTEGER NOT NULL,
  last_sync_at    INTEGER,
  last_sync_error TEXT
);

-- ── المشاريع وتصنيفها ──
-- التصنيف قرارٌ يبقى. والآليُّ منه اقتراح: وجودُ «ملخص القضية» يرجّح أنّ
-- المشروع لعميل، لكنّ الحكم لمن يفتح الشاشة — ومتى حكم لم يُنقَض آلياً،
-- وذلك ما يقوله `decided_by` حين يمتلئ.
CREATE TABLE IF NOT EXISTS basecamp_projects (
  project_id      TEXT PRIMARY KEY,             -- معرّف بيسكامب
  name            TEXT NOT NULL,
  app_url         TEXT NOT NULL,                -- يصير `cases.basecamp_url`
  status          TEXT NOT NULL DEFAULT 'active',  -- active | archived | trashed

  vault_id        TEXT,                         -- أداة «Docs & Files»
  doc_id          TEXT,                         -- ملفّ «ملخص القضية»
  doc_updated_at  TEXT,                         -- ISO — به يُعرف ما تبدّل

  kind            TEXT NOT NULL DEFAULT 'unknown',  -- client | internal | unknown
  decided_by      TEXT,                         -- من صنّفه بيده؛ فارغٌ = آلياً

  client_id       TEXT REFERENCES clients(id) ON DELETE SET NULL,
  case_id         TEXT REFERENCES cases(id) ON DELETE SET NULL,

  -- صورةُ ما كتبته المزامنة آخرَ مرّة. وهي الطرف الثالث في الدمج: بها
  -- يُعرف أنّ يداً مسّت حقلاً في المنصة، فلا يُطمس بما عند بيسكامب.
  synced_values   TEXT,                         -- JSON

  last_synced_at  INTEGER,
  last_error      TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bc_projects_kind    ON basecamp_projects(kind);
CREATE INDEX IF NOT EXISTS idx_bc_projects_case    ON basecamp_projects(case_id);
CREATE INDEX IF NOT EXISTS idx_bc_projects_client  ON basecamp_projects(client_id);

-- ── ما اختلف ──
-- حقلٌ مسّته يدٌ في المنصة وتبدّل عند بيسكامب: يُسجَّل بالقيمتين ولا يُكتب.
-- والقرارُ لصاحب المكتب — وهذا ما اختاره صراحةً على «بيسكامب يفوز دائماً»،
-- لأنّ تصحيحاً يُمحى صامتاً في بيانات موكّلين أسوأُ من تعارضٍ ينتظر.
CREATE TABLE IF NOT EXISTS basecamp_conflicts (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  case_id         TEXT,
  field           TEXT NOT NULL,                -- اسم الحقل في المنصة
  platform_value  TEXT,
  basecamp_value  TEXT,
  detected_at     INTEGER NOT NULL,
  resolved_at     INTEGER,
  resolution      TEXT                          -- basecamp | platform | ignored
);
CREATE INDEX IF NOT EXISTS idx_bc_conflicts_open
  ON basecamp_conflicts(resolved_at, detected_at DESC);

-- ولا جدولَ سجلٍّ جديد: المزامنة تكتب في `activity_logs` القائم
-- بـ`entity_type = 'basecamp'`، فيظهر عملُها في شاشة الأنشطة كبقية ما يقع.
