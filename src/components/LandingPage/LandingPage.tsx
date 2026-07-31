import React from 'react';
import { Briefcase, FileText, Mail, Sparkles, TrendingUp, Users } from 'lucide-react';
import { NafLogo } from '@/registry/naf/brand/naf-logo';
import { Button } from '@/registry/naf/ui/button';

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
      icon: TrendingUp,
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
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <NafLogo variant="mark" className="h-8" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">NAF Law</h1>
                <p className="text-sm text-muted-foreground hidden sm:block">نظام إدارة المكتب القانوني</p>
              </div>
            </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => { document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }} variant="ghost">
              استعراض الميزات
            </Button>
            <Button onClick={onShowLogin} className="shadow-md hover:shadow-lg">
              تسجيل الدخول
            </Button>
          </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-surface-deep text-surface-deep-foreground">
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="dark p-4 bg-surface-deep-foreground/20 rounded-full backdrop-blur-sm">
                <NafLogo variant="mark" className="h-16" />
              </div>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
              نظام NAF Law
            </h2>
            <p className="text-xl md:text-2xl text-surface-deep-muted mb-8 max-w-4xl mx-auto leading-relaxed">
              حلول متكاملة لإدارة المكاتب القانونية بكفاءة واحترافية عالية
            </p>
            <p className="text-lg md:text-xl text-surface-deep-muted mb-10 max-w-3xl mx-auto">
              إدارة العملاء والقضايا والتحليلات مع مساعد ذكي مدعوم بالذكاء الاصطناعي
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={onShowLogin} className="text-primary shadow-lg hover:shadow-xl" variant="outline" size="lg">
                دخول
              </Button>
              <Button onClick={() => { document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }} className="border-2 border-surface-deep-foreground bg-transparent text-surface-deep-foreground hover:bg-card hover:text-foreground" variant="outline" size="lg">
                استعراض الميزات
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              مميزات نظام NAF Law
            </h3>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              نظام شامل ومتطور لإدارة جميع جوانب المكتب القانوني بكفاءة عالية
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="bg-card rounded-xl shadow-lg p-8 border border-border hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 group"
              >
                <div className="flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-8 w-8 text-primary-foreground" />
                </div>
                <h4 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h4>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-surface-deep text-surface-deep-foreground">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">أرقام تتحدث عن نفسها</h3>
            <p className="text-surface-deep-muted text-lg">نظام موثوق ومجرب في إدارة المكاتب القانونية</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-surface-deep-foreground mb-2"><bdi>100%</bdi></div>
              <div className="text-surface-deep-muted">أمان البيانات</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-surface-deep-foreground mb-2"><bdi>24/7</bdi></div>
              <div className="text-surface-deep-muted">متاح دائماً</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-surface-deep-foreground mb-2">AI</div>
              <div className="text-surface-deep-muted">ذكاء اصطناعي</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-surface-deep-foreground mb-2">∞</div>
              <div className="text-surface-deep-muted">إمكانيات لا محدودة</div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-surface-deep text-surface-deep-foreground text-center">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl md:text-4xl font-bold mb-6">
            جاهز لتطوير مكتبك القانوني؟
          </h3>
          <p className="text-lg md:text-xl text-surface-deep-muted mb-8 leading-relaxed">
            انضم إلى NAF Law اليوم واستفد من قوة الذكاء الاصطناعي والأدوات المتكاملة لإدارة مكتبك بكفاءة استثنائية
          </p>
          <Button onClick={onShowLogin} className="text-primary shadow-lg hover:shadow-xl" variant="outline" size="lg">
            دخول
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface-deep text-surface-deep-foreground py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="dark inline-flex"><NafLogo variant="mark" className="h-8" /></span>
                <h4 className="text-xl font-bold">NAF Law</h4>
              </div>
              <p className="text-surface-deep-muted leading-relaxed">
                نظام متطور لإدارة المكاتب القانونية يجمع بين الكفاءة والتقنيات الحديثة
              </p>
            </div>
            
            <div>
              <h5 className="font-semibold mb-4">الميزات الرئيسية</h5>
              <ul className="space-y-2 text-surface-deep-muted">
                <li>• إدارة العملاء والقضايا</li>
                <li>• تحليلات وتقارير متقدمة</li>
                <li>• مساعد ذكي بالذكاء الاصطناعي</li>
                <li>• نظام أمان متطور</li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-semibold mb-4">تواصل معنا</h5>
              <div className="space-y-2 text-surface-deep-muted">
                <p>للدعم الفني والاستفسارات</p>
                <p>support@naflaw.com</p>
              </div>
            </div>
          </div>
          
          <div className="border-t border-surface-deep-muted/20 mt-8 pt-8 text-center">
            <p className="text-muted-foreground">
              © 2024 NAF Law. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}