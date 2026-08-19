import { useState, useEffect } from 'react';
import { Archive, CircleCheck, ExternalLink, Plus, Search, TriangleAlert } from 'lucide-react';
import { BulkAction, Client } from '../../types';
import ClientCard from './ClientCard';
import ClientModal from './ClientModal';
import ZoomMeetingModal from '../Meetings/ZoomMeetingModal';
import ProfileAvatar from '../Common/ProfileAvatar';
import RowCheckbox from '../Common/RowCheckbox';
import SelectionBar from '../Common/SelectionBar';
import ViewToggle, { useViewMode } from '../Common/ViewToggle';
import { useAuth } from '../../contexts/AuthContext';
import { useSelection } from '../../lib/use-selection';
import { db } from '../../data/database';
import { useSettingList } from '../../lib/use-settings';
import { clientStatusLabel, clientTypeLabel } from '../../lib/labels';
import { formatDate, formatNumber, formatPhone } from '@/registry/naf/lib/format';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Alert } from '@/registry/naf/ui/alert';
import { messageTone } from '../../lib/status-message';
import { Card } from '@/registry/naf/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/registry/naf/ui/table';

export default function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingClient, setMeetingClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  /* المؤرشفُ مخفيٌّ افتراضاً — وهو الغرضُ منه. و«المؤرشفة» تُظهرها وحدها
     ليُرجَع منها أو يُحذف. */
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active');
  const [viewMode, setViewMode] = useViewMode('clients');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const { hasPermission } = useAuth();

  // المرشّحات من «تكوين النظام».
  const clientTypes = useSettingList('clientTypes');
  const clientStatuses = useSettingList('clientStatuses');

  // تحميل العملاء عند تحميل المكون
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = () => {
    const loadClientsAsync = async () => {
      try {
        // جلب العملاء من مسارات المنصة على D1
        setClients(await db.getClients());
      } catch (error) {
        console.error('Error loading clients:', error);
        setClients([]);
      }
    };
    
    loadClientsAsync();
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.phone.includes(searchTerm);

    const matchesType = filterType === 'all' || client.clientType === filterType;
    const matchesStatus = filterStatus === 'all' || client.status === filterStatus;
    const matchesArchive = archiveView === 'archived' ? Boolean(client.archivedAt) : !client.archivedAt;

    return matchesSearch && matchesType && matchesStatus && matchesArchive;
  });

  /** الحاضرون — غيرُ المؤرشفين. تُبنى عليهم البطاقاتُ الأربع أعلى الشاشة. */
  const present = clients.filter((client) => !client.archivedAt);

  const selection = useSelection(filteredClients);

  /* ═══ الفعلُ على المحدَّد ═══
     الحصيلةُ تُقال بعددها لا بـ«تمّ»: من أرشف اثني عشر يريد أن يعرف أنّ
     اثني عشر أُرشفوا — ونقصانُ العدد يعني أنّ صفّاً حذفه غيرُه قبله. */
  const runBulk = async (action: BulkAction) => {
    const ids = selection.ids;
    if (!ids.length) return;

    setBusy(true);
    setNotice('');
    try {
      const outcome = await db.bulkClients(action, ids);
      /* والصيغةُ «تم…» لأنّ `messageTone` تقرأ بها النجاح — §٤ تنصّ على
         «تم + المصدر»، ورسالةٌ تبدأ بـ«حُذف» تُقرأ خطأً فتُعرض حمراء. */
      const noun = action === 'delete' ? 'حذف' : action === 'archive' ? 'أرشفة' : 'إرجاع';
      setNotice(`تمّ ${noun} ${formatNumber(outcome.affected)} من ${formatNumber(outcome.requested)}`);
      selection.clear();
      loadClients();
    } catch (error) {
      console.error('تعذّر تنفيذ الفعل الجماعي:', error);
      setNotice('تعذّر التنفيذ. حدّث الصفحة وأعد المحاولة.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateClient = () => {
    setEditingClient(null);
    setSelectedClient(null);
    setIsEditing(true);
    setShowClientModal(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setSelectedClient(null);
    setIsEditing(true);
    setShowClientModal(true);
  };

  const handleViewDetails = (client: Client) => {
    setSelectedClient(client);
    setEditingClient(null);
    setIsEditing(false);
    setShowClientModal(true);
  };

  const handleSaveClient = (clientData: Partial<Client>) => {
    const saveClientAsync = async () => {
      try {
        if (editingClient) {
          await db.updateClient(editingClient.id, clientData);
        } else {
          await db.createClient(clientData as Omit<Client, 'id'>);
        }
        loadClients();

        setShowClientModal(false);
        setEditingClient(null);
        setSelectedClient(null);
        setIsEditing(false);
      } catch (error) {
        console.error('Error saving client:', error);
        alert('حدث خطأ أثناء حفظ بيانات العميل');
      }
    };
    
    saveClientAsync();
  };

  const handleCloseModal = () => {
    setShowClientModal(false);
    setSelectedClient(null);
    setEditingClient(null);
    setIsEditing(false);
  };

  const handleCreateMeeting = (client: Client) => {
    setMeetingClient(client);
    setShowMeetingModal(true);
  };

  const handleCloseMeetingModal = () => {
    setShowMeetingModal(false);
    setMeetingClient(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة العملاء</h1>
          <p className="text-muted-foreground">إدارة بيانات العملاء الفعليين والمعلومات المرتبطة بهم</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          {hasPermission('clients', 'create') && (
            <Button onClick={handleCreateClient}>
              <Plus className="h-5 w-5" />
              إضافة عميل جديد
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
              placeholder="البحث عن عميل"
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
              {clientStatuses.map((status) => (
                <option key={status} value={status}>{clientStatusLabel(status)}</option>
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

      {/* النبرةُ من `messageTone` كبقيّة الشاشات: كانت `info` دائماً،
          فـ«تعذّر التنفيذ» يُعرض أزرق كالنجاح. */}
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

      {(hasPermission('clients', 'update') || hasPermission('clients', 'delete')) && (
        <SelectionBar
          count={selection.count}
          onClear={selection.clear}
          onAction={runBulk}
          busy={busy}
          showRestore={archiveView === 'archived'}
          deleteWarning="وتسقط معه قضاياه — فهي مرتبطةٌ به في القاعدة."
          noun="عميلاً"
        />
      )}

      {/* الإحصاء على الحاضرين: المؤرشفُ خرج من القائمة، فعدُّه فيها يناقضها. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">إجمالي العملاء</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground"><bdi>{formatNumber(present.length)}</bdi></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">العملاء الحاليين</p>
          <p className="text-xl sm:text-2xl font-bold text-success">
            <bdi>{formatNumber(present.filter(c => c.status === 'current').length)}</bdi>
          </p>
        </Card>
        {/* البطاقتان تتبعان «تكوين النظام»: كان النوعان مكتوبَين هنا،
            و`clientTypes` قائمةٌ يحرّرها المسؤول — فترتيبٌ يتبدّل أو نوعٌ
            يُعاد تسميتُه يترك بطاقةً على صفرٍ بلا سبب ظاهر. */}
        {clientTypes.slice(0, 2).map((type) => (
          <Card key={type} className="p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">{clientTypeLabel(type)}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              <bdi>{formatNumber(present.filter(c => c.clientType === type).length)}</bdi>
            </p>
          </Card>
        ))}
      </div>

      {/* البطاقات — تُري الواحد */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onViewDetails={handleViewDetails}
              onEdit={handleEditClient}
              onCreateMeeting={handleCreateMeeting}
              canEdit={hasPermission('clients', 'update')}
              selected={selection.has(client.id)}
              onSelect={() => selection.toggle(client.id)}
            />
          ))}
        </div>
      )}

      {/* والصفوف — تُري الجملة */}
      {viewMode === 'rows' && filteredClients.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <RowCheckbox
                      checked={selection.allChosen}
                      indeterminate={selection.someChosen}
                      onChange={selection.toggleAll}
                      label="حدّد كلَّ المعروض"
                    />
                  </TableHead>
                  <TableHead>العميل</TableHead>
                  <TableHead className="hidden md:table-cell">رقم الهوية</TableHead>
                  <TableHead className="hidden sm:table-cell">الجوال</TableHead>
                  <TableHead className="hidden lg:table-cell">عميل منذ</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>‏</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow
                    key={client.id}
                    className={selection.has(client.id) ? 'bg-primary-soft' : undefined}
                  >
                    <TableCell>
                      <RowCheckbox
                        checked={selection.has(client.id)}
                        onChange={() => selection.toggle(client.id)}
                        label={`حدّد ${client.fullName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ProfileAvatar src={client.profilePicture} name={client.fullName} size="sm" />
                        <div className="min-w-0">
                          <Button
                            onClick={() => handleViewDetails(client)}
                            className="justify-start text-start"
                            variant="link"
                          >
                            {client.fullName}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            {clientTypeLabel(client.clientType)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      <bdi>{client.idNumber || '—'}</bdi>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      <bdi>{client.phone ? formatPhone(client.phone) : '—'}</bdi>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      <bdi>{formatDate(client.joinDate)}</bdi>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={client.status === 'current' ? 'success' : 'default'}>
                          {clientStatusLabel(client.status)}
                        </Badge>
                        {client.archivedAt && (
                          <Badge variant="default">
                            <Archive aria-hidden="true" />
                            مؤرشف
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {hasPermission('clients', 'update') && (
                          <button
                            onClick={() => handleEditClient(client)}
                            className="text-primary hover:text-primary-strong text-sm"
                          >
                            تعديل
                          </button>
                        )}
                        <button
                          onClick={() => handleViewDetails(client)}
                          className="text-muted-foreground hover:text-foreground text-sm inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          الملفّ
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {archiveView === 'archived'
              ? 'لا مؤرشفين. ما يُؤرشف يظهر هنا ويُرجع منه.'
              : 'لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.'}
          </p>
        </div>
      )}

      {/* Client Modal */}
      {showClientModal && (
        <ClientModal
          client={selectedClient || editingClient || undefined}
          onClose={handleCloseModal}
          onSave={handleSaveClient}
          isEditing={isEditing}
        />
      )}

      {/* Zoom Meeting Modal */}
      {showMeetingModal && meetingClient && (
        <ZoomMeetingModal
          client={meetingClient}
          onClose={handleCloseMeetingModal}
        />
      )}
    </div>
  );
}