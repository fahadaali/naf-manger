import React, { useState, useEffect } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { User, UserPermissions } from '../../types';
import { db } from '../../data/database';
import { formatDate, formatDateTime, formatTime } from '@/registry/naf/lib/format';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    role: 'staff',
    password: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const loadUsersAsync = async () => {
      try {
        const allUsers = await db.getUsers();
        setUsers(allUsers);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    
    loadUsersAsync();
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'مدير النظام';
      case 'lawyer': return 'محامي';
      case 'staff': return 'إداري';
      default: return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive-soft text-destructive-strong';
      case 'lawyer': return 'bg-primary-soft text-primary-strong';
      case 'staff': return 'bg-success-soft text-success-strong';
      default: return 'bg-muted text-foreground';
    }
  };

  const formatLastLogin = (date?: Date) => {
    if (!date) return 'لم يسجل دخول';
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `منذ ${diffInMinutes} دقيقة`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `منذ ${hours} ساعة`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `منذ ${days} يوم`;
    }
  };

  const handleCreateUser = async () => {
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      setSaveMessage('جميع الحقول مطلوبة');
      return;
    }

    setIsSaving(true);
    setSaveMessage('');

    try {
      const userData: Omit<User, 'id'> = {
        name: newUserData.name,
        email: newUserData.email,
        role: newUserData.role as User['role'],
        createdDate: new Date(),
        permissions: getDefaultPermissions(newUserData.role as User['role'])
      };

      await db.createUser(userData);
      await loadUsers();
      setShowCreateModal(false);
      setNewUserData({ name: '', email: '', role: 'staff', password: '' });
      setSaveMessage('تم إنشاء المستخدم بنجاح');

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error creating user:', error);
      setSaveMessage('حدث خطأ أثناء إنشاء المستخدم');
    } finally {
      setIsSaving(false);
    }
  };

  const getDefaultPermissions = (role: User['role']): UserPermissions => {
    switch (role) {
      case 'admin':
        return {
          clients: { create: true, read: true, update: true, delete: true },
          prospects: { create: true, read: true, update: true, delete: true, convert: true },
          cases: { create: true, read: true, update: true, delete: true },
          analytics: { read: true },
          settings: { read: true, update: true },
          users: { create: true, read: true, update: true, delete: true },
          marketers: { create: true, read: true, update: true, delete: true }
        };
      case 'lawyer':
        return {
          clients: { create: true, read: true, update: true, delete: false },
          prospects: { create: true, read: true, update: true, delete: false, convert: true },
          cases: { create: true, read: true, update: true, delete: false },
          analytics: { read: true },
          settings: { read: false, update: false },
          users: { create: false, read: false, update: false, delete: false },
          marketers: { create: false, read: true, update: false, delete: false }
        };
      case 'staff':
        return {
          clients: { create: false, read: true, update: false, delete: false },
          prospects: { create: true, read: true, update: true, delete: false, convert: false },
          cases: { create: false, read: true, update: false, delete: false },
          analytics: { read: false },
          settings: { read: false, update: false },
          users: { create: false, read: false, update: false, delete: false },
          marketers: { create: false, read: false, update: false, delete: false }
        };
      default:
        return {
          clients: { create: false, read: false, update: false, delete: false },
          prospects: { create: false, read: false, update: false, delete: false, convert: false },
          cases: { create: false, read: false, update: false, delete: false },
          analytics: { read: false },
          settings: { read: false, update: false },
          users: { create: false, read: false, update: false, delete: false },
          marketers: { create: false, read: false, update: false, delete: false }
        };
    }
  };

  const handleUpdatePermissions = async (user: User, newPermissions: UserPermissions) => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      await db.updateUser(user.id, { permissions: newPermissions });
      await loadUsers();
      setEditingUser(null);
      setSaveMessage('تم تحديث الصلاحيات بنجاح');

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error updating permissions:', error);
      setSaveMessage('حدث خطأ أثناء تحديث الصلاحيات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (window.confirm(`هل أنت متأكد من حذف المستخدم "${user.name}"؟`)) {
      try {
        const success = await db.deleteUser(userId);
        if (success) {
          await loadUsers();
          setSaveMessage('تم حذف المستخدم بنجاح');
          setTimeout(() => setSaveMessage(''), 3000);
        } else {
          setSaveMessage('لا يمكن حذف هذا المستخدم');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        setSaveMessage('حدث خطأ أثناء حذف المستخدم');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">إدارة المستخدمين</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          إضافة مستخدم جديد
        </button>
      </div>

      {saveMessage && (
        <div className={`p-3 rounded-lg ${
          saveMessage.includes('نجاح') ? 'bg-success-soft text-success-strong' : 'bg-destructive-soft text-destructive-strong'
        }`}>
          {saveMessage}
        </div>
      )}

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">
                المستخدم
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">
                الدور
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">
                آخر تسجيل دخول
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">
                تاريخ الإنشاء
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tabular-nums">
                إجراءات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted">
                <td className="px-6 py-4 tabular-nums">
                  <div>
                    <div className="text-sm font-medium text-foreground">{user.name}</div>
                    <div className="text-sm text-muted-foreground"><bdi>{user.email}</bdi></div>
                  </div>
                </td>
                <td className="px-6 py-4 tabular-nums">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground tabular-nums">
                  {formatLastLogin(user.lastLogin)}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground tabular-nums">
                  <bdi>{formatDate(user.createdDate)}</bdi>
                </td>
                <td className="px-6 py-4 tabular-nums">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="text-primary hover:text-primary-strong p-1"
                      title="تعديل الصلاحيات"
                    >
                      <ShieldCheck className="h-4 w-4" />
                    </button>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-destructive hover:text-destructive-strong p-1"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">إضافة مستخدم جديد</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">الاسم الكامل</label>
                <input
                  type="text"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">الدور</label>
                <select 
                  value={newUserData.role}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="staff">إداري</option>
                  <option value="lawyer">محامي</option>
                  <option value="admin">مدير النظام</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">كلمة المرور المؤقتة</label>
                <input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUserData({ name: '', email: '', role: 'staff', password: '' });
                }}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                إلغاء
              </button>
              <button 
                onClick={handleCreateUser}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-4 py-2 rounded-lg"
              >
                {isSaving ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-overlay flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              تعديل صلاحيات: {editingUser.name}
            </h3>
            
            <div className="space-y-6">
              {Object.entries(editingUser.permissions).map(([resource, permissions]) => (
                <div key={resource} className="border rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-3">
                    {resource === 'clients' ? 'العملاء' :
                     resource === 'prospects' ? 'العملاء المحتملين' :
                     resource === 'cases' ? 'القضايا' :
                     resource === 'analytics' ? 'التحليلات' :
                     resource === 'settings' ? 'الإعدادات' :
                     resource === 'users' ? 'المستخدمين' : resource}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(permissions as any).map(([action, allowed]) => (
                      <label key={action} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allowed as boolean}
                          onChange={(e) => {
                            const newPermissions = {
                              ...editingUser.permissions,
                              [resource]: {
                                ...editingUser.permissions[resource as keyof UserPermissions],
                                [action]: e.target.checked
                              }
                            };
                            setEditingUser({ ...editingUser, permissions: newPermissions });
                          }}
                          className="rounded border-border text-primary focus-visible:ring-ring"
                        />
                        <span className="text-sm text-foreground">
                          {action === 'create' ? 'إنشاء' :
                           action === 'read' ? 'قراءة' :
                           action === 'update' ? 'تحديث' :
                           action === 'delete' ? 'حذف' :
                           action === 'convert' ? 'تحويل' : action}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                إلغاء
              </button>
              <button 
                onClick={() => handleUpdatePermissions(editingUser, editingUser.permissions)}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-4 py-2 rounded-lg"
              >
                {isSaving ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}