-- وافق: ما يُعاد به قراءةُ الفاتورة والمشروع — وبصمةُ الموضوع المقترح.
--
-- ═══ وافق ═══
--
-- الدفعةُ عند وافق لا تحمل وصفاً: فيها `reference` و`project` ومعرّفاتُ
-- فواتيرها. وتفصيلُ العمل في بنود الفاتورة. فتُحفظ المعرّفات ليُعيد زرُّ
-- «اربط بالذكاء الاصطناعي الآن» قراءةَ فاتورةٍ لم يُحفظ نصُّها، بلا جلب
-- الدفعات من جديد؛ ويُحفظ اسمُ المشروع لأنه قد يكون اسمَ القضية.
--
-- ═══ الموضوعُ المقترح ═══
--
-- قضيةٌ بلا «موضوع مشروع» يُصاغ لها موضوعٌ من ملفّ بيسكامب ونشاط المشروع
-- (`basecamp/sync.js`). والبصمةُ تمنع إعادةَ السؤال عن مصدرٍ لم يتبدّل.
--
-- وكلُّه `ADD COLUMN` — لا `DROP TABLE`.

ALTER TABLE wafeq_payments ADD COLUMN invoice_ids TEXT;     -- JSON: معرّفاتُ الفواتير
ALTER TABLE wafeq_payments ADD COLUMN project_id TEXT;
ALTER TABLE wafeq_payments ADD COLUMN project_name TEXT;

ALTER TABLE cases ADD COLUMN ai_topic_hash TEXT;
