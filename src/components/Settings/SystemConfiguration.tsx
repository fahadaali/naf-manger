import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '../../data/database';
import { SystemSettings } from '../../types';

export default function SystemConfiguration() {
  const [settings, setSettings] = useState<SystemSettings>({
    clientTypes: [],
    clientStatuses: [],
    prospectStatuses: [],
    prospectSources: [],
    caseTypes: [],
    caseStatuses: []
  });
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
        case 'suspended': return 'موقوف';
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

  const addItem = (category: string) => {
    if (!newItem.trim()) return;
    
    const updatedSettings = {
      ...settings,
      [category]: [...settings[category as keyof SystemSettings], newItem.trim()]
    };
    
    setSettings(updatedSettings);
    setNewItem('');
    setEditingCategory(null);
  };

  const removeItem = (category: string, index: number) => {
    const updatedSettings = {
      ...settings,
      [category]: settings[category as keyof SystemSettings].filter((_, i) => i !== index)
    };
    
    setSettings(updatedSettings);
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
      
      {saveMessage && (
        <div className={`p-3 rounded-lg ${
          saveMessage.includes('نجاح') ? 'bg-success-soft text-success-strong' : 'bg-destructive-soft text-destructive-strong'
        }`}>
          {saveMessage}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(settings)
          .filter(([category, items]) => Array.isArray(items))
          .map(([category, items]) => (
          <div key={category} className="bg-muted rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-foreground">{getCategoryLabel(category)}</h4>
              <button
                onClick={() => setEditingCategory(category)}
                className="text-primary hover:text-primary-strong p-1"
                title="إضافة عنصر جديد"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex justify-between items-center bg-card rounded p-3">
                  <span className="text-sm text-foreground">{getItemLabel(category, item)}</span>
                  <button
                    onClick={() => removeItem(category, index)}
                    className="text-destructive hover:text-destructive-strong p-1"
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {editingCategory === category && (
                <div className="bg-card rounded p-3 border-2 border-primary/30">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="اسم العنصر الجديد"
                      className="flex-1 px-3 py-2 border border-border rounded text-sm focus-visible:ring-2 focus-visible:ring-ring"
                      onKeyPress={(e) => e.key === 'Enter' && addItem(category)}
                      autoFocus
                    />
                    <button
                      onClick={() => addItem(category)}
                      className="bg-primary text-primary-foreground px-3 py-2 rounded text-sm hover:bg-primary/90"
                    >
                      إضافة
                    </button>
                    <button
                      onClick={() => {
                        setEditingCategory(null);
                        setNewItem('');
                      }}
                      className="bg-muted text-foreground px-3 py-2 rounded text-sm hover:bg-muted-foreground"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-primary-soft rounded-lg p-4">
        <h4 className="font-medium text-primary-strong mb-2">ملاحظة مهمة</h4>
        <p className="text-sm text-primary-strong">
          تغيير هذه الإعدادات سيؤثر على جميع البيانات الموجودة في النظام. تأكد من صحة التغييرات قبل الحفظ.
        </p>
      </div>
      
      <div className="flex justify-end">
        <button 
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-6 py-2 rounded-lg flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-card"></div>
              جارٍ الحفظ...
            </>
          ) : (
            'حفظ الإعدادات'
          )}
        </button>
      </div>
    </div>
  );
}