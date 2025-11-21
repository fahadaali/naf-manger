/*
  # إنشاء جدول إعدادات النظام

  1. الجداول الجديدة
    - `system_settings`
      - `id` (uuid, primary key)
      - `key` (text, unique)
      - `value` (jsonb)
      - `description` (text, nullable)
      - `updated_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جدول `system_settings`
    - إضافة سياسات للمستخدمين المصادق عليهم
*/

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- سياسة للمستخدمين المصادق عليهم لقراءة الإعدادات
CREATE POLICY "Authenticated users can read settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- سياسة للمديرين فقط لتحديث الإعدادات
CREATE POLICY "Admins can update settings"
  ON system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- إنشاء فهرس على المفتاح
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- إضافة trigger لتحديث updated_at
CREATE TRIGGER update_system_settings_updated_at 
  BEFORE UPDATE ON system_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- إدراج الإعدادات الافتراضية
INSERT INTO system_settings (key, value, description) VALUES
  ('client_types', '["individual", "company", "association", "government"]', 'أنواع العملاء المتاحة'),
  ('client_statuses', '["current", "former"]', 'حالات العملاء المتاحة'),
  ('prospect_statuses', '["مهتم", "تم التواصل", "بانتظار توقيع", "غير مناسب", "تم الرفض"]', 'حالات العملاء المحتملين'),
  ('prospect_sources', '["موقع إلكتروني", "وسائل التواصل الاجتماعي", "إحالة من عميل", "إعلان", "معرض", "أخرى"]', 'مصادر العملاء المحتملين'),
  ('case_types', '["قضية تجارية", "قضية عمالية", "قضية مدنية", "قضية جزائية"]', 'أنواع القضايا المتاحة'),
  ('case_statuses', '["pending", "in-progress", "completed", "postponed"]', 'حالات القضايا المتاحة'),
  ('marketer_statuses', '["active", "suspended", "former"]', 'حالات المسوّقين'),
  ('relationship_types', '["employee", "freelancer", "external_company"]', 'أنواع العلاقة مع المسوّقين'),
  ('commission_types', '["fixed_amount", "percentage"]', 'أنواع العمولات'),
  ('collection_statuses', '["fully_paid", "partially_paid", "unpaid"]', 'حالات التحصيل'),
  ('fee_types', '["advance_only", "deferred_only", "advance_and_deferred"]', 'أنواع الأتعاب'),
  ('company_info', '{"name": "NAF Law", "description": "نظام إدارة المكتب القانوني", "primaryColor": "#1e40af", "secondaryColor": "#3b82f6", "accentColor": "#f59e0b"}', 'معلومات الشركة والألوان')
ON CONFLICT (key) DO NOTHING;