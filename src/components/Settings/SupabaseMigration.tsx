import React, { useState, useEffect } from 'react';
import { 
  CloudIcon, 
  ArrowPathIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  CogIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';

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
      setMigrationMessage('تم ترحيل جميع البيانات بنجاح إلى Supabase! يمكنك الآن الاستفادة من قاعدة البيانات المركزية.');
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
        <CloudIcon className="h-6 w-6 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold text-slate-900">قاعدة البيانات المركزية</h3>
          <p className="text-sm text-slate-600">إعداد وترحيل البيانات إلى Supabase</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className={`rounded-lg p-4 border ${
        isSupabaseConnected 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center gap-3">
          {isSupabaseConnected ? (
            <CheckCircleIcon className="h-6 w-6 text-green-600" />
          ) : (
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
          )}
          <div>
            <h4 className={`font-medium ${
              isSupabaseConnected ? 'text-green-900' : 'text-red-900'
            }`}>
              {isSupabaseConnected ? 'Supabase متصل' : 'Supabase غير متصل'}
            </h4>
            <p className={`text-sm ${
              isSupabaseConnected ? 'text-green-800' : 'text-red-800'
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
        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
            <CogIcon className="h-5 w-5" />
            البيانات المحلية الحالية
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{localDataStats.clients}</p>
              <p className="text-sm text-slate-600">العملاء</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{localDataStats.prospects}</p>
              <p className="text-sm text-slate-600">العملاء المحتملين</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{localDataStats.cases}</p>
              <p className="text-sm text-slate-600">القضايا</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{localDataStats.marketers}</p>
              <p className="text-sm text-slate-600">المسوّقين</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{localDataStats.activities}</p>
              <p className="text-sm text-slate-600">الأنشطة</p>
            </div>
          </div>
        </div>
      )}

      {/* Migration Status */}
      {migrationMessage && (
        <div className={`rounded-lg p-4 border ${
          migrationStatus === 'success' ? 'bg-green-50 border-green-200' :
          migrationStatus === 'error' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start gap-3">
            {migrationStatus === 'success' && <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />}
            {migrationStatus === 'error' && <ExclamationTriangleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />}
            {migrationStatus === 'migrating' && (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 flex-shrink-0"></div>
            )}
            <div>
              <p className={`font-medium ${
                migrationStatus === 'success' ? 'text-green-900' :
                migrationStatus === 'error' ? 'text-red-900' :
                'text-blue-900'
              }`}>
                {migrationStatus === 'success' ? 'نجح الترحيل' :
                 migrationStatus === 'error' ? 'فشل الترحيل' :
                 migrationStatus === 'migrating' ? 'جاري الترحيل' : 'معلومات'}
              </p>
              <p className={`text-sm ${
                migrationStatus === 'success' ? 'text-green-800' :
                migrationStatus === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {migrationMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Migration Steps */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h4 className="font-medium text-slate-900 mb-4">خطوات الترحيل إلى Supabase</h4>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isSupabaseConnected ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'
            }`}>
              1
            </div>
            <div>
              <h5 className="font-medium text-slate-900">توصيل Supabase</h5>
              <p className="text-sm text-slate-600">
                {isSupabaseConnected 
                  ? '✅ تم توصيل Supabase بنجاح'
                  : 'اضغط على "Connect to Supabase" في أعلى الصفحة'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              migrationStatus === 'success' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'
            }`}>
              2
            </div>
            <div>
              <h5 className="font-medium text-slate-900">ترحيل البيانات</h5>
              <p className="text-sm text-slate-600">
                {migrationStatus === 'success' 
                  ? '✅ تم ترحيل جميع البيانات بنجاح'
                  : 'نقل البيانات من التخزين المحلي إلى قاعدة بيانات Supabase'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-600">
              3
            </div>
            <div>
              <h5 className="font-medium text-slate-900">التحقق من البيانات</h5>
              <p className="text-sm text-slate-600">
                التأكد من صحة البيانات المرحلة في لوحة تحكم Supabase
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={exportBackup}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
        >
          <DocumentArrowDownIcon className="h-5 w-5" />
          تصدير نسخة احتياطية أولاً
        </button>
        
        <button
          onClick={handleMigration}
          disabled={!isSupabaseConnected || migrationStatus === 'migrating'}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {migrationStatus === 'migrating' ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              جاري الترحيل...
            </>
          ) : (
            <>
              <ArrowPathIcon className="h-5 w-5" />
              بدء ترحيل البيانات
            </>
          )}
        </button>
      </div>

      {/* Benefits */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h4 className="font-medium text-blue-900 mb-4 flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5" />
          مزايا استخدام Supabase
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
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
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0" />
          <div>
            <h5 className="font-medium text-amber-900 mb-2">ملاحظات مهمة:</h5>
            <ul className="text-sm text-amber-800 space-y-1">
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