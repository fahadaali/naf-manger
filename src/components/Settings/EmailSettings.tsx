import React, { useState, useEffect } from 'react';
import { 
  EnvelopeIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { db } from '../../data/database';
import { SystemSettings } from '../../types';

export default function EmailSettings() {
  const [settings, setSettings] = useState<SystemSettings['emailSettings']>({
    host: '',
    port: 587,
    secure: false,
    user: '',
    password: '',
    fromName: '',
    fromAddress: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const loadSettingsAsync = async () => {
      try {
        const systemSettings = await db.getSettings();
        if (systemSettings.emailSettings) {
          setSettings(systemSettings.emailSettings);
        }
      } catch (error) {
        console.error('Error loading email settings:', error);
      }
    };
    
    loadSettingsAsync();
  };

  const handleInputChange = (field: keyof NonNullable<SystemSettings['emailSettings']>, value: string | number | boolean) => {
    setSettings(prev => ({
      ...prev!,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      const systemSettings = await db.getSettings();
      const updatedSettings = {
        ...systemSettings,
        emailSettings: settings
      };
      
      await db.updateSettings(updatedSettings);
      setSaveMessage('تم حفظ إعدادات البريد الإلكتروني بنجاح');
      
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error saving email settings:', error);
      setSaveMessage('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  const testEmailConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSaveMessage('');

    try {
      // التحقق من الحقول المطلوبة
      if (!settings?.host || !settings?.user || !settings?.password || !testEmail.trim()) {
        throw new Error('يرجى ملء جميع الحقول المطلوبة وإدخال بريد إلكتروني للاختبار');
      }

      // التحقق من صحة البريد الإلكتروني للاختبار
      if (!/\S+@\S+\.\S+/.test(testEmail)) {
        throw new Error('يرجى إدخال بريد إلكتروني صحيح للاختبار');
      }

      // التحقق من توفر خادم البريد الإلكتروني
      const healthResponse = await fetch('http://localhost:3001/api/health');
      if (!healthResponse.ok) {
        throw new Error('خادم البريد الإلكتروني غير متاح. تأكد من تشغيل الخادم على المنفذ 3001');
      }

      // إرسال طلب إلى خادم البريد الإلكتروني
      const response = await fetch('http://localhost:3001/api/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailSettings: settings,
          testEmail: testEmail
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'فشل في إرسال البريد التجريبي');
      }

      setTestResult('success');
      setSaveMessage(`✅ تم إرسال البريد التجريبي بنجاح!

📧 تفاصيل الإرسال:
• البريد المرسل إليه: ${testEmail}
• معرف الرسالة: ${result.messageId}
• الخادم: ${settings.host}:${settings.port}
• الأمان: ${settings.secure ? 'SSL/TLS' : 'STARTTLS'}
• المرسل: ${settings.fromName} <${settings.fromAddress}>
• وقت الإرسال: ${new Date().toLocaleString('ar-SA')}

ℹ️ تحقق من صندوق الوارد أو مجلد الرسائل غير المرغوب فيها في البريد المرسل إليه.`);
      
    } catch (error) {
      console.error('Email test error:', error);
      setTestResult('error');
      
      let errorMessage = 'فشل في إرسال البريد التجريبي';
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = 'لا يمكن الاتصال بخادم البريد الإلكتروني. تأكد من تشغيل الخادم على المنفذ 3001';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setSaveMessage(`❌ ${errorMessage}

💡 نصائح لحل المشكلة:
• تأكد من تشغيل خادم البريد الإلكتروني: cd server && npm start
• تحقق من صحة إعدادات SMTP
• تأكد من تفعيل "App Passwords" للحسابات التي تدعمها
• تحقق من إعدادات الأمان في حساب البريد الإلكتروني`);
    } finally {
      setIsTesting(false);
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('هل أنت متأكد من إعادة تعيين إعدادات البريد الإلكتروني إلى القيم الافتراضية؟')) {
      setSettings({
        host: 'smtp.hostinger.com',
        port: 587,
        secure: false,
        user: '',
        password: '',
        fromName: 'NAF Law',
        fromAddress: ''
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <EnvelopeIcon className="h-6 w-6 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">إعدادات البريد الإلكتروني</h3>
        </div>
        <button
          onClick={resetToDefaults}
          className="text-slate-600 hover:text-slate-800 text-sm"
        >
          إعادة تعيين للافتراضي
        </button>
      </div>

      {saveMessage && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          saveMessage.includes('نجاح') || testResult === 'success' 
            ? 'bg-green-50 text-green-800' 
            : 'bg-red-50 text-red-800'
        }`}>
          {testResult === 'success' && <CheckCircleIcon className="h-5 w-5" />}
          {testResult === 'error' && <ExclamationTriangleIcon className="h-5 w-5" />}
          {saveMessage}
        </div>
      )}

      {/* إعدادات الخادم */}
      <div className="bg-slate-50 rounded-lg p-6">
        <h4 className="font-medium text-slate-900 mb-4">إعدادات خادم SMTP</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              خادم SMTP *
            </label>
            <input
              type="text"
              value={settings?.host || ''}
              onChange={(e) => handleInputChange('host', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="smtp.hostinger.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              المنفذ *
            </label>
            <input
              type="number"
              value={settings?.port || 587}
              onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="587"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.secure || false}
                onChange={(e) => handleInputChange('secure', e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">استخدام SSL/TLS (للمنفذ 465)</span>
            </label>
          </div>
        </div>
      </div>

      {/* بيانات المصادقة */}
      <div className="bg-slate-50 rounded-lg p-6">
        <h4 className="font-medium text-slate-900 mb-4">بيانات المصادقة</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              اسم المستخدم / البريد الإلكتروني *
            </label>
            <input
              type="email"
              value={settings?.user || ''}
              onChange={(e) => handleInputChange('user', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your-email@yourdomain.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              كلمة المرور *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={settings?.password || ''}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* إعدادات المرسل */}
      <div className="bg-slate-50 rounded-lg p-6">
        <h4 className="font-medium text-slate-900 mb-4">إعدادات المرسل</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              اسم المرسل *
            </label>
            <input
              type="text"
              value={settings?.fromName || ''}
              onChange={(e) => handleInputChange('fromName', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="NAF Law"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              بريد المرسل *
            </label>
            <input
              type="email"
              value={settings?.fromAddress || ''}
              onChange={(e) => handleInputChange('fromAddress', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="noreply@naflaw.com"
            />
          </div>
        </div>
      </div>

      {/* معلومات مساعدة */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">معلومات مهمة:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• تأكد من تفعيل SMTP في إعدادات البريد الإلكتروني لدى مزود الخدمة</li>
          <li>• للمنفذ 587 استخدم STARTTLS (غير مؤمن في البداية)</li>
          <li>• للمنفذ 465 استخدم SSL/TLS (مؤمن من البداية)</li>
          <li>• تأكد من صحة اسم المستخدم وكلمة المرور</li>
          <li>• قد تحتاج لإنشاء كلمة مرور تطبيق منفصلة</li>
        </ul>
      </div>

      {/* أزرار الإجراءات */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              بريد إلكتروني للاختبار *
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="test@example.com"
            />
          </div>
        </div>

        <button
          onClick={testEmailConnection}
          disabled={isTesting || !settings?.host || !settings?.user || !settings?.password || !testEmail.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg"
        >
          {isTesting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              جاري إرسال البريد التجريبي...
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-4 w-4" />
              إرسال بريد تجريبي
            </>
          )}
        </button>
      </div>

      <div className="flex justify-end">
        <div className="flex gap-3">
          <button
            onClick={loadSettings}
            className="px-4 py-2 text-slate-600 hover:text-slate-800"
          >
            إلغاء التغييرات
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </div>

      {/* حالة الخادم */}
      <div className={`border rounded-lg p-4 ${
        settings?.host && settings?.user && settings?.password 
          ? 'bg-green-50 border-green-200' 
          : 'bg-blue-50 border-blue-200'
      }`}>
        <h4 className={`font-medium mb-2 ${
          settings?.host && settings?.user && settings?.password 
            ? 'text-green-900' 
            : 'text-blue-900'
        }`}>
          {settings?.host && settings?.user && settings?.password 
            ? '✅ إعدادات البريد الإلكتروني مكتملة' 
            : 'ℹ️ معلومات حول إعدادات البريد الإلكتروني'}
        </h4>
        <div className={`text-sm space-y-2 ${
          settings?.host && settings?.user && settings?.password 
            ? 'text-green-800' 
            : 'text-blue-800'
        }`}>
          {settings?.host && settings?.user && settings?.password ? (
            <>
              <p>• <strong>الخادم المكون:</strong> {settings.host}:{settings.port}</p>
              <p>• <strong>المستخدم:</strong> {settings.user}</p>
              <p>• <strong>الأمان:</strong> {settings.secure ? 'SSL/TLS' : 'STARTTLS'}</p>
              <p>• <strong>المرسل:</strong> {settings.fromName} &lt;{settings.fromAddress}&gt;</p>
              <p>• <strong>الحالة:</strong> جاهز للاستخدام في ميزات الاجتماعات والإشعارات</p>
            </>
          ) : (
            <>
              <p>• <strong>اختبار الإعدادات:</strong> يتحقق من صحة البيانات المدخلة</p>
              <p>• <strong>الاستخدام:</strong> سيتم استخدام الإعدادات في ميزات الاجتماعات</p>
              <p>• <strong>خوادم شائعة:</strong></p>
              <div className="mr-4 space-y-1">
                <p>- Gmail: smtp.gmail.com:587</p>
                <p>- Outlook: smtp-mail.outlook.com:587</p>
                <p>- Hostinger: smtp.hostinger.com:587</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* تعليمات تشغيل الخادم */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-amber-600 text-sm">⚠️</span>
            </div>
          </div>
          <div>
            <h5 className="font-medium text-amber-900 mb-2">تعليمات تشغيل خادم البريد الإلكتروني:</h5>
            <div className="text-sm text-amber-800 space-y-2">
              <p><strong>1. انتقل إلى مجلد الخادم:</strong></p>
              <code className="bg-amber-100 px-2 py-1 rounded text-xs">cd server</code>
              
              <p><strong>2. ثبت المكتبات المطلوبة:</strong></p>
              <code className="bg-amber-100 px-2 py-1 rounded text-xs">npm install</code>
              
              <p><strong>3. شغل الخادم:</strong></p>
              <code className="bg-amber-100 px-2 py-1 rounded text-xs">npm start</code>
              
              <p><strong>4. تأكد من أن الخادم يعمل على:</strong></p>
              <code className="bg-amber-100 px-2 py-1 rounded text-xs">http://localhost:3001</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}