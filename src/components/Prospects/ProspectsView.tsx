import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Prospect } from '../../types';
import ProspectCard from './ProspectCard';
import ProspectModal from './ProspectModal';
import ZoomMeetingModal from '../Meetings/ZoomMeetingModal';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import { formatNumber } from '@/registry/naf/lib/format';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';

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
            alert(`تم تحويل "${prospect.fullName}" إلى عميل`);
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
        setTotalClients((await db.getClients()).length);
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
          <h1 className="text-2xl font-bold text-foreground">إدارة العملاء المحتملين</h1>
          <p className="text-muted-foreground">إدارة العملاء المحتملين وتحويلهم إلى عملاء فعليين</p>
        </div>
        {hasPermission('prospects', 'create') && (
          <Button onClick={handleCreateProspect}>
            <Plus className="h-5 w-5" />
            إضافة عميل محتمل
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="البحث عن عميل محتمل"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="pe-10 ps-4"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">كل الأنواع</option>
              <option value="individual">أفراد</option>
              <option value="company">شركات</option>
              <option value="association">جمعيات</option>
              <option value="government">جهات حكومية</option>
            </Select>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">كل الحالات</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">إجمالي العملاء المحتملين</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground"><bdi>{formatNumber(prospects.length)}</bdi></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">المهتمّين</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">
            <bdi>{formatNumber(prospects.filter(p => p.prospectStatus === 'مهتم').length)}</bdi>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">بانتظار توقيع</p>
          <p className="text-xl sm:text-2xl font-bold text-warning">
            <bdi>{formatNumber(prospects.filter(p => p.prospectStatus === 'بانتظار توقيع').length)}</bdi>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">معدل التحويل</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground"><bdi>{formatNumber(conversionRate)}%</bdi></p>
        </Card>
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
          <p className="text-muted-foreground">لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.</p>
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