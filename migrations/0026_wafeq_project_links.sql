-- مشروعُ وافق ← القضية: ربطٌ يُتذكَّر.
--
-- المدفوعاتُ عند وافق مربوطةٌ بفواتير لها **مشروع**، واسمُه في الغالب اسمُ
-- مشروع بيسكامب — أي القضية — أو قريبٌ منه. أمّا الدافعُ فلا يُعتمد عليه:
-- شركةٌ تابعة، أو أخٌ، أو أبٌ، أو صديق.
--
-- فإذا عُرف أنّ مشروعَ وافق X هو القضية Y — بتطابق الاسمين بعد التوحيد
-- (`exact`)، أو بتأكيد إنسانٍ لاقتراح (`confirmed`) أو بربطٍ يدويّ (`manual`) —
-- حُفظ هنا، وتُربط دفعاتُه كلُّها بعدها آلياً (`wafeq/sync.js`).
--
-- وحذفُ القضية يُزيل الربط (`CASCADE`): لا تُربط دفعةٌ بقضيةٍ لم تعد.
-- وجدولٌ جديد — لا `DROP` ولا تعديل.

CREATE TABLE IF NOT EXISTS wafeq_project_links (
  project_id    TEXT PRIMARY KEY,                -- معرّفُ المشروع عند وافق
  project_name  TEXT,
  case_id       TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source        TEXT NOT NULL DEFAULT 'confirmed', -- exact | confirmed | manual
  decided_by    TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wafeq_project_links_case ON wafeq_project_links(case_id);
