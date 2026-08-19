import { useState, useEffect } from 'react';
import { ChartColumn, FileText, LayoutDashboard, Settings, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import { pictureUrl } from '../../data/api';
import { ThemeToggle } from '@/registry/naf/ui/theme-toggle';
import { NafLogo } from '@/registry/naf/brand/naf-logo';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, permission: null },
  { id: 'clients', label: 'العملاء', icon: Users, permission: 'clients.read' },
  { id: 'prospects', label: 'العملاء المحتملين', icon: UserPlus, permission: 'prospects.read' },
  { id: 'cases', label: 'القضايا', icon: FileText, permission: 'cases.read' },
  { id: 'marketers', label: 'المسوّقين', icon: Users, permission: null },
  { id: 'analytics', label: 'التحليلات', icon: ChartColumn, permission: 'analytics.read' },
  { id: 'reports', label: 'التقارير المخصصة', icon: ChartColumn, permission: 'analytics.read' },
  { id: 'settings', label: 'الإعدادات', icon: Settings, permission: 'settings.read' },
];

export default function Sidebar({ currentView, onViewChange, isOpen, onClose }: SidebarProps) {
  const { hasPermission } = useAuth();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    // تحديث الإعدادات عند تغييرها
    const loadSettings = async () => {
      try {
        const currentSettings = await db.getSettings();
        setSettings(currentSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
  }, []);

  const canAccessMenuItem = (item: typeof menuItems[0]) => {
    if (!item.permission) return true;
    
    const [resource, action] = item.permission.split('.');
    return hasPermission(resource, action);
  };

  return (
    <div className={`bg-sidebar text-sidebar-foreground w-64 min-h-screen fixed inset-y-0 start-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
      /* الإزاحة للدُّرج على الجوّال وحده — ‎max-lg:‎ إلزاميّ لا تجميل:
         بدونه يتغلّب متغيّرا ‎rtl:‎ و‎ltr:‎ على ‎lg:translate-x-0‎ في ترتيب
         الإخراج، فيُزاح الشريط خارج الشاشة على الحاسوب أيضاً.
         و‎translate‎ لا مقابل منطقيّ له في Tailwind، فيُصرَّح للاتجاهين:
         موجبه يخرج يميناً — صحيح في RTL وخطأ في LTR. */
      isOpen
        ? 'translate-x-0'
        : 'max-lg:rtl:translate-x-full max-lg:ltr:-translate-x-full'
    }`}>
      <div className="p-4 sm:p-6">
        {/* Close button for mobile */}
        <div className="flex justify-between items-center mb-6 lg:hidden">
          <div className="flex items-center gap-3">
            {settings?.companyLogo ? (
              <img 
                src={pictureUrl(settings.companyLogo)} 
                alt="شعار الشركة" 
                className="h-6 w-6 object-contain"
              />
            ) : (
              <NafLogo variant="mark" className="h-6" />
            )}
            <span className="text-lg font-bold">{settings?.companyName || 'شركة ناف'}</span>
          </div>
          <button
            onClick={onClose}
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground p-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Logo section for desktop */}
        <div className="flex items-center gap-3 mb-8">
          {settings?.companyLogo ? (
            <img 
              src={pictureUrl(settings.companyLogo)} 
              alt="شعار الشركة" 
              className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
            />
          ) : (
            <NafLogo variant="mark" className="h-6 sm:h-8" />
          )}
          <div className="hidden lg:block">
            <h1 className="text-lg sm:text-xl font-bold">{settings?.companyName || 'شركة ناف'}</h1>
            <p className="text-xs sm:text-sm text-sidebar-foreground/70">{settings?.companyDescription || 'نظام إدارة العملاء'}</p>
          </div>
        </div>
        
        <nav className="space-y-2">
          {menuItems.map((item) => {
            if (!canAccessMenuItem(item)) return null;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-start transition-colors ${
                  currentView === item.id 
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-sm sm:text-base">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* المظهر في الشريط الجانبي لا في الترويسة: الشريط يظهر في المقاسين
            — ثابتاً على الحاسوب ودُرجاً على الجوّال — فيبقى المُبدِّل في
            متناول القارئ في الحالتين، ونسخةٌ واحدة لا نسختان تفترقان.

            وهو مجموعةُ أزرارٍ ظاهرة لا قائمةٌ مطويّة، لأن «يتبع النظام»
            المدفونةَ في قائمة خيارٌ منسيّ — وهي الافتراض. */}
        <div className="mt-8 border-t border-sidebar-border pt-4">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}