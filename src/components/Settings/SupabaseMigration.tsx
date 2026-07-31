import React, { useState, useEffect } from 'react';
import { CircleCheck, Database, FileOutput, RefreshCw, Settings, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import { Button } from '@/registry/naf/ui/button';

export default function SupabaseMigration() {
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');
  const [migrationMessage, setMigrationMessage] = useState('');
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [localDataStats, setLocalDataStats] = useState<any>(null);
  const { migrateData } = useAuth();

  useEffect(() => {
    checkSupabaseConnection();
    loadLocalDataStats();
  }, []);

  const checkSupabaseConnection = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    setIsSupabaseConnected(!!(supabaseUrl && supabaseKey));
  };

  const loadLocalDataStats = async () => {
    try {
      const stats = await db.getStats();
      const activities = await db.getActivities();
      const marketers = await db.getMarketers();
      
      setLocalDataStats({
        clients: stats.totalClients,
        prospects: stats.totalProspects,
        cases: stats.totalCases,
        activities: activities.length,
        marketers: marketers.length
      });
    } catch (error) {
      console.error('Error loading local data stats:', error);
    }
  };

  const handleMigration = async () => {
    if (!isSupabaseConnected) {
      setMigrationMessage('يرجى توصيل Supabase أولاً من خلال الزر في أعلى الصفحة');
      setMigrationStatus('error');
      return;
    }

    setMigrationStatus('migrating');
    setMigrationMessage('جاري ترحيل البيانات...');

    try {
      await migrateData();
      setMigrationStatus('success');
      setMigrationMessage('تم ترحيل جميع البيانات إلى Supabase');
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationStatus('error');
      setMigrationMessage(`فشل في ترحيل البيانات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  };

  const exportBackup = async () => {
    try {
      const allData = await db.exportAllData();
      const dataStr = JSON.stringify(allData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `NAF_Law_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting backup:', error);
      alert('حدث خطأ أثناء تصدير النسخة الاحتياطية');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-6 w-6 text-primary" />
        <div>
          <h3 className="text-lg font-semibold text-foreground">قاعدة البيانات المركزية</h3>
          <p className="text-sm text-muted-foreground">إعداد وترحيل البيانات إلى Supabase</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`rounded-lg p-4 border ${
        isSupabaseConnected 
          ? 'bg-success-soft border-success/30' 
          : 'bg-destructive-soft border-destructive/30'
      }`}>
        <div className="flex items-center gap-3">
          {isSupabaseConnected ? (
            <CircleCheck className="h-6 w-6 text-success" />
          ) : (
            <TriangleAlert className="h-6 w-6 text-destructive" />
          )}
          <div>
            <h4 className={`font-medium ${
              isSupabaseConnected ? 'text-success-strong' : 'text-destructive-strong'
            }`}>
              {isSupabaseConnected ? 'Supabase متصل' : 'Supabase غير متصل'}
            </h4>
            <p className={`text-sm ${
              isSupabaseConnected ? 'text-success-strong' : 'text-destructive-strong'
            }`}>
              {isSupabaseConnected 
                ? 'تم العثور على إعدادات Supabase صحيحة. يمكنك الآن ترحيل البيانات.'
                : 'لم يتم العثور على إعدادات Supabase. يرجى الضغط على "Connect to Supabase" في أعلى الصفحة.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Local Data Overview */}
      {localDataStats && (
        <div className="bg-muted rounded-lg p-6">
          <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            البيانات المحلية الحالية
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{localDataStats.clients}</p>
              <p className="text-sm text-muted-foreground">العملاء</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-info">{localDataStats.prospects}</p>
              <p className="text-sm text-muted-foreground">العملاء المحتملين</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{localDataStats.cases}</p>
              <p className="text-sm text-muted-foreground">القضايا</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-warning">{localDataStats.marketers}</p>
              <p className="text-sm text-muted-foreground">المسوّقين</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{localDataStats.activities}</p>
              <p className="text-sm text-muted-foreground">الأنشطة</p>
            </div>
          </div>
        </div>
      )}

      {/* Migration Status */}
      {migrationMessage && (
        <div className={`rounded-lg p-4 border ${
          migrationStatus === 'success' ? 'bg-success-soft border-success/30' :
          migrationStatus === 'error' ? 'bg-destructive-soft border-destructive/30' :
          'bg-primary-soft border-primary/30'
        }`}>
          <div className="flex items-start gap-3">
            {migrationStatus === 'success' && <CircleCheck className="h-6 w-6 text-success flex-shrink-0" />}
            {migrationStatus === 'error' && <TriangleAlert className="h-6 w-6 text-destructive flex-shrink-0" />}
            {migrationStatus === 'migrating' && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary flex-shrink-0"></div>
            )}
            <div>
              <p className={`font-medium ${
                migrationStatus === 'success' ? 'text-success-strong' :
                migrationStatus === 'error' ? 'text-destructive-strong' :
                'text-primary-strong'
              }`}>
                {migrationStatus === 'success' ? 'نجح الترحيل' :
                 migrationStatus === 'error' ? 'فشل الترحيل' :
                 migrationStatus === 'migrating' ? 'جارٍ الترحيل' : 'معلومات'}
              </p>
              <p className={`text-sm ${
                migrationStatus === 'success' ? 'text-success-strong' :
                migrationStatus === 'error' ? 'text-destructive-strong' :
                'text-primary-strong'
              }`}>
                {migrationMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Migration Steps */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h4 className="font-medium text-foreground mb-4">خطوات الترحيل إلى Supabase</h4>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isSupabaseConnected ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'
            }`}>
              1
            </div>
            <div>
              <h5 className="font-medium text-foreground">توصيل Supabase</h5>
              <p className="text-sm text-muted-foreground">
                {isSupabaseConnected 
                  ? 'تم الربط'
                  : 'اضغط على "Connect to Supabase" في أعلى الصفحة'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              migrationStatus === 'success' ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground'
            }`}>
              2
            </div>
            <div>
              <h5 className="font-medium text-foreground">ترحيل البيانات</h5>
              <p className="text-sm text-muted-foreground">
                {migrationStatus === 'success' 
                  ? 'تم ترحيل جميع البيانات'
                  : 'نقل البيانات من التخزين المحلي إلى قاعدة بيانات Supabase'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
              3
            </div>
            <div>
              <h5 className="font-medium text-foreground">التحقق من البيانات</h5>
              <p className="text-sm text-muted-foreground">
                التأكد من صحة البيانات المرحلة في لوحة تحكم Supabase
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button onClick={exportBackup} variant="secondary">
          <FileOutput className="h-5 w-5" />
          تصدير نسخة احتياطية أولاً
        </Button>
        
        <Button onClick={handleMigration} disabled={!isSupabaseConnected || migrationStatus === 'migrating'}>
          {migrationStatus === 'migrating' ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-card"></div>
              جارٍ الترحيل...
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5" />
              بدء ترحيل البيانات
            </>
          )}
        </Button>
      </div>

      {/* Benefits */}
      <div className="bg-primary-soft rounded-lg p-6">
        <h4 className="font-medium text-primary-strong mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          مزايا استخدام Supabase
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-primary-strong">
          <ul className="space-y-2">
            <li>• قاعدة بيانات مركزية آمنة</li>
            <li>• مزامنة البيانات بين جميع المستخدمين</li>
            <li>• نسخ احتياطية تلقائية</li>
            <li>• أداء عالي وموثوقية</li>
          </ul>
          <ul className="space-y-2">
            <li>• مصادقة متقدمة للمستخدمين</li>
            <li>• أمان على مستوى الصفوف (RLS)</li>
            <li>• إمكانية الوصول من أي جهاز</li>
            <li>• دعم فني متخصص</li>
          </ul>
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-warning-soft border border-warning/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TriangleAlert className="h-6 w-6 text-warning flex-shrink-0" />
          <div>
            <h5 className="font-medium text-warning-strong mb-2">ملاحظات مهمة:</h5>
            <ul className="text-sm text-warning-strong space-y-1">
              <li>• تأكد من إنشاء نسخة احتياطية قبل بدء الترحيل</li>
              <li>• عملية الترحيل قد تستغرق عدة دقائق حسب حجم البيانات</li>
              <li>• بعد الترحيل، ستصبح البيانات مركزية ومتاحة لجميع المستخدمين</li>
              <li>• يُنصح بعدم استخدام التطبيق أثناء عملية الترحيل</li>
              <li>• في حالة فشل الترحيل، يمكنك استعادة البيانات من النسخة الاحتياطية</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}