import React, { useState, useEffect } from 'react';
import { ClockIcon, UserIcon, DocumentTextIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { ActivityLog } from '../../types';
import { db } from '../../data/database';

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    
    // تحديث الأنشطة كل 15 ثانية
    const interval = setInterval(loadActivities, 15000);
    
    return () => clearInterval(interval);
  }, []);
  
  const loadActivities = async () => {
    try {
      setLoading(true);
      
      setActivities((await db.getActivities()).slice(0, 10));
    } catch (error) {
      console.error('Error loading activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'client_created':
      case 'client_updated':
      case 'client_deleted':
        return UserGroupIcon;
      case 'case_created':
      case 'case_updated':
      case 'case_deleted':
        return DocumentTextIcon;
      case 'user_login':
      case 'user_created':
        return UserIcon;
      default:
        return ClockIcon;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'client_created':
      case 'case_created':
      case 'user_created':
        return 'bg-green-100 text-green-600';
      case 'client_updated':
      case 'case_updated':
        return 'bg-blue-100 text-blue-600';
      case 'client_deleted':
      case 'case_deleted':
        return 'bg-red-100 text-red-600';
      case 'user_login':
        return 'bg-purple-100 text-purple-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `منذ ${diffInMinutes} دقيقة`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `منذ ${hours} ساعة`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `منذ ${days} يوم`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <ClockIcon className="h-6 w-6 text-slate-600" />
        <h3 className="text-lg font-semibold text-slate-900">النشاط الأخير</h3>
      </div>
      
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
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
                <p className="text-sm font-medium text-slate-900 mb-1">
                  {activity.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{activity.userName}</span>
                  <span>•</span>
                  <span>{getTimeAgo(activity.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        }) : (
          <p className="text-slate-500 text-center py-4">لا توجد أنشطة حديثة</p>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-200">
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          <span onClick={loadActivities}>
          تحديث الأنشطة
          </span>
        </button>
      </div>
    </div>
  );
}