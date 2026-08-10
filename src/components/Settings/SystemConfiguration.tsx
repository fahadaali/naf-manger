import { useState, useEffect } from 'react';
import { CircleCheck, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { db } from '../../data/database';
import { SystemSettings } from '../../types';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';

/* الشاشة تحرّر قوائمَ النصوص من الإعدادات وحدها — لا اسمَ الشركة ولا
   إعداداتِ البريد. والمفاتيح تُستخرج بالنوع لا بالنصّ، فما ليس قائمةَ نصوصٍ
   لا يبلغ `addItem` ولا `removeItem` أصلاً: كانا يفترضان مصفوفةً في كل
   مفتاح، فينشران نصّاً حرفاً حرفاً لو مُرّر مفتاحٌ غيرها. */
type ListCategory = {
  [K in keyof SystemSettings]-?: SystemSettings[K] extends string[] | undefined ? K : never;
}[keyof SystemSettings];

const EMPTY_LISTS: Pick<SystemSettings, ListCategory> = {
  clientTypes: [],
  clientStatuses: [],
  prospectStatuses: [],
  prospectSources: [],
  caseTypes: [],
  caseStatuses: [],
  contactRelations: [],
  idTypes: [],
  marketerStatuses: [],
  relationshipTypes: [],
  commissionTypes: [],
  collectionStatuses: [],
  feeTypes: []
};

export default function SystemConfiguration() {
  const [settings, setSettings] = useState<SystemSettings>({ ...EMPTY_LISTS });
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newItem, setNewItem] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const loadSettingsAsync = async () => {
      try {
        const currentSettings = await db.getSettings();
        setSettings(currentSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettingsAsync();
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'clientTypes': return 'أنواع العملاء';
      case 'clientStatuses': return 'حالات العملاء';
      case 'prospectStatuses': return 'حالات العملاء المحتملين';
      case 'prospectSources': return 'مصادر العملاء المحتملين';
      case 'caseTypes': return 'أنواع القضايا';
      case 'caseStatuses': return 'حالات القضايا';
      case 'contactRelations': return 'صفات أصحاب الأرقام';
      case 'idTypes': return 'أنواع الهوية';
      case 'marketerStatuses': return 'حالات المسوّقين';
      case 'relationshipTypes': return 'أنواع العلاقة مع المسوّقين';
      case 'commissionTypes': return 'أنواع العمولات';
      case 'collectionStatuses': return 'حالات التحصيل';
      case 'feeTypes': return 'أنواع الأتعاب';
      default: return category;
    }
  };

  const getItemLabel = (category: string, item: string) => {
    if (category === 'clientTypes') {
      switch (item) {
        case 'individual': return 'فرد';
        case 'company': return 'شركة';
        case 'association': return 'جمعية';
        case 'government': return 'جهة حكومية';
        default: return item;
      }
    }
    
    if (category === 'clientStatuses') {
      switch (item) {
        case 'current': return 'حالي';
        case 'former': return 'سابق';
        default: return item;
      }
    }
    
    if (category === 'caseStatuses') {
      switch (item) {
        case 'pending': return 'منظورة';
        case 'in-progress': return 'قيد المعالجة';
        case 'completed': return 'مكتملة';
        case 'postponed': return 'مؤجلة';
        default: return item;
      }
    }
    
    if (category === 'marketerStatuses') {
      switch (item) {
        case 'active': return 'نشط';
        case 'suspended': return 'معطّل';
        case 'former': return 'سابق';
        default: return item;
      }
    }
    
    if (category === 'relationshipTypes') {
      switch (item) {
        case 'employee': return 'موظف';
        case 'freelancer': return 'مستقل';
        case 'external_company': return 'شركة خارجية';
        default: return item;
      }
    }
    
    if (category === 'commissionTypes') {
      switch (item) {
        case 'fixed_amount': return 'مبلغ ثابت';
        case 'percentage': return 'نسبة مئوية';
        default: return item;
      }
    }
    
    if (category === 'collectionStatuses') {
      switch (item) {
        case 'fully_paid': return 'مدفوع كاملاً';
        case 'partially_paid': return 'مدفوع جزئياً';
        case 'unpaid': return 'غير مدفوع';
        default: return item;
      }
    }
    
    if (category === 'feeTypes') {
      switch (item) {
        case 'advance_only': return 'مقدم فقط';
        case 'deferred_only': return 'مؤخر فقط';
        case 'advance_and_deferred': return 'مقدم ومؤخر';
        default: return item;
      }
    }
    
    return item;
  };

  const addItem = (category: ListCategory) => {
    if (!newItem.trim()) return;

    setSettings(prev => ({
      ...prev,
      [category]: [...(prev[category] ?? []), newItem.trim()]
    }));
    setNewItem('');
    setEditingCategory(null);
  };

  const removeItem = (category: ListCategory, index: number) => {
    setSettings(prev => ({
      ...prev,
      [category]: (prev[category] ?? []).filter((_, i) => i !== index)
    }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');

    try {
      await db.updateSettings(settings);
      setSaveMessage('تم الحفظ');
      
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">إعدادات النظام</h3>
      
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* المرورُ على مفاتيح القوائم بترتيبها المسجَّل، لا على `Object.entries`:
            ترتيبُ العرض ثابتٌ لا يتبع ترتيبَ ما يردّه الخادم، وقائمةٌ لم يردّها
            تظهر فارغةً تُملأ بدل أن تغيب عن الشاشة. */}
        {(Object.keys(EMPTY_LISTS) as ListCategory[]).map((category) => {
          const items = settings[category] ?? [];
          return (
          <div key={category} className="bg-muted rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-foreground">{getCategoryLabel(category)}</h4>
              <Button onClick={() => setEditingCategory(category)} className="text-primary hover:text-primary-strong" title="إضافة عنصر جديد" variant="ghost" size="icon-sm">
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex justify-between items-center bg-card rounded p-3">
                  <span className="text-sm text-foreground">{getItemLabel(category, item)}</span>
                  <Button onClick={() => removeItem(category, index)} className="text-destructive hover:text-destructive-strong" title="حذف" variant="ghost" size="icon-sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              {editingCategory === category && (
                <div className="bg-card rounded p-3 border-2 border-primary/30">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="اسم العنصر الجديد" className="flex-1 text-sm"
                      onKeyPress={(e) => e.key === 'Enter' && addItem(category)}
                      autoFocus
                    />
                    <Button onClick={() => addItem(category)} size="sm">
                      إضافة
                    </Button>
                    <Button onClick={() => { setEditingCategory(null); setNewItem(''); }} variant="secondary" size="sm">
                      إلغاء
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      <div className="bg-primary-soft rounded-lg p-4">
        <h4 className="font-medium text-primary-strong mb-2">ملاحظة مهمة</h4>
        <p className="text-sm text-primary-strong">
          تغيير هذه الإعدادات سيؤثر على جميع البيانات الموجودة في النظام. تأكد من صحة التغييرات قبل الحفظ.
        </p>
      </div>
      
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-card"></div>
              جارٍ الحفظ
            </>
          ) : (
            'حفظ الإعدادات'
          )}
        </Button>
      </div>
    </div>
  );
}