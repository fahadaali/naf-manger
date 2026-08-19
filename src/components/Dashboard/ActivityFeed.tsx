import { useState, useEffect } from 'react';
import { Banknote, ClipboardList, FileText, Link2, Megaphone, User, UserPlus, Users } from 'lucide-react';
import { ActivityLog } from '../../types';
import { db } from '../../data/database';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { formatNumber, isolate } from '@/registry/naf/lib/format';

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    
    // تحديث الأنشطة كل 15 ثانية
    const interval = setInterval(loadActivities, 15000);
    
    return () => clearInterval(interval);
  }, []);
  
  /* الدوّار للجلبة الأولى وحدها: كان `setLoading(true)` يقع في كل دورة
     تحديث، فتُستبدل القائمةُ المعروضة بدوّارٍ كلَّ خمس عشرة ثانية —
     وميضٌ لا يخبر بشيء، والقائمةُ الظاهرة أصدق حتى يصل بدلُها. */
  const loadActivities = async () => {
    try {
      setActivities((await db.getActivities()).slice(0, 10));
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  /* ═══ الأيقونةُ من الكيان واللونُ من الفعل ═══
   *
   * كان `switch` يعدّ أنواعاً بأعيانها — `client_created` و`case_updated`
   * وأخواتِها — ولا يُكتب منها واحد، فكلُّ فرعٍ فيه ميت. والأنواعُ اليوم
   * تُبنى في `worker/lib/activity.js` بصيغة `<كيان>_<فعل>`، فتُقرأ
   * جزأين: يُضاف كيانٌ أو فعلٌ هناك فيجد صورتَه هنا بلا تعديل. */
  const ENTITY_ICON: Record<string, typeof Users> = {
    client: Users,
    prospect: UserPlus,
    case: FileText,
    marketer: Megaphone,
    commission: Banknote,
    user: User,
    basecamp: Link2,
  };

  const ACTION_TONE: Record<string, string> = {
    created: 'bg-success-soft text-success-strong',
    updated: 'bg-primary-soft text-primary-strong',
    deleted: 'bg-destructive-soft text-destructive-strong',
    archived: 'bg-muted text-muted-foreground',
    restored: 'bg-info-soft text-info-strong',
  };

  /** `<كيان>_<فعل>` — وآخرُ شرطةٍ هي الفاصل، فكيانٌ باسمين لا يُمزَّق. */
  const partsOf = (type: string) => {
    const cut = type.lastIndexOf('_');
    return cut > 0
      ? { entity: type.slice(0, cut), action: type.slice(cut + 1) }
      : { entity: type, action: '' };
  };

  const getActivityIcon = (type: string) =>
    ENTITY_ICON[partsOf(type).entity] ?? ClipboardList;

  const getActivityColor = (type: string) =>
    ACTION_TONE[partsOf(type).action] ?? 'bg-muted text-muted-foreground';

  /* الأرقامُ من `formatNumber` ومعزولةٌ بـ`isolate`: القاعدة توجب عزل كل
     رقمٍ في نصّ عربي، و`<bdi>` لا يبلغ سلسلةً تُبنى هنا. ولحظةٌ في
     المستقبل — ساعةُ جهازٍ متأخّرة — تُقرأ «الآن» لا «منذ ‎-٥‎ دقيقة». */
  const getTimeAgo = (timestamp: Date) => {
    const minutes = Math.floor((Date.now() - timestamp.getTime()) / 60000);
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${isolate(formatNumber(minutes))} دقيقة`;
    if (minutes < 1440) return `منذ ${isolate(formatNumber(Math.floor(minutes / 60)))} ساعة`;
    return `منذ ${isolate(formatNumber(Math.floor(minutes / 1440)))} يوم`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="h-6 w-6 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">النشاط الأخير</h3>
      </div>
      
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : activities.length > 0 ? activities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          const colorClass = getActivityColor(activity.type);
          
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${colorClass} flex-shrink-0`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground mb-1">
                  {activity.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activity.userName}</span>
                  <span>•</span>
                  <span>{getTimeAgo(activity.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        }) : (
          <p className="text-muted-foreground text-center py-4">لم يصل أي نشاط بعد.</p>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-border">
        {/* المُعالِج على الزرّ لا على `<span>` بداخله: كان الضغط خارج
            النصّ لا يعمل، وتفعيلُه بالكيبورد لا يبلغ المُعالِج أصلاً. */}
        <Button type="button" onClick={loadActivities} variant="link" size="sm">
          تحديث الأنشطة
        </Button>
      </div>
    </Card>
  );
}