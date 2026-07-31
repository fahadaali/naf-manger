import React, { useState } from 'react';
import {
  ComputerDesktopIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline';
import { Bell, Check, ChevronDown, FileOutput, FileText, Globe, Mail, Settings, ShieldCheck, User, Users } from 'lucide-react';
import UserManagement from './UserManagement';
import SystemConfiguration from './SystemConfiguration';
import DataExport from './DataExport';
import EmailSettings from './EmailSettings';
import { useAuth } from '../../contexts/AuthContext';
import GeneralSettings from './GeneralSettings';
import DashboardDisplay from './DashboardDisplay';
import ProfilePictureUpload from '../Common/ProfilePictureUpload';
import SupabaseMigration from './SupabaseMigration';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('personal');
  const { user, hasPermission, updateUser } = useAuth();
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '+966501234567',
    jobTitle: user?.role === 'admin' ? 'مدير النظام' : user?.role === 'lawyer' ? 'محامي' : 'إداري',
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
      icon: Settings,
      color: 'purple',
      tabs: [
        { id: 'general', label: 'الإعدادات العامة', icon: Globe, description: 'معلومات الشركة والألوان والشعار', permission: 'settings.update' },
        { id: 'system', label: 'تكوين النظام', icon: Settings, description: 'إدارة أنواع العملاء والقضايا والحالات', permission: 'settings.update' },
        { id: 'email', label: 'البريد الإلكتروني', icon: Mail, description: 'إعدادات خادم SMTP وإرسال الرسائل', permission: 'settings.update' },
        { id: 'supabase', label: 'قاعدة البيانات المركزية', icon: FileText, description: 'إعداد وترحيل البيانات إلى Supabase', permission: 'settings.update' }
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
        { id: 'import', label: 'استيراد البيانات', icon: DocumentArrowUpIcon, description: 'استيراد البيانات من ملفات Excel', permission: 'settings.update' }
      ]
    },
    {
      id: 'display',
      name: 'العرض والمراقبة',
      icon: ComputerDesktopIcon,
      color: 'amber',
      tabs: [
        { id: 'dashboard-display', label: 'عرض لوحة التحكم', icon: ComputerDesktopIcon, description: 'إعداد عرض البيانات على الشاشات', permission: 'admin.only' }
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
      
      setSaveMessage('تم حفظ التغييرات بنجاح');
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
      
      setSaveMessage('تم تغيير كلمة المرور بنجاح');
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
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">رقم الجوال</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-foreground">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={profileData.jobTitle}
                    disabled
                    className="w-full px-4 py-3 border border-border rounded-xl bg-muted text-muted-foreground"
                  />
                </div>
              </div>
            </div>
            
            {saveMessage && (
              <div className={`max-w-2xl mx-auto p-4 rounded-xl flex items-center gap-3 ${
                saveMessage.includes('نجاح') ? 'bg-success-soft text-success-strong border border-success/30' : 'bg-destructive-soft text-destructive-strong border border-destructive/30'
              }`}>
                {saveMessage.includes('نجاح') && <Check className="h-5 w-5" />}
                {saveMessage}
              </div>
            )}

            <div className="max-w-2xl mx-auto border-t border-border pt-6">
              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setProfileData({
                    name: user?.name || '',
                    email: user?.email || '',
                    phone: '+966501234567',
                    jobTitle: user?.role === 'admin' ? 'مدير النظام' : user?.role === 'lawyer' ? 'محامي' : 'إداري',
                    profilePicture: user?.profilePicture || ''
                  })}
                  className="px-6 py-3 text-muted-foreground hover:text-foreground font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleProfileSave}
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-8 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-card"></div>
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      حفظ التغييرات
                    </>
                  )}
                </button>
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
                    <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-medium transition-colors">
                      تنزيل نموذج Excel
                    </button>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="w-full px-4 py-3 border border-primary/30 rounded-xl bg-card"
                    />
                    <button className="w-full bg-success hover:bg-success/90 text-success-foreground px-6 py-3 rounded-xl font-medium transition-colors">
                      رفع الملف
                    </button>
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
                    <button className="w-full bg-success hover:bg-success/90 text-success-foreground px-6 py-3 rounded-xl font-medium transition-colors">
                      تنزيل نموذج Excel
                    </button>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="w-full px-4 py-3 border border-success/30 rounded-xl bg-card"
                    />
                    <button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-medium transition-colors">
                      رفع الملف
                    </button>
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
                    <input
                      type="password"
                      value={securityData.currentPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
                      placeholder="أدخل كلمة المرور الحالية"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
                      placeholder="أدخل كلمة المرور الجديدة"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">تأكيد كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
                      placeholder="أعد إدخال كلمة المرور الجديدة"
                    />
                  </div>
                  <button
                    onClick={handleSecuritySave}
                    disabled={isSaving || !securityData.currentPassword || !securityData.newPassword}
                    className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-6 py-3 rounded-xl font-medium transition-colors"
                  >
                    {isSaving ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
                  </button>
                </div>
              </div>
              
              <div className="bg-info-soft rounded-2xl p-8 border border-info/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-foreground mb-2">المصادقة الثنائية</h4>
                    <p className="text-muted-foreground">تفعيل المصادقة الثنائية لحماية إضافية لحسابك</p>
                  </div>
                  <button className="bg-info hover:bg-info/90 text-info-foreground px-6 py-3 rounded-xl font-medium transition-colors">
                    تفعيل
                  </button>
                </div>
              </div>
            </div>
            
            {saveMessage && (
              <div className={`max-w-2xl mx-auto p-4 rounded-xl flex items-center gap-3 ${
                saveMessage.includes('نجاح') ? 'bg-success-soft text-success-strong border border-success/30' : 'bg-destructive-soft text-destructive-strong border border-destructive/30'
              }`}>
                {saveMessage.includes('نجاح') && <Check className="h-5 w-5" />}
                {saveMessage}
              </div>
            )}
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
                  <Settings className="h-6 w-6 text-info" />
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
                  <Bell className="h-6 w-6 text-primary" />
                  جدولة التقارير
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">تقرير يومي</label>
                    <select className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring bg-card">
                      <option value="disabled">معطل</option>
                      <option value="8am" selected>8:00 صباحاً</option>
                      <option value="9am">9:00 صباحاً</option>
                      <option value="10am">10:00 صباحاً</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">تقرير أسبوعي</label>
                    <select className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring bg-card">
                      <option value="disabled">معطل</option>
                      <option value="sunday" selected>الأحد</option>
                      <option value="monday">الاثنين</option>
                      <option value="saturday">السبت</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">تقرير شهري</label>
                    <select className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring bg-card">
                      <option value="disabled">معطل</option>
                      <option value="1st" selected>أول الشهر</option>
                      <option value="15th">منتصف الشهر</option>
                      <option value="last">آخر الشهر</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-foreground">طريقة الإرسال</label>
                    <select className="w-full px-4 py-3 border border-border rounded-xl focus-visible:ring-2 focus-visible:ring-ring bg-card">
                      <option value="email" selected>البريد الإلكتروني</option>
                      <option value="sms">رسائل نصية</option>
                      <option value="both">كلاهما</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center">
                <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-xl font-medium transition-colors">
                  حفظ إعدادات الإشعارات
                </button>
              </div>
            </div>
          </div>
        );
      
      default:
        if (activeTab === 'general') {
          return <GeneralSettings />;
        } else if (activeTab === 'supabase') {
          return <SupabaseMigration />;
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
              <Settings className="h-6 w-6 text-primary-foreground" />
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
                              )} shadow-lg transform scale-[1.02]`
                            : `text-foreground ${getColorClasses(category.color, 'hover')} hover:transform hover:scale-[1.01]`
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