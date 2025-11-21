/*
  # إضافة مستخدم مدير جديد

  1. إضافة مستخدم جديد
    - `id` (uuid): ca9eed8c-7b3e-41d7-bff9-e5f33011514e
    - `name` (text): فهد العتيبي
    - `email` (text): fahad2ao@gmail.com
    - `role` (text): admin
    - `permissions` (jsonb): صلاحيات كاملة للمدير

  2. الصلاحيات المضافة
    - صلاحيات كاملة لجميع الموارد (العملاء، القضايا، المستخدمين، إلخ)
    - إمكانية إنشاء وقراءة وتحديث وحذف جميع البيانات
    - الوصول إلى جميع التحليلات والإعدادات
*/

-- إضافة المستخدم الجديد مع صلاحيات المدير الكاملة
INSERT INTO public.users (
  id,
  name,
  email,
  role,
  permissions,
  created_at,
  updated_at
) VALUES (
  'ca9eed8c-7b3e-41d7-bff9-e5f33011514e',
  'فهد العتيبي',
  'fahad2ao@gmail.com',
  'admin',
  '{
    "clients": {
      "create": true,
      "read": true,
      "update": true,
      "delete": true
    },
    "prospects": {
      "create": true,
      "read": true,
      "update": true,
      "delete": true,
      "convert": true
    },
    "cases": {
      "create": true,
      "read": true,
      "update": true,
      "delete": true
    },
    "analytics": {
      "read": true
    },
    "settings": {
      "read": true,
      "update": true
    },
    "users": {
      "create": true,
      "read": true,
      "update": true,
      "delete": true
    },
    "marketers": {
      "create": true,
      "read": true,
      "update": true,
      "delete": true
    }
  }'::jsonb,
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  permissions = EXCLUDED.permissions,
  updated_at = now();