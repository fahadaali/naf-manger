import { useState, useEffect } from 'react';
import { House, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import ProfileAvatar from '../Common/ProfileAvatar';
import { roleLabel } from '../../lib/labels';

interface HeaderProps {
  currentView: string;
  onMenuClick: () => void;
}

/* naf-terms.md §٢ «الانتقال إلى المنصات من الترويسة»، وأيقونته `House`
   في naf-icons.md. */
const ALL_PLATFORMS = 'كل المنصات';

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
  const { user, logout, center } = useAuth();
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

  return (
    <header className="bg-card shadow-sm border-b border-border">
      <div className="flex justify-between items-center px-4 sm:px-6 py-4">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="فتح القائمة"
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
          {/* كان هنا جرسُ إشعاراتٍ بلا `onClick` ولا اسمٍ مقروء: يُضغط فلا
              يقع شيء. والإشعاراتُ غيرُ مبنيّةٍ أصلاً — تفضيلاتُها تُحفظ
              ولا مُرسِل لها، وREADME يقول ذلك — فزرٌّ يَعِد بها وعدٌ كاذب.
              ويعود حين يُبنى الإرسال. */}

          <div className="flex items-center gap-3">
            {/* إلى شبكة المنصات في المركز، بجوار الاسم مباشرةً. صورةُ
                `PlatformsLink` في naf-ui بأدوات هذه المنصة: هذه المنصة لا
                تستعمل غلاف السجلّ. العنوانُ من الخادم (`center` في ‎/api/me
                = AUTH_ISSUER) لا مكتوبٌ هنا، فإن غاب لم يُعرض الزرّ. ويفتح
                في اللسان نفسه. وتحت `sm` يبقى رمزاً وحده، واسمُه في
                aria-label وtitle. */}
            {center && (
              <a
                href={`${center.replace(/\/+$/, "")}/`}
                aria-label={ALL_PLATFORMS}
                title={ALL_PLATFORMS}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:px-3"
              >
                <House size={16} aria-hidden="true" className="shrink-0" />
                <span className="hidden sm:inline">{ALL_PLATFORMS}</span>
              </a>
            )}
            <ProfileAvatar 
              src={user?.profilePicture} 
              name={user?.name || 'مستخدم'} 
              size="sm" 
            />
            <div className="text-start hidden sm:block">
              <p className="text-sm font-medium text-foreground truncate max-w-32">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel(user?.role)}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              aria-label="تسجيل الخروج"
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