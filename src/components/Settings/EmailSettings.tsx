import React, { useState, useEffect } from 'react';
import { CircleCheck, Eye, EyeOff, Mail, TriangleAlert } from 'lucide-react';
import { db } from '../../data/database';
import { SystemSettings } from '../../types';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';

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
      setSaveMessage('تم الحفظ');
      
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

  /* ═══ إرسال البريد معطَّل ═══
   *
   * كان يُنادى خادمُ Express على `localhost:3001` — خادمٌ خارج Cloudflare
   * يحتاج استضافةً وصيانة، ولا يعمل إلا على جهاز من شغّله.
   *
   * وWorkers لا تتكلّم SMTP، و`Email Routing` تستقبل وتحوّل ولا تُرسل.
   * فالإرسال يحتاج مزوّداً يتكلّم HTTP، وذلك قرارٌ لم يُتَّخذ بعد.
   *
   * فالشاشة تحفظ الإعدادات ولا ترسل، وتقول ذلك صراحةً بالمصطلح المسجَّل
   * «غير مربوط» بدل أن تسقط بخطأ شبكةٍ يوهم أن العطل عارض.
   */
  const testEmailConnection = async () => {
    setTestResult('error');
    setSaveMessage('غير مربوط');
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
          <Mail className="h-6 w-6 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">إعدادات البريد الإلكتروني</h3>
        </div>
        <Button onClick={resetToDefaults} variant="ghost" size="sm">
          إعادة تعيين للافتراضي
        </Button>
      </div>

      {saveMessage && (() => {
        /* نتيجةُ الفحص تسبق نبرةَ النصّ: «غير مربوط» رسالةُ حالةٍ
           مسجَّلة لا خطأ لغويّ، والفحصُ هو من يعرف أيّهما. */
        const tone =
          testResult === 'success' ? 'success' :
          testResult === 'error' ? 'destructive' :
          messageTone(saveMessage);
        const Icon = tone === 'success' ? CircleCheck : TriangleAlert;
        return (
          <Alert variant={tone}>
            <Icon aria-hidden="true" />
            <span>{saveMessage}</span>
          </Alert>
        );
      })()}

      {/* إعدادات الخادم */}
      <div className="bg-muted rounded-lg p-6">
        <h4 className="font-medium text-foreground mb-4">إعدادات خادم SMTP</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              خادم SMTP *
            </label>
            <Input
              type="text"
              value={settings?.host || ''}
              onChange={(e) => handleInputChange('host', e.target.value)}
              placeholder="smtp.hostinger.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              المنفذ *
            </label>
            <Input
              type="number"
              value={settings?.port || 587}
              onChange={(e) => handleInputChange('port', parseInt(e.target.value))}
              placeholder="587"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.secure || false}
                onChange={(e) => handleInputChange('secure', e.target.checked)}
                className="rounded border-border text-primary focus-visible:ring-ring"
              />
              <span className="text-sm text-foreground">استخدام SSL/TLS (للمنفذ 465)</span>
            </label>
          </div>
        </div>
      </div>

      {/* بيانات المصادقة */}
      <div className="bg-muted rounded-lg p-6">
        <h4 className="font-medium text-foreground mb-4">بيانات المصادقة</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              اسم المستخدم / البريد الإلكتروني *
            </label>
            <Input
              type="email"
              value={settings?.user || ''}
              onChange={(e) => handleInputChange('user', e.target.value)}
              placeholder="your-email@yourdomain.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              كلمة المرور *
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={settings?.password || ''}
                onChange={(e) => handleInputChange('password', e.target.value)} className="pe-10"
                placeholder="••••••••"
              />
              <Button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-1/2 -translate-y-1/2" variant="ghost" size="icon-sm">
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* إعدادات المرسل */}
      <div className="bg-muted rounded-lg p-6">
        <h4 className="font-medium text-foreground mb-4">إعدادات المرسل</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              اسم المرسل *
            </label>
            <Input
              type="text"
              value={settings?.fromName || ''}
              onChange={(e) => handleInputChange('fromName', e.target.value)}
              placeholder="NAF Law"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              بريد المرسل *
            </label>
            <Input
              type="email"
              value={settings?.fromAddress || ''}
              onChange={(e) => handleInputChange('fromAddress', e.target.value)}
              placeholder="noreply@naflaw.com"
            />
          </div>
        </div>
      </div>

      {/* معلومات مساعدة */}
      <div className="bg-primary-soft border border-primary/30 rounded-lg p-4">
        <h4 className="font-medium text-primary-strong mb-2">معلومات مهمة:</h4>
        <ul className="text-sm text-primary-strong space-y-1">
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
            <label className="block text-sm font-medium text-foreground mb-2">
              بريد إلكتروني للاختبار *
            </label>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
            />
          </div>
        </div>

        <Button onClick={testEmailConnection} disabled={isTesting || !settings?.host || !settings?.user || !settings?.password || !testEmail.trim()} variant="success">
          {isTesting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-card"></div>
              جارٍ إرسال البريد التجريبي
            </>
          ) : (
            <>
              <CircleCheck className="h-4 w-4" />
              إرسال بريد تجريبي
            </>
          )}
        </Button>
      </div>

      <div className="flex justify-end">
        <div className="flex gap-3">
          <Button onClick={loadSettings} variant="ghost">
            إلغاء التغييرات
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'جارٍ الحفظ' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </div>

      {/* حالة الخادم */}
      <div className={`border rounded-lg p-4 ${
        settings?.host && settings?.user && settings?.password 
          ? 'bg-success-soft border-success/30' 
          : 'bg-primary-soft border-primary/30'
      }`}>
        <h4 className={`font-medium mb-2 ${
          settings?.host && settings?.user && settings?.password 
            ? 'text-success-strong' 
            : 'text-primary-strong'
        }`}>
          {settings?.host && settings?.user && settings?.password 
            ? 'إعدادات البريد الإلكتروني مكتملة'
            : 'معلومات حول إعدادات البريد الإلكتروني'}
        </h4>
        <div className={`text-sm space-y-2 ${
          settings?.host && settings?.user && settings?.password 
            ? 'text-success-strong' 
            : 'text-primary-strong'
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
              <div className="ms-4 space-y-1">
                <p>- Gmail: smtp.gmail.com:587</p>
                <p>- Outlook: smtp-mail.outlook.com:587</p>
                <p>- Hostinger: smtp.hostinger.com:587</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* تعليمات تشغيل الخادم */}
      <div className="bg-warning-soft border border-warning/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-warning-soft rounded-full flex items-center justify-center">
              <TriangleAlert className="size-4 text-warning-strong" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h5 className="font-medium text-warning-strong mb-2">تعليمات تشغيل خادم البريد الإلكتروني:</h5>
            <div className="text-sm text-warning-strong space-y-2">
              <p><strong>1. انتقل إلى مجلد الخادم:</strong></p>
              <code className="bg-warning-soft px-2 py-1 rounded text-xs">cd server</code>
              
              <p>الإرسال غير مربوط. وWorkers لا تتكلّم SMTP، فالإرسال يحتاج
              مزوّداً يتكلّم HTTP — وذلك قرارٌ لم يُتَّخذ بعد. والإعدادات هنا
              تُحفظ وتنتظره.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}