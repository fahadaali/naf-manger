import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import ClientsView from './components/Clients/ClientsView';
import ProspectsView from './components/Prospects/ProspectsView';
import CasesView from './components/Cases/CasesView';
import Analytics from './components/Analytics/Analytics';
import Settings from './components/Settings/Settings';
import ReportsView from './components/Reports/ReportsView';
import MarketersView from './components/Marketers/MarketersView';
import Denied from './components/Auth/Denied';
import DisplayBoard from './components/Display/DisplayBoard';
import ErrorBoundary from './components/Common/ErrorBoundary';

/* كان هنا `LoginModal` يعرض `LoginPage` فوق `LandingPage`. وسقط الثلاثة
   حين صار البابُ مركزياً: الوسيط يحرس الجذر، فلا يبلغ هذه الحزمةَ متصفّحٌ
   بلا جلسة أصلاً. ولا أثرَ لها في المستودع اليوم. */

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
          <p className="text-muted-foreground">جارٍ التحميل</p>
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

  /* اختيارُ الشاشة وحده. والأخطاء يمسكها `ErrorBoundary` أدناه لا
     `try/catch` هنا: الدالة تبني عنصراً، والتصيير يقع بعدها في React
     فلا تبلغه كتلةٌ من هنا. وكان هنا عشرة `console.log` تُطبع عند كل
     تصيير — سطورٌ لا تُقرأ وتُثقل المتصفّح بلا فائدة. */
  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return <ClientsView />;
      case 'prospects':
        return <ProspectsView />;
      case 'cases':
        return <CasesView />;
      case 'analytics':
        return <Analytics />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <Settings />;
      case 'marketers':
        return <MarketersView />;
      default:
        return <Dashboard />;
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
          {/* الحاجز حول الشاشة وحدها: شاشةٌ تسقط لا تُسقط الشريط والترويسة
              معها، فيُنتقل منها إلى غيرها بلا إعادة تحميل. */}
          <ErrorBoundary resetKey={currentView}>
            {renderCurrentView()}
          </ErrorBoundary>
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

  /* `‎/display/<token>` شاشةُ عرضٍ عامّة: مسارُها يسبق الحارس في الـWorker،
     وحراستُها رمزٌ في العنوان لا جلسة. فلا تمرّ بـ`AuthProvider` — وإلّا
     استدعت `‎/api/me` فرُدّت بـ٤٠١ فحُوِّلت الشاشةُ المعلَّقة إلى المركز
     تطلب دخولاً من لا أحد. */
  if (window.location.pathname.startsWith('/display/')) {
    const token = window.location.pathname.slice('/display/'.length);
    if (token) return <DisplayBoard token={token} />;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;