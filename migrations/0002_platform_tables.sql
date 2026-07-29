-- جداول المنصة — منقولةٌ عن مخطّط Supabase في `supabase/migrations/`.
--
-- ولا نقلَ صفوفٍ معها: القرار المعتمد أن القاعدة القديمة فارغة أو تجريبية،
-- فهذا إنشاءُ مخطّطٍ لا ترحيلُ بيانات. والملفّات القديمة تبقى في المستودع
-- شاهدةً على ما كان.
--
-- ═══ ثلاثة فروق عن الأصل، وكلُّها مقصودة ═══
--
-- ١) **المبالغ أعدادٌ صحيحة بالهللات** — لا `REAL`.
--    SQLite لا تحمل عشرياً مضبوطاً، و`0.1 + 0.2` ليست `0.3`. وعمولةٌ تُجمع
--    على مئة قضية تنحرف عن دفترها بقروشٍ لا يجد المحاسب لها سبباً. فالمبلغ
--    ×١٠٠ صحيحاً، والقسمة عند العرض وحده.
--
-- ٢) **الأوقات ثوانٍ صحيحة** — كجدول الأعضاء، فلا صيغتان في قاعدة واحدة.
--    أمّا التواريخ المجرّدة — `join_date` و`start_date` و`payment_date`
--    و`follow_up_date` — فتبقى نصّاً `YYYY-MM-DD`: هي تواريخ لا لحظات،
--    وتحويلُها إلى ثوانٍ يُدخل المنطقة الزمنية في قيمةٍ لا تعنيها، فينزلق
--    التاريخ يوماً كاملاً لمن يقرأ من منطقة أخرى.
--
-- ٣) **`jsonb` صار `TEXT` يحمل JSON.** والقراءة تفكّه، والتالف يُعامل غياباً
--    لا يُسقط الطلب.
--
-- والأعمدة التي كانت تشير إلى `users` في Supabase تشير الآن إلى `members`
-- منطقياً لا بقيدٍ أجنبي: العضوية تبدأ من الصفر، ومعرّفاتُ Supabase القديمة
-- لا مقابل لها. وتُترك بلا قيدٍ كي لا يسقط إدراجٌ لعضوٍ لم يدخل المنصة بعد.

-- ── العملاء ──
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
  profile_picture      TEXT,                       -- مفتاح R2 لا base64
  commercial_register  TEXT,
  legal_representative TEXT,                       -- JSON
  attachments          TEXT NOT NULL DEFAULT '[]', -- JSON: مفاتيح R2
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_id_number   ON clients(id_number);
CREATE INDEX IF NOT EXISTS idx_clients_status      ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_client_type ON clients(client_type);

-- ── العملاء المحتملون ──
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

-- ── المسوّقون ──
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

-- ── القضايا ──
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
  fee_structure         TEXT,                      -- JSON — مبالغُه هللات
  payment_status        TEXT,                      -- JSON
  commission_structure  TEXT,                      -- JSON
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_client_id   ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status      ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_marketer_id ON cases(marketer_id);

-- ── سجلّ الأنشطة ──
-- `user_name` نصٌّ محفوظ لا مشتقّ: العضو قد يُحذف من المنصة ويبقى السجلّ
-- شاهداً، فاسمُه وقت الفعل هو الصحيح لا اسمُه اليوم.
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

-- ── إعدادات النظام ──
CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,                     -- المفتاح هو المعرّف
  value      TEXT NOT NULL DEFAULT '{}',           -- JSON
  updated_by TEXT,
  updated_at INTEGER NOT NULL
);

-- ── دفعات العمولات ──
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
