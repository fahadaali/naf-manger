import { useState, useEffect } from 'react';
import { CircleCheck, Plus, Search, TriangleAlert, Users } from 'lucide-react';
import { Marketer } from '../../types';
import MarketerCard from './MarketerCard';
import MarketerModal from './MarketerModal';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import { useSettingList } from '../../lib/use-settings';
import { marketerStatusLabel, relationshipTypeLabel } from '../../lib/labels';
import { formatNumber } from '@/registry/naf/lib/format';
import { Button } from '@/registry/naf/ui/button';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Card } from '@/registry/naf/ui/card';
import { Alert } from '@/registry/naf/ui/alert';
import { messageTone } from '../../lib/status-message';

export default function MarketersView() {
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [selectedMarketer, setSelectedMarketer] = useState<Marketer | null>(null);
  const [showMarketerModal, setShowMarketerModal] = useState(false);
  const [editingMarketer, setEditingMarketer] = useState<Marketer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [notice, setNotice] = useState('');
  const { hasPermission } = useAuth();

  // المرشّحات من «تكوين النظام».
  const marketerStatuses = useSettingList('marketerStatuses');
  const relationshipTypes = useSettingList('relationshipTypes');

  useEffect(() => {
    loadMarketers();
  }, []);

  const loadMarketers = () => {
    const loadMarketersAsync = async () => {
      try {
        // جلب المسوّقين من مسارات المنصة على D1
        setMarketers(await db.getMarketers());
      } catch (error) {
        console.error('Error loading marketers:', error);
        setMarketers([]);
      }
    };
    
    loadMarketersAsync();
  };

  const filteredMarketers = marketers.filter(marketer => {
    const matchesSearch = marketer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         marketer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         marketer.phone.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || marketer.status === filterStatus;
    const matchesType = filterType === 'all' || marketer.relationshipType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleCreateMarketer = () => {
    setEditingMarketer(null);
    setSelectedMarketer(null);
    setIsEditing(true);
    setShowMarketerModal(true);
  };

  const handleEditMarketer = (marketer: Marketer) => {
    setEditingMarketer(marketer);
    setSelectedMarketer(null);
    setIsEditing(true);
    setShowMarketerModal(true);
  };

  const handleViewDetails = (marketer: Marketer) => {
    setSelectedMarketer(marketer);
    setEditingMarketer(null);
    setIsEditing(false);
    setShowMarketerModal(true);
  };

  const handleSaveMarketer = (marketerData: Partial<Marketer>) => {
    const saveMarketerAsync = async () => {
      try {
        if (editingMarketer) {
          await db.updateMarketer(editingMarketer.id, marketerData);
        } else {
          await db.createMarketer(marketerData as Omit<Marketer, 'id'>);
        }
        loadMarketers();

        setShowMarketerModal(false);
        setEditingMarketer(null);
        setSelectedMarketer(null);
        setIsEditing(false);
      } catch (error) {
        console.error('Error saving marketer:', error);
        setNotice('تعذّر حفظ بيانات المسوّق. أعد المحاولة');
      }
    };
    
    saveMarketerAsync();
  };

  /* ═══ الحذفُ كان بلا زرّ ═══
     `db.deleteMarketer` مكتوبةٌ والمسارُ يقبلها، ولا شيءَ في الشاشة ولا في
     البطاقة ولا في النافذة يناديها — فمسوّقٌ أُضيف خطأً يبقى. ولا عمودَ
     أرشفةٍ لجدولهم، فالحذفُ حذف.

     وقضيةٌ تشير إليه تمنعه: القيدُ الأجنبيّ يردّ `invalid_reference`،
     والرسالةُ تقول ذلك بدل «حدث خطأ» — والعلاجُ فكُّ الربط أو «سابق». */
  const handleDeleteMarketer = async (marketer: Marketer) => {
    if (!window.confirm(
      `حذف «${marketer.fullName}» نهائياً؟ وتُحذف معه دفعاتُ عمولته المسجَّلة.`
    )) return;

    setNotice('');
    try {
      await db.deleteMarketer(marketer.id);
      setNotice('تمّ الحذف');
      loadMarketers();
      setTimeout(() => setNotice(''), 3000);
    } catch (error) {
      console.error('تعذّر حذف المسوّق:', error);
      const code = (error as { code?: string })?.code;
      setNotice(
        code === 'invalid_reference'
          ? 'لا يُحذف مسوّقٌ مرتبطٌ بقضية. افصله عنها أو اجعل حالته «سابق».'
          : 'تعذّر الحذف. أعد المحاولة'
      );
    }
  };

  const handleCloseModal = () => {
    setShowMarketerModal(false);
    setSelectedMarketer(null);
    setEditingMarketer(null);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-deep text-surface-deep-foreground rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-card/20 rounded-full">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">إدارة المسوّقين</h1>
              <p className="text-surface-deep-muted">إدارة المسوّقين وتتبع أدائهم والعمولات المستحقة لهم</p>
            </div>
          </div>
          {hasPermission('marketers', 'create') && (
            <Button onClick={handleCreateMarketer}>
              <Plus className="h-5 w-5" />
              إضافة مسوّق جديد
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="البحث عن مسوّق"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="pe-10 ps-4"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">كل الحالات</option>
              {marketerStatuses.map((status) => (
                <option key={status} value={status}>{marketerStatusLabel(status)}</option>
              ))}
            </Select>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">كل الأنواع</option>
              {relationshipTypes.map((type) => (
                <option key={type} value={type}>{relationshipTypeLabel(type)}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">إجمالي المسوّقين</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground"><bdi>{formatNumber(marketers.length)}</bdi></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">المسوّقين النشطين</p>
          <p className="text-xl sm:text-2xl font-bold text-success">
            <bdi>{formatNumber(marketers.filter(m => m.status === 'active').length)}</bdi>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">الموظفين</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            <bdi>{formatNumber(marketers.filter(m => m.relationshipType === 'employee').length)}</bdi>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">المستقلين</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            <bdi>{formatNumber(marketers.filter(m => m.relationshipType === 'freelancer').length)}</bdi>
          </p>
        </Card>
      </div>

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

      {/* Marketers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredMarketers.map((marketer) => (
          <MarketerCard
            key={marketer.id}
            marketer={marketer}
            onViewDetails={handleViewDetails}
            onEdit={handleEditMarketer}
            onDelete={hasPermission('marketers', 'delete') ? handleDeleteMarketer : undefined}
            canEdit={hasPermission('marketers', 'update')}
          />
        ))}
      </div>

      {filteredMarketers.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.</p>
        </div>
      )}

      {/* Marketer Modal */}
      {showMarketerModal && (
        <MarketerModal
          marketer={selectedMarketer || editingMarketer || undefined}
          onClose={handleCloseModal}
          onSave={handleSaveMarketer}
          isEditing={isEditing}
        />
      )}
    </div>
  );
}