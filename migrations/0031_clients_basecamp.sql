-- لوحةُ «العملاء الفعليون» في بيسكامب — في الاتّجاهين، كلوحة المحتملين.
--
-- ═══ لوحتان في مشروعٍ واحد ═══
--
-- مشروعُ «إدارة العملاء» فيه لوحتان: المحتملون والفعليون. فصار صفُّ الإعداد
-- لكلِّ نوعٍ في `basecamp_boards` بمفتاح `kind`، ويُنقل إليه صفُّ
-- `basecamp_prospect_board` إن وُجد. والجدولُ القديم يبقى ولا يُقرأ.
--
-- ═══ رقمُ البطاقة في العميل كان رقمَ بطاقة المحتمل ═══
--
-- التحويلُ (`0029`) كان يحفظ في `clients.bc_card_id` رقمَ بطاقة المحتمل، ليُعرف
-- أنها لا تُعاد عميلاً محتملاً. وصار العمودُ رقمَ بطاقة العميل في لوحته — فيُنقل
-- القديمُ إلى قائمة المحذوفين (والغرضُ نفسُه: لا تُعيده المزامنة)، ويُفرَّغ.

INSERT INTO basecamp_prospect_tombstones (card_id, deleted_at)
SELECT bc_card_id, CAST(strftime('%s', 'now') AS INTEGER)
FROM clients WHERE bc_card_id IS NOT NULL
ON CONFLICT(card_id) DO NOTHING;

UPDATE clients SET bc_card_id = NULL WHERE bc_card_id IS NOT NULL;

ALTER TABLE clients ADD COLUMN bc_column_id     TEXT;
ALTER TABLE clients ADD COLUMN bc_app_url       TEXT;
ALTER TABLE clients ADD COLUMN bc_synced_values TEXT;     -- JSON
ALTER TABLE clients ADD COLUMN bc_updated_at    TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_bc_card ON clients(bc_card_id);

-- ── تعليقاتُ العميل ──
-- بشكل `prospect_comments`. والتحويلُ ينقل تعليقاتِ المحتمل إليها قبل حذفه.
CREATE TABLE IF NOT EXISTS client_comments (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  author_name     TEXT NOT NULL DEFAULT '',
  author_user_id  TEXT,
  source          TEXT NOT NULL DEFAULT 'platform',  -- platform | basecamp
  bc_comment_id   TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_comments_client
  ON client_comments(client_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_comments_bc
  ON client_comments(bc_comment_id);

-- ── اللوحات ──
CREATE TABLE IF NOT EXISTS basecamp_boards (
  kind            TEXT PRIMARY KEY CHECK (kind IN ('prospects', 'clients')),
  project_id      TEXT NOT NULL,
  project_name    TEXT NOT NULL DEFAULT '',
  card_table_id   TEXT NOT NULL,
  card_table_name TEXT NOT NULL DEFAULT '',
  column_map      TEXT NOT NULL DEFAULT '{}',   -- JSON: حالة ← معرّفُ العمود
  -- الـWebhook واحدٌ للمشروع وسرُّه واحد — ويُحفظ في الصفّين معاً.
  webhook_id      TEXT,
  webhook_secret  TEXT NOT NULL,
  configured_by   TEXT NOT NULL,
  configured_at   INTEGER NOT NULL,
  last_sync_at    INTEGER,
  last_sync_error TEXT
);

INSERT INTO basecamp_boards
  (kind, project_id, project_name, card_table_id, column_map, webhook_id, webhook_secret,
   configured_by, configured_at, last_sync_at, last_sync_error)
SELECT 'prospects', project_id, project_name, card_table_id, column_map, webhook_id, webhook_secret,
       configured_by, configured_at, last_sync_at, last_sync_error
FROM basecamp_prospect_board WHERE id = 1
ON CONFLICT(kind) DO NOTHING;

-- ── اختلافاتُ بطاقة العميل ──
-- حقلُها `client.<حقل>` كاختلافات مزامنة المشاريع، وهذا العمودُ يفرّقها.
ALTER TABLE basecamp_conflicts ADD COLUMN client_id TEXT;
