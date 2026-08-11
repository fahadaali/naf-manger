-- ما يستحقّ نظرَ إنسان — يُجمع ولا يوقف شيئاً.
--
-- ═══ المسألة ═══
--
-- المزامنةُ الآلية تكتب بلا معاينة، وهي كذلك من أوّل يوم. لكنّها تُنتج
-- في طريقها أشياءَ تستحقّ نظراً: نوعٌ اقترحه الطراز، ولفظٌ لم يُفهم،
-- ورقمُ قضيةٍ مولَّد، ومشروعٌ صُنّف آلياً، واسمٌ يشبه اسماً.
--
-- وكانت هذه **تنبيهاتٍ في ناتج المعاينة**: نصٌّ يُعرض لمن شغّل معاينةً،
-- ويتبخّر مع الدورة. فمن يعتمد على الجدولة لا يراها أصلاً، ومن يريد أن
-- يراها يُشغّل معاينةً في كل مرّة — وهو التطويلُ بعينه.
--
-- ═══ فتُحفظ صفوفاً تُحسم مرّةً ═══
--
-- تكتبها المزامنةُ وتمضي — **لا تنتظر أحداً ولا تحجب كتابة**. ويفتحها
-- صاحبُ المكتب متى شاء فيحسمها في ضغطة، ولا تعود.
--
-- و«لا تعود» شرطُ العمل كلِّه: `UNIQUE (project_id, kind, fingerprint)`.
-- فالصفُّ يُفتح مرّةً لكلّ (مشروعٍ + نوعِ سؤالٍ + قيمةٍ سُئل عنها)، ومتى
-- حُسم بقي محسوماً — ولا تُعيد الدورةُ التالية فتحَه. ولا يُفتح ثانيةً
-- إلا إذا تبدّل ما سُئل عنه، وحينها هو سؤالٌ آخرُ بحقّ.

CREATE TABLE IF NOT EXISTS basecamp_reviews (
  id           TEXT PRIMARY KEY,

  -- project_kind | case_type | unresolved_value | similar_client | generated_number
  kind         TEXT NOT NULL,

  project_id   TEXT NOT NULL,
  case_id      TEXT,
  client_id    TEXT,

  -- الحقل أو اللفظ الذي دار عليه السؤال، وتفصيلُه JSON لما تحتاجه الشاشة.
  subject      TEXT,
  detail       TEXT,

  -- ما دام هو هو فالسؤال هو هو. وتبدُّلُه سؤالٌ جديد يُفتح له صفّ.
  fingerprint  TEXT NOT NULL,

  created_at   INTEGER NOT NULL,
  resolved_at  INTEGER,
  resolution   TEXT,
  decided_by   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bc_reviews_once
  ON basecamp_reviews(project_id, kind, fingerprint);

-- والقائمةُ تُقرأ مفتوحةً وحدها، والأحدثُ أولاً.
CREATE INDEX IF NOT EXISTS idx_bc_reviews_open
  ON basecamp_reviews(resolved_at, created_at DESC);
