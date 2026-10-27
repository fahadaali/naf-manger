-- عنوانُ القضية، وموضوعُها مصاغاً — والأصلُ محفوظ.
--
-- «موضوع القضية» إلزاميّ، وما استُورد منه منقولٌ خاماً من ملفّ بيسكامب. فيصوغه
-- الطراز (`basecamp/sync.js` و`phraseCase`)، ويصوغ معه عنواناً قصيراً لجدول القضايا.
--
--   `title`            عنوانُ القضية — يُكتب من الشاشة كذلك.
--   `ai_title`         آخرُ عنوانٍ صاغه الطراز.
--   `ai_summary_text`  آخرُ موضوعٍ صاغه.
--   `summary_raw`      الموضوعُ كما ورد من بيسكامب — لا يضيع بالصياغة.
--
-- والعمودان الآليّان بهما يُعرف أنّ إنساناً لم يمسّ الحقل: ما دام الموضوعُ هو
-- ما صاغه الطراز فهو له، يُعاد صياغتُه إن تبدّل مصدرُه؛ ومتى عُدّل بيدٍ صار لها.
--
-- وكلُّه `ADD COLUMN` — لا `DROP TABLE`.

ALTER TABLE cases ADD COLUMN title TEXT;
ALTER TABLE cases ADD COLUMN ai_title TEXT;
ALTER TABLE cases ADD COLUMN ai_summary_text TEXT;
ALTER TABLE cases ADD COLUMN summary_raw TEXT;
