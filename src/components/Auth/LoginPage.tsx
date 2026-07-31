import React, { useState, useEffect } from 'react';
import { Scale, EyeIcon, SlashIcon as EyeSlashIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const currentSettings = await db.getSettings();
        setSettings(currentSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
        // استخدام إعدادات افتراضية في حالة الخطأ
        setSettings({
          companyName: 'NAF Law',
          companyDescription: 'نظام إدارة المكتب القانوني',
          companyLogo: null
        });
      }
    };
    
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(credentials);
      if (!success) {
        setError('بيانات الدخول غير صحيحة');
      }
    } catch (err) {
      setError('حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-0" dir="rtl">
      <div className="bg-card w-full overflow-hidden">
        <div className="bg-surface-deep text-surface-deep-foreground p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            {settings?.companyLogo ? (
              <img 
                src={settings.companyLogo} 
                alt="شعار الشركة" 
                className="h-12 w-12 object-contain"
              />
            ) : (
              <Scale className="h-12 w-12 text-warning" />
            )}
            <div>
              <h1 className="text-3xl font-bold">{settings?.companyName || 'NAF Law'}</h1>
              <p className="text-surface-deep-muted">{settings?.companyDescription || 'نظام إدارة المكتب القانوني'}</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">تسجيل الدخول</h2>
            <p className="text-muted-foreground">أدخل بيانات الدخول للوصول إلى النظام</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                value={credentials.email}
                onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors"
                placeholder="admin@naflaw.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-3 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring transition-colors pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-destructive-soft border border-destructive/30 rounded-lg p-3">
                <p className="text-destructive text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-medium py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}