import React, { useState, useEffect } from 'react';
import { Building2, CircleCheck, Image, Palette, TriangleAlert } from 'lucide-react';
import { db } from '../../data/database';
import { SystemSettings } from '../../types';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';

export default function GeneralSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const loadSettingsAsync = async () => {
      try {
        const currentSettings = await db.getSettings();
        setSettings(currentSettings);
        if (currentSettings.companyLogo) {
          setLogoPreview(currentSettings.companyLogo);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettingsAsync();
  };

  const handleInputChange = (field: keyof SystemSettings, value: string) => {
    if (!settings) return;
    setSettings(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      setSaveMessage('يرجى اختيار ملف صورة صحيح');
      return;
    }

    // التحقق من حجم الملف (أقل من 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setSaveMessage('حجم الصورة يجب أن يكون أقل من 2 ميجابايت');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setLogoPreview(result);
      if (settings) {
        setSettings(prev => prev ? { ...prev, companyLogo: result } : null);
      }
    };
    reader.readAsDataURL(file);
  };

  /* ═══ لماذا زال منتقي الألوان من هذه الشاشة ═══
   *
   * كانت هنا ثلاثة حقول لون يحرّرها أي مستخدم، تُخزَّن في قاعدة البيانات
   * وتُحقن على عنصر الجذر وقت التشغيل. وهي أعمق ما كان في الانحراف: شاشةٌ
   * تسمح بتغيير هوية المنصة تعني أن السجلّ لا يحكم شيئاً، وأن كل نسخةٍ من
   * naf-manger قد تختلف عن أختها وعن المنصات الأربع الباقية.
   *
   * واللون قرارٌ يُسجَّل في naf-ui مرّةً ثم يُستهلك في الخمس — لا يُنتقى
   * في شاشة إعدادات. والقاعدة الحاكمة: «السجلّ يسبق المنصة».
   *
   * حقول primaryColor و secondaryColor و accentColor تبقى في القاعدة
   * وفي النوع — إسقاطها ترحيلُ مخطَّط يخصّ قراراً آخر — لكنها لم تعد
   * تُقرأ ولا تُكتب من الواجهة، ولم يعد شيء يُحقن على الجذر.
   */

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    setSaveMessage('');

    try {
      await db.updateSettings(settings);

      setSaveMessage('تم الحفظ');
      
      // إعادة تحميل الصفحة لتطبيق التغييرات على جميع المكونات
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('حدث خطأ أثناء حفظ الإعدادات');
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    if (window.confirm('هل أنت متأكد من إعادة تعيين الإعدادات إلى القيم الافتراضية؟')) {
      const defaultSettings = {
        ...settings!,
        companyName: 'NAF Law',
        companyDescription: 'نظام إدارة المكتب القانوني',
        companyLogo: undefined
      };

      setSettings(defaultSettings);
      setLogoPreview(null);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-foreground">الإعدادات العامة</h3>
        <Button onClick={resetToDefaults} variant="ghost" size="sm">
          إعادة تعيين للافتراضي
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

      {/* معلومات الشركة */}
      <div className="bg-muted rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-6 w-6 text-muted-foreground" />
          <h4 className="font-medium text-foreground">معلومات الشركة</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              اسم الشركة
            </label>
            <Input
              type="text"
              value={settings.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              placeholder="اسم الشركة"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              وصف الشركة
            </label>
            <Input
              type="text"
              value={settings.companyDescription}
              onChange={(e) => handleInputChange('companyDescription', e.target.value)}
              placeholder="وصف مختصر للشركة"
            />
          </div>
        </div>
      </div>

      {/* شعار الشركة */}
      <div className="bg-muted rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image className="h-6 w-6 text-muted-foreground" />
          <h4 className="font-medium text-foreground">شعار الشركة</h4>
        </div>
        
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-foreground mb-2">
              رفع شعار جديد
            </label>
            <Input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
            />
            <p className="text-xs text-muted-foreground mt-1">
              يُفضل استخدام صور بصيغة PNG أو SVG، الحد الأقصى 2MB
            </p>
          </div>
          
          {logoPreview && (
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-foreground mb-2">
                معاينة الشعار
              </label>
              <div className="w-20 h-20 border border-border rounded-lg overflow-hidden bg-card flex items-center justify-center">
                <img
                  src={logoPreview}
                  alt="شعار الشركة"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* لوحة الهوية — تُعرَض ولا تُحرَّر */}
      <div className="bg-muted rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-6 w-6 text-muted-foreground" />
          <h4 className="font-medium text-foreground">لوحة الهوية</h4>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          الألوان تأتي من سجلّ التصميم الموحّد ولا تُحرَّر هنا. تغييرها قرار
          يُسجَّل مرّة واحدة في <bdi>naf-ui</bdi> فتتبعه منصات ناف الخمس معاً.
        </p>

        <div className="flex flex-wrap gap-3">
          {[
            { cls: 'bg-primary text-primary-foreground', label: 'أساسي' },
            { cls: 'bg-secondary text-secondary-foreground', label: 'ثانوي' },
            { cls: 'bg-accent text-accent-foreground', label: 'تمييز' },
            { cls: 'bg-success text-success-foreground', label: 'نجاح' },
            { cls: 'bg-warning text-warning-foreground', label: 'تحذير' },
            { cls: 'bg-destructive text-destructive-foreground', label: 'خطأ' },
            { cls: 'bg-info text-info-foreground', label: 'معلومة' }
          ].map((swatch) => (
            <div
              key={swatch.label}
              className={`w-16 h-16 rounded-lg flex items-center justify-center text-xs font-medium ${swatch.cls}`}
            >
              {swatch.label}
            </div>
          ))}
        </div>
      </div>

      {/* معاينة التغييرات */}
      <div className="bg-primary-soft rounded-lg p-4">
        <h4 className="font-medium text-primary-strong mb-2">ملاحظة</h4>
        <p className="text-sm text-primary-strong">
          تُطبَّق التغييرات على النظام بعد الحفظ.
        </p>
      </div>

      {/* أزرار الحفظ */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button onClick={() => loadSettings()} variant="ghost">
          إلغاء التغييرات
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'جارٍ الحفظ' : 'حفظ الإعدادات'}
        </Button>
      </div>
    </div>
  );
}