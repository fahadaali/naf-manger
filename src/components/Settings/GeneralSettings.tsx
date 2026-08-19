import React, { useState, useEffect } from 'react';
import { Building2, CircleCheck, Image, Palette, TriangleAlert } from 'lucide-react';
import { db } from '../../data/database';
import { SystemSettings } from '../../types';
import { pictureUrl, uploadFile } from '../../data/api';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';

/* الحدّان مرآةُ `LOGO` في `worker/lib/files.js` — والخادم هو الحاكم.
   وSVG مستثنًى هناك قصداً: يحمل نصّاً يُنفَّذ حين يُفتح على أصلنا. */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 512 * 1024;

/** ما تملك هذه الشاشة تغييرَه — وهو ما تُرسله لا الكائن كلَّه. */
type GeneralFields = Pick<SystemSettings, 'companyName' | 'companyDescription' | 'companyLogo'>;

export default function GeneralSettings() {
  const [settings, setSettings] = useState<GeneralFields | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const loadSettingsAsync = async () => {
      try {
        const current = await db.getSettings();
        setSettings({
          companyName: current.companyName ?? '',
          companyDescription: current.companyDescription ?? '',
          companyLogo: current.companyLogo ?? null,
        });
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadSettingsAsync();
  };

  const handleInputChange = (field: keyof GeneralFields, value: string) => {
    if (!settings) return;
    setSettings(prev => prev ? { ...prev, [field]: value } : null);
  };

  /* ═══ الشعار يُرفع إلى الحاوية، ولا يُقرأ نصّاً ═══
   *
   * كان هنا `readAsDataURL`: يقرأ الملفّ سلسلةَ base64 ويحشرها في
   * `system_settings.value` — حتى ٢٫٧ ميغابايت نصّاً لملفّ ٢ ميغابايت،
   * فوق حدّ D1 لقيمةٍ واحدة فيسقط الحفظ. وما دون الحدّ يُنقل مع كل قراءة
   * إعدادات، أي مع كل فتحةِ نموذجٍ لكل عضو.
   *
   * والآن `POST /api/files` بنوع `logo`، والمفتاحُ وحده هو ما يُحفظ —
   * كما تفعل الصورة الشخصية بالضبط. */
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSaveMessage('');

    if (!ACCEPTED.includes(file.type)) {
      setSaveMessage('الصيغ المقبولة: PNG أو JPEG أو WebP');
      return;
    }
    if (file.size > MAX_BYTES) {
      setSaveMessage('حجم الشعار يجب أن يكون أقل من نصف ميجابايت');
      return;
    }

    setUploading(true);
    try {
      const { key } = await uploadFile(file, 'logo');
      setSettings(prev => prev ? { ...prev, companyLogo: key } : null);
    } catch (error) {
      console.error('تعذّر رفع الشعار:', error);
      setSaveMessage('تعذّر رفع الشعار. أعد المحاولة');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
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
      /* حقولُ هذه الشاشة وحدها لا الكائن الراجع كلَّه: إرسالُه يُثبّت
         المفرداتِ الافتراضية في الصفّ فلا يبلغها تعديلٌ لاحق في الشيفرة. */
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

  /* والمحوُ يُرسَل `null` لا `undefined`: الثاني يُسقطه `JSON.stringify`
     من الجسم، فلا يبلغ الخادمَ مفتاحٌ يمحوه ويبقى الشعارُ القديم بعد أن
     فُرّغت معاينتُه — فيُقرأ الحفظُ ناجحاً ويعود الشعار مع إعادة التحميل. */
  const resetToDefaults = () => {
    if (window.confirm('هل أنت متأكد من إعادة تعيين الإعدادات إلى القيم الافتراضية؟')) {
      setSettings({
        companyName: 'شركة ناف',
        companyDescription: 'نظام إدارة العملاء',
        companyLogo: null,
      });
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
              accept={ACCEPTED.join(',')}
              onChange={handleLogoUpload}
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              PNG أو JPEG أو WebP (أقل من نصف ميجابايت)
            </p>
          </div>

          {settings.companyLogo && (
            <div className="shrink-0">
              <label className="block text-sm font-medium text-foreground mb-2">
                معاينة الشعار
              </label>
              <div className="w-20 h-20 border border-border rounded-lg overflow-hidden bg-card flex items-center justify-center">
                <img
                  src={pictureUrl(settings.companyLogo)}
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