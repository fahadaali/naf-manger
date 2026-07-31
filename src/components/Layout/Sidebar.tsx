import React, { useState, useEffect } from 'react';
import { 
  HomeIcon, 
  UserGroupIcon, 
  DocumentTextIcon, 
  ChartBarIcon,
  CogIcon,
  UserPlusIcon,
  ChatBubbleBottomCenterTextIcon,
  DocumentChartBarIcon
} from '@heroicons/react/24/outline';
import { Scale, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import { ThemeToggle } from '@/registry/naf/ui/theme-toggle';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: HomeIcon, permission: null },
  { id: 'clients', label: 'العملاء', icon: UserGroupIcon, permission: 'clients.read' },
  { id: 'prospects', label: 'العملاء المحتملين', icon: UserPlusIcon, permission: 'prospects.read' },
  { id: 'cases', label: 'القضايا', icon: DocumentTextIcon, permission: 'cases.read' },
  { id: 'marketers', label: 'المسوّقين', icon: UserGroupIcon, permission: null },
  { id: 'analytics', label: 'التحليلات', icon: ChartBarIcon, permission: 'analytics.read' },
  { id: 'reports', label: 'التقارير المخصصة', icon: DocumentChartBarIcon, permission: 'analytics.read' },
  { id: 'smart-lawyer', label: 'المحامي الذكي', icon: ChatBubbleBottomCenterTextIcon, permission: null },
  { id: 'settings', label: 'الإعدادات', icon: CogIcon, permission: 'settings.read' },
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
    <div className={`bg-slate-900 text-white w-64 min-h-screen fixed inset-y-0 right-0 z-50 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
      isOpen ? 'translate-x-0' : 'translate-x-full'
    }`}>
      <div className="p-4 sm:p-6">
        {/* Close button for mobile */}
        <div className="flex justify-between items-center mb-6 lg:hidden">
          <div className="flex items-center gap-3">
            {settings?.companyLogo ? (
              <img 
                src={settings.companyLogo} 
                alt="شعار الشركة" 
                className="h-6 w-6 object-contain"
              />
            ) : (
              <Scale className="h-6 w-6 text-amber-400" />
            )}
            <span className="text-lg font-bold">{settings?.companyName || 'NAF Law'}</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Logo section for desktop */}
        <div className="flex items-center gap-3 mb-8">
          {settings?.companyLogo ? (
            <img 
              src={settings.companyLogo} 
              alt="شعار الشركة" 
              className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
            />
          ) : (
            <Scale className="h-6 w-6 sm:h-8 sm:w-8 text-amber-400" />
          )}
          <div className="hidden lg:block">
            <h1 className="text-lg sm:text-xl font-bold">{settings?.companyName || 'NAF Law'}</h1>
            <p className="text-xs sm:text-sm text-slate-400">{settings?.companyDescription || 'نظام إدارة المكتب القانوني'}</p>
          </div>
        </div>
        
        <nav className="space-y-2">
          {menuItems.map((item) => {
            if (!canAccessMenuItem(item)) return null;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-right transition-colors ${
                  currentView === item.id 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
        <div className="mt-8 border-t border-slate-800 pt-4">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}