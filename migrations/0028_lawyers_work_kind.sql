-- المحامون قائمةٌ بذاتها، ونوعُ العمل، و«جارية» حالةٌ واحدة.
--
-- ═══ المحامون ═══
--
-- كان المحامي المسؤول يُختار من مستخدمي المنصة — ومن المحامين من لا يدخلها.
-- فصار لهم جدولٌ يُدار من الإعدادات، وكلٌّ منهم قد يُربط بحساب مستخدم
-- (`member_id`) فتعمل «قضاياي» لصاحبه، وقد لا يُربط.
--
-- و`cases.lawyer_id` و`cases.team` تحمل اليومَ معرّفاتِ أعضاء. فيُزرع الجدولُ
-- بهم **بمعرّفاتهم نفسِها** (`id = user_id`): كلُّ مرجعٍ قائمٍ يبقى صحيحاً بلا
-- تعديل صفٍّ واحد في القضايا.
--
-- ═══ نوعُ العمل ═══
--
-- «قضيةٌ منظورة أمام جهة» غيرُ «عملٍ قانونيٍّ مستمرّ» (عقودٌ، استشارات، تأسيس).
-- `work_kind`: `litigation` أو `legal_work`، وغيابُه يعني «يُستنتج» — من الجهة
-- المختصة أو رقمِ القضية لديها أو نوعٍ يبدأ بـ«قضية» (`worker/lib/work-kind.js`).
--
-- ═══ «منظورة» و«قيد المعالجة» واحدة ═══
--
-- كانتا حالتين لمعنًى واحد، فتظهر إحداهما صفراً والأخرى بعدد القضايا الجارية
-- كلِّها. فتُدمجان في `in-progress` («جارية»)، ومعها صورةُ المزامنة في
-- `basecamp_projects` لئلّا تُقرأ تعارضاً، وقائمةُ الحالات المحفوظة في الإعدادات
-- (فتعود إلى الافتراضيّ).
--
-- وكلُّه إضافةٌ أو تحديثُ قيم — لا `DROP`.

CREATE TABLE IF NOT EXISTS lawyers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  title       TEXT,                     -- الصفة: محامٍ، مستشار، متدرّب…
  email       TEXT,
  phone       TEXT,
  member_id   TEXT UNIQUE,              -- حسابُه في المنصة إن كان له
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

INSERT OR IGNORE INTO lawyers (id, name, email, member_id, created_at, updated_at)
SELECT m.user_id, COALESCE(NULLIF(m.display_name, ''), m.email, m.user_id), m.email, m.user_id,
       CAST(strftime('%s', 'now') AS INTEGER), CAST(strftime('%s', 'now') AS INTEGER)
  FROM members m
 WHERE m.role = 'lawyer'
    OR m.user_id IN (SELECT lawyer_id FROM cases WHERE lawyer_id IS NOT NULL)
    OR m.user_id IN (SELECT value FROM cases, json_each(cases.team) WHERE json_valid(cases.team));

ALTER TABLE cases ADD COLUMN work_kind TEXT;

UPDATE cases SET status = 'in-progress' WHERE status = 'pending';
UPDATE basecamp_projects
   SET synced_values = json_set(synced_values, '$.case.status', 'in-progress')
 WHERE json_valid(synced_values) AND json_extract(synced_values, '$.case.status') = 'pending';
UPDATE system_settings SET value = json_remove(value, '$.caseStatuses')
 WHERE key = 'settings' AND json_valid(value);
