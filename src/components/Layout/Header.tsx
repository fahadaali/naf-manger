import { useState, useEffect } from 'react';
import { Bell, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import ProfileAvatar from '../Common/ProfileAvatar';

interface HeaderProps {
  currentView: string;
  onMenuClick: () => void;
}

const viewTitles: Record<string, string> = {
  dashboard: 'لوحة التحكم',
  clients: 'إدارة العملاء',
  prospects: 'إدارة العملاء المحتملين',
  cases: 'إدارة القضايا',
  analytics: 'التحليلات والإحصائيات',
  reports: 'التقارير المخصصة',
  marketers: 'إدارة المسوّقين',
  settings: 'الإعدادات'
};

export default function Header({ currentView, onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'مسؤول النظام';
      case 'lawyer': return 'محامٍ';
      case 'staff': return 'إداري';
      default: return role;
    }
  };

  return (
    <header className="bg-card shadow-sm border-b border-border">
      <div className="flex justify-between items-center px-4 sm:px-6 py-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">
            {viewTitles[currentView] || settings?.companyName || 'شركة ناف'}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground hidden sm:block">{settings?.companyDescription || 'نظام إدارة العملاء'}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-muted rounded-full transition-colors hidden sm:block">
            <Bell className="h-6 w-6 text-muted-foreground" />
          </button>
          
          <div className="flex items-center gap-3">
            <ProfileAvatar 
              src={user?.profilePicture} 
              name={user?.name || 'مستخدم'} 
              size="sm" 
            />
            <div className="text-start hidden sm:block">
              <p className="text-sm font-medium text-foreground truncate max-w-32">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{getRoleLabel(user?.role || '')}</p>
            </div>
            <button
              onClick={logout}
              className="p-1 sm:p-2 hover:bg-destructive-soft hover:text-destructive-strong rounded-full transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}