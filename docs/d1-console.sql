-- ═══════════════════════════════════════════════════════════════════════
--  مخطّط قاعدة naf-manger على D1 — نصٌّ واحد يُنسخ ويُلصق في Console D1
-- ═══════════════════════════════════════════════════════════════════════
--
--  هذا الملفّ ليس هجرةً جديدة: هو مجموعُ `migrations/0001` و`0002` في
--  نصٍّ واحد، للصقه في لوحة Cloudflare مباشرةً حين لا يُشغَّل سير النشر.
--
--  وتشغيلُه آمنٌ للتكرار: كل جملةٍ فيه `IF NOT EXISTS`، فما وُجد يُترك
--  ولا يُدهس صفٌّ واحد. ولا `DROP` فيه ولا `DELETE` — لا سطرَ واحداً.
--
--  المسار في اللوحة:
--    Cloudflare Dashboard → Storage & Databases → D1 SQL Database
--      → naf-manger → Console → الصق ما دون هذا السطر → Execute
--
--  والبديل من الطرفية:
--    npx wrangler d1 execute naf-manger --remote --file=docs/d1-console.sql
--
--  ولو كانت القاعدة لم تُنشأ بعد:
--    npx wrangler d1 create naf-manger
--
--  ملاحظة على تتبّع الهجرات: تشغيلُ هذا النصّ يُنشئ الجداول ولا يكتب في
--  جدول `d1_migrations`. فسير النشر بعده يحاول تطبيق `0001` و`0002` — ويمرّ
--  بلا أثر لأن كل جملةٍ فيهما `IF NOT EXISTS` كذلك. فلا تعارض.
--
-- ═══════════════════════════════════════════════════════════════════════
--  ثلاث قواعد تحكم الأنواع هنا
--
--  ١) المبالغ أعدادٌ صحيحة بالهللات — لا `REAL`. SQLite لا تحمل عشرياً
--     مضبوطاً، و`0.1 + 0.2` ليست `0.3`. فالمبلغ ×١٠٠ صحيحاً، والقسمة عند
--     العرض وحده.
--
--  ٢) الأوقات ثوانٍ صحيحة. أمّا التواريخ المجرّدة — `join_date` و
--     `start_date` و`payment_date` و`follow_up_date` — فنصٌّ `YYYY-MM-DD`:
--     هي تواريخ لا لحظات، وتحويلُها إلى ثوانٍ يُدخل المنطقة الزمنية في
--     قيمةٍ لا تعنيها، فينزلق التاريخ يوماً كاملاً لمن يقرأ من منطقة أخرى.
--
--  ٣) البنى المركّبة `TEXT` تحمل JSON. والقراءة تفكّه، والتالف يُعامل
--     غياباً لا يُسقط الطلب.
-- ═══════════════════════════════════════════════════════════════════════


-- ── ١/٨ الأعضاء ──
-- مرجعُ العضوية الوحيد. من دخل أُدرج صفُّه هنا، ومنه يُقرأ دورُه وحالةُ
-- تفعيله في كل طلبٍ محروس. ولا كلمة مرور فيه: المصادقة عند المركز.
CREATE TABLE IF NOT EXISTS members (
  user_id      TEXT PRIMARY KEY,   -- sub القادم من المركز
  display_name TEXT,
  email        TEXT,
  role         TEXT NOT NULL DEFAULT 'staff',   -- admin | lawyer | staff
  perms        TEXT,               -- JSON — NULL يعني «افتراضُ الدور»
  is_active    INTEGER NOT NULL DEFAULT 1,
  last_seen_at INTEGER,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);


-- ── ٢/٨ العملاء ──
CREATE TABLE IF NOT EXISTS clients (
  id                   TEXT PRIMARY KEY,
  full_name            TEXT NOT NULL,
  id_number            TEXT NOT NULL UNIQUE,
  phone                TEXT NOT NULL DEFAULT '',
  email                TEXT NOT NULL DEFAULT '',
  join_date            TEXT NOT NULL DEFAULT (date('now')),  -- YYYY-MM-DD
  client_type          TEXT NOT NULL DEFAULT 'individual',
  status               TEXT NOT NULL DEFAULT 'current',
  notes                TEXT NOT NULL DEFAULT '',
  profile_picture      TEXT,                       -- مفتاح R2
  commercial_register  TEXT,
  legal_representative TEXT,                       -- JSON
  attachments          TEXT NOT NULL DEFAULT '[]', -- JSON: مفاتيح R2
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_id_number   ON clients(id_number);
CREATE INDEX IF NOT EXISTS idx_clients_status      ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_client_type ON clients(client_type);


-- ── ٣/٨ العملاء المحتملون ──
CREATE TABLE IF NOT EXISTS prospects (
  id                   TEXT PRIMARY KEY,
  full_name            TEXT NOT NULL,
  id_number            TEXT NOT NULL UNIQUE,
  phone                TEXT NOT NULL DEFAULT '',
  email                TEXT NOT NULL DEFAULT '',
  join_date            TEXT NOT NULL DEFAULT (date('now')),
  client_type          TEXT NOT NULL DEFAULT 'individual',
  prospect_status      TEXT NOT NULL DEFAULT 'مهتم',
  notes                TEXT NOT NULL DEFAULT '',
  profile_picture      TEXT,
  commercial_register  TEXT,
  legal_representative TEXT,
  attachments          TEXT NOT NULL DEFAULT '[]',
  source               TEXT,
  expected_value       INTEGER,                    -- هللات
  follow_up_date       TEXT,                       -- YYYY-MM-DD
  assigned_to          TEXT,                       -- members.user_id
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prospects_status      ON prospects(prospect_status);
CREATE INDEX IF NOT EXISTS idx_prospects_assigned_to ON prospects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_prospects_follow_up   ON prospects(follow_up_date);


-- ── ٤/٨ المسوّقون ──
-- يسبق القضايا لأنها تشير إليه.
CREATE TABLE IF NOT EXISTS marketers (
  id                TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  id_number         TEXT NOT NULL UNIQUE,
  phone             TEXT NOT NULL DEFAULT '',
  email             TEXT NOT NULL DEFAULT '',
  relationship_type TEXT NOT NULL DEFAULT 'freelancer',
  start_date        TEXT NOT NULL DEFAULT (date('now')),
  status            TEXT NOT NULL DEFAULT 'active',
  notes             TEXT NOT NULL DEFAULT '',
  profile_picture   TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marketers_status ON marketers(status);


-- ── ٥/٨ القضايا ──
CREATE TABLE IF NOT EXISTS cases (
  id                    TEXT PRIMARY KEY,
  case_number           TEXT NOT NULL UNIQUE,
  case_type             TEXT NOT NULL,
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_name           TEXT NOT NULL,
  summary               TEXT NOT NULL DEFAULT '',
  status                TEXT NOT NULL DEFAULT 'pending',
  outcome               TEXT,
  basecamp_url          TEXT,
  marketer_id           TEXT REFERENCES marketers(id),
  marketer_name         TEXT,
  fee_structure         TEXT,                      -- JSON
  payment_status        TEXT,                      -- JSON
  commission_structure  TEXT,                      -- JSON
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_client_id   ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status      ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_marketer_id ON cases(marketer_id);


-- ── ٦/٨ سجلّ الأنشطة ──
-- `user_name` نصٌّ محفوظ لا مشتقّ: العضو قد يُوقف ويبقى السجلّ شاهداً،
-- فاسمُه وقت الفعل هو الصحيح لا اسمُه اليوم.
CREATE TABLE IF NOT EXISTS activity_logs (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  entity_id   TEXT,
  entity_type TEXT,
  details     TEXT,                                -- JSON
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity  ON activity_logs(entity_type, entity_id);


-- ── ٧/٨ إعدادات النظام ──
-- كائنٌ واحد تحت مفتاح `settings` لا صفٌّ لكل إعداد: الواجهة تقرؤه كاملاً
-- وتكتبه كاملاً. والجدول يبقى `key/value` كي يتّسع لمفاتيح أخرى لاحقاً.
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '{}',           -- JSON
  updated_by TEXT,
  updated_at INTEGER NOT NULL
);


-- ── ٨/٨ دفعات العمولات ──
CREATE TABLE IF NOT EXISTS commission_payments (
  id           TEXT PRIMARY KEY,
  marketer_id  TEXT NOT NULL REFERENCES marketers(id) ON DELETE CASCADE,
  case_id      TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  amount       INTEGER NOT NULL DEFAULT 0,         -- هللات
  payment_date TEXT NOT NULL DEFAULT (date('now')),  -- YYYY-MM-DD
  notes        TEXT,
  created_by   TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commissions_marketer ON commission_payments(marketer_id);
CREATE INDEX IF NOT EXISTS idx_commissions_case     ON commission_payments(case_id);


-- ═══ التحقّق بعد التنفيذ ═══
-- تُتوقَّع ثمانية أسماء. وما نقص منها لم يُنشأ.
SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (
  'members', 'clients', 'prospects', 'marketers',
  'cases', 'activity_logs', 'system_settings', 'commission_payments'
) ORDER BY name;
