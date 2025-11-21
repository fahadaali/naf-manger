/*
  # إنشاء جدول القضايا

  1. الجداول الجديدة
    - `cases`
      - `id` (uuid, primary key)
      - `case_number` (text, unique)
      - `case_type` (text)
      - `client_id` (uuid, foreign key to clients)
      - `client_name` (text)
      - `summary` (text)
      - `status` (text)
      - `outcome` (text, nullable)
      - `basecamp_url` (text, nullable)
      - `marketer_id` (uuid, nullable, foreign key to marketers)
      - `marketer_name` (text, nullable)
      - `fee_structure` (jsonb, nullable)
      - `payment_status` (jsonb, nullable)
      - `commission_structure` (jsonb, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جدول `cases`
    - إضافة سياسات للمستخدمين المصادق عليهم
*/

CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text UNIQUE NOT NULL,
  case_type text NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  outcome text,
  basecamp_url text,
  marketer_id uuid,
  marketer_name text,
  fee_structure jsonb,
  payment_status jsonb,
  commission_structure jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- سياسة للمستخدمين المصادق عليهم لقراءة القضايا
CREATE POLICY "Authenticated users can read cases"
  ON cases
  FOR SELECT
  TO authenticated
  USING (true);

-- سياسة للمستخدمين المصرح لهم بإنشاء القضايا
CREATE POLICY "Authorized users can create cases"
  ON cases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'lawyer')
    )
  );

-- سياسة للمستخدمين المصرح لهم بتحديث القضايا
CREATE POLICY "Authorized users can update cases"
  ON cases
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'lawyer')
    )
  );

-- سياسة للمديرين فقط لحذف القضايا
CREATE POLICY "Admins can delete cases"
  ON cases
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_case_type ON cases(case_type);
CREATE INDEX IF NOT EXISTS idx_cases_marketer_id ON cases(marketer_id);

-- إضافة trigger لتحديث updated_at
CREATE TRIGGER update_cases_updated_at 
  BEFORE UPDATE ON cases 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();