import React from 'react';
import { Scale, Users, FileText, BarChart as ChartBar, Sparkles, Mail, Briefcase, ShieldCheck } from 'lucide-react';

interface LandingPageProps {
  onShowLogin: () => void;
}

export default function LandingPage({ onShowLogin }: LandingPageProps) {
  const features = [
    {
      icon: Users,
      title: 'إدارة العملاء',
      description: 'نظام شامل لإدارة بيانات العملاء الحاليين والمحتملين مع تتبع تفاعلاتهم وتاريخهم القانوني'
    },
    {
      icon: FileText,
      title: 'إدارة القضايا',
      description: 'تتبع مفصل للقضايا القانونية وحالاتها ومواعيدها مع ربطها بأدوات إدارة المشاريع'
    },
    {
      icon: ChartBar,
      title: 'تحليلات متقدمة',
      description: 'لوحات تحكم تفاعلية وتقارير مخصصة لتحليل أداء المكتب واتخاذ قرارات مستنيرة'
    },
    {
      icon: Sparkles,
      title: 'مساعد ذكي',
      description: 'مساعد قانوني مدعوم بالذكاء الاصطناعي لتقديم استشارات عامة وتحليلات ذكية'
    },
    {
      icon: Briefcase,
      title: 'إدارة المسوّقين',
      description: 'تتبع أداء المسوّقين وحساب العمولات وإدارة المدفوعات بكفاءة عالية'
    },
    {
      icon: Mail,
      title: 'نظام المراسلات',
      description: 'إدارة رسائل البريد الإلكتروني وجدولة الاجتماعات مع العملاء داخل النظام'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Scale className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">NAF Law</h1>
                <p className="text-sm text-slate-600 hidden sm:block">نظام إدارة المكتب القانوني</p>
              </div>
            </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-slate-600 hover:text-slate-800 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              اعرف المزيد عن الميزات
            </button>
            <button
              onClick={onShowLogin}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              تسجيل الدخول
            </button>
          </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm">
                <Scale className="h-16 w-16 text-white" />
              </div>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              نظام NAF Law
            </h2>
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-4xl mx-auto leading-relaxed">
              حلول متكاملة لإدارة المكاتب القانونية بكفاءة واحترافية عالية
            </p>
            <p className="text-lg md:text-xl text-blue-200 mb-10 max-w-3xl mx-auto">
              إدارة العملاء والقضايا والتحليلات مع مساعد ذكي مدعوم بالذكاء الاصطناعي
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onShowLogin}
                className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-lg font-semibold text-lg shadow-lg transition-all transform hover:scale-105 hover:shadow-xl"
              >
                ابدأ الآن
              </button>
              <button 
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="border-2 border-white text-white hover:bg-white hover:text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105"
              >
                تعرف على المزيد
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              مميزات نظام NAF Law
            </h3>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
              نظام شامل ومتطور لإدارة جميع جوانب المكتب القانوني بكفاءة عالية
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 group"
              >
                <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <h4 className="text-xl font-semibold text-slate-900 mb-3">{feature.title}</h4>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">أرقام تتحدث عن نفسها</h3>
            <p className="text-slate-300 text-lg">نظام موثوق ومجرب في إدارة المكاتب القانونية</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">100%</div>
              <div className="text-slate-300">أمان البيانات</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">24/7</div>
              <div className="text-slate-300">متاح دائماً</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-400 mb-2">AI</div>
              <div className="text-slate-300">ذكاء اصطناعي</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-amber-400 mb-2">∞</div>
              <div className="text-slate-300">إمكانيات لا محدودة</div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl md:text-4xl font-bold mb-6">
            جاهز لتطوير مكتبك القانوني؟
          </h3>
          <p className="text-lg md:text-xl text-blue-100 mb-8 leading-relaxed">
            انضم إلى NAF Law اليوم واستفد من قوة الذكاء الاصطناعي والأدوات المتكاملة لإدارة مكتبك بكفاءة استثنائية
          </p>
          <button
            onClick={onShowLogin}
            className="bg-white text-blue-600 hover:bg-blue-50 px-10 py-4 rounded-lg font-semibold text-lg shadow-lg transition-all transform hover:scale-105 hover:shadow-xl"
          >
            ابدأ رحلتك الآن
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Scale className="h-8 w-8 text-blue-400" />
                <h4 className="text-xl font-bold">NAF Law</h4>
              </div>
              <p className="text-slate-300 leading-relaxed">
                نظام متطور لإدارة المكاتب القانونية يجمع بين الكفاءة والتقنيات الحديثة
              </p>
            </div>
            
            <div>
              <h5 className="font-semibold mb-4">الميزات الرئيسية</h5>
              <ul className="space-y-2 text-slate-300">
                <li>• إدارة العملاء والقضايا</li>
                <li>• تحليلات وتقارير متقدمة</li>
                <li>• مساعد ذكي بالذكاء الاصطناعي</li>
                <li>• نظام أمان متطور</li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-semibold mb-4">تواصل معنا</h5>
              <div className="space-y-2 text-slate-300">
                <p>للدعم الفني والاستفسارات</p>
                <p>support@naflaw.com</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-slate-700 mt-8 pt-8 text-center">
            <p className="text-slate-400">
              © 2024 NAF Law. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}