import React, { useState } from 'react';
/* ‎Settings‎ اسمُ هذه الشاشة نفسِها، ولا يجتمع اسمان في مجالٍ واحد: كان
   الاستيراد يُدهَس بتعريف الدالة أدناه، فتصير كلُّ ‎<Settings />‎ في هذا
   الملفّ نداءً للشاشة لا رسماً لأيقونة — تستدعي نفسَها بلا قرار توقّف،
   فتنمو شجرةُ التصيير حتى يعلق المتصفّح والجهاز معه.
   فالأيقونة تُستعار باسمٍ صريح، ويبقى الاسم الأصلي للشاشة وحدها. */
import { Bell, Check, ChevronDown, CircleCheck, FileOutput, FileText, Globe, Import, Mail, Settings as SettingsIcon, ShieldCheck, TriangleAlert, Tv, User, Users } from 'lucide-react';
import UserManagement from './UserManagement';
import SystemConfiguration from './SystemConfiguration';
import DataExport from './DataExport';
import EmailSettings from './EmailSettings';
import { useAuth } from '../../contexts/AuthContext';
import GeneralSettings from './GeneralSettings';
import DashboardDisplay from './DashboardDisplay';
import ProfilePictureUpload from '../Common/ProfilePictureUpload';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('personal');
  const { user, hasPermission, updateUser } = useAuth();
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '+966501234567',
    jobTitle: user?.role === 'admin' ? 'مسؤول النظام' : user?.role === 'lawyer' ? 'محامٍ' : 'إداري',
    profilePicture: user?.profilePicture || ''
  });

  // Security form state
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

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
        { id: 'general', label: 'الإعدادات العامة', icon: Globe, description: 'معلومات الشركة والألوان والشعار', permission: 'settings.update' },
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
        { id: 'import', label: 'استيراد البيانات', icon: Import, description: 'استيراد البيانات من ملفات Excel', permission: 'settings.update' }
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

  /* لكل رمز مقدّمتُه المسجَّلة، ولذلك أُضيف variant الرابع `fg`: الأبيض
     الحرفيّ الذي كان مكتوباً هنا لا ينقلب في الوضع الداكن، ورموز
     ‎--*-foreground‎ تنقلب مع خلفياتها بتعريف واحد. */
  const getColorClasses = (
    color: string,
    variant: 'bg' | 'fg' | 'text' | 'border' | 'hover'
  ) => {
    const colors = {
      blue: {
        bg: 'bg-primary',
        fg: 'text-primary-foreground',
        text: 'text-primary',
        border: 'border-primary/30',
        hover: 'hover:bg-primary-soft'
      },
      purple: {
        bg: 'bg-info',
        fg: 'text-info-foreground',
        text: 'text-info',
        border: 'border-info/30',
        hover: 'hover:bg-info-soft'
      },
      green: {
        bg: 'bg-success',
        fg: 'text-success-foreground',
        text: 'text-success',
        border: 'border-success/30',
        hover: 'hover:bg-success-soft'
      },
      amber: {
        bg: 'bg-warning',
        fg: 'text-warning-foreground',
        text: 'text-warning',
        border: 'border-warning/30',
        hover: 'hover:bg-warning-soft'
      }
    };
    return colors[color as keyof typeof colors]?.[variant] || colors.blue[variant];
  };

  const handleCategoryToggle = (categoryId: string) => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
      setActiveTab('');
    } else {
      setExpandedCategory(categoryId);
      // Set the first tab of the category as active
      const category = visibleCategories.find(cat => cat.id === categoryId);
      if (category && category.tabs.length > 0) {
        setActiveTab(category.tabs[0].id);
      }
    }
  };

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleProfileSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await updateUser({
        name: profileData.name,
        email: profileData.email,
        profilePicture: profileData.profilePicture || undefined
      });
      
      setSaveMessage('تم الحفظ');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('حدث خطأ أثناء حفظ التغييرات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSecuritySave = async () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      setSaveMessage('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }

    if (securityData.newPassword.length < 8) {
      setSaveMessage('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSaveMessage('تم تغيير كلمة المرور');
      setSecurityData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setIsSaving(false);
    }
  };

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
                currentPicture={profileData.profilePicture}
                onPictureChange={(picture) => setProfileData(prev => ({ ...prev, profilePicture: picture || '' }))}
                size="xl"
              />
            </div>
            
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">الاسم الكامل</label>
                  <Input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">البريد الإلكتروني</label>
                  <Input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">رقم الجوال</label>
                  <Input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">المسمى الوظيفي</label>
                  <Input
                    type="text"
                    value={profileData.jobTitle}
                    disabled className="bg-muted text-muted-foreground"
                  />
                </div>
              </div>
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
                <Button onClick={() => setProfileData({ name: user?.name || '', email: user?.email || '', phone: '+966501234567', jobTitle: user?.role === 'admin' ? 'مسؤول النظام' : user?.role === 'lawyer' ? 'محامٍ' : 'إداري', profilePicture: user?.profilePicture || '' })} variant="ghost" size="lg">
                  إلغاء
                </Button>
                <Button onClick={handleProfileSave} disabled={isSaving} size="lg">
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
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">استيراد البيانات</h3>
              <p className="text-muted-foreground">رفع ملفات Excel لاستيراد بيانات العملاء والقضايا</p>
            </div>
            
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-primary-soft rounded-2xl p-8 border border-primary/30">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h4 className="text-xl font-bold text-primary-strong mb-2">استيراد العملاء</h4>
                    <p className="text-primary">رفع ملف Excel يحتوي على بيانات العملاء</p>
                  </div>
                  <div className="space-y-4">
                    <Button className="w-full" size="lg">
                      تنزيل نموذج Excel
                    </Button>
                    <Input
                      type="file"
                      accept=".xlsx,.xls" className="border-primary/30"
                    />
                    <Button className="w-full" variant="success" size="lg">
                      رفع الملف
                    </Button>
                  </div>
                </div>
                
                <div className="bg-success-soft rounded-2xl p-8 border border-success/30">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-success-foreground" />
                    </div>
                    <h4 className="text-xl font-bold text-success-strong mb-2">استيراد القضايا</h4>
                    <p className="text-success">رفع ملف Excel يحتوي على بيانات القضايا</p>
                  </div>
                  <div className="space-y-4">
                    <Button className="w-full" variant="success" size="lg">
                      تنزيل نموذج Excel
                    </Button>
                    <Input
                      type="file"
                      accept=".xlsx,.xls" className="border-success/30"
                    />
                    <Button className="w-full" size="lg">
                      رفع الملف
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'security':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">إعدادات الأمان</h3>
              <p className="text-muted-foreground">إدارة كلمة المرور والمصادقة الثنائية</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="bg-muted rounded-2xl p-8 border border-border">
                <h4 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  تغيير كلمة المرور
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">كلمة المرور الحالية</label>
                    <Input
                      type="password"
                      value={securityData.currentPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="أدخل كلمة المرور الحالية"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">كلمة المرور الجديدة</label>
                    <Input
                      type="password"
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="أدخل كلمة المرور الجديدة"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">تأكيد كلمة المرور الجديدة</label>
                    <Input
                      type="password"
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="أعد إدخال كلمة المرور الجديدة"
                    />
                  </div>
                  <Button onClick={handleSecuritySave} disabled={isSaving || !securityData.currentPassword || !securityData.newPassword} className="w-full" size="lg">
                    {isSaving ? 'جارٍ الحفظ' : 'تغيير كلمة المرور'}
                  </Button>
                </div>
              </div>
              
              <div className="bg-info-soft rounded-2xl p-8 border border-info/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-foreground mb-2">المصادقة الثنائية</h4>
                    <p className="text-muted-foreground">تفعيل المصادقة الثنائية لحماية إضافية لحسابك</p>
                  </div>
                  <Button className="bg-info hover:bg-info/90 text-info-foreground" size="lg">
                    تفعيل
                  </Button>
                </div>
              </div>
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
          </div>
        );
      
      case 'notifications':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">إعدادات الإشعارات</h3>
              <p className="text-muted-foreground">تخصيص تفضيلات الإشعارات والتنبيهات</p>
            </div>
            
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Email Notifications */}
              <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
                <h4 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                  <Mail className="h-6 w-6 text-primary" />
                  إشعارات البريد الإلكتروني
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: 'newClients', label: 'العملاء الجدد', desc: 'إشعار عند إضافة عميل جديد' },
                    { key: 'newCases', label: 'القضايا الجديدة', desc: 'إشعار عند إضافة قضية جديدة' },
                    { key: 'caseUpdates', label: 'تحديث حالة القضايا', desc: 'إشعار عند تغيير حالة القضية' },
                    { key: 'newProspects', label: 'العملاء المحتملين', desc: 'إشعار عند إضافة عميل محتمل جديد' },
                    { key: 'followUps', label: 'مواعيد المتابعة', desc: 'تذكير بمواعيد متابعة العملاء المحتملين' },
                    { key: 'payments', label: 'المدفوعات', desc: 'إشعار عند استلام مدفوعات جديدة' }
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                      <div>
                        <label className="text-sm font-semibold text-foreground">{item.label}</label>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-5 h-5 rounded border-border text-primary focus-visible:ring-ring"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* System Notifications */}
              <div className="bg-card rounded-2xl p-8 border border-border shadow-sm">
                <h4 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                  <SettingsIcon className="h-6 w-6 text-info" />
                  إشعارات النظام
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: 'userLogin', label: 'تسجيل دخول المستخدمين', desc: 'إشعار عند تسجيل دخول المستخدمين' },
                    { key: 'backups', label: 'النسخ الاحتياطية', desc: 'إشعار عند إنشاء النسخ الاحتياطية' },
                    { key: 'updates', label: 'تحديثات النظام', desc: 'إشعار عند توفر تحديثات جديدة' },
                    { key: 'errors', label: 'أخطاء النظام', desc: 'تنبيه عند حدوث أخطاء في النظام' }
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                      <div>
                        <label className="text-sm font-semibold text-foreground">{item.label}</label>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked={item.key !== 'userLogin'}
                        className="w-5 h-5 rounded border-border text-info focus-visible:ring-ring"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Notification Schedule */}
              <div className="bg-primary-soft rounded-2xl p-8 border border-primary/30">
                <h4 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                  <Bell className="h-6 w-6 text-primary-strong" />
                  جدولة التقارير
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">تقرير يومي</label>
                    <Select>
                      <option value="disabled">معطّل</option>
                      <option value="8am" selected>8:00 صباحاً</option>
                      <option value="9am">9:00 صباحاً</option>
                      <option value="10am">10:00 صباحاً</option>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">تقرير أسبوعي</label>
                    <Select>
                      <option value="disabled">معطّل</option>
                      <option value="sunday" selected>الأحد</option>
                      <option value="monday">الاثنين</option>
                      <option value="saturday">السبت</option>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">تقرير شهري</label>
                    <Select>
                      <option value="disabled">معطّل</option>
                      <option value="1st" selected>أول الشهر</option>
                      <option value="15th">منتصف الشهر</option>
                      <option value="last">آخر الشهر</option>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">طريقة الإرسال</label>
                    <Select>
                      <option value="email" selected>البريد الإلكتروني</option>
                      <option value="sms">رسائل نصية</option>
                      <option value="both">كلاهما</option>
                    </Select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center">
                <Button  size="lg">
                  حفظ إعدادات الإشعارات
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
        <div className="space-y-6">
          {/* Categories with Inline Content */}
          <div className="space-y-4">
            {visibleCategories.map((category) => (
              <div key={category.id} className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => handleCategoryToggle(category.id)}
                  className={`w-full p-6 ${getColorClasses(category.color, 'bg')} ${getColorClasses(
                    category.color,
                    'fg'
                  )} flex items-center justify-between hover:opacity-90 transition-opacity`}
                >
                  <div className="flex items-center gap-3">
                    <category.icon className="h-6 w-6" />
                    <h3 className="font-bold text-lg">{category.name}</h3>
                  </div>
                  <ChevronDown 
                    className={`h-5 w-5 transition-transform duration-300 ${
                      expandedCategory === category.id ? 'rotate-180' : ''
                    }`} 
                  />
                </button>
                
                {/* Category Tabs */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  expandedCategory === category.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="p-4 space-y-2 border-b border-border">
                    {category.tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-start transition-all duration-200 ${
                          activeTab === tab.id
                            ? `${getColorClasses(category.color, 'bg')} ${getColorClasses(
                                category.color,
                                'fg'
                              )} shadow-lg`
                            : `text-foreground ${getColorClasses(category.color, 'hover')}`
                        }`}
                      >
                        <tab.icon className={`h-5 w-5 ${
                          activeTab === tab.id
                            ? getColorClasses(category.color, 'fg')
                            : getColorClasses(category.color, 'text')
                        }`} />
                        <div className="flex-1 text-start">
                          <div className={`font-medium ${
                              activeTab === tab.id
                                ? getColorClasses(category.color, 'fg')
                                : 'text-foreground'
                            }`}>
                            {tab.label}
                          </div>
                          <div className={`text-xs ${
                            activeTab === tab.id
                              ? `${getColorClasses(category.color, 'fg')}/80`
                              : 'text-muted-foreground'
                          }`}>
                            {tab.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Area - Shows directly under the expanded category */}
                {expandedCategory === category.id && activeTab && category.tabs.some(tab => tab.id === activeTab) && (
                  <div className="transition-all duration-300 ease-in-out">
                    <div className="p-8 bg-muted">
                      {renderTabContent()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}