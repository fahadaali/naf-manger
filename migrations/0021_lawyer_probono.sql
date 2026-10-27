-- المحامي المسؤول وفريقُه، وقيمةُ العمل التطوّعي.
--
-- ═══ المحامي ═══
--
-- `lawyer_id` عضوٌ واحدٌ مسؤولٌ عن القضية، و`team` JSON `[user_id…]` من يعاونه.
-- ويشيران إلى `members(user_id)` منطقياً لا بقيدٍ أجنبي — كـ`assigned_to` في
-- المحتملين: صفُّ العضو يُنشأ بأوّل دخولٍ له، وقيدٌ هنا يُسقط إسناداً لعضوٍ لم
-- يدخل بعد. والرؤيةُ لا تتبدّل به: الكلُّ يرى الكلّ، وللمحامي تصفيةُ «قضاياي».
--
-- ═══ التطوّعي ═══
--
-- القضيةُ التطوّعية بلا أتعاب، لكنّ لها قيمة: ما كان المكتبُ سيتقاضاه. فـ
-- `pro_bono_value` تقديرٌ بالهللات كبقية المبالغ، و`pro_bono_hours` الساعاتُ
-- إن عُدّت. وبهما يُبنى تقريرُ المسؤولية الاجتماعية.
--
-- وكلُّه `ADD COLUMN` — لا `DROP TABLE`، فلا حذفٌ ضمنيٌّ يُشعل `ON DELETE CASCADE`.

ALTER TABLE cases ADD COLUMN lawyer_id TEXT;
ALTER TABLE cases ADD COLUMN team TEXT NOT NULL DEFAULT '[]';
ALTER TABLE cases ADD COLUMN pro_bono_value INTEGER;   -- هللات
ALTER TABLE cases ADD COLUMN pro_bono_hours REAL;

CREATE INDEX IF NOT EXISTS idx_cases_lawyer ON cases(lawyer_id);
