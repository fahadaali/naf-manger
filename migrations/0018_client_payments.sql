-- دفعاتُ العميل — سجلٌّ لا رقم.
--
-- ═══ المسألة ═══
--
-- «المبلغ المحصَّل» كان رقماً يُكتب بيدٍ في `cases.payment_status`. فلا يُعرف
-- متى دُفع ولا كم مرّة ولا بأيّ طريقة، ويُكتب فوقه فيضيع ما قبله. وكشفُ حسابٍ
-- لموكّلٍ لا يُبنى من رقمٍ واحد.
--
-- فصار جدولاً على نمط `commission_payments`: لكل دفعةٍ صفُّها، والمحصَّلُ
-- مجموعُها — يحسبه الخادمُ في `worker/lib/payments.js` ويكتبه في
-- `payment_status` نفسِه، فيبقى كلُّ من يقرأ ذلك العمود صحيحاً بلا تعديل:
-- إحصاءاتُ المسوّق وجدولُ قضاياه والتقارير.
--
-- ═══ أعمدتُه ═══
--
-- `amount` هللاتٌ عددٌ صحيح كبقية المبالغ (القاعدة الأولى في الهجرة الثانية).
-- `source`: `manual` تسجّله الشاشة · `opening` رصيدٌ افتتاحيّ من الرقم القديم ·
--           `wafeq` يُقرأ من وافق.
-- `external_id` معرّفُ الدفعة عند مصدرها الخارجي — `UNIQUE` فلا تُكتب مرّتين،
--           و`NULL` لما سُجّل هنا (و`UNIQUE` تقبل الغياب مكرّراً).
-- `client_id` يُنسخ من القضية في الخادم لا من الجسم الوارد: كشفُ حساب الموكّل
--           يُقرأ به، ودفعةٌ تُنسب إلى غير صاحبها خطأٌ في دفترٍ ماليّ.

CREATE TABLE IF NOT EXISTS client_payments (
  id           TEXT PRIMARY KEY,
  case_id      TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_id    TEXT,
  amount       INTEGER NOT NULL DEFAULT 0,             -- هللات
  payment_date TEXT NOT NULL DEFAULT (date('now')),   -- YYYY-MM-DD
  method       TEXT,                                   -- تحويل | نقد | شيك | بطاقة
  reference    TEXT,
  notes        TEXT,
  source       TEXT NOT NULL DEFAULT 'manual',
  external_id  TEXT UNIQUE,
  created_by   TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_payments_case   ON client_payments(case_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_client ON client_payments(client_id);

-- ═══ الرصيدُ الافتتاحيّ ═══
-- كلُّ قضيةٍ حملت محصَّلاً تُنشأ لها دفعةٌ واحدة بالمبلغ نفسِه، فلا يتغيّر
-- رقمٌ في أيّ شاشة. والمبلغُ في `payment_status` ريالاتٌ كما كتبته الشاشة،
-- فيُضرب في مئة ويُقرَّب. وتاريخُها يومُ إنشاء القضية — لا يُعرف غيرُه —
-- والقضايا التطوّعية خارجها: لا أتعابَ فيها تُحصَّل.
--
-- و`NOT EXISTS` يجعل التشغيلَ مرّتين تشغيلاً واحداً.
INSERT INTO client_payments
  (id, case_id, client_id, amount, payment_date, notes, source, created_by, created_at)
SELECT lower(hex(randomblob(16))),
       c.id,
       c.client_id,
       CAST(ROUND(json_extract(c.payment_status, '$.collectedAmount') * 100) AS INTEGER),
       date(c.created_at, 'unixepoch'),
       'رصيدٌ افتتاحيّ — المحصَّل المسجَّل قبل سجلّ الدفعات',
       'opening',
       'migration',
       CAST(strftime('%s', 'now') AS INTEGER)
FROM cases c
-- و`CASE` لا `AND`: بنيةٌ فارغة (`NULL`) تجعل `NOT (json_valid(...) AND ...)`
-- مجهولاً لا صادقاً فيُسقَط صفُّها صامتاً، و`json_extract` على نصٍّ تالف
-- يرمي — ولا يُضمن أن يُقصَر `AND` قبله.
WHERE COALESCE(CASE WHEN json_valid(c.payment_status)
                    THEN json_extract(c.payment_status, '$.collectedAmount') END, 0) > 0
  AND COALESCE(CASE WHEN json_valid(c.fee_structure)
                    THEN json_extract(c.fee_structure, '$.type') END, '') <> 'pro_bono'
  AND NOT EXISTS (
        SELECT 1 FROM client_payments p WHERE p.case_id = c.id AND p.source = 'opening'
      );
