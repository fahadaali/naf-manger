import React, { useState } from 'react';
import { 
  UserIcon, 
  CogIcon, 
  ShieldCheckIcon, 
  DocumentTextIcon,
  BellIcon,
  GlobeAltIcon,
  UsersIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  ComputerDesktopIcon,
  EnvelopeIcon,
  ChevronDownIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
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
      icon: UserIcon,
      color: 'blue',
      tabs: [
        { id: 'profile', label: 'الملف الشخصي', icon: UserIcon, description: 'تحديث معلوماتك الشخصية والصورة', permission: null },
        { id: 'security', label: 'الأمان', icon: ShieldCheckIcon, description: 'تغيير كلمة المرور والمصادقة الثنائية', permission: null },
        { id: 'notifications', label: 'الإشعارات', icon: BellIcon, description: 'إدارة تفضيلات الإشعارات والتنبيهات', permission: null }
      ]
    },
    {
      id: 'system',
      name: 'إعدادات النظام',
      icon: CogIcon,
      color: 'purple',
      tabs: [
        { id: 'general', label: 'الإعدادات العامة', icon: GlobeAltIcon, description: 'معلومات الشركة والألوان والشعار', permission: 'settings.update' },
        { id: 'system', label: 'تكوين النظام', icon: CogIcon, description: 'إدارة أنواع العملاء والقضايا والحالات', permission: 'settings.update' },
        { id: 'email', label: 'البريد الإلكتروني', icon: EnvelopeIcon, description: 'إعدادات خادم SMTP وإرسال الرسائل', permission: 'settings.update' },
        { id: 'supabase', label: 'قاعدة البيانات المركزية', icon: DocumentTextIcon, description: 'إعداد وترحيل البيانات إلى Supabase', permission: 'settings.update' }
      ]
    },
    {
      id: 'management',
      name: 'إدارة المستخدمين والبيانات',
      icon: UsersIcon,
      color: 'green',
      tabs: [
        { id: 'users', label: 'إدارة المستخدمين', icon: UsersIcon, description: 'إضافة وتعديل المستخدمين والصلاحيات', permission: 'users.read' },
        { id: 'export', label: 'تصدير البيانات', icon: DocumentArrowDownIcon, description: 'تصدير بيانات العملاء والقضايا', permission: 'settings.read' },
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

  const getColorClasses = (color: string, variant: 'bg' | 'text' | 'border' | 'hover') => {
    const colors = {
      blue: {
        bg: 'bg-blue-500',
        text: 'text-blue-600',
        border: 'border-blue-200',
        hover: 'hover:bg-blue-50'
      },
      purple: {
        bg: 'bg-purple-500',
        text: 'text-purple-600',
        border: 'border-purple-200',
        hover: 'hover:bg-purple-50'
      },
      green: {
        bg: 'bg-green-500',
        text: 'text-green-600',
        border: 'border-green-200',
        hover: 'hover:bg-green-50'
      },
      amber: {
        bg: 'bg-amber-500',
        text: 'text-amber-600',
        border: 'border-amber-200',
        hover: 'hover:bg-amber-50'
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
              <h3 className="text-2xl font-bold text-slate-900 mb-2">الملف الشخصي</h3>
              <p className="text-slate-600">إدارة معلوماتك الشخصية وصورتك الشخصية</p>
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
                  <label className="block text-sm font-semibold text-slate-700">الاسم الكامل</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">رقم الجوال</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={profileData.jobTitle}
                    disabled
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-500"
                  />
                </div>
              </div>
            </div>
            
            {saveMessage && (
              <div className={`max-w-2xl mx-auto p-4 rounded-xl flex items-center gap-3 ${
                saveMessage.includes('نجاح') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {saveMessage.includes('نجاح') && <CheckIcon className="h-5 w-5" />}
                {saveMessage}
              </div>
            )}

            <div className="max-w-2xl mx-auto border-t border-slate-200 pt-6">
              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setProfileData({
                    name: user?.name || '',
                    email: user?.email || '',
                    phone: '+966501234567',
                    jobTitle: user?.role === 'admin' ? 'مدير النظام' : user?.role === 'lawyer' ? 'محامي' : 'إداري',
                    profilePicture: user?.profilePicture || ''
                  })}
                  className="px-6 py-3 text-slate-600 hover:text-slate-800 font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleProfileSave}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-4 w-4" />
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
              <h3 className="text-2xl font-bold text-slate-900 mb-2">استيراد البيانات</h3>
              <p className="text-slate-600">رفع ملفات Excel لاستيراد بيانات العملاء والقضايا</p>
            </div>
            
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border border-blue-200">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UsersIcon className="h-8 w-8 text-white" />
                    </div>
                    <h4 className="text-xl font-bold text-blue-900 mb-2">استيراد العملاء</h4>
                    <p className="text-blue-700">رفع ملف Excel يحتوي على بيانات العملاء</p>
                  </div>
                  <div className="space-y-4">
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
                      تنزيل نموذج Excel
                    </button>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="w-full px-4 py-3 border border-blue-300 rounded-xl bg-white"
                    />
                    <button className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
                      رفع الملف
                    </button>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 border border-green-200">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <DocumentTextIcon className="h-8 w-8 text-white" />
                    </div>
                    <h4 className="text-xl font-bold text-green-900 mb-2">استيراد القضايا</h4>
                    <p className="text-green-700">رفع ملف Excel يحتوي على بيانات القضايا</p>
                  </div>
                  <div className="space-y-4">
                    <button className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
                      تنزيل نموذج Excel
                    </button>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="w-full px-4 py-3 border border-green-300 rounded-xl bg-white"
                    />
                    <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
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
              <h3 className="text-2xl font-bold text-slate-900 mb-2">إعدادات الأمان</h3>
              <p className="text-slate-600">إدارة كلمة المرور والمصادقة الثنائية</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <ShieldCheckIcon className="h-6 w-6 text-blue-600" />
                  تغيير كلمة المرور
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">كلمة المرور الحالية</label>
                    <input
                      type="password"
                      value={securityData.currentPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="أدخل كلمة المرور الحالية"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={securityData.newPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="أدخل كلمة المرور الجديدة"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">تأكيد كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={securityData.confirmPassword}
                      onChange={(e) => setSecurityData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="أعد إدخال كلمة المرور الجديدة"
                    />
                  </div>
                  <button
                    onClick={handleSecuritySave}
                    disabled={isSaving || !securityData.currentPassword || !securityData.newPassword}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium transition-colors"
                  >
                    {isSaving ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
                  </button>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 mb-2">المصادقة الثنائية</h4>
                    <p className="text-slate-600">تفعيل المصادقة الثنائية لحماية إضافية لحسابك</p>
                  </div>
                  <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
                    تفعيل
                  </button>
                </div>
              </div>
            </div>
            
            {saveMessage && (
              <div className={`max-w-2xl mx-auto p-4 rounded-xl flex items-center gap-3 ${
                saveMessage.includes('نجاح') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {saveMessage.includes('نجاح') && <CheckIcon className="h-5 w-5" />}
                {saveMessage}
              </div>
            )}
          </div>
        );
      
      case 'notifications':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">إعدادات الإشعارات</h3>
              <p className="text-slate-600">تخصيص تفضيلات الإشعارات والتنبيهات</p>
            </div>
            
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Email Notifications */}
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <EnvelopeIcon className="h-6 w-6 text-blue-600" />
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
                    <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <label className="text-sm font-semibold text-slate-900">{item.label}</label>
                        <p className="text-xs text-slate-600">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* System Notifications */}
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <CogIcon className="h-6 w-6 text-purple-600" />
                  إشعارات النظام
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: 'userLogin', label: 'تسجيل دخول المستخدمين', desc: 'إشعار عند تسجيل دخول المستخدمين' },
                    { key: 'backups', label: 'النسخ الاحتياطية', desc: 'إشعار عند إنشاء النسخ الاحتياطية' },
                    { key: 'updates', label: 'تحديثات النظام', desc: 'إشعار عند توفر تحديثات جديدة' },
                    { key: 'errors', label: 'أخطاء النظام', desc: 'تنبيه عند حدوث أخطاء في النظام' }
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div>
                        <label className="text-sm font-semibold text-slate-900">{item.label}</label>
                        <p className="text-xs text-slate-600">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked={item.key !== 'userLogin'}
                        className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Notification Schedule */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-200">
                <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
                  <BellIcon className="h-6 w-6 text-blue-600" />
                  جدولة التقارير
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">تقرير يومي</label>
                    <select className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="disabled">معطل</option>
                      <option value="8am" selected>8:00 صباحاً</option>
                      <option value="9am">9:00 صباحاً</option>
                      <option value="10am">10:00 صباحاً</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">تقرير أسبوعي</label>
                    <select className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="disabled">معطل</option>
                      <option value="sunday" selected>الأحد</option>
                      <option value="monday">الاثنين</option>
                      <option value="saturday">السبت</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">تقرير شهري</label>
                    <select className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="disabled">معطل</option>
                      <option value="1st" selected>أول الشهر</option>
                      <option value="15th">منتصف الشهر</option>
                      <option value="last">آخر الشهر</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">طريقة الإرسال</label>
                    <select className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="email" selected>البريد الإلكتروني</option>
                      <option value="sms">رسائل نصية</option>
                      <option value="both">كلاهما</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-colors">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <CogIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">الإعدادات</h1>
              <p className="text-slate-600">إدارة إعدادات النظام والملف الشخصي</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Categories with Inline Content */}
          <div className="space-y-4">
            {visibleCategories.map((category) => (
              <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => handleCategoryToggle(category.id)}
                  className={`w-full p-6 bg-gradient-to-r ${
                    category.color === 'blue' ? 'from-blue-500 to-blue-600' :
                    category.color === 'purple' ? 'from-purple-500 to-purple-600' :
                    category.color === 'green' ? 'from-green-500 to-green-600' :
                    'from-amber-500 to-amber-600'
                  } text-white flex items-center justify-between hover:opacity-90 transition-opacity`}
                >
                  <div className="flex items-center gap-3">
                    <category.icon className="h-6 w-6" />
                    <h3 className="font-bold text-lg">{category.name}</h3>
                  </div>
                  <ChevronDownIcon 
                    className={`h-5 w-5 transition-transform duration-300 ${
                      expandedCategory === category.id ? 'rotate-180' : ''
                    }`} 
                  />
                </button>
                
                {/* Category Tabs */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  expandedCategory === category.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="p-4 space-y-2 border-b border-slate-200">
                    {category.tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all duration-200 ${
                          activeTab === tab.id
                            ? `${getColorClasses(category.color, 'bg')} text-white shadow-lg transform scale-[1.02]`
                            : `text-slate-700 ${getColorClasses(category.color, 'hover')} hover:transform hover:scale-[1.01]`
                        }`}
                      >
                        <tab.icon className={`h-5 w-5 ${
                          activeTab === tab.id ? 'text-white' : getColorClasses(category.color, 'text')
                        }`} />
                        <div className="flex-1 text-right">
                          <div className={`font-medium ${activeTab === tab.id ? 'text-white' : 'text-slate-900'}`}>
                            {tab.label}
                          </div>
                          <div className={`text-xs ${
                            activeTab === tab.id ? 'text-white/80' : 'text-slate-500'
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
                    <div className="p-8 bg-slate-50">
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