-- الاجتماعات.
--
-- ═══ لماذا وُجد هذا الجدول ═══
--
-- كانت نافذة الاجتماع تكتب معرّفاً ثابتاً في الشيفرة — `2534928083` —
-- لكل اجتماع ولكل عميل، ولا تنادي واجهة Zoom إطلاقاً. ثم تحفظ التفاصيل
-- في `localStorage` فلا يراها إلا من أنشأها على جهازه هو، ولا تُقرأ من
-- أي شاشة بعد ذلك.
--
-- فالاجتماع الآن يُنشأ في Zoom ويُحفظ هنا: معرّفُه ورابطاه من ردّ Zoom،
-- ومرجعُه إلى العميل أو المحتمل الذي عُقد له.

CREATE TABLE IF NOT EXISTS meetings (
  id            TEXT PRIMARY KEY,

  -- معرّف الاجتماع عند Zoom ورابطاه — كما ردّها المزوّد لا كما بُنيت هنا.
  provider      TEXT NOT NULL DEFAULT 'zoom',
  provider_id   TEXT NOT NULL,
  join_url      TEXT NOT NULL,
  start_url     TEXT,

  topic         TEXT NOT NULL,
  agenda        TEXT NOT NULL DEFAULT '',
  -- لحظةُ البدء بالثواني — لا تاريخٌ مجرّد: للاجتماع وقتٌ ومنطقةٌ زمنية.
  start_at      INTEGER NOT NULL,
  duration      INTEGER NOT NULL DEFAULT 60,
  passcode      TEXT,

  -- لمن عُقد. `subject_type` من `client | prospect`، و`subject_id` صفُّه.
  -- ولا `REFERENCES`: الجدولان مختلفان، وقيدٌ واحد لا يشير إلى اثنين.
  subject_type  TEXT,
  subject_id    TEXT,

  -- المدعوّون: قائمةُ بريدٍ JSON. والدعوة لا تُرسَل بعد — لا مُرسِل بريد.
  invitees      TEXT NOT NULL DEFAULT '[]',

  created_by    TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meetings_subject ON meetings(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start   ON meetings(start_at DESC);
