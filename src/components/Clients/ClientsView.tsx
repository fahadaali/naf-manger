import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { Client } from '../../types';
import ClientCard from './ClientCard';
import ClientModal from './ClientModal';
import ZoomMeetingModal from '../Meetings/ZoomMeetingModal';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import { formatNumber } from '@/registry/naf/lib/format';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';

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
  const { hasPermission } = useAuth();

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
    
    return matchesSearch && matchesType && matchesStatus;
  });

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

  const handleMeetingCreated = (meetingData: any) => {
    console.log('Meeting created:', meetingData);
    // يمكن إضافة منطق إضافي هنا مثل تحديث قاعدة البيانات
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة العملاء</h1>
          <p className="text-muted-foreground">إدارة بيانات العملاء الفعليين والمعلومات المرتبطة بهم</p>
        </div>
        {hasPermission('clients', 'create') && (
          <Button onClick={handleCreateClient}>
            <Plus className="h-5 w-5" />
            إضافة عميل جديد
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
              <option value="current">حالي</option>
              <option value="former">سابق</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">إجمالي العملاء</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground"><bdi>{formatNumber(clients.length)}</bdi></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">العملاء الحاليين</p>
          <p className="text-xl sm:text-2xl font-bold text-success">
            <bdi>{formatNumber(clients.filter(c => c.status === 'current').length)}</bdi>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">الشركات</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            <bdi>{formatNumber(clients.filter(c => c.clientType === 'company').length)}</bdi>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">الأفراد</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">
            <bdi>{formatNumber(clients.filter(c => c.clientType === 'individual').length)}</bdi>
          </p>
        </Card>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onViewDetails={handleViewDetails}
            onEdit={handleEditClient}
            onCreateMeeting={handleCreateMeeting}
            canEdit={hasPermission('clients', 'update')}
          />
        ))}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.</p>
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
          onMeetingCreated={handleMeetingCreated}
        />
      )}
    </div>
  );
}