-- التقارير المخصّصة.
--
-- ═══ لماذا وُجد هذا الجدول ═══
--
-- كانت ثلاثُ شاشاتٍ كاملة — قائمةٌ وبانٍ وعارض، ألفٌ وسبعةَ عشرَ سطراً —
-- فوق أغلفةٍ تُرجع فراغاً: `getCustomReports() → []` و`updateCustomReport()
-- → null` و`generateReportData() → []`. فيُبنى تقريرٌ ويُضغط «حفظ» فلا
-- يظهر في القائمة ولا يبقى منه أثر، ولا تقول الشاشة إن الميزة لم تُبنَ.

CREATE TABLE IF NOT EXISTS custom_reports (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',

  -- مصدرُ البيانات: `clients | prospects | cases`. ولا `mixed` بعد —
  -- الوصلُ بين جدولين قرارٌ لم يُتَّخذ، وقبولُه هنا يَعِد بما لا يُبنى.
  data_source   TEXT NOT NULL,

  -- تعريفُ التقرير JSON: الحقول والمرشّحات والتجميع والتصوير.
  --
  -- وهو **تعريفٌ لا استعلام**: أسماءُ الأعمدة تُطابَق بقائمةٍ بيضاء في
  -- `worker/lib/reports.js` قبل أن تُبنى جملةُ SQL، والقيمُ تُربط
  -- بمعاملات. فلا يبلغ نصُّ المستخدم جملةً تُنفَّذ.
  definition    TEXT NOT NULL DEFAULT '{}',

  -- تقريرٌ عامّ يراه كلُّ من يملك `analytics.read`؛ وغيرُه لصاحبه وحده.
  is_public     INTEGER NOT NULL DEFAULT 0,
  is_template   INTEGER NOT NULL DEFAULT 0,

  created_by    TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_reports_owner ON custom_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_reports_public ON custom_reports(is_public);
