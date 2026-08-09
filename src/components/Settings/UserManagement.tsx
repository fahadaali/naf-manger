import { useState, useEffect } from 'react';
import { CircleCheck, CircleHelp, Gavel, ShieldCheck, Trash2, TriangleAlert, UserCog } from 'lucide-react';
import { User, UserPermissions } from '../../types';
import { db } from '../../data/database';
import { formatDate } from '@/registry/naf/lib/format';
import { Dialog, DialogContent, DialogTitle } from '@/registry/naf/ui/dialog';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/registry/naf/ui/table';
import { Card } from '@/registry/naf/ui/card';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
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
      case 'admin': return 'مسؤول النظام';
      case 'lawyer': return 'محامٍ';
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

  /* ═══ العضوية تبدأ من المركز لا من هنا ═══
   *
   * كان هنا `handleCreateUser` ينادي `db.createUser` — وهي ترمي
   * `managed_by_center` دائماً — فكلُّ ضغطةٍ تنتهي بـ«حدث خطأ أثناء إنشاء
   * المستخدم» بلا سببٍ ظاهر. ونموذجُه يطلب كلمةَ مرورٍ لنظامٍ لا كلمةَ
   * مرورٍ محليةً فيه أصلاً.
   *
   * والسبب بنيويّ لا عابر: العضو صفٌّ في `members` مفتاحُه `sub` القادم من
   * المركز، ويُنشأ بأول دخول. وصفٌّ يُدرَج هنا بلا هويةٍ هناك لا يستطيع
   * صاحبُه الدخول — فالإنشاء المحلي لا يعطي أحداً وصولاً.
   *
   * وكان هنا كذلك `getDefaultPermissions` — نسخةٌ ثانية من جدول
   * `worker/lib/roles.js`، وهو الحاكم في كل طلبٍ محروس. ومصدران لقرارٍ
   * واحد انحرافٌ مؤجَّل، فسقطت النسخة مع مُستعمِلها الوحيد.
   */

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
      <h3 className="text-lg font-semibold text-foreground">إدارة المستخدمين</h3>

      {/* كان هنا زرُّ «إضافة مستخدم جديد» ونموذجُه — ومسارُه ينتهي دائماً
          بخطأ. والعضوية تبدأ من المركز، وهذه الشاشة ترقّي وتوقف. */}
      <Alert variant="info">
        <CircleHelp aria-hidden="true" />
        <span>
          يُضاف العضو من المركز، ويظهر هنا بعد أول دخولٍ له بدور «إداري». ومن هذه
          الشاشة تُغيَّر صلاحياتُه أو يُوقف وصولُه.
        </span>
      </Alert>

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