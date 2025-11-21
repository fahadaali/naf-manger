/*
  # إنشاء جدول العملاء

  1. الجداول الجديدة
    - `clients`
      - `id` (uuid, primary key)
      - `full_name` (text)
      - `id_number` (text, unique)
      - `phone` (text)
      - `email` (text)
      - `join_date` (date)
      - `client_type` (text)
      - `status` (text)
      - `notes` (text)
      - `profile_picture` (text, nullable)
      - `commercial_register` (text, nullable)
      - `legal_representative` (jsonb, nullable)
      - `attachments` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جدول `clients`
    - إضافة سياسات للمستخدمين المصادق عليهم
*/

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  id_number text UNIQUE NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  join_date date NOT NULL DEFAULT CURRENT_DATE,
  client_type text NOT NULL DEFAULT 'individual',
  status text NOT NULL DEFAULT 'current',
  notes text DEFAULT '',
  profile_picture text,
  commercial_register text,
  legal_representative jsonb,
  attachments jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- سياسة للمستخدمين المصادق عليهم لقراءة العملاء
CREATE POLICY "Authenticated users can read clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

-- سياسة للمستخدمين المصرح لهم بإنشاء العملاء
CREATE POLICY "Authorized users can create clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'lawyer')
    )
  );

-- سياسة للمستخدمين المصرح لهم بتحديث العملاء
CREATE POLICY "Authorized users can update clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'lawyer')
    )
  );

-- سياسة للمديرين فقط لحذف العملاء
CREATE POLICY "Admins can delete clients"
  ON clients
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
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_id_number ON clients(id_number);
CREATE INDEX IF NOT EXISTS idx_clients_client_type ON clients(client_type);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- إضافة trigger لتحديث updated_at
CREATE TRIGGER update_clients_updated_at 
  BEFORE UPDATE ON clients 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();