import { useState, useEffect } from 'react';
import { CircleCheck, Plus, Search, TriangleAlert } from 'lucide-react';
import { BulkAction, Prospect } from '../../types';
import ProspectCard from './ProspectCard';
import ProspectModal from './ProspectModal';
import ZoomMeetingModal from '../Meetings/ZoomMeetingModal';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import SelectionBar from '../Common/SelectionBar';
import { useSelection } from '../../lib/use-selection';
import { useSettingList } from '../../lib/use-settings';
import { clientTypeLabel } from '../../lib/labels';
import { formatNumber } from '@/registry/naf/lib/format';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { messageTone } from '../../lib/status-message';

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
  /* ═══ الأرشفةُ لحقت بالشاشة ═══
     العمودُ `prospects.archived_at` قائمٌ منذ الهجرة الحادية عشرة،
     و`db.bulkProspects` مكتوبة — ولم يكن في هذه الشاشة ما يستعملهما: لا
     تحديدَ جماعي ولا أرشفة ولا حذف، بينما الثلاثةُ في العملاء والقضايا.
     ومحتملٌ أُضيف خطأً لم يكن يُزال إلا بتحويله عميلاً أو من القاعدة. */
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const { hasPermission } = useAuth();

  // تحميل العملاء المحتملين عند تحميل المكون
  useEffect(() => {
    loadProspects();
  }, []);

  const loadProspects = () => {
    const loadProspectsAsync = async () => {
      try {
        // جلب العملاء المحتملين من مسارات المنصة على D1
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
    const matchesArchive = archiveView === 'archived'
      ? Boolean(prospect.archivedAt)
      : !prospect.archivedAt;

    return matchesSearch && matchesType && matchesStatus && matchesArchive;
  });

  /** الحاضرون — غيرُ المؤرشفين. تُبنى عليهم البطاقاتُ الأربع أعلى الشاشة. */
  const present = prospects.filter((prospect) => !prospect.archivedAt);

  const selection = useSelection(filteredProspects);

  /* الحصيلةُ تُقال بعددها لا بـ«تمّ» — كما في شاشتَي العملاء والقضايا. */
  const runBulk = async (action: BulkAction) => {
    const ids = selection.ids;
    if (!ids.length) return;

    setBusy(true);
    setNotice('');
    try {
      const outcome = await db.bulkProspects(action, ids);
      /* والصيغةُ «تم…» لأنّ `messageTone` تقرأ بها النجاح — §٤ تنصّ على
         «تم + المصدر»، ورسالةٌ تبدأ بـ«حُذف» تُقرأ خطأً فتُعرض حمراء. */
      const noun = action === 'delete' ? 'حذف' : action === 'archive' ? 'أرشفة' : 'إرجاع';
      setNotice(`تمّ ${noun} ${formatNumber(outcome.affected)} من ${formatNumber(outcome.requested)}`);
      selection.clear();
      loadProspects();
    } catch (error) {
      console.error('تعذّر تنفيذ الفعل الجماعي:', error);
      setNotice('تعذّر التنفيذ. حدّث الصفحة وأعد المحاولة.');
    } finally {
      setBusy(false);
    }
  };

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
          /* والأثرُ يسجّله الخادم مع التحويل: كان يُكتب هنا منسوباً إلى
             «النظام» لا إلى من ضغط، ويسقط صامتاً إن انقطعت الشبكة بعد
             تحويلٍ وقع. */
          await db.convertProspectToClient(prospect.id);

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

  /* المسجَّلة في التكوين ومعها ما وقع في الصفوف فعلاً: حالةٌ أُضيفت ولم
     تُستعمل بعد تظهر للترشيح، وحالةٌ حُذفت من التكوين وبقيت في صفوف قديمة
     لا تختفي من المرشّح فتصير صفوفُها غير قابلة للوصول. */
  const clientTypes = useSettingList('clientTypes');
  const configured = useSettingList('prospectStatuses');
  const statuses = [...new Set([...configured, ...prospects.map((p) => p.prospectStatus)])];
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
  
  const conversionRate = present.length + totalClients > 0 ?
    Math.round((totalClients / (present.length + totalClients)) * 100) : 0;

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
              {clientTypes.map((type) => (
                <option key={type} value={type}>{clientTypeLabel(type)}</option>
              ))}
            </Select>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">كل الحالات</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </Select>
            <Select
              value={archiveView}
              onChange={(e) => {
                setArchiveView(e.target.value as 'active' | 'archived');
                selection.clear();
              }}
            >
              <option value="active">الحاضرون</option>
              <option value="archived">المؤرشفون</option>
            </Select>
          </div>
        </div>
      </Card>

      {notice && (() => {
        const tone = messageTone(notice);
        const Icon = tone === 'success' ? CircleCheck : TriangleAlert;
        return (
          <Alert variant={tone}>
            <Icon aria-hidden="true" />
            <span>{notice}</span>
          </Alert>
        );
      })()}

      <SelectionBar
        count={selection.count}
        onClear={selection.clear}
        onAction={runBulk}
        busy={busy}
        showRestore={archiveView === 'archived'}
        noun="محتملاً"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">إجمالي العملاء المحتملين</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground"><bdi>{formatNumber(present.length)}</bdi></p>
        </Card>
        {/* ═══ البطاقتان تتبعان «تكوين النظام» ═══
            كانتا تقارنان نصّين حرفيّين — «مهتم» و«بانتظار توقيع» —
            و`prospectStatuses` قائمةٌ يحرّرها المسؤول. فتعديلُ صياغةِ حالةٍ
            كان يُصفّر البطاقة بلا خطأٍ ولا تنبيه. والمعروضُ أوّلُ حالتين
            مكوَّنتين، فتتبعان ما ضُبط. */}
        {configured.slice(0, 2).map((status, index) => (
          <Card key={status} className="p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">{status}</p>
            <p className={`text-xl sm:text-2xl font-bold ${index === 0 ? 'text-primary' : 'text-warning'}`}>
              <bdi>{formatNumber(present.filter(p => p.prospectStatus === status).length)}</bdi>
            </p>
          </Card>
        ))}
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
            selected={selection.has(prospect.id)}
            onSelect={() => selection.toggle(prospect.id)}
          />
        ))}
      </div>

      {filteredProspects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {archiveView === 'archived'
              ? 'لا محتملَ مؤرشفاً.'
              : 'لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.'}
          </p>
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
        />
      )}
    </div>
  );
}