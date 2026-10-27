-- القضايا المجانية تطوّعاً — نوعُ أتعابٍ رابع.
--
-- ═══ المسألة ═══
--
-- بعضُ القضايا والأعمال القانونية يقدّمها المكتب مجاناً تطوّعاً. ولم يكن
-- في «نوع الأتعاب» ما يقولها: فتُسجَّل «مقدَّم فقط» بمبلغٍ صفر، ولا يُعرف
-- بعدها أكانت تطوّعاً أم أتعاباً لم تُكتب بعد.
--
-- فصار لها رمزٌ: `pro_bono` في `fee_structure.type`. ولا عمودَ يُضاف — بنيةُ
-- الأتعاب JSON في `cases.fee_structure` منذ الهجرة الثانية.
--
-- ═══ والقائمةُ المحفوظة تبلغه ═══
--
-- `DEFAULT_SETTINGS.feeTypes` في الشيفرة يحمله الآن، وذلك يكفي مكتباً لم
-- يحرّر أنواعَ الأتعاب. أمّا من حرّرها من «تكوين النظام» فقائمتُه محفوظةٌ في
-- صفّ `settings` وتُقرأ كما هي — فلا يظهر له الخيار. فيُلحق بآخرها، ويبقى
-- ما قبله على ترتيبه.
--
-- ═══ وهي آمنةٌ للتكرار ═══
--
-- `NOT EXISTS` يجعل تشغيلَها مرّتين تشغيلاً واحداً. وصفٌّ تالف أو بلا
-- `feeTypes` مصفوفةً لا يُمسّ. ولا صفَّ يُنشأ لمن لم يحفظ شيئاً.

UPDATE system_settings
SET value = json_insert(value, '$.feeTypes[#]', 'pro_bono'),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER)
WHERE key = 'settings'
  AND json_valid(value)
  AND json_type(value, '$.feeTypes') = 'array'
  AND NOT EXISTS (
        SELECT 1
        FROM json_each(system_settings.value, '$.feeTypes') AS stored
        WHERE stored.value = 'pro_bono'
      );
