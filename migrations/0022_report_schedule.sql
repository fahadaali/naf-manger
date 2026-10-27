-- إرسالُ التقارير المخصّصة دورياً بالبريد.
--
-- `schedule_frequency` — `daily | weekly | monthly`، وفراغُه يعني «لا إرسال».
-- `schedule_recipients` — JSON: معرّفاتُ أعضاء، أو بريدٌ خارجيّ يكتبه المسؤول
--                         وحده. والعضوُ لا يتلقّى تقريراً لا يملك قراءتَه.
-- `last_sent_at` — آخرُ إرسال؛ به يُرسل التقريرُ مرّةً في دورته لا كلَّ ساعة.
--
-- وكلُّه `ADD COLUMN` — لا `DROP TABLE`.

ALTER TABLE custom_reports ADD COLUMN schedule_frequency TEXT;
ALTER TABLE custom_reports ADD COLUMN schedule_recipients TEXT NOT NULL DEFAULT '[]';
ALTER TABLE custom_reports ADD COLUMN last_sent_at INTEGER;
