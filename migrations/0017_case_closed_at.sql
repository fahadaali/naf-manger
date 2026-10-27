-- لحظةُ إغلاق القضية.
--
-- ═══ المسألة ═══
--
-- «معدّل الربح» في اللوحة بلا مؤشّرٍ عن الشهر الماضي، وذلك مقصود: لا عمودَ
-- يقول متى أُغلقت القضية. و`updated_at` يتحرّك مع أيّ تعديل، فبناءُ «ربحُ
-- هذا الشهر» عليه يقيس التحريرَ لا الحُكم.
--
-- فـ`closed_at`: لحظةُ صيرورة الحالة `completed` بالثواني، وفراغُها يعني
-- «لم تُغلق». وترجعُ القضيةُ مفتوحةً فيُفرَّغ.
--
-- ═══ ويكتبه القاعدةُ لا الشيفرة ═══
--
-- الحالةُ تُكتب من أبوابٍ كثيرة: نافذةُ القضية، والفعلُ الجماعي، ومزامنةُ
-- بيسكامب، وحسمُ اختلاف، ولوحُ المراجعة. وعمودٌ يُكتب في كلٍّ منها يُنسى في
-- أحدها. فمشغّلان هنا يكتبانه أيّاً كان الباب.
--
-- و`UPDATE OF status` لا يشتعل إلا حين تكون الحالة في جملة التعديل، و`WHEN`
-- لا يمضي إلا إن تبدّلت فعلاً — فحفظُ قضيةٍ مكتملةٍ ثانيةً لا يُزحزح لحظةَ
-- إغلاقها. والتعديلُ داخل المشغّل لا يمسّ الحالة، فلا يُعيد إشعالَه.
--
-- وكلُّه `ADD COLUMN` — لا `DROP TABLE`، فلا حذفٌ ضمنيٌّ يُشعل
-- `ON DELETE CASCADE` كما وقع في الهجرة العاشرة.

ALTER TABLE cases ADD COLUMN closed_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_cases_closed_at ON cases(closed_at);

-- ═══ ما أُغلق قبل هذا ═══
-- لا يُعرف متى أُغلق حقّاً. وأقربُ ما في الصفّ آخرُ تعديلٍ له — وهو تقديرٌ
-- يُقال لا يُدّعى غيرُه: قضيةٌ استُوردت مكتملةً تُعدّ مغلقةً يومَ استيرادها.
UPDATE cases SET closed_at = updated_at WHERE status = 'completed' AND closed_at IS NULL;

CREATE TRIGGER IF NOT EXISTS cases_closed_at_on_insert
AFTER INSERT ON cases
WHEN NEW.status = 'completed' AND NEW.closed_at IS NULL
BEGIN
  UPDATE cases SET closed_at = NEW.updated_at WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS cases_closed_at_on_status
AFTER UPDATE OF status ON cases
WHEN NEW.status IS NOT OLD.status
BEGIN
  UPDATE cases
     SET closed_at = CASE WHEN NEW.status = 'completed'
                          THEN CAST(strftime('%s', 'now') AS INTEGER)
                          ELSE NULL END
   WHERE id = NEW.id;
END;
