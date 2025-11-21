import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
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
      setSaveMessage('تم حفظ الإعدادات بنجاح');
      
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
      <h3 className="text-lg font-semibold text-slate-900">إعدادات النظام</h3>
      
      {saveMessage && (
        <div className={`p-3 rounded-lg ${
          saveMessage.includes('نجاح') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {saveMessage}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(settings)
          .filter(([category, items]) => Array.isArray(items))
          .map(([category, items]) => (
          <div key={category} className="bg-slate-50 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-slate-900">{getCategoryLabel(category)}</h4>
              <button
                onClick={() => setEditingCategory(category)}
                className="text-blue-600 hover:text-blue-800 p-1"
                title="إضافة عنصر جديد"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex justify-between items-center bg-white rounded p-3">
                  <span className="text-sm text-slate-900">{getItemLabel(category, item)}</span>
                  <button
                    onClick={() => removeItem(category, index)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="حذف"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              
              {editingCategory === category && (
                <div className="bg-white rounded p-3 border-2 border-blue-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="اسم العنصر الجديد"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && addItem(category)}
                      autoFocus
                    />
                    <button
                      onClick={() => addItem(category)}
                      className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
                    >
                      إضافة
                    </button>
                    <button
                      onClick={() => {
                        setEditingCategory(null);
                        setNewItem('');
                      }}
                      className="bg-slate-300 text-slate-700 px-3 py-2 rounded text-sm hover:bg-slate-400"
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
      
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">ملاحظة مهمة</h4>
        <p className="text-sm text-blue-800">
          تغيير هذه الإعدادات سيؤثر على جميع البيانات الموجودة في النظام. تأكد من صحة التغييرات قبل الحفظ.
        </p>
      </div>
      
      <div className="flex justify-end">
        <button 
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              جاري الحفظ...
            </>
          ) : (
            'حفظ الإعدادات'
          )}
        </button>
      </div>
    </div>
  );
}