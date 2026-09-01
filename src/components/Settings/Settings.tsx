import { useEffect, useState } from 'react';
/* ‎Settings‎ اسمُ هذه الشاشة نفسِها، ولا يجتمع اسمان في مجالٍ واحد: كان
   الاستيراد يُدهَس بتعريف الدالة أدناه، فتصير كلُّ ‎<Settings />‎ في هذا
   الملفّ نداءً للشاشة لا رسماً لأيقونة — تستدعي نفسَها بلا قرار توقّف،
   فتنمو شجرةُ التصيير حتى يعلق المتصفّح والجهاز معه.
   فالأيقونة تُستعار باسمٍ صريح، ويبقى الاسم الأصلي للشاشة وحدها. */
import { Bell, Check, CircleCheck, ExternalLink, FileOutput, Globe, Import, Info, Link2, Mail, Settings as SettingsIcon, ShieldCheck, TriangleAlert, Tv, User, Users } from 'lucide-react';
import UserManagement from './UserManagement';
import SystemConfiguration from './SystemConfiguration';
import DataExport from './DataExport';
import DataImport from './DataImport';
import BasecampSync from './BasecampSync';
import EmailSettings from './EmailSettings';
import { useAuth } from '../../contexts/AuthContext';
import GeneralSettings from './GeneralSettings';
import DashboardDisplay from './DashboardDisplay';
import ProfilePictureUpload from '../Common/ProfilePictureUpload';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';
import { NotificationPrefs } from '../../types';

const ROLE_LABEL: Record<string, string> = {
  admin: 'مسؤول النظام',
  lawyer: 'محامٍ',
  staff: 'إداري'
};

/* بنودُ الإشعارات — المفاتيح عقدٌ مع `NotificationPrefs` وبـ`updateMe` في
   الخادم. وكانت هذه القوائم مكتوبةً في التصيير بصناديق `defaultChecked`
   لا تُقرأ، وزرُّ حفظها بلا مُعالِج. */
const EMAIL_NOTICES: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: 'newClients', label: 'العملاء الجدد', desc: 'إشعار عند إضافة عميل جديد' },
  { key: 'newCases', label: 'القضايا الجديدة', desc: 'إشعار عند إضافة قضية جديدة' },
  { key: 'caseUpdates', label: 'تحديث حالة القضايا', desc: 'إشعار عند تغيير حالة القضية' },
  { key: 'newProspects', label: 'العملاء المحتملين', desc: 'إشعار عند إضافة عميل محتمل جديد' },
  { key: 'followUps', label: 'مواعيد المتابعة', desc: 'تذكير بمواعيد متابعة العملاء المحتملين' },
  { key: 'payments', label: 'المدفوعات', desc: 'إشعار عند استلام مدفوعات جديدة' }
];

const SYSTEM_NOTICES: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: 'userLogin', label: 'تسجيل دخول المستخدمين', desc: 'إشعار عند تسجيل دخول المستخدمين' },
  { key: 'backups', label: 'النسخ الاحتياطية', desc: 'إشعار عند إنشاء النسخ الاحتياطية' },
  { key: 'updates', label: 'تحديثات النظام', desc: 'إشعار عند توفر تحديثات جديدة' },
  { key: 'errors', label: 'أخطاء النظام', desc: 'تنبيه عند حدوث أخطاء في النظام' }
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const { user, hasPermission, updateUser, center } = useAuth();

  /* الصورة وحدها حالةٌ محلّية هنا: الاسم والبريد والمسمّى تُقرأ من المركز
     ولا تُحرَّر، فحملُها في نموذجٍ يوهم أنها تُحفظ. */
  const [avatarKey, setAvatarKey] = useState<string | undefined>(user?.avatarKey);
  const [prefs, setPrefs] = useState<NotificationPrefs | undefined>(user?.notificationPrefs);

  /* الحالةُ تتبع العضو: أوّلُ تصييرٍ قد يسبق وصول `‎/api/me‎`، فتبدأ
     القيمتان فارغتين ثم تصلان — وبلا هذا يبقى النموذج على فراغه. */
  useEffect(() => {
    setAvatarKey(user?.avatarKey);
    setPrefs(user?.notificationPrefs);
  }, [user?.avatarKey, user?.notificationPrefs]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  /** عنوان حساب المركز — موضعُ الاسم والبريد وكلمة المرور والمصادقة الثنائية. */
  const accountUrl = center ?? undefined;

  const tabCategories = [
    {
      id: 'personal',
      name: 'الإعدادات الشخصية',
      icon: User,
      color: 'blue',
      tabs: [
        { id: 'profile', label: 'الملف الشخصي', icon: User, description: 'تحديث معلوماتك الشخصية والصورة', permission: null },
        { id: 'security', label: 'الأمان', icon: ShieldCheck, description: 'تغيير كلمة المرور والمصادقة الثنائية', permission: null },
        { id: 'notifications', label: 'الإشعارات', icon: Bell, description: 'إدارة تفضيلات الإشعارات والتنبيهات', permission: null }
      ]
    },
    {
      id: 'system',
      name: 'إعدادات النظام',
      icon: SettingsIcon,
      color: 'purple',
      tabs: [
        { id: 'general', label: 'الإعدادات العامة', icon: Globe, description: 'اسم المكتب ووصفه وشعاره', permission: 'settings.update' },
        { id: 'system', label: 'تكوين النظام', icon: SettingsIcon, description: 'إدارة أنواع العملاء والقضايا والحالات', permission: 'settings.update' },
        { id: 'email', label: 'البريد الإلكتروني', icon: Mail, description: 'إعدادات خادم SMTP وإرسال الرسائل', permission: 'settings.update' }
      ]
    },
    {
      id: 'management',
      name: 'إدارة المستخدمين والبيانات',
      icon: Users,
      color: 'green',
      tabs: [
        { id: 'users', label: 'إدارة المستخدمين', icon: Users, description: 'إضافة وتعديل المستخدمين والصلاحيات', permission: 'users.read' },
        { id: 'export', label: 'تصدير البيانات', icon: FileOutput, description: 'تصدير بيانات العملاء والقضايا', permission: 'settings.read' },
        { id: 'import', label: 'استيراد البيانات', icon: Import, description: 'استيراد البيانات من ملفات Excel', permission: 'settings.update' },
        { id: 'basecamp', label: 'الربط ببيسكامب', icon: Link2, description: 'استيراد بيانات العملاء من بيسكامب ومزامنتها', permission: 'admin.only' }
      ]
    },
    {
      id: 'display',
      name: 'العرض والمراقبة',
      icon: Tv,
      color: 'amber',
      tabs: [
        { id: 'dashboard-display', label: 'عرض لوحة التحكم', icon: Tv, description: 'إعداد عرض البيانات على الشاشات', permission: 'admin.only' }
      ]
    }
  ];

  const getVisibleCategories = () => {
    return tabCategories.map(category => ({
      ...category,
      tabs: category.tabs.filter(tab => {
        if (!tab.permission) return true;
        if (tab.permission === 'admin.only') return user?.role === 'admin';
        const [resource, action] = tab.permission.split('.');
        return hasPermission(resource, action);
      })
    })).filter(category => category.tabs.length > 0);
  };

  const visibleCategories = getVisibleCategories();

  /* ═══ اللونُ علامةٌ لا طلاء ═══
   *
   * كان لكل فئةٍ لونُها مصمتاً يملأ شريطَها بعرض الشاشة، ولخيارها المختار
   * مثلُه. فصارت الشاشةُ أربعةَ ألواحٍ صارخة، ولم يبقَ بين «الفئة»
   * و«الخيار» فرقٌ في الوزن يُقرأ منه أيُّهما يحوي الآخر.
   *
   * فاللونُ الآن في موضعين اثنين: مربّعُ الأيقونة، والخيارُ المختار —
   * تخفيفاً (`soft`) لا مصمتاً، مع حدٍّ ولفظٍ بلونه. والباقي محايد.
   *
   * ورموزُ ‎--*-soft‎ مخلوطةٌ بالبطاقة في `naf-theme.css`، فتنقلب مع
   * الوضع الداكن بتعريفٍ واحد ولا تُكتب هنا قيمةٌ حرفية.
   */
  const getColorClasses = (color: string, variant: 'soft' | 'text' | 'border') => {
    const colors = {
      blue: { soft: 'bg-primary-soft', text: 'text-primary', border: 'border-primary/30' },
      purple: { soft: 'bg-info-soft', text: 'text-info', border: 'border-info/30' },
      green: { soft: 'bg-success-soft', text: 'text-success', border: 'border-success/30' },
      amber: { soft: 'bg-warning-soft', text: 'text-warning', border: 'border-warning/30' }
    };
    return colors[color as keyof typeof colors]?.[variant] || colors.blue[variant];
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  /* ═══ الحفظ يقع، والرسالة تتبعه ═══
   *
   * كان هنا `await new Promise(r => setTimeout(r, 1000))` ثم «تم الحفظ» —
   * انتظارٌ يُشبه العمل ولا يعمل. والآن `updateUser` تنادي `‎/api/me‎`
   * وترمي إن سقطت، فالرسالة لا تُقال إلا بعد أن يردّ الخادم.
   */
  const save = async (
    patch: { avatarKey?: string | null; notificationPrefs?: NotificationPrefs },
    failure: string
  ) => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await updateUser(patch);
      setSaveMessage('تم الحفظ');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error(failure, error);
      setSaveMessage(failure);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileSave = () =>
    save({ avatarKey: avatarKey ?? null }, 'حدث خطأ أثناء حفظ التغييرات');

  const handleNotificationsSave = () => {
    if (!prefs) return;
    return save({ notificationPrefs: prefs }, 'حدث خطأ أثناء حفظ الإشعارات');
  };

  const togglePref = (key: keyof NotificationPrefs) =>
    setPrefs(prev => (prev ? { ...prev, [key]: !prev[key] } : prev));

  /* ═══ ما ليس في هذا المستودع لا يُدَّعى هنا ═══
   *
   * كانت شاشة الأمان تتحقّق من تطابق كلمتين وطولهما ثم تقول «تم تغيير
   * كلمة المرور» — بلا نداءٍ لأي مسار. وكلمةُ المرور والمصادقةُ الثنائية
   * والهويةُ نفسها تعيش في المركز `naf-id`؛ وحزمة `naf-auth` لا تُصدِّر
   * لهما شيئاً، فلا سبيل لربطهما من هنا أصلاً.
   *
   * فالشاشة تقود إلى موضعهما بدل أن تَعِد بما لا تملك. وادّعاءُ تغييرٍ
   * لم يقع أسوأ من غيابه: من قرأ «تم» يمضي واثقاً بكلمةٍ لم تتغيّر. */
  const CenterLink = ({ children }: { children: React.ReactNode }) =>
    accountUrl ? (
      <a
        href={accountUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-primary underline underline-offset-4 hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        {children}
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    ) : (
      <span className="text-muted-foreground">{children}</span>
    );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">الملف الشخصي</h3>
              <p className="text-muted-foreground">إدارة معلوماتك الشخصية وصورتك الشخصية</p>
            </div>
            
            <div className="flex justify-center">
              <ProfilePictureUpload
                currentPicture={avatarKey}
                onPictureChange={setAvatarKey}
                size="xl"
              />
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              {/* ما تملكه المنصة: الصورة وحدها، وهي أعلاه. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">الاسم الكامل</label>
                  <Input type="text" value={user?.name ?? ''} readOnly className="bg-muted text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">البريد الإلكتروني</label>
                  <Input type="email" value={user?.email ?? ''} readOnly className="bg-muted text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">المسمى الوظيفي</label>
                  <Input
                    type="text"
                    value={ROLE_LABEL[user?.role ?? ''] ?? ''}
                    readOnly className="bg-muted text-muted-foreground"
                  />
                </div>
              </div>

              {/* كان «الاسم» و«البريد» و«رقم الجوال» حقولاً تُحرَّر وتُحفظ ظاهرياً.
                  والاسم والبريد يكتبهما المركز في صفّ العضو عند كل دخول، فتحريرُهما
                  هنا يُدهس في الدخول التالي. ورقمُ الجوال لم يكن له عمودٌ أصلاً —
                  كانت قيمتُه ثابتةً مكتوبةً في الشيفرة: ‎+966501234567‎. */}
              <Alert variant="info">
                <Info aria-hidden="true" />
                <span>
                  الاسم والبريد والمسمّى تأتي من حسابك في المركز وتُحدَّث عند كل دخول.
                  لتغييرها انتقل إلى <CenterLink>حسابك في المركز</CenterLink>.
                </span>
              </Alert>
            </div>


            {saveMessage && (() => {
              const tone = messageTone(saveMessage);
              const Icon = tone === 'success' ? CircleCheck : TriangleAlert;
              return (
                <Alert variant={tone} className="max-w-2xl mx-auto">
                  <Icon aria-hidden="true" />
                  <span>{saveMessage}</span>
                </Alert>
              );
            })()}

            <div className="max-w-2xl mx-auto border-t border-border pt-6">
              <div className="flex justify-end gap-4">
                <Button onClick={() => setAvatarKey(user?.avatarKey)} variant="ghost" size="lg" disabled={isSaving}>
                  إلغاء
                </Button>
                <Button onClick={handleProfileSave} disabled={isSaving || avatarKey === user?.avatarKey} size="lg">
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-card"></div>
                      جارٍ الحفظ
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      حفظ التغييرات
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        );
      
      case 'users':
        return <UserManagement />;
      
      case 'system':
        return <SystemConfiguration />;
      
      case 'dashboard-display':
        return <DashboardDisplay />;
      
      case 'email':
        return <EmailSettings />;
      
      case 'export':
        return <DataExport />;
      
      case 'import':
        return <DataImport />;

      case 'basecamp':
        return <BasecampSync />;

      case 'security':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">إعدادات الأمان</h3>
              <p className="text-muted-foreground">إدارة كلمة المرور والمصادقة الثنائية</p>
            </div>
            
            {/* كانت هنا ثلاثةُ حقولِ كلمةِ مرور وزرٌّ ينتظر ثانيةً ثم يقول
                «تم تغيير كلمة المرور» بلا نداءٍ لأي مسار، وزرُّ «تفعيل»
                للمصادقة الثنائية بلا مُعالِج أصلاً.

                والاثنان يخصّان الهوية، والهويةُ في المركز `naf-id` لا في هذه
                المنصة: لا كلمةَ مرورٍ في مخطَّطها ولا مسارَ لها، و`naf-auth`
                لا تُصدِّر لهما شيئاً. فلا سبيل لربطهما من هنا، والشاشة تقود
                إلى موضعهما. */}
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-muted rounded-2xl p-8 border border-border space-y-4">
                <h4 className="text-lg font-bold text-foreground flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  كلمة المرور والمصادقة الثنائية
                </h4>
                <p className="text-muted-foreground">
                  دخولك إلى ناف مركزيّ: كلمةُ مرورك والمصادقةُ الثنائية تخصّان حسابك في
                  المركز، لا هذه المنصة وحدها. وتغييرُهما هناك يسري على منصات ناف جميعاً.
                </p>
                <CenterLink>إدارة الأمان في المركز</CenterLink>
              </div>

              <div className="bg-info-soft rounded-2xl p-8 border border-info/30">
                <h4 className="text-lg font-bold text-foreground mb-2">جلستك في هذه المنصة</h4>
                <p className="text-muted-foreground">
                  تُغلَق بالخروج من الشريط الجانبي. وإن خرجتَ من المركز أُنهيت جلساتُك في
                  منصات ناف كلِّها.
                </p>
              </div>
            </div>
          </div>
        );
      
      case 'notifications':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">إعدادات الإشعارات</h3>
              <p className="text-muted-foreground">تخصيص تفضيلات الإشعارات والتنبيهات</p>
            </div>

            {/* كانت الصناديق `defaultChecked` غير مضبوطة — لا حالة تحملها ولا شيء
                يقرؤها — وزرُّ الحفظ بلا `onClick`. والآن كلٌّ منها مضبوط بتفضيلِ
                العضو من `‎/api/me‎`، والحفظ يكتب في صفّه. */}
            <div className="max-w-4xl mx-auto space-y-8">
              <Alert variant="warning">
                <TriangleAlert aria-hidden="true" />
                <span>
                  تُحفظ تفضيلاتك الآن، ولا تُرسَل رسائل بعد: إرسالُ البريد غير مربوط —
                  انظر تبويب «البريد الإلكتروني».
                </span>
              </Alert>

              {([
                { title: 'إشعارات البريد الإلكتروني', Icon: Mail, tone: 'text-primary', items: EMAIL_NOTICES },
                { title: 'إشعارات النظام', Icon: SettingsIcon, tone: 'text-info', items: SYSTEM_NOTICES }
              ] as const).map(({ title, Icon, tone, items }) => (
                <div key={title} className="bg-card rounded-2xl p-8 border border-border shadow-sm">
                  <h4 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${tone}`} />
                    {title}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {items.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center justify-between gap-4 p-4 bg-muted rounded-xl cursor-pointer"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                          <span className="block text-xs text-muted-foreground">{item.desc}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={prefs?.[item.key] ?? false}
                          onChange={() => togglePref(item.key)}
                          disabled={!prefs}
                          className="w-5 h-5 flex-none rounded border-border text-primary focus-visible:ring-ring"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* كانت هنا «جدولة التقارير»: أربعُ قوائم بـ`selected` غير مضبوطة لا
                  تُقرأ ولا تُحفظ، لجدولةٍ لا مُجدوِل لها. وموضعُها حين تُبنى هو
                  `Cron Triggers` في `wrangler.toml` لا حالةٌ في متصفّح. */}

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

              <div className="flex justify-center">
                <Button onClick={handleNotificationsSave} disabled={isSaving || !prefs} size="lg">
                  {isSaving ? 'جارٍ الحفظ' : 'حفظ إعدادات الإشعارات'}
                </Button>
              </div>
            </div>
          </div>
        );
      
      default:
        if (activeTab === 'general') {
          return <GeneralSettings />;
        }
        return <div>المحتوى غير متوفر</div>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <SettingsIcon className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">الإعدادات</h1>
              <p className="text-muted-foreground">إدارة إعدادات النظام والملف الشخصي</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ═══ عمودُ تنقّلٍ ولوحةُ محتوى ═══
            كانت الأقسامُ الأربعةُ قوائمَ تُطوى وتُنشَر: قسمٌ واحدٌ مفتوحٌ في
            الوقت الواحد، وخياراتُ الثلاثة الباقية مخبوءةٌ خلف ضغطة. فمن أراد
            «تصدير البيانات» وهو في «الملف الشخصي» طوى قسماً ونشر آخر ثم اختار
            — ثلاثُ ضغطاتٍ لِما يكفيه واحدة.

            والأحدَ عشرَ خياراً كلُّها معروضةٌ الآن في عمودٍ واحدٍ لا يُطوى،
            والمحتوى إلى جانبه يأخذ باقي العرض. وعلى الشاشة الضيّقة يتكدّس:
            العمودُ فوق شبكةً، والمحتوى تحته. */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* ولا `sticky` هنا: `main` في `App.tsx` عليه `overflow-auto`، فهو
              حاويةُ التمرير التي يلتصق العنصرُ داخلها — وهو لا يمرّر شيئاً
              (الغلافُ `min-h-screen` فينمو بمحتواه، والتمريرُ للصفحة). فيبقى
              الالتصاقُ صنفاً مكتوباً لا أثر له، وإحياؤه يلزمه تبديلُ الغلاف
              نفسِه لا سطرٌ هنا. */}
          <nav
            aria-label="أقسام الإعدادات"
            className="w-full lg:w-72 lg:flex-none bg-card rounded-2xl border border-border shadow-sm p-3 space-y-5"
          >
            {visibleCategories.map((category) => (
              <div key={category.id} className="space-y-2">
                {/* ═══ عنوانُ القسم لافتةٌ تُقرأ لا خيارٌ يُضغط ═══
                    كان يشبه صفَّ خيارٍ مختاراً: أيقونةٌ في مربّعٍ ملوَّن ثمّ
                    لفظ، في العمود نفسِه وبالمحاذاة نفسِها. فيُقرأ «الإعدادات
                    الشخصية» خياراً حادي عشر لا عنواناً لثلاثة تحته.

                    فثلاثةُ فروقٍ تجتمع عليه، لا واحد: الحجمُ (١٢ بكسلاً دون
                    الأربعةَ عشرَ للخيار)، والخطُّ تحته يفصله عمّا يليه،
                    والأيقونةُ بلا مربّعٍ يملؤه لونٌ — فلا يبقى فيه ما يشبه
                    الاختيار. */}
                <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-border">
                  <category.icon
                    className={`h-3.5 w-3.5 flex-none ${getColorClasses(category.color, 'text')}`}
                    aria-hidden="true"
                  />
                  <h2 className="min-w-0 text-xs font-bold tracking-wider text-muted-foreground">
                    {category.name}
                  </h2>
                </div>

                {/* عمودٌ على الشاشة الواسعة، وشبكةٌ على الضيّقة — فلا يطول
                    العمودُ على الجوّال حتى يُدفَع المحتوى خارج الشاشة. */}
                <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
                  {category.tabs.map((tab) => {
                    const current = activeTab === tab.id;
                    return (
                      <li key={tab.id}>
                        <button
                          onClick={() => handleTabClick(tab.id)}
                          aria-current={current ? 'page' : undefined}
                          title={tab.description}
                          /* `min-h-11` أي ٤٤ بكسل — أدنى ما يُلمس بإصبع.
                             وبالحشو وحدَه كان الصفُّ ٤١، وفرقُ ثلاثة بكسلات
                             يُخطئه الإبهام على شاشةٍ تهتزّ في يد. */
                          className={`w-full min-h-11 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            current
                              ? `${getColorClasses(category.color, 'soft')} ${getColorClasses(
                                  category.color,
                                  'border'
                                )} font-semibold ${getColorClasses(category.color, 'text')}`
                              : 'border-transparent text-foreground hover:bg-muted'
                          }`}
                        >
                          <tab.icon
                            className={`h-4 w-4 flex-none ${
                              current ? getColorClasses(category.color, 'text') : 'text-muted-foreground'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 leading-snug">{tab.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* `min-w-0` كما في `App.tsx`: لوحةٌ فيها جدولٌ عريض لا تدفع العمود. */}
          <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-6 lg:p-8">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}