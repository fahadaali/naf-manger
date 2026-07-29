import React, { useState, useEffect } from 'react';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Prospect } from '../../types';
import ProspectCard from './ProspectCard';
import ProspectModal from './ProspectModal';
import ZoomMeetingModal from '../Meetings/ZoomMeetingModal';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';

export default function ProspectsView() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingProspect, setMeetingProspect] = useState<Prospect | null>(null);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const { hasPermission } = useAuth();

  // تحميل العملاء المحتملين عند تحميل المكون
  useEffect(() => {
    loadProspects();
  }, []);

  const loadProspects = () => {
    const loadProspectsAsync = async () => {
      try {
        // جلب العملاء المحتملين مباشرة من Supabase
        setProspects(await db.getProspects());
      } catch (error) {
        console.error('Error loading prospects:', error);
        setProspects([]);
      }
    };
    
    loadProspectsAsync();
  };

  const filteredProspects = prospects.filter(prospect => {
    const matchesSearch = prospect.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prospect.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prospect.phone.includes(searchTerm);
    
    const matchesType = filterType === 'all' || prospect.clientType === filterType;
    const matchesStatus = filterStatus === 'all' || prospect.prospectStatus === filterStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleCreateProspect = () => {
    setEditingProspect(null);
    setSelectedProspect(null);
    setIsEditing(true);
    setShowProspectModal(true);
  };

  const handleEditProspect = (prospect: Prospect) => {
    setEditingProspect(prospect);
    setSelectedProspect(null);
    setIsEditing(true);
    setShowProspectModal(true);
  };

  const handleViewDetails = (prospect: Prospect) => {
    setSelectedProspect(prospect);
    setEditingProspect(null);
    setIsEditing(false);
    setShowProspectModal(true);
  };

  const handleSaveProspect = (prospectData: Partial<Prospect>) => {
    const saveProspectAsync = async () => {
      try {
        if (editingProspect) {
          await db.updateProspect(editingProspect.id, prospectData);
        } else {
          await db.createProspect(prospectData as Omit<Prospect, 'id'>);
        }
        loadProspects();

        setShowProspectModal(false);
        setEditingProspect(null);
        setSelectedProspect(null);
        setIsEditing(false);
      } catch (error) {
        console.error('Error saving prospect:', error);
        alert('حدث خطأ أثناء حفظ بيانات العميل المحتمل');
      }
    };
    
    saveProspectAsync();
  };

  const handleConvertToClient = (prospect: Prospect) => {
    if (window.confirm(`هل أنت متأكد من تحويل "${prospect.fullName}" إلى عميل فعلي؟`)) {
      const convertProspectAsync = async () => {
        try {
          /* التحويل فعلٌ واحد على الخادم: النسخُ ثم الحذف من المتصفّح
             يترك محتملاً نُسخ ولم يُحذف إن انقطعت الشبكة بينهما. */
          await db.convertProspectToClient(prospect.id);

          await db.addActivity({
            type: 'prospect_converted',
            description: `تم تحويل العميل المحتمل "${prospect.fullName}" إلى عميل فعلي`,
            userId: 'system',
            userName: 'النظام',
            entityId: prospect.id,
            entityType: 'prospect',
          } as any);

            loadProspects(); // إعادة تحميل القائمة
            alert(`تم تحويل "${prospect.fullName}" إلى عميل فعلي بنجاح!`);
        } catch (error) {
          console.error('Error converting prospect:', error);
          alert('حدث خطأ أثناء تحويل العميل المحتمل');
        }
      };
      
      convertProspectAsync();
    }
  };

  const handleCloseModal = () => {
    setShowProspectModal(false);
    setSelectedProspect(null);
    setEditingProspect(null);
    setIsEditing(false);
  };

  const handleCreateMeeting = (prospect: Prospect) => {
    setMeetingProspect(prospect);
    setShowMeetingModal(true);
  };

  const handleCloseMeetingModal = () => {
    setShowMeetingModal(false);
    setMeetingProspect(null);
  };

  const handleMeetingCreated = (meetingData: any) => {
    console.log('Meeting created:', meetingData);
    // يمكن إضافة منطق إضافي هنا مثل تحديث قاعدة البيانات
  };
  const uniqueStatuses = [...new Set(prospects.map(p => p.prospectStatus))];
  const [totalClients, setTotalClients] = useState(0);
  
  useEffect(() => {
    const loadTotalClients = async () => {
      try {
        const { data: clients, error } = await supabase
          .from('clients')
          .select('id');

        if (error) throw error;
        setTotalClients((clients || []).length);
      } catch (error) {
        console.error('Error loading total clients:', error);
        setTotalClients(0);
      }
    };
    
    loadTotalClients();
  }, []);
  
  const conversionRate = prospects.length + totalClients > 0 ? 
    Math.round((totalClients / (prospects.length + totalClients)) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">إدارة العملاء المحتملين</h1>
          <p className="text-slate-600">إدارة العملاء المحتملين وتحويلهم إلى عملاء فعليين</p>
        </div>
        {hasPermission('prospects', 'create') && (
          <button 
            onClick={handleCreateProspect}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            إضافة عميل محتمل
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="البحث عن عميل محتمل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">كل الأنواع</option>
              <option value="individual">أفراد</option>
              <option value="company">شركات</option>
              <option value="association">جمعيات</option>
              <option value="government">جهات حكومية</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">كل الحالات</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-xs sm:text-sm text-slate-600">إجمالي العملاء المحتملين</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{prospects.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-xs sm:text-sm text-slate-600">مهتمين</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">
            {prospects.filter(p => p.prospectStatus === 'مهتم').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-xs sm:text-sm text-slate-600">بانتظار توقيع</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600">
            {prospects.filter(p => p.prospectStatus === 'بانتظار توقيع').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-xs sm:text-sm text-slate-600">معدل التحويل</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{conversionRate}%</p>
        </div>
      </div>

      {/* Prospects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredProspects.map((prospect) => (
          <ProspectCard
            key={prospect.id}
            prospect={prospect}
            onViewDetails={handleViewDetails}
            onEdit={handleEditProspect}
            onConvert={handleConvertToClient}
            onCreateMeeting={handleCreateMeeting}
            canEdit={hasPermission('prospects', 'update')}
            canConvert={hasPermission('prospects', 'convert')}
          />
        ))}
      </div>

      {filteredProspects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500">لا توجد عملاء محتملين مطابقين لمعايير البحث</p>
        </div>
      )}

      {/* Prospect Modal */}
      {showProspectModal && (
        <ProspectModal
          prospect={selectedProspect || editingProspect || undefined}
          onClose={handleCloseModal}
          onSave={handleSaveProspect}
          isEditing={isEditing}
        />
      )}

      {/* Zoom Meeting Modal */}
      {showMeetingModal && meetingProspect && (
        <ZoomMeetingModal
          client={meetingProspect}
          onClose={handleCloseMeetingModal}
          onMeetingCreated={handleMeetingCreated}
        />
      )}
    </div>
  );
}