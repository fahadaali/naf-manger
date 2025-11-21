import React, { useState } from 'react';
import { 
  ComputerDesktopIcon, 
  ClipboardDocumentIcon, 
  CheckCircleIcon,
  LinkIcon,
  EyeIcon,
  CogIcon
} from '@heroicons/react/24/outline';

export default function DashboardDisplay() {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyDashboardLink = async () => {
    try {
      const dashboardUrl = `${window.location.origin}${window.location.pathname}`;
      await navigator.clipboard.writeText(dashboardUrl);
      setCopySuccess(true);
      
      // إخفاء رسالة النجاح بعد 3 ثوان
      setTimeout(() => {
        setCopySuccess(false);
      }, 3000);
    } catch (error) {
      console.error('فشل في نسخ الرابط:', error);
      // Fallback للمتصفحات القديمة
      const textArea = document.createElement('textarea');
      textArea.value = `${window.location.origin}${window.location.pathname}`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">عرض لوحة التحكم على الشاشات</h3>
        <p className="text-slate-600 mt-1">إعداد عرض لوحة التحكم على شاشات الشركة الداخلية لمراقبة الأداء</p>
      </div>

      {/* نسخ رابط لوحة التحكم */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-full">
              <ComputerDesktopIcon className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-xl font-bold mb-2">رابط لوحة التحكم</h4>
              <p className="text-blue-100">
                انسخ هذا الرابط لعرض لوحة التحكم على شاشات الشركة ومراقبة الأداء في الوقت الفعلي
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCopyDashboardLink}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                copySuccess 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white text-blue-600 hover:bg-blue-50'
              }`}
            >
              {copySuccess ? (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  تم النسخ بنجاح!
                </>
              ) : (
                <>
                  <ClipboardDocumentIcon className="h-5 w-5" />
                  نسخ الرابط
                </>
              )}
            </button>
            
            <div className="text-center">
              <div className="flex items-center gap-2 text-blue-100 text-sm">
                <LinkIcon className="h-4 w-4" />
                <span className="font-mono bg-black bg-opacity-20 px-2 py-1 rounded text-xs">
                  {window.location.origin}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* تعليمات الاستخدام */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CogIcon className="h-6 w-6 text-slate-600" />
          <h4 className="text-lg font-semibold text-slate-900">كيفية الاستخدام</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-600 font-bold text-lg">1</span>
            </div>
            <h5 className="font-medium text-slate-900 mb-2">انسخ الرابط</h5>
            <p className="text-sm text-slate-600">
              اضغط على زر "نسخ الرابط" أعلاه لنسخ رابط لوحة التحكم إلى الحافظة
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-green-600 font-bold text-lg">2</span>
            </div>
            <h5 className="font-medium text-slate-900 mb-2">افتح في المتصفح</h5>
            <p className="text-sm text-slate-600">
              الصق الرابط في متصفح الشاشة المراد عرض لوحة التحكم عليها
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-purple-600 font-bold text-lg">3</span>
            </div>
            <h5 className="font-medium text-slate-900 mb-2">مراقبة مستمرة</h5>
            <p className="text-sm text-slate-600">
              ستعرض الشاشة إحصائيات المكتب المحدثة في الوقت الفعلي
            </p>
          </div>
        </div>
      </div>

      {/* مميزات العرض */}
      <div className="bg-slate-50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <EyeIcon className="h-6 w-6 text-slate-600" />
          <h4 className="text-lg font-semibold text-slate-900">مميزات العرض على الشاشات</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-slate-700">إحصائيات محدثة في الوقت الفعلي</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-slate-700">رسوم بيانية تفاعلية</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            <span className="text-slate-700">مراقبة أداء الفريق</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <span className="text-slate-700">تتبع تقدم القضايا</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-slate-700">معدلات النجاح والتحويل</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            <span className="text-slate-700">نشاط المستخدمين الحديث</span>
          </div>
        </div>
      </div>

      {/* نصائح مهمة */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-amber-600 text-sm">💡</span>
            </div>
          </div>
          <div>
            <h5 className="font-medium text-amber-900 mb-2">نصائح للاستخدام الأمثل:</h5>
            <ul className="text-sm text-amber-800 space-y-1">
              <li>• استخدم شاشات بدقة عالية للحصول على أفضل تجربة عرض</li>
              <li>• تأكد من اتصال الشاشة بالإنترنت لتحديث البيانات</li>
              <li>• يُنصح بتحديث الصفحة كل 24 ساعة للحصول على أحدث البيانات</li>
              <li>• يمكن عرض لوحة التحكم على عدة شاشات في نفس الوقت</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}