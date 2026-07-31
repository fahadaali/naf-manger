import React, { useState } from 'react';
import { CircleCheck, Copy, Eye, Lightbulb, Link2, Settings, Tv } from 'lucide-react';

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
        <h3 className="text-lg font-semibold text-foreground">عرض لوحة التحكم على الشاشات</h3>
        <p className="text-muted-foreground mt-1">إعداد عرض لوحة التحكم على شاشات الشركة الداخلية لمراقبة الأداء</p>
      </div>

      {/* نسخ رابط لوحة التحكم */}
      <div className="bg-surface-deep text-surface-deep-foreground rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-card bg-opacity-20 rounded-full">
              <Tv className="h-8 w-8" />
            </div>
            <div>
              <h4 className="text-xl font-bold mb-2">رابط لوحة التحكم</h4>
              <p className="text-surface-deep-muted">
                انسخ هذا الرابط لعرض لوحة التحكم على شاشات الشركة ومراقبة الأداء في الوقت الفعلي
              </p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCopyDashboardLink}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                copySuccess 
                  ? 'bg-success text-success-foreground' 
                  : 'bg-card text-primary-strong hover:bg-primary-soft'
              }`}
            >
              {copySuccess ? (
                <>
                  <CircleCheck className="h-5 w-5" />
                  تم النسخ
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  نسخ الرابط
                </>
              )}
            </button>
            
            <div className="text-center">
              <div className="flex items-center gap-2 text-surface-deep-muted text-sm">
                <Link2 className="h-4 w-4" />
                <bdi className="bg-surface-deep-foreground/10 px-2 py-1 rounded text-xs">
                  {window.location.origin}
                </bdi>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* تعليمات الاستخدام */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <h4 className="text-lg font-semibold text-foreground">كيفية الاستخدام</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-soft rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-primary-strong font-bold text-lg">1</span>
            </div>
            <h5 className="font-medium text-foreground mb-2">نسخ الرابط</h5>
            <p className="text-sm text-muted-foreground">
              اضغط على زر "نسخ الرابط" أعلاه لنسخ رابط لوحة التحكم إلى الحافظة
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-soft rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-primary-strong font-bold text-lg">2</span>
            </div>
            <h5 className="font-medium text-foreground mb-2">افتح في المتصفح</h5>
            <p className="text-sm text-muted-foreground">
              الصق الرابط في متصفح الشاشة المراد عرض لوحة التحكم عليها
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-primary-soft rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-primary-strong font-bold text-lg">3</span>
            </div>
            <h5 className="font-medium text-foreground mb-2">مراقبة مستمرة</h5>
            <p className="text-sm text-muted-foreground">
              ستعرض الشاشة إحصائيات المكتب المحدثة في الوقت الفعلي
            </p>
          </div>
        </div>
      </div>

      {/* مميزات العرض */}
      <div className="bg-muted rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-6 w-6 text-muted-foreground" />
          <h4 className="text-lg font-semibold text-foreground">مميزات العرض على الشاشات</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            <span className="text-foreground">إحصائيات محدثة في الوقت الفعلي</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            <span className="text-foreground">رسوم بيانية تفاعلية</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            <span className="text-foreground">مراقبة أداء الفريق</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            <span className="text-foreground">تتبع تقدم القضايا</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            <span className="text-foreground">معدلات النجاح والتحويل</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
            <span className="text-foreground">نشاط المستخدمين الحديث</span>
          </div>
        </div>
      </div>

      {/* نصائح مهمة */}
      <div className="bg-warning-soft border border-warning/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-warning-soft rounded-full flex items-center justify-center">
              <Lightbulb className="size-4 text-warning-strong" aria-hidden="true" />
            </div>
          </div>
          <div>
            <h5 className="font-medium text-warning-strong mb-2">نصائح للاستخدام الأمثل:</h5>
            <ul className="list-disc ps-5 text-sm text-warning-strong space-y-1">
              <li>استخدم شاشات بدقة عالية للحصول على أفضل تجربة عرض</li>
              <li>تأكد من اتصال الشاشة بالإنترنت لتحديث البيانات</li>
              <li>يُنصح بتحديث الصفحة كل 24 ساعة للحصول على أحدث البيانات</li>
              <li>يمكن عرض لوحة التحكم على عدة شاشات في نفس الوقت</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}