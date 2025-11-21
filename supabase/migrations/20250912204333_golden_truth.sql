/*
  # إنشاء جدول العملاء المحتملين

  1. الجداول الجديدة
    - `prospects`
      - `id` (uuid, primary key)
      - `full_name` (text)
      - `id_number` (text, unique)
      - `phone` (text)
      - `email` (text)
      - `join_date` (date)
      - `client_type` (text)
      - `prospect_status` (text)
      - `notes` (text)
      - `profile_picture` (text, nullable)
      - `commercial_register` (text, nullable)
      - `legal_representative` (jsonb, nullable)
      - `attachments` (jsonb)
      - `source` (text, nullable)
      - `expected_value` (numeric, nullable)
      - `follow_up_date` (date, nullable)
      - `assigned_to` (uuid, nullable, foreign key to users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جدول `prospects`
    - إضافة سياسات للمستخدمين المصادق عليهم
*/

CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  id_number text UNIQUE NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  join_date date NOT NULL DEFAULT CURRENT_DATE,
  client_type text NOT NULL DEFAULT 'individual',
  prospect_status text NOT NULL DEFAULT 'مهتم',
  notes text DEFAULT '',
  profile_picture text,
  commercial_register text,
  legal_representative jsonb,
  attachments jsonb DEFAULT '[]',
  source text,
  expected_value numeric,
  follow_up_date date,
  assigned_to uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

-- سياسة للمستخدمين المصادق عليهم لقراءة العملاء المحتملين
CREATE POLICY "Authenticated users can read prospects"
  ON prospects
  FOR SELECT
  TO authenticated
  USING (true);

-- سياسة للمستخدمين المصرح لهم بإنشاء العملاء المحتملين
CREATE POLICY "Authorized users can create prospects"
  ON prospects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'lawyer' OR role = 'staff')
    )
  );

-- سياسة للمستخدمين المصرح لهم بتحديث العملاء المحتملين
CREATE POLICY "Authorized users can update prospects"
  ON prospects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'lawyer' OR role = 'staff')
    )
  );

-- سياسة للمديرين والمحامين لحذف العملاء المحتملين
CREATE POLICY "Admins and lawyers can delete prospects"
  ON prospects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'lawyer')
    )
  );

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);
CREATE INDEX IF NOT EXISTS idx_prospects_id_number ON prospects(id_number);
CREATE INDEX IF NOT EXISTS idx_prospects_prospect_status ON prospects(prospect_status);
CREATE INDEX IF NOT EXISTS idx_prospects_assigned_to ON prospects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_prospects_follow_up_date ON prospects(follow_up_date);

-- إضافة trigger لتحديث updated_at
CREATE TRIGGER update_prospects_updated_at 
  BEFORE UPDATE ON prospects 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();