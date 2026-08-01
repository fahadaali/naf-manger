// الصلاحيات الافتراضية لكل دور.
//
// عمود `perms` في جدول الأعضاء يقبل `NULL`، ومعناه «افتراضُ الدور» لا
// «لا صلاحية». وأول دخول يُدرج الصفّ بلا `perms` — فبدون هذا الجدول كان
// كلُّ داخلٍ جديد يصل إلى لوحةٍ لا يرى فيها شيئاً، ولا سبب ظاهر.
//
// ونسخةُ الواجهة من هذا الجدول لا تزال في `UserManagement.tsx`
// (`getDefaultPermissions`). ومصدران لقرارٍ واحد انحرافٌ مؤجَّل — والقرارُ
// النافذ هذا لا ذاك: الواجهة تعرض، وهذا الملفّ يحكم في كل طلب محروس.

const NONE = {
  clients: { create: false, read: false, update: false, delete: false },
  prospects: { create: false, read: false, update: false, delete: false, convert: false },
  cases: { create: false, read: false, update: false, delete: false },
  analytics: { read: false },
  settings: { read: false, update: false },
  users: { create: false, read: false, update: false, delete: false },
  marketers: { create: false, read: false, update: false, delete: false },
};

const BY_ROLE = {
  admin: {
    clients: { create: true, read: true, update: true, delete: true },
    prospects: { create: true, read: true, update: true, delete: true, convert: true },
    cases: { create: true, read: true, update: true, delete: true },
    analytics: { read: true },
    settings: { read: true, update: true },
    users: { create: true, read: true, update: true, delete: true },
    marketers: { create: true, read: true, update: true, delete: true },
  },
  lawyer: {
    clients: { create: true, read: true, update: true, delete: false },
    prospects: { create: true, read: true, update: true, delete: false, convert: true },
    cases: { create: true, read: true, update: true, delete: false },
    analytics: { read: true },
    settings: { read: false, update: false },
    users: { create: false, read: false, update: false, delete: false },
    marketers: { create: false, read: true, update: false, delete: false },
  },
  staff: {
    clients: { create: false, read: true, update: false, delete: false },
    prospects: { create: true, read: true, update: true, delete: false, convert: false },
    cases: { create: false, read: true, update: false, delete: false },
    analytics: { read: false },
    settings: { read: false, update: false },
    users: { create: false, read: false, update: false, delete: false },
    marketers: { create: false, read: false, update: false, delete: false },
  },
};

/**
 * صلاحيات العضو.
 *
 * `perms` المخزَّنة تسبق افتراضَ الدور: مسؤول المنصة قد يضبطها لعضو بعينه
 * من شاشة الصلاحيات، وافتراضُ الدور يدهسها لو قُدّم عليها.
 *
 * ودورٌ لا يعرفه هذا الجدول يأخذ `NONE` لا افتراضاً سخياً: قيمةٌ غريبة في
 * العمود يجب أن تُغلق الأبواب لا تفتحها.
 */
export function permissionsFor(role, perms) {
  if (perms && typeof perms === 'object') return perms;
  return BY_ROLE[role] ?? NONE;
}
