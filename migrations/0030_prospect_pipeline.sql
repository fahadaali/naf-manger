-- رحلةُ العميل المحتمل — حالاتٌ أدقّ.
--
-- كانت «مهتم» تعني «وصل الآن» و«مهتمٌّ فعلاً» معاً، ولا مرحلةَ للاستشارة ولا
-- لعرض السعر، ولا حالةَ لمن انقطع. والإغلاقُ «غير مناسب» و«تم الرفض» لا يقول
-- اسمُه من رفض مَن. فصارت:
--
--   جديد ← تم التواصل ← استشارة مجدولة ← تم إرسال عرض السعر ← بانتظار توقيع
--   والإغلاق: لا يرد / متوقف · اعتذرنا عنه · رفض العميل
--
-- والمفرداتُ في `DEFAULT_SETTINGS` (`worker/lib/queries.js`). وهنا تُنقل الصفوفُ
-- القائمة إلى أسمائها الجديدة:
--
--   مهتم       ← تم التواصل   (الأغلبُ أنه تُوُصِّل معه؛ و«جديد» لما يُضاف بعد اليوم)
--   غير مناسب  ← اعتذرنا عنه
--   تم الرفض   ← رفض العميل
--
-- ═══ إلا إن كان المكتبُ قد حرّر قائمته ═══
--
-- الإعدادُ يُحفظ مختلَفاً عن الافتراض وحده (`writeSettings`). فإن وُجدت
-- `prospectStatuses` محفوظةً فقد كتبها مسؤولٌ بيده، والصفوفُ تتبع قائمته لا
-- قائمتنا — فلا تُمسّ، ولا تُمسّ قائمتُه.

UPDATE prospects
SET prospect_status = CASE prospect_status
      WHEN 'مهتم'      THEN 'تم التواصل'
      WHEN 'غير مناسب' THEN 'اعتذرنا عنه'
      WHEN 'تم الرفض'  THEN 'رفض العميل'
      ELSE prospect_status
    END
WHERE prospect_status IN ('مهتم', 'غير مناسب', 'تم الرفض')
  AND NOT EXISTS (
    SELECT 1 FROM system_settings
    WHERE key = 'settings' AND json_valid(value) AND json_extract(value, '$.prospectStatuses') IS NOT NULL
  );

-- والصورةُ المحفوظة لبطاقات بيسكامب تُنقل معها — وإلا رأى الدمجُ التالي
-- «تبدّلت الحالة في المنصة» وهي لم تتبدّل إلا اسماً. (والنقلُ إلى العمود
-- الجديد يقع على كل حال: البطاقةُ في عمودٍ قديمٍ يُقرأ بالحالة الجديدة.)
UPDATE prospects
SET bc_synced_values = json_set(
      bc_synced_values, '$.prospectStatus',
      CASE json_extract(bc_synced_values, '$.prospectStatus')
        WHEN 'مهتم'      THEN 'تم التواصل'
        WHEN 'غير مناسب' THEN 'اعتذرنا عنه'
        WHEN 'تم الرفض'  THEN 'رفض العميل'
      END)
WHERE json_valid(bc_synced_values)
  AND json_extract(bc_synced_values, '$.prospectStatus') IN ('مهتم', 'غير مناسب', 'تم الرفض')
  AND NOT EXISTS (
    SELECT 1 FROM system_settings
    WHERE key = 'settings' AND json_valid(value) AND json_extract(value, '$.prospectStatuses') IS NOT NULL
  );
