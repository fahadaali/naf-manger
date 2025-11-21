/*
  # إنشاء جدول سجل الأنشطة

  1. الجداول الجديدة
    - `activity_logs`
      - `id` (uuid, primary key)
      - `type` (text)
      - `description` (text)
      - `user_id` (uuid, foreign key to users)
      - `user_name` (text)
      - `entity_id` (text, nullable)
      - `entity_type` (text, nullable)
      - `details` (jsonb, nullable)
      - `created_at` (timestamptz)

  2. الأمان
    - تفعيل RLS على جدول `activity_logs`
    - إضافة سياسات للمستخدمين المصادق عليهم
*/

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  description text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  entity_id text,
  entity_type text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- سياسة للمستخدمين المصادق عليهم لقراءة الأنشطة
CREATE POLICY "Authenticated users can read activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- سياسة للمستخدمين المصادق عليهم لإنشاء أنشطة
CREATE POLICY "Authenticated users can create activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);