import React, { useState, useEffect } from 'react';
import { CircleCheck, CircleHelp, Gavel, Plus, ShieldCheck, Trash2, TriangleAlert, UserCog } from 'lucide-react';
import { User, UserPermissions } from '../../types';
import { db } from '../../data/database';
import { formatDate } from '@/registry/naf/lib/format';
import { Dialog, DialogContent, DialogTitle } from '@/registry/naf/ui/dialog';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/registry/naf/ui/table';
import { Card } from '@/registry/naf/ui/card';

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

  /* Gavel هنا صلاحيةُ محامٍ لا كيانُ قضية: الجدول عن أدوار
     المستخدمين ولا تظهر فيه قضية. مسجَّل في naf-icons.md. */
  const ROLE = {
    admin: { variant: 'destructive' as const, Icon: ShieldCheck },
    lawyer: { variant: 'primary' as const, Icon: Gavel },
    staff: { variant: 'success' as const, Icon: UserCog }
  };

  const roleOf = (role: string) =>
    ROLE[role as keyof typeof ROLE] ??
    { variant: 'default' as const, Icon: CircleHelp };

  const formatLastLogin = (date?: Date) => {
    if (!date) return 'لم يدخل بعد';
    
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
      setSaveMessage('تمت إضافة المستخدم');

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
      setSaveMessage('تم تحديث الصلاحية');

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
          setSaveMessage('تم حذف المستخدم');
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
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-5 w-5" />
          إضافة مستخدم جديد
        </Button>
      </div>

      {saveMessage && (() => {
        const tone = messageTone(saveMessage);
        const Icon = tone === 'success' ? CircleCheck : TriangleAlert;
        return (
          <Alert variant={tone}>
            <Icon aria-hidden="true" />
            <span>{saveMessage}</span>
          </Alert>
        );
      })()}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                المستخدم
              </TableHead>
              <TableHead>
                الدور
              </TableHead>
              <TableHead>
                آخر نشاط
              </TableHead>
              <TableHead>
                تاريخ الإنشاء
              </TableHead>
              <TableHead>
                إجراءات
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div>
                    <div className="text-sm font-medium text-foreground">{user.name}</div>
                    <div className="text-sm text-muted-foreground"><bdi>{user.email}</bdi></div>
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    const { variant, Icon } = roleOf(user.role);
                    return (
                      <Badge variant={variant}>
                        <Icon aria-hidden="true" />
                        {getRoleLabel(user.role)}
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  {formatLastLogin(user.lastLogin)}
                </TableCell>
                <TableCell>
                  <bdi>{formatDate(user.createdDate)}</bdi>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button onClick={() => setEditingUser(user)} className="text-primary hover:text-primary-strong" title="تعديل الصلاحيات" variant="ghost" size="icon-sm">
                      <ShieldCheck className="h-4 w-4" />
                    </Button>
                    {user.role !== 'admin' && (
                      <Button onClick={() => handleDeleteUser(user.id)} className="text-destructive hover:text-destructive-strong" title="حذف" variant="ghost" size="icon-sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create User Modal */}
      {showCreateModal && (
        <Dialog open onOpenChange={(next) => { if (!next) setShowCreateModal(false); }}>
        <DialogContent className="max-w-md p-6 p-0">
            <DialogTitle className="text-lg font-semibold mb-4">إضافة مستخدم جديد</DialogTitle>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">الاسم الكامل</label>
                <Input
                  type="text"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">البريد الإلكتروني</label>
                <Input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">الدور</label>
                <Select 
                  value={newUserData.role}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="staff">إداري</option>
                  <option value="lawyer">محامي</option>
                  <option value="admin">مدير النظام</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">كلمة المرور المؤقتة</label>
                <Input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button onClick={() => { setShowCreateModal(false); setNewUserData({ name: '', email: '', role: 'staff', password: '' }); }} variant="ghost">
                إلغاء
              </Button>
              <Button onClick={handleCreateUser} disabled={isSaving}>
                {isSaving ? 'جارٍ الإنشاء' : 'إنشاء المستخدم'}
              </Button>
            </div>
          </DialogContent>
      </Dialog>
      )}

      {/* Edit Permissions Modal */}
      {editingUser && (
        <Dialog open onOpenChange={(next) => { if (!next) setEditingUser(null); }}>
        <DialogContent className="max-w-2xl p-6 max-h-full overflow-y-auto p-0">
            <DialogTitle className="text-lg font-semibold mb-4">
              تعديل صلاحيات: {editingUser.name}
            </DialogTitle>
            
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
              <Button onClick={() => setEditingUser(null)} variant="ghost">
                إلغاء
              </Button>
              <Button onClick={() => handleUpdatePermissions(editingUser, editingUser.permissions)} disabled={isSaving}>
                {isSaving ? 'جارٍ الحفظ' : 'حفظ الصلاحيات'}
              </Button>
            </div>
          </DialogContent>
      </Dialog>
      )}
    </div>
  );
}