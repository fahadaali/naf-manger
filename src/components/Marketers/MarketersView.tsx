import React, { useState, useEffect } from 'react';
import { PlusIcon, MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { Marketer, MarketerStats } from '../../types';
import MarketerCard from './MarketerCard';
import MarketerModal from './MarketerModal';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';

export default function MarketersView() {
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [selectedMarketer, setSelectedMarketer] = useState<Marketer | null>(null);
  const [showMarketerModal, setShowMarketerModal] = useState(false);
  const [editingMarketer, setEditingMarketer] = useState<Marketer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const { hasPermission } = useAuth();

  useEffect(() => {
    loadMarketers();
  }, []);

  const loadMarketers = () => {
    const loadMarketersAsync = async () => {
      try {
        // جلب المسوّقين مباشرة من Supabase
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
        alert('حدث خطأ أثناء حفظ بيانات المسوّق');
      }
    };
    
    saveMarketerAsync();
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
            <div className="p-3 bg-card bg-opacity-20 rounded-full">
              <UserGroupIcon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">إدارة المسوّقين</h1>
              <p className="text-surface-deep-muted">إدارة المسوّقين وتتبع أدائهم والعمولات المستحقة لهم</p>
            </div>
          </div>
          {hasPermission('marketers', 'create') && (
            <button 
              onClick={handleCreateMarketer}
              className="bg-card text-info px-4 py-2 rounded-lg hover:bg-info-soft flex items-center gap-2 font-medium shadow-lg"
            >
              <PlusIcon className="h-5 w-5" />
              إضافة مسوّق جديد
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute end-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="البحث عن مسوّق..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pe-10 ps-4 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="suspended">موقوف</option>
              <option value="former">سابق</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
            >
              <option value="all">كل الأنواع</option>
              <option value="employee">موظف</option>
              <option value="freelancer">مستقل</option>
              <option value="external_company">شركة خارجية</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">إجمالي المسوّقين</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{marketers.length}</p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">النشطين</p>
          <p className="text-xl sm:text-2xl font-bold text-success">
            {marketers.filter(m => m.status === 'active').length}
          </p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">الموظفين</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {marketers.filter(m => m.relationshipType === 'employee').length}
          </p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">المستقلين</p>
          <p className="text-xl sm:text-2xl font-bold text-info">
            {marketers.filter(m => m.relationshipType === 'freelancer').length}
          </p>
        </div>
      </div>

      {/* Marketers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredMarketers.map((marketer) => (
          <MarketerCard
            key={marketer.id}
            marketer={marketer}
            onViewDetails={handleViewDetails}
            onEdit={handleEditMarketer}
            canEdit={hasPermission('marketers', 'update')}
          />
        ))}
      </div>

      {filteredMarketers.length === 0 && (
        <div className="text-center py-12">
          <UserGroupIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">لا توجد مسوّقين مطابقين لمعايير البحث</p>
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