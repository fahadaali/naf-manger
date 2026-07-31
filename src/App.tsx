import React, { useState, useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import ClientsView from './components/Clients/ClientsView';
import ProspectsView from './components/Prospects/ProspectsView';
import CasesView from './components/Cases/CasesView';
import Analytics from './components/Analytics/Analytics';
import AIAssistant from './components/AIAssistant/AIAssistant';
import Settings from './components/Settings/Settings';
import ReportsView from './components/Reports/ReportsView';
import SmartLawyer from './components/SmartLawyer/SmartLawyer';
import MarketersView from './components/Marketers/MarketersView';
import Denied from './components/Auth/Denied';
import { Button } from '@/registry/naf/ui/button';

/* `LoginModal` كان هنا، ويعرض `LoginPage` فوق `LandingPage`. وقد سقط الاثنان
   من المسار حين صار الباب مركزياً: الوسيط يحرس الجذر، فلا يبلغ هذه الحزمةَ
   متصفّحٌ بلا جلسة أصلاً. والملفّان باقيان في المستودع كما هما. */

function AppContent() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, loading } = useAuth();

  /* ═══ ما كان هنا ═══
   *
   * كان هذا التأثير يقرأ ثلاثة ألوان من قاعدة البيانات ويحقنها على عنصر
   * الجذر عند كل إقلاع — ‎--color-primary‎ و‎--color-secondary‎
   * و‎--color-accent‎. وهو الذراع التشغيليّ للثيم الموازي: لوحةٌ تعيش في
   * صفٍّ في قاعدة بيانات، تختلف بين نسخةٍ وأخرى، ولا يعرفها السجلّ.
   *
   * اللوحة الآن من ‎naf-theme.css‎ وحده، تصل مع الحزمة قبل أوّل رسم ولا
   * تنتظر شبكةً ولا استعلاماً. ولا شيء يُحقن على الجذر إلا صنف ‎.dark‎
   * من مُبدِّل المظهر.
   */

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  /* غير المصادَق لا يبلغ هنا في السويّ: الوسيط يحوّله إلى المركز قبل أن
     تصل هذه الحزمة إلى متصفّحه. وبلوغُه يعني تعذّر `‎/api/me` — فيُعرض
     نصٌّ مسجَّل ولا تُعرض شاشة دخول محلية: الباب هو المركز.

     وصفحتا `LandingPage` و`LoginPage` باقيتان في المستودع ولا يقود إليهما
     مسار. حذفُهما قرارٌ مستقل عن ربط الدخول، فلا يُخلط به. */
  if (!isAuthenticated) {
    return (
      <div dir="rtl" className="min-h-screen bg-muted flex items-center justify-center p-4">
        <p className="text-foreground">حدث خطأ في النظام. أعد المحاولة بعد قليل</p>
      </div>
    );
  }

  const closeSidebar = () => setSidebarOpen(false);

  const renderCurrentView = () => {
    console.log('Rendering view:', currentView);
    console.log('User authenticated:', isAuthenticated);
    console.log('Loading state:', loading);
    
    try {
    switch (currentView) {
      case 'dashboard':
          console.log('Rendering Dashboard component');
        return <Dashboard />;
      case 'clients':
          console.log('Rendering ClientsView component');
        return <ClientsView />;
      case 'prospects':
          console.log('Rendering ProspectsView component');
        return <ProspectsView />;
      case 'cases':
          console.log('Rendering CasesView component');
        return <CasesView />;
      case 'analytics':
          console.log('Rendering Analytics component');
        return <Analytics />;
      case 'reports':
          console.log('Rendering ReportsView component');
        return <ReportsView />;
      case 'settings':
          console.log('Rendering Settings component');
        return <Settings />;
      case 'smart-lawyer':
          console.log('Rendering SmartLawyer component');
        return <SmartLawyer />;
      case 'marketers':
          console.log('Rendering MarketersView component');
        return <MarketersView />;
      default:
          console.log('Rendering default Dashboard component');
        return <Dashboard />;
    }
    } catch (error) {
      console.error('Error rendering view:', error);
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-destructive mb-4">
              <TriangleAlert className="w-16 h-16 mx-auto" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">حدث خطأ في عرض الصفحة</h2>
            <p className="text-muted-foreground mb-4">يرجى فحص وحدة التحكم للحصول على تفاصيل الخطأ</p>
            <Button onClick={() => window.location.reload()}>
              إعادة تحميل الصفحة
            </Button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-muted flex relative" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-overlay z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}
      
      <Sidebar 
        currentView={currentView} 
        onViewChange={(view) => {
          setCurrentView(view);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />
      
      <div className="flex-1 flex flex-col">
        <Header 
          currentView={currentView} 
          onMenuClick={() => setSidebarOpen(true)}
        />
        
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
}

function App() {
  /* `‎/denied` مسارٌ عام: يبلغه من لا جلسةَ له ومن مُنع، فلا يمرّ بـ
     `AuthProvider` — وإلّا استدعى `‎/api/me` فرُدّ بـ٤٠١ ومعه عنوان الباب،
     فيُحوَّل الممنوعُ إلى المركز الذي ردّه توّاً، ويعود منه ممنوعاً. لفّةٌ
     لا تنتهي، وصاحبُها لا يقرأ سببه أبداً.

     والمطابقة بالمساواة التامة لا بالبادئة: `‎/denied-something` مسارٌ آخر. */
  if (window.location.pathname === '/denied') {
    return <Denied />;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;