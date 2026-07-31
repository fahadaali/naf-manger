import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import { NafLogo } from '@/registry/naf/brand/naf-logo';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Alert } from '@/registry/naf/ui/alert';

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
              <NafLogo variant="mark" className="h-12" />
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
              <Input
                type="email"
                required
                value={credentials.email}
                onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                placeholder="admin@naflaw.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))} className="pe-12"
                  placeholder="••••••••"
                />
                <Button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-1/2 -translate-y-1/2" variant="ghost" size="icon-sm">
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <span className="text-sm">{error}</span>
              </Alert>
            )}

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'جارٍ تسجيل الدخول' : 'تسجيل الدخول'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}