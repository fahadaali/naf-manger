import React from 'react';
import { Copy, ExternalLink, FileText, Globe, MessageSquare, ScanText, Search, ShieldCheck } from 'lucide-react';
import { NafLogo } from '@/registry/naf/brand/naf-logo';

const SmartLawyer: React.FC = () => {
  const lawyerAIUrl = 'https://chatgpt.com/g/g-CnmXGoaZE-lawyerai';

  const handleOpenLawyerAI = (prompt?: string) => {
    try {
      const url = prompt ? `${lawyerAIUrl}?prompt=${encodeURIComponent(prompt)}` : lawyerAIUrl;
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
      
      if (!newWindow) {
        // Fallback if popup is blocked
        alert(`تم منع النافذة المنبثقة. يرجى فتح الرابط التالي يدوياً:\n${url}`);
        navigator.clipboard.writeText(url).catch(() => {});
      }
    } catch (error) {
      console.error('Error opening LawyerAI:', error);
      alert('حدث خطأ في فتح المحامي الذكي. يرجى المحاولة مرة أخرى.');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(lawyerAIUrl)
      .then(() => {
        alert('تم نسخ الرابط إلى الحافظة!');
      })
      .catch(() => {
        alert('فشل في نسخ الرابط. يرجى نسخه يدوياً.');
      });
  };

  const quickActions = [
    {
      title: 'استشارة عامة',
      description: 'احصل على استشارة قانونية عامة',
      icon: MessageSquare,
      prompt: 'أحتاج إلى استشارة قانونية عامة حول موضوع معين'
    },
    {
      title: 'صياغة عقود',
      description: 'مساعدة في صياغة العقود والاتفاقيات',
      icon: FileText,
      prompt: 'أحتاج مساعدة في صياغة عقد أو اتفاقية'
    },
    {
      title: 'تحليل قضايا',
      description: 'تحليل القضايا القانونية المعقدة',
      icon: ScanText,
      prompt: 'أحتاج تحليل قانوني لقضية معينة'
    },
    {
      title: 'بحث قانوني',
      description: 'البحث في القوانين والأنظمة',
      icon: Search,
      prompt: 'أحتاج بحث في القوانين والأنظمة المتعلقة بموضوع معين'
    }
  ];

  const features = [
    {
      icon: MessageSquare,
      title: 'استشارات فورية',
      description: 'احصل على إجابات قانونية سريعة ودقيقة'
    },
    {
      icon: FileText,
      title: 'صياغة الوثائق',
      description: 'مساعدة في صياغة العقود والمستندات القانونية'
    },
    {
      icon: Search,
      title: 'البحث القانوني',
      description: 'البحث في القوانين والسوابق القضائية'
    },
    {
      icon: ScanText,
      title: 'تحليل القضايا',
      description: 'تحليل معمق للقضايا والمسائل القانونية'
    },
    {
      icon: ShieldCheck,
      title: 'فحص الامتثال',
      description: 'التأكد من الامتثال للقوانين واللوائح'
    },
    {
      icon: Globe,
      title: 'القوانين الدولية',
      description: 'معرفة بالقوانين المحلية والدولية'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-surface-deep text-surface-deep-foreground">
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="dark p-4 bg-surface-deep-foreground/20 rounded-full backdrop-blur-sm">
                <NafLogo variant="mark" className="h-16" />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              المحامي الذكي
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-surface-deep-muted max-w-3xl mx-auto">
              مساعدك القانوني الذكي المدعوم بالذكاء الاصطناعي للحصول على استشارات قانونية دقيقة وسريعة
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => handleOpenLawyerAI()}
                className="inline-flex items-center px-8 py-4 bg-card text-primary font-semibold rounded-lg hover:bg-primary-soft transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <MessageSquare className="h-6 w-6 me-2" />
                بدء محادثة مع المحامي الذكي
                <ExternalLink className="h-5 w-5 ms-2" />
              </button>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Copy className="h-6 w-6 me-2" />
                نسخ الرابط
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">الإجراءات السريعة</h2>
          <p className="text-lg text-muted-foreground">ابدأ بأحد هذه الخيارات للحصول على المساعدة المناسبة</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => (
            <div
              key={index}
              onClick={() => handleOpenLawyerAI(action.prompt)}
              className="bg-card rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer border border-border hover:border-ring transform hover:-translate-y-2"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-primary-soft rounded-lg mb-4">
                <action.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{action.title}</h3>
              <p className="text-muted-foreground text-sm">{action.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="bg-muted py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">ميزات المحامي الذكي</h2>
            <p className="text-lg text-muted-foreground">تقنيات متقدمة لخدمة قانونية شاملة</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-card rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-center w-12 h-12 bg-primary rounded-lg mb-4">
                  <feature.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How to Use */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">كيفية الاستخدام</h2>
          <p className="text-lg text-muted-foreground">خطوات بسيطة للحصول على المساعدة القانونية</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-primary-soft rounded-full mx-auto mb-4">
              <span className="text-2xl font-bold text-primary">1</span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">اختر نوع الاستشارة</h3>
            <p className="text-muted-foreground">حدد نوع المساعدة القانونية التي تحتاجها من الخيارات المتاحة</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-primary-soft rounded-full mx-auto mb-4">
              <span className="text-2xl font-bold text-primary">2</span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">اطرح سؤالك</h3>
            <p className="text-muted-foreground">اكتب سؤالك أو وصف حالتك بوضوح للحصول على إجابة دقيقة</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-primary-soft rounded-full mx-auto mb-4">
              <span className="text-2xl font-bold text-primary">3</span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">احصل على الإجابة</h3>
            <p className="text-muted-foreground">ستحصل على استشارة قانونية مفصلة ومبنية على أحدث القوانين</p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-warning-soft border-e-4 border-warning p-6 mx-4 sm:mx-6 lg:mx-8 mb-8 rounded-s-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-warning" />
          </div>
          <div className="ms-3">
            <h3 className="text-sm font-medium text-warning-strong">تنبيه مهم</h3>
            <div className="mt-2 text-sm text-warning">
              <p>
                المحامي الذكي يقدم معلومات قانونية عامة ولا يعتبر بديلاً عن الاستشارة القانونية المهنية. 
                للحصول على مشورة قانونية محددة لحالتك، يُنصح بالتشاور مع محامٍ مؤهل.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartLawyer;