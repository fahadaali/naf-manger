import React, { useState, useEffect } from 'react';
import { BellIcon, UserCircleIcon, ArrowRightOnRectangleIcon, Bars3Icon } from '@heroicons/react/24/outline';
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
  settings: 'الإعدادات',
  'smart-lawyer': 'المحامي الذكي'
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
      case 'admin': return 'مدير النظام';
      case 'lawyer': return 'محامي';
      case 'staff': return 'إداري';
      default: return role;
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-slate-200">
      <div className="flex justify-between items-center px-4 sm:px-6 py-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        
        <div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900">
            {viewTitles[currentView] || settings?.companyName || 'NAF Law'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600 hidden sm:block">{settings?.companyDescription || 'نظام إدارة المكتب القانوني'}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-100 rounded-full transition-colors hidden sm:block">
            <BellIcon className="h-6 w-6 text-slate-600" />
          </button>
          
          <div className="flex items-center gap-3">
            <ProfileAvatar 
              src={user?.profilePicture} 
              name={user?.name || 'مستخدم'} 
              size="sm" 
            />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900 truncate max-w-32">{user?.name}</p>
              <p className="text-xs text-slate-500">{getRoleLabel(user?.role || '')}</p>
            </div>
            <button
              onClick={logout}
              className="p-1 sm:p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
              title="تسجيل الخروج"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}