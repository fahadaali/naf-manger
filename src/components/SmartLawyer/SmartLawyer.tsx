import React from 'react';
import { 
  ScaleIcon, 
  DocumentTextIcon, 
  MagnifyingGlassIcon, 
  ShieldCheckIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

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
      icon: ChatBubbleLeftRightIcon,
      prompt: 'أحتاج إلى استشارة قانونية عامة حول موضوع معين'
    },
    {
      title: 'صياغة عقود',
      description: 'مساعدة في صياغة العقود والاتفاقيات',
      icon: DocumentTextIcon,
      prompt: 'أحتاج مساعدة في صياغة عقد أو اتفاقية'
    },
    {
      title: 'تحليل قضايا',
      description: 'تحليل القضايا القانونية المعقدة',
      icon: ScaleIcon,
      prompt: 'أحتاج تحليل قانوني لقضية معينة'
    },
    {
      title: 'بحث قانوني',
      description: 'البحث في القوانين والأنظمة',
      icon: MagnifyingGlassIcon,
      prompt: 'أحتاج بحث في القوانين والأنظمة المتعلقة بموضوع معين'
    }
  ];

  const features = [
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'استشارات فورية',
      description: 'احصل على إجابات قانونية سريعة ودقيقة'
    },
    {
      icon: DocumentTextIcon,
      title: 'صياغة الوثائق',
      description: 'مساعدة في صياغة العقود والمستندات القانونية'
    },
    {
      icon: MagnifyingGlassIcon,
      title: 'البحث القانوني',
      description: 'البحث في القوانين والسوابق القضائية'
    },
    {
      icon: ScaleIcon,
      title: 'تحليل القضايا',
      description: 'تحليل معمق للقضايا والمسائل القانونية'
    },
    {
      icon: ShieldCheckIcon,
      title: 'فحص الامتثال',
      description: 'التأكد من الامتثال للقوانين واللوائح'
    },
    {
      icon: GlobeAltIcon,
      title: 'القوانين الدولية',
      description: 'معرفة بالقوانين المحلية والدولية'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm">
                <ScaleIcon className="h-16 w-16 text-white" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              المحامي الذكي
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100 max-w-3xl mx-auto">
              مساعدك القانوني الذكي المدعوم بالذكاء الاصطناعي للحصول على استشارات قانونية دقيقة وسريعة
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => handleOpenLawyerAI()}
                className="inline-flex items-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <ChatBubbleLeftRightIcon className="h-6 w-6 ml-2" />
                بدء محادثة مع المحامي الذكي
                <ArrowTopRightOnSquareIcon className="h-5 w-5 mr-2" />
              </button>
              <button
                onClick={handleCopyLink}
                className="inline-flex items-center px-8 py-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <ClipboardDocumentIcon className="h-6 w-6 ml-2" />
                نسخ الرابط
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">الإجراءات السريعة</h2>
          <p className="text-lg text-gray-600">ابدأ بأحد هذه الخيارات للحصول على المساعدة المناسبة</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => (
            <div
              key={index}
              onClick={() => handleOpenLawyerAI(action.prompt)}
              className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer border border-gray-100 hover:border-blue-200 transform hover:-translate-y-2"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
                <action.icon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.title}</h3>
              <p className="text-gray-600 text-sm">{action.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">ميزات المحامي الذكي</h2>
            <p className="text-lg text-gray-600">تقنيات متقدمة لخدمة قانونية شاملة</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg mb-4">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How to Use */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">كيفية الاستخدام</h2>
          <p className="text-lg text-gray-600">خطوات بسيطة للحصول على المساعدة القانونية</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">1</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">اختر نوع الاستشارة</h3>
            <p className="text-gray-600">حدد نوع المساعدة القانونية التي تحتاجها من الخيارات المتاحة</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">2</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">اطرح سؤالك</h3>
            <p className="text-gray-600">اكتب سؤالك أو وصف حالتك بوضوح للحصول على إجابة دقيقة</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">3</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">احصل على الإجابة</h3>
            <p className="text-gray-600">ستحصل على استشارة قانونية مفصلة ومبنية على أحدث القوانين</p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mx-4 sm:mx-6 lg:mx-8 mb-8 rounded-r-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <ShieldCheckIcon className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="mr-3">
            <h3 className="text-sm font-medium text-yellow-800">تنبيه مهم</h3>
            <div className="mt-2 text-sm text-yellow-700">
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