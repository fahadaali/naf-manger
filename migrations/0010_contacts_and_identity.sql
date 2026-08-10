-- جهاتُ الاتّصال المتعددة، ونوعُ الهوية، ورقمُ هويةٍ يجوز أن يغيب.
--
-- ═══ لماذا يُعاد بناء الجدول ═══
--
-- `id_number` كان `TEXT NOT NULL UNIQUE`. وذلك يفترض أنّ لكل عميلٍ رقمَ
-- هوية حاضراً وقتَ إدراجه — وهو غيرُ صحيح: ملفّاتٌ قديمة في بيسكامب بلا
-- رقم، وموكّلٌ يُفتح ملفُّه قبل أن يُرسل هويته.
--
-- وكان الاستيراد يولّد رقماً بديلاً ليمرّ القيد. وهو أسوأ من الفراغ:
-- رقمُ هويةٍ مخترَعٌ في ملفّ موكّل يُقرأ رقماً حقيقياً بعد شهر.
--
-- فيصير العمود يقبل `NULL`. و`UNIQUE` في SQLite يقبل `NULL` مكرّراً —
-- فعشرةُ عملاءَ بلا هوية لا يتزاحمون، وأيُّ رقمين متساويين يُردّان.
--
-- ولا سبيلَ إلى رفع `NOT NULL` في SQLite إلا بإعادة البناء: إنشاءُ جدولٍ
-- بالشكل الجديد، ونقلُ الصفوف، ثم الإحلال. والمعرّفات تبقى كما هي،
-- فإشاراتُ `cases.client_id` سليمةٌ بعده.

-- ═══ العملاء ═══
CREATE TABLE clients_new (
  id                   TEXT PRIMARY KEY,
  full_name            TEXT NOT NULL,

  -- يجوز أن يغيب. و`UNIQUE` تمنع تكرار الرقم الحاضر ولا تمنع تعدّد الغياب.
  id_number            TEXT UNIQUE,

  -- هوية وطنية | إقامة | سجل تجاري — والمفردات في «تكوين النظام».
  id_type              TEXT,

  -- الرقم الأول، ويبقى لأنّ القوائم والبحث والتصدير تقرؤه.
  phone                TEXT NOT NULL DEFAULT '',

  -- ═══ وبقيةُ الأرقام هنا ═══
  -- JSON: [{ "number": "05…", "relation": "أب", "name": "…" }]
  --
  -- ورقمٌ واحدٌ في عمودٍ واحد كان يُسقط ما في ملفّات المكتب فعلاً: جوّالُ
  -- الموكّل وجوّالُ وكيله وجوّالُ أخيه في سطرٍ واحد. فكان يُؤخذ أوّلُها
  -- ويُترك الباقي بلا أن يُقال.
  contacts             TEXT NOT NULL DEFAULT '[]',

  email                TEXT NOT NULL DEFAULT '',
  join_date            TEXT NOT NULL DEFAULT (date('now')),
  client_type          TEXT NOT NULL DEFAULT 'individual',
  status               TEXT NOT NULL DEFAULT 'current',
  notes                TEXT NOT NULL DEFAULT '',
  profile_picture      TEXT,
  commercial_register  TEXT,
  legal_representative TEXT,
  attachments          TEXT NOT NULL DEFAULT '[]',
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

INSERT INTO clients_new
  (id, full_name, id_number, phone, email, join_date, client_type, status, notes,
   profile_picture, commercial_register, legal_representative, attachments,
   created_at, updated_at)
SELECT
   id, full_name,
   -- الأرقام المولَّدة في استيرادٍ سابق تُمحى: ليست هويات.
   CASE WHEN id_number LIKE 'BC-%' THEN NULL ELSE id_number END,
   phone, email, join_date, client_type, status, notes,
   profile_picture, commercial_register, legal_representative, attachments,
   created_at, updated_at
FROM clients;

DROP TABLE clients;
ALTER TABLE clients_new RENAME TO clients;

CREATE INDEX IF NOT EXISTS idx_clients_id_number   ON clients(id_number);
CREATE INDEX IF NOT EXISTS idx_clients_status      ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_client_type ON clients(client_type);

-- ═══ العملاء المحتملون ═══
-- يُبنون بالشكل نفسه: المحتمل يصير عميلاً بـ`convert`، فاختلافُ عمودٍ
-- بينهما يُسقط التحويل أو يُضيع حقلاً عنده.
CREATE TABLE prospects_new (
  id                   TEXT PRIMARY KEY,
  full_name            TEXT NOT NULL,
  id_number            TEXT UNIQUE,
  id_type              TEXT,
  phone                TEXT NOT NULL DEFAULT '',
  contacts             TEXT NOT NULL DEFAULT '[]',
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
  expected_value       INTEGER,
  follow_up_date       TEXT,
  assigned_to          TEXT,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

INSERT INTO prospects_new
  (id, full_name, id_number, phone, email, join_date, client_type, prospect_status, notes,
   profile_picture, commercial_register, legal_representative, attachments,
   source, expected_value, follow_up_date, assigned_to, created_at, updated_at)
SELECT
   id, full_name,
   CASE WHEN id_number LIKE 'BC-%' THEN NULL ELSE id_number END,
   phone, email, join_date, client_type, prospect_status, notes,
   profile_picture, commercial_register, legal_representative, attachments,
   source, expected_value, follow_up_date, assigned_to, created_at, updated_at
FROM prospects;

DROP TABLE prospects;
ALTER TABLE prospects_new RENAME TO prospects;

CREATE INDEX IF NOT EXISTS idx_prospects_status      ON prospects(prospect_status);
CREATE INDEX IF NOT EXISTS idx_prospects_assigned_to ON prospects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_prospects_follow_up   ON prospects(follow_up_date);

-- ═══ تاريخُ إنشاء المشروع في بيسكامب ═══
-- «عميلٌ منذ» كان يُكتب تاريخَ الاستيراد — أي أنّ موكّلاً منذ ٢٠٢١ يظهر
-- عميلاً منذ اليوم. والتاريخ الصحيح عندهم: تاريخُ إنشاء مشروعه.
ALTER TABLE basecamp_projects ADD COLUMN created_on TEXT;
