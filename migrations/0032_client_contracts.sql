-- العقدُ السنويّ — طريقةُ تعاقدٍ على مستوى الموكّل لا القضية.
--
-- ═══ المسألة ═══
--
-- من الموكّلين من يتعاقد مع المكتب سنةً بدفعاتٍ دورية تشمل كلَّ ما يحتاجه
-- فيها، لا أتعاباً لكلّ قضية: مقدَّمٌ ومؤخَّر لا يقولان ذلك. فصار للموكّل عقدٌ
-- له بدايةٌ ونهاية، ودفعةٌ تتكرّر بتكرارٍ يُختار، ومبلغُها قد يتغيّر في أثناء
-- السنة (بعد عشرة أشهر مثلاً) أو عند التجديد.
--
-- ═══ أعمدتُه ═══
--
-- `amount`        مبلغُ الدفعة الواحدة عند البداية — هللات كبقية المبالغ.
-- `frequency`     monthly | quarterly | semiannual | annual.
-- `rate_changes`  تعديلاتُ المبلغ في أثناء العقد: `[{ from: 'YYYY-MM-DD', amount }]`
--                 والمبلغُ فيها ريالاتٌ كبُنى JSON الأخرى (`payment_status`).
--                 كلُّ دفعةٍ يحلّ موعدُها في تاريخِ تعديلٍ أو بعده تأخذ مبلغَه.
-- `renewed_from`  العقدُ السابق إن كان هذا تجديداً له — سلسلةُ السنوات تُقرأ به.
--
-- والجدولُ نفسُه لا يُخزَّن: يُشتقّ من البداية والنهاية والتكرار والتعديلات
-- (`worker/lib/contracts.js`)، فتعديلُ مبلغٍ يُبدّل كلَّ ما بعده بلا صفوفٍ تُصحَّح.
--
-- ═══ دفعاتُه ═══
--
-- سجلٌّ على نمط `client_payments` — لكنّه على العقد لا على قضية: الموكّلُ
-- بعقدٍ سنويّ يدفع عن السنة لا عن قضيةٍ بعينها.
--
-- وكلُّه إضافة — لا `DROP` ولا صفَّ قائمٌ يُمسّ.

CREATE TABLE IF NOT EXISTS client_contracts (
  id            TEXT PRIMARY KEY,
  client_id     TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  start_date    TEXT NOT NULL,                       -- YYYY-MM-DD
  end_date      TEXT NOT NULL,                       -- YYYY-MM-DD شاملٌ
  frequency     TEXT NOT NULL DEFAULT 'monthly',
  amount        INTEGER NOT NULL DEFAULT 0,          -- هللات
  rate_changes  TEXT NOT NULL DEFAULT '[]',
  notes         TEXT NOT NULL DEFAULT '',
  renewed_from  TEXT,
  created_by    TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_client_contracts_client ON client_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contracts_end    ON client_contracts(end_date);

CREATE TABLE IF NOT EXISTS contract_payments (
  id            TEXT PRIMARY KEY,
  contract_id   TEXT NOT NULL REFERENCES client_contracts(id) ON DELETE CASCADE,
  client_id     TEXT,
  amount        INTEGER NOT NULL DEFAULT 0,          -- هللات
  payment_date  TEXT NOT NULL DEFAULT (date('now')), -- YYYY-MM-DD
  method        TEXT,
  reference     TEXT,
  notes         TEXT,
  created_by    TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contract_payments_contract ON contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_client   ON contract_payments(client_id);

-- ═══ «عقد سنوي» نوعُ أتعابٍ للقضية ═══
-- قضايا الموكّل المتعاقد تُعلَّم به، فيُعرف أنّ أتعابها في عقده. ومن حرّر
-- أنواعَ الأتعاب من «تكوين النظام» قائمتُه محفوظة — فيُلحق بآخرها كما أُلحق
-- `pro_bono` في `migrations/0016`.
UPDATE system_settings
SET value = json_insert(value, '$.feeTypes[#]', 'annual_contract'),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER)
WHERE key = 'settings'
  AND json_valid(value)
  AND json_type(value, '$.feeTypes') = 'array'
  AND NOT EXISTS (
        SELECT 1
        FROM json_each(system_settings.value, '$.feeTypes') AS stored
        WHERE stored.value = 'annual_contract'
      );
