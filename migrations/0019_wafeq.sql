-- الربط بوافق — قراءةُ المدفوعات وربطُها بالقضايا.
--
-- ═══ الاتّجاه واحد ═══
--
-- يُقرأ من وافق ولا يُكتب فيه حرف، كبيسكامب. فصلاحيةُ القراءة تكفي، وخطأٌ
-- في المنصة لا يُفسد دفتراً محاسبياً.
--
-- ═══ ولماذا جدولٌ وسيط لا كتابةٌ في سجلّ الدفعات مباشرة ═══
--
-- الدفعةُ في وافق تخصّ موكّلاً، ولا تقول أيَّ قضيةٍ له. والربطُ بالقضية
-- ترجيحٌ — برقم القضية في نصّها، أو بالطراز. وسجلُّ الدفعات (`client_payments`)
-- هو ما يُحسب منه المحصَّل: دفعةٌ تُكتب فيه بترجيحٍ خاطئ تُحرّك محصَّلَ قضيةٍ
-- لم تُدفع، وكشفَ حسابِ موكّل، ولا يراها أحد.
--
-- فتُحفظ هنا أوّلاً بحالتها، ولا تنزل إلى السجلّ إلا ما رُبط:
--   `linked`     رُبطت — برقم القضية حرفاً، أو بتأكيد إنسان
--   `suggested`  اقترح لها الطرازُ أو الموكّلُ قضيةً، تنتظر تأكيداً
--   `unmatched`  لم يُعرف لها قضية، تنتظر اختياراً
--   `ignored`    لا تخصّ القضايا (أتعابٌ عامّة، أو دفعةٌ ليست من موكّل)

-- ── الاتّصال ──
-- صفٌّ واحد كبيسكامب. والمفتاحُ نفسُه سرٌّ في `wrangler secret` لا هنا —
-- `WAFEQ_API_KEY` — فلا يُحفظ في القاعدة ولا يُقرأ منها.
CREATE TABLE IF NOT EXISTS wafeq_connection (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  -- الجدولةُ لا تعمل قبل أن يصير ١، ولا يصير إلا بعد مزامنةٍ يدويةٍ ناجحة.
  sync_enabled    INTEGER NOT NULL DEFAULT 0,
  last_sync_at    INTEGER,
  last_sync_error TEXT,
  -- أحدثُ تاريخ دفعةٍ قُرئ — تبدأ منه الدورةُ التالية بنافذةٍ متداخلة.
  cursor_date     TEXT,
  updated_at      INTEGER NOT NULL
);

-- ── المدفوعات المقروءة ──
CREATE TABLE IF NOT EXISTS wafeq_payments (
  external_id       TEXT PRIMARY KEY,             -- معرّفُ الدفعة عند وافق
  payment_date      TEXT,                         -- YYYY-MM-DD
  amount            INTEGER NOT NULL DEFAULT 0,   -- هللات
  currency          TEXT,
  contact_name      TEXT,
  contact_number    TEXT,                         -- الرقمُ الضريبي أو الهوية كما عندهم
  reference         TEXT,
  description       TEXT,
  invoice_text      TEXT,                         -- أرقامُ الفواتير وبنودُها نصّاً

  status            TEXT NOT NULL DEFAULT 'unmatched',
  case_id           TEXT REFERENCES cases(id) ON DELETE SET NULL,
  suggested_case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  client_id         TEXT REFERENCES clients(id) ON DELETE SET NULL,
  match_by          TEXT,                         -- case_number | client | ai | manual
  reason            TEXT,
  payment_id        TEXT,                         -- صفُّه في `client_payments` إن رُبط

  -- بصمةُ ما سُئل عنه الطراز: ما دامت هي هي فلا يُسأل ثانيةً.
  ai_fingerprint    TEXT,
  decided_by        TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wafeq_payments_status ON wafeq_payments(status, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_wafeq_payments_case   ON wafeq_payments(case_id);
