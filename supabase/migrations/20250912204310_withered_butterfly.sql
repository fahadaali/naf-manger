/*
  # إنشاء جدول المستخدمين

  1. الجداول الجديدة
    - `users`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text, unique)
      - `role` (text)
      - `permissions` (jsonb)
      - `profile_picture` (text, nullable)
      - `last_login` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جدول `users`
    - إضافة سياسة للمستخدمين المصادق عليهم لقراءة بياناتهم
    - إضافة سياسة للمديرين لإدارة جميع المستخدمين
*/

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  permissions jsonb NOT NULL DEFAULT '{}',
  profile_picture text,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- سياسة للمستخدمين لقراءة بياناتهم الخاصة
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- سياسة للمستخدمين لتحديث بياناتهم الخاصة
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- سياسة للمديرين لقراءة جميع المستخدمين
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- سياسة للمديرين لإدارة جميع المستخدمين
CREATE POLICY "Admins can manage all users"
  ON users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- إنشاء فهرس على البريد الإلكتروني لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- إنشاء فهرس على الدور لتحسين الاستعلامات
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- إضافة trigger لتحديث updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();