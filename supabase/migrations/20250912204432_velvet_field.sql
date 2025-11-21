/*
  # إنشاء جدول مدفوعات العمولات

  1. الجداول الجديدة
    - `commission_payments`
      - `id` (uuid, primary key)
      - `marketer_id` (uuid, foreign key to marketers)
      - `case_id` (uuid, foreign key to cases)
      - `amount` (numeric)
      - `payment_date` (date)
      - `notes` (text, nullable)
      - `created_by` (uuid, foreign key to users)
      - `created_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جدول `commission_payments`
    - إضافة سياسات للمستخدمين المصادق عليهم
*/

CREATE TABLE IF NOT EXISTS commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketer_id uuid NOT NULL REFERENCES marketers(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;

-- سياسة للمستخدمين المصادق عليهم لقراءة مدفوعات العمولات
CREATE POLICY "Authenticated users can read commission payments"
  ON commission_payments
  FOR SELECT
  TO authenticated
  USING (true);

-- سياسة للمديرين والمحامين لإنشاء مدفوعات العمولات
CREATE POLICY "Authorized users can create commission payments"
  ON commission_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'lawyer')
    )
  );

-- سياسة للمديرين فقط لتحديث وحذف مدفوعات العمولات
CREATE POLICY "Admins can manage commission payments"
  ON commission_payments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_commission_payments_marketer_id ON commission_payments(marketer_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_case_id ON commission_payments(case_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_payment_date ON commission_payments(payment_date);