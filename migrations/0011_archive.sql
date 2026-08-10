-- الأرشفة: إخراجُ صفٍّ من الشاشة بلا إتلافه.
--
-- ═══ لماذا عمودٌ لا حذف ═══
--
-- ملفُّ موكّلٍ انتهى عملُه لا يُحذف: قد يعود، وقد يُسأل عنه، وقضاياه
-- شهادةٌ على عملٍ وقع. لكنّه يزحم القائمة على من يبحث عن الحاضر.
--
-- فـ`archived_at` — لحظةُ الأرشفة بالثواني، وفراغُها يعني «حاضر». والصفُّ
-- يبقى في جدوله بمعرّفه وإشاراته، فلا تُقطع قضيةٌ عن عميلها ولا عمولةٌ عن
-- قضيتها.
--
-- ═══ وإضافةُ عمودٍ لا إعادةُ بناء ═══
--
-- `ALTER TABLE ... ADD COLUMN` لا تهدم الجدول، فلا `DROP TABLE`، فلا حذفٌ
-- ضمنيٌّ يشتعل به `ON DELETE CASCADE`. وهذا ما أتلف القضايا في الهجرة
-- العاشرة قبل تصحيحها — ولا يتكرّر ما دام التعديل إضافةَ عمود.

ALTER TABLE clients   ADD COLUMN archived_at INTEGER;
ALTER TABLE prospects ADD COLUMN archived_at INTEGER;
ALTER TABLE cases     ADD COLUMN archived_at INTEGER;

-- القوائم تُرشَّح بها في كل فتحة، فالفهرس عليها لا على شيء بعده.
CREATE INDEX IF NOT EXISTS idx_clients_archived   ON clients(archived_at);
CREATE INDEX IF NOT EXISTS idx_prospects_archived ON prospects(archived_at);
CREATE INDEX IF NOT EXISTS idx_cases_archived     ON cases(archived_at);
