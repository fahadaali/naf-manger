/*
  # إنشاء مستخدم مدير افتراضي

  1. إنشاء مستخدم مدير النظام
    - البريد الإلكتروني: admin@naflaw.com
    - الاسم: محمد أحمد النافع
    - الدور: admin
    - صلاحيات كاملة
*/

-- إدراج مستخدم المدير الافتراضي
INSERT INTO users (
  id,
  name,
  email,
  role,
  permissions,
  created_at
) VALUES (
  gen_random_uuid(),
  'محمد أحمد النافع',
  'admin@naflaw.com',
  'admin',
  '{
    "clients": {"create": true, "read": true, "update": true, "delete": true},
    "prospects": {"create": true, "read": true, "update": true, "delete": true, "convert": true},
    "cases": {"create": true, "read": true, "update": true, "delete": true},
    "analytics": {"read": true},
    "settings": {"read": true, "update": true},
    "users": {"create": true, "read": true, "update": true, "delete": true},
    "marketers": {"create": true, "read": true, "update": true, "delete": true}
  }'::jsonb,
  now()
) ON CONFLICT (email) DO NOTHING;

-- إدراج مستخدم محامي افتراضي
INSERT INTO users (
  id,
  name,
  email,
  role,
  permissions,
  created_at
) VALUES (
  gen_random_uuid(),
  'سارة أحمد المحامية',
  'lawyer@naflaw.com',
  'lawyer',
  '{
    "clients": {"create": true, "read": true, "update": true, "delete": false},
    "prospects": {"create": true, "read": true, "update": true, "delete": false, "convert": true},
    "cases": {"create": true, "read": true, "update": true, "delete": false},
    "analytics": {"read": true},
    "settings": {"read": false, "update": false},
    "users": {"create": false, "read": false, "update": false, "delete": false},
    "marketers": {"create": false, "read": true, "update": false, "delete": false}
  }'::jsonb,
  now()
) ON CONFLICT (email) DO NOTHING;

-- إدراج مستخدم إداري افتراضي
INSERT INTO users (
  id,
  name,
  email,
  role,
  permissions,
  created_at
) VALUES (
  gen_random_uuid(),
  'أحمد علي الإداري',
  'staff@naflaw.com',
  'staff',
  '{
    "clients": {"create": false, "read": true, "update": false, "delete": false},
    "prospects": {"create": true, "read": true, "update": true, "delete": false, "convert": false},
    "cases": {"create": false, "read": true, "update": false, "delete": false},
    "analytics": {"read": false},
    "settings": {"read": false, "update": false},
    "users": {"create": false, "read": false, "update": false, "delete": false},
    "marketers": {"create": true, "read": true, "update": false, "delete": false}
  }'::jsonb,
  now()
) ON CONFLICT (email) DO NOTHING;