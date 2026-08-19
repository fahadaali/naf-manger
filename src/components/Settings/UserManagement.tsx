import { useState, useEffect } from 'react';
import { CircleCheck, CircleHelp, CircleSlash, Gavel, ShieldCheck, TriangleAlert, UserCheck, UserCog, UserX } from 'lucide-react';
import { User, UserPermissions } from '../../types';
import { db } from '../../data/database';
import { useAuth } from '../../contexts/AuthContext';
import { roleLabel } from '../../lib/labels';
import { formatDate } from '@/registry/naf/lib/format';
import { Dialog, DialogContent, DialogTitle } from '@/registry/naf/ui/dialog';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Select } from '@/registry/naf/ui/select';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/registry/naf/ui/table';
import { Card } from '@/registry/naf/ui/card';

/* الموردُ والفعلُ بأسمائهما — مرآةُ `NONE` في `worker/lib/roles.js`. وكان
   `marketers` ساقطاً من القائمة، فيظهر مفتاحُه الإنجليزي في شاشةٍ عربيةٍ
   كلِّها. */
const RESOURCE_LABEL: Record<string, string> = {
  clients: 'العملاء',
  prospects: 'العملاء المحتملين',
  cases: 'القضايا',
  marketers: 'المسوّقين',
  analytics: 'التحليلات',
  settings: 'الإعدادات',
  users: 'المستخدمين'
};

const ACTION_LABEL: Record<string, string> = {
  create: 'إنشاء',
  read: 'قراءة',
  update: 'تحديث',
  delete: 'حذف',
  convert: 'تحويل'
};

/** الأدوارُ الثلاثة — مرآةُ `BY_ROLE` في `worker/lib/roles.js`، وهو الحاكم. */
const ROLE_OPTIONS = ['admin', 'lawyer', 'staff'];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
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

  /* ═══ الدور يُغيَّر من هنا ═══
   *
   * الخادم يقبله — `updateMember` تكتب `role` — وREADME يقول «تُدار
   * الترقيةُ والإيقاف من شاشة المستخدمين». ولم تكن الشاشة تعرض إلا محرّرَ
   * الصلاحيات الدقيقة، فرفعُ عضوٍ إلى `lawyer` أو `admin` لا سبيل إليه إلا
   * بتعديلٍ مباشر في القاعدة.
   *
   * وتبديلُ الدور يُبدّل الصلاحياتِ معه: `perms` تُمحى فيسري افتراضُ الدور
   * الجديد من `worker/lib/roles.js`. ولولا ذلك لبقي عضوٌ رُقّي إلى «محامٍ»
   * على صلاحيات «إداري» المحفوظة، فيُقرأ الدورُ شيئاً والصلاحيةُ غيرَه. */
  const handleChangeRole = async (user: User, role: string) => {
    if (role === user.role) return;
    if (!window.confirm(
      `تغيير دور «${user.name}» إلى «${roleLabel(role)}»؟ تعود صلاحياتُه إلى افتراض الدور الجديد.`
    )) return;

    setIsSaving(true);
    setSaveMessage('');
    try {
      await db.updateUser(user.id, { role: role as User['role'], permissions: undefined });
      await loadUsers();
      setSaveMessage('تم تغيير الدور');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error changing role:', error);
      const code = (error as { code?: string })?.code;
      setSaveMessage(
        code === 'cannot_change_self' ? 'لا تغيّر دورك بنفسك' : 'حدث خطأ أثناء تغيير الدور'
      );
    } finally {
      setIsSaving(false);
    }
  };

  /* ═══ الإيقافُ إيقافٌ لا حذف ═══
   *
   * كان الزرُّ `Trash2` والتأكيدُ يقول «حذف» والرسالةُ «تم حذف المستخدم» —
   * والفعلُ الواقع `isActive: false`. والصفُّ يبقى في الجدول كما هو، ولا
   * مؤشّرَ للحالة، ولا سبيلَ لإعادة التفعيل. فيُقرأ الحذفُ واقعاً وهو لم
   * يقع، ويُعاد الضغطُ ولا يتغيّر شيء.
   *
   * والحذفُ الحقيقيّ ليس مقصوداً أصلاً: صفُّ العضو يُيتّم سجلَّ الأنشطة،
   * والإيقافُ يقوم مقامه — الوسيط يقرأ `is_active` في كل طلبٍ محميّ فيسري
   * في الطلب التالي. فالاسمُ يُصحَّح والحالةُ تُعرض ويُفتح الطريقُ عودةً. */
  const handleToggleActive = async (user: User) => {
    const next = !(user.isActive ?? true);
    const question = next
      ? `إعادة تفعيل وصول «${user.name}»؟`
      : `إيقاف وصول «${user.name}»؟ يسري في طلبه التالي، وبياناتُه وسجلُّه يبقيان.`;
    if (!window.confirm(question)) return;

    setIsSaving(true);
    setSaveMessage('');
    try {
      await db.setUserActive(user.id, next);
      await loadUsers();
      setSaveMessage(next ? 'تم تفعيل الوصول' : 'تم إيقاف الوصول');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error toggling access:', error);
      const code = (error as { code?: string })?.code;
      setSaveMessage(
        code === 'cannot_change_self' ? 'لا توقف وصولك بنفسك' : 'حدث خطأ أثناء تغيير الوصول'
      );
    } finally {
      setIsSaving(false);
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
                الوصول
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
            {users.map((user) => {
              const active = user.isActive ?? true;
              const isSelf = user.id === currentUser?.id;
              return (
              <TableRow key={user.id} className={active ? undefined : 'opacity-70'}>
                <TableCell>
                  <div>
                    <div className="text-sm font-medium text-foreground">{user.name}</div>
                    <div className="text-sm text-muted-foreground"><bdi>{user.email}</bdi></div>
                  </div>
                </TableCell>
                <TableCell>
                  {/* الدورُ يُغيَّر من هنا — وهو ما يَعِد به README. ولا
                      يغيّر العضوُ دورَ نفسه: الخادم يردّه بـ`cannot_change_self`،
                      وآخرُ آدمنٍ يفعلها يُغلق الشاشة على الجميع. */}
                  {isSelf ? (
                    (() => {
                      const { variant, Icon } = roleOf(user.role);
                      return (
                        <Badge variant={variant}>
                          <Icon aria-hidden="true" />
                          {roleLabel(user.role)}
                        </Badge>
                      );
                    })()
                  ) : (
                    <Select
                      value={user.role}
                      onChange={(event) => handleChangeRole(user, event.target.value)}
                      disabled={isSaving}
                      aria-label={`دور ${user.name}`}
                      className="w-40"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>{roleLabel(role)}</option>
                      ))}
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  {/* حالةُ التفعيل تُعرض: كانت تُكتب في القاعدة ولا يراها
                      أحد، فيُوقَف عضوٌ ولا يتغيّر في الجدول شيء. */}
                  <Badge variant={active ? 'success' : 'default'}>
                    {active ? <CircleCheck aria-hidden="true" /> : <CircleSlash aria-hidden="true" />}
                    {active ? 'مفعَّل' : 'موقوف'}
                  </Badge>
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
                    {/* والإيقافُ يُرجَع: كان الزرُّ `Trash2` ويقول «حذف»
                        والفعلُ إيقافٌ، ولا طريقَ عودةٍ منه. */}
                    {!isSelf && (
                      <Button
                        onClick={() => handleToggleActive(user)}
                        disabled={isSaving}
                        className={active ? 'text-destructive hover:text-destructive-strong' : 'text-success hover:text-success-strong'}
                        title={active ? 'إيقاف الوصول' : 'إعادة التفعيل'}
                        variant="ghost"
                        size="icon-sm"
                      >
                        {active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
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
                    {RESOURCE_LABEL[resource] ?? resource}
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
                          {ACTION_LABEL[action] ?? action}
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