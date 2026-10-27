-- جرسُ الإشعارات داخل المنصة.
--
-- كانت الإشعاراتُ بالبريد وحده، والبريدُ يلزمه Resend. فصفٌّ لكلّ مستلمٍ هنا
-- يُكتب **مع البريد أو بدونه** — فيعمل الجرسُ في مكتبٍ لم يربط بريداً بعد.
-- والمستلمون هم أنفسُهم: من اشترك في نوع الإشعار ويملك قراءةَ ما يُبلَّغ عنه
-- (`worker/lib/notify.js`).
--
-- `link` اسمُ الشاشة التي يفتحها البند (`cases`، `clients`…)، و`read_at`
-- فراغُه «لم يُقرأ». وما مضى عليه تسعون يوماً يُحذف في دورة الصباح.

CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,                    -- members.user_id
  kind        TEXT NOT NULL,                    -- newCases | newClients | payments | followUps…
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  link        TEXT,
  read_at     INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at, created_at DESC);
