/*
  # إنشاء جدول المسوّقين

  1. الجداول الجديدة
    - `marketers`
      - `id` (uuid, primary key)
      - `full_name` (text)
      - `id_number` (text, unique)
      - `phone` (text)
      - `email` (text)
      - `relationship_type` (text)
      - `start_date` (date)
      - `status` (text)
      - `notes` (text)
      - `profile_picture` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جدول `marketers`
    - إضافة سياسات للمستخدمين المصادق عليهم
*/

CREATE TABLE IF NOT EXISTS marketers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  id_number text UNIQUE NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  relationship_type text NOT NULL DEFAULT 'freelancer',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  notes text DEFAULT '',
  profile_picture text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE marketers ENABLE ROW LEVEL SECURITY;

-- سياسة للمستخدمين المصادق عليهم لقراءة المسوّقين
CREATE POLICY "Authenticated users can read marketers"
  ON marketers
  FOR SELECT
  TO authenticated
  USING (true);

-- سياسة للمستخدمين المصرح لهم بإنشاء المسوّقين
CREATE POLICY "Authorized users can create marketers"
  ON marketers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'staff')
    )
  );

-- سياسة للمستخدمين المصرح لهم بتحديث المسوّقين
CREATE POLICY "Authorized users can update marketers"
  ON marketers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'staff')
    )
  );

-- سياسة للمديرين فقط لحذف المسوّقين
CREATE POLICY "Admins can delete marketers"
  ON marketers
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
CREATE INDEX IF NOT EXISTS idx_marketers_email ON marketers(email);
CREATE INDEX IF NOT EXISTS idx_marketers_id_number ON marketers(id_number);
CREATE INDEX IF NOT EXISTS idx_marketers_status ON marketers(status);

-- إضافة trigger لتحديث updated_at
CREATE TRIGGER update_marketers_updated_at 
  BEFORE UPDATE ON marketers 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- إضافة foreign key constraint للقضايا
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cases_marketer_id_fkey'
  ) THEN
    ALTER TABLE cases ADD CONSTRAINT cases_marketer_id_fkey 
    FOREIGN KEY (marketer_id) REFERENCES marketers(id);
  END IF;
END $$;