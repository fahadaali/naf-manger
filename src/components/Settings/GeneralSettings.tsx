import React, { useState, useEffect } from 'react';
import { PhotoIcon, SwatchIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { db } from '../../data/database';
import { SystemSettings } from '../../types';

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

  const handleColorChange = (colorType: 'primaryColor' | 'secondaryColor' | 'accentColor', color: string) => {
    handleInputChange(colorType, color);
    
    // تطبيق اللون فوراً على الصفحة للمعاينة
    const root = document.documentElement;
    switch (colorType) {
      case 'primaryColor':
        root.style.setProperty('--color-primary', color);
        break;
      case 'secondaryColor':
        root.style.setProperty('--color-secondary', color);
        break;
      case 'accentColor':
        root.style.setProperty('--color-accent', color);
        break;
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    setSaveMessage('');

    try {
      await db.updateSettings(settings);
      
      // تطبيق الألوان على النظام
      applyThemeColors(settings);
      
      setSaveMessage('تم حفظ الإعدادات بنجاح');
      
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

  const applyThemeColors = (settings: SystemSettings) => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', settings.primaryColor);
    root.style.setProperty('--color-secondary', settings.secondaryColor);
    root.style.setProperty('--color-accent', settings.accentColor);
  };

  const resetToDefaults = () => {
    if (window.confirm('هل أنت متأكد من إعادة تعيين الإعدادات إلى القيم الافتراضية؟')) {
      const defaultSettings = {
        ...settings!,
        companyName: 'NAF Law',
        companyDescription: 'نظام إدارة المكتب القانوني',
        companyLogo: undefined,
        primaryColor: '#1e40af',
        secondaryColor: '#3b82f6',
        accentColor: '#f59e0b'
      };
      
      setSettings(defaultSettings);
      setLogoPreview(null);
      applyThemeColors(defaultSettings);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">الإعدادات العامة</h3>
        <button
          onClick={resetToDefaults}
          className="text-slate-600 hover:text-slate-800 text-sm"
        >
          إعادة تعيين للافتراضي
        </button>
      </div>

      {saveMessage && (
        <div className={`p-3 rounded-lg ${
          saveMessage.includes('نجاح') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* معلومات الشركة */}
      <div className="bg-slate-50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <BuildingOfficeIcon className="h-6 w-6 text-slate-600" />
          <h4 className="font-medium text-slate-900">معلومات الشركة</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              اسم الشركة
            </label>
            <input
              type="text"
              value={settings.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="اسم الشركة"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              وصف الشركة
            </label>
            <input
              type="text"
              value={settings.companyDescription}
              onChange={(e) => handleInputChange('companyDescription', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="وصف مختصر للشركة"
            />
          </div>
        </div>
      </div>

      {/* شعار الشركة */}
      <div className="bg-slate-50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <PhotoIcon className="h-6 w-6 text-slate-600" />
          <h4 className="font-medium text-slate-900">شعار الشركة</h4>
        </div>
        
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              رفع شعار جديد
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              يُفضل استخدام صور بصيغة PNG أو SVG، الحد الأقصى 2MB
            </p>
          </div>
          
          {logoPreview && (
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                معاينة الشعار
              </label>
              <div className="w-20 h-20 border border-slate-300 rounded-lg overflow-hidden bg-white flex items-center justify-center">
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

      {/* ألوان النظام */}
      <div className="bg-slate-50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <SwatchIcon className="h-6 w-6 text-slate-600" />
          <h4 className="font-medium text-slate-900">ألوان النظام</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              اللون الأساسي
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.primaryColor}
                onChange={(e) => handleColorChange('primaryColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="#1e40af"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">يُستخدم للأزرار الرئيسية والروابط</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              اللون الثانوي
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.secondaryColor}
                onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.secondaryColor}
                onChange={(e) => handleColorChange('secondaryColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="#3b82f6"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">يُستخدم للعناصر الثانوية</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              لون التمييز
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => handleColorChange('accentColor', e.target.value)}
                className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.accentColor}
                onChange={(e) => handleColorChange('accentColor', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="#f59e0b"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">يُستخدم للتنبيهات والتمييز</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h5 className="font-medium text-blue-900 mb-2">معاينة الألوان</h5>
          <div className="flex gap-3">
            <div 
              className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: settings.primaryColor }}
            >
              أساسي
            </div>
            <div 
              className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: settings.secondaryColor }}
            >
              ثانوي
            </div>
            <div 
              className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: settings.accentColor }}
            >
              تمييز
            </div>
          </div>
        </div>
      </div>

      {/* معاينة التغييرات */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">ملاحظة</h4>
        <p className="text-sm text-blue-800">
          سيتم تطبيق التغييرات على جميع أجزاء النظام بعد الحفظ. يمكنك معاينة الألوان فوراً عند تغييرها.
        </p>
      </div>

      {/* أزرار الحفظ */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={() => loadSettings()}
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
  );
}