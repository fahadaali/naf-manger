import React, { useState, useEffect } from 'react';
import { ChevronDown, ExternalLink, Plus, Search } from 'lucide-react';
import { Case } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import CaseModal from './CaseModal';
import { db } from '../../data/database';
import { formatDate, formatPhone } from '@/registry/naf/lib/format';

export default function CasesView() {
  const [cases, setCases] = useState<Case[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [viewingCase, setViewingCase] = useState<Case | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { hasPermission } = useAuth();
  const [showCompletedCases, setShowCompletedCases] = useState(false);

  // تحميل القضايا عند تحميل المكون
  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = () => {
    const loadCasesAsync = async () => {
      try {
        // جلب القضايا مباشرة من Supabase
        setCases(await db.getCases());
      } catch (error) {
        console.error('Error loading cases:', error);
        setCases([]);
      }
    };
    
    loadCasesAsync();
  };

  // فصل القضايا المكتملة عن الباقي
  const activeCases = cases.filter(case_ => case_.status !== 'completed');
  const completedCases = cases.filter(case_ => case_.status === 'completed');

  const filteredActiveCases = activeCases.filter(case_ => {
    const matchesSearch = case_.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         case_.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         case_.summary.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || case_.status === filterStatus;
    const matchesType = filterType === 'all' || case_.caseType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const filteredCompletedCases = completedCases.filter(case_ => {
    const matchesSearch = case_.caseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         case_.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         case_.summary.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || filterStatus === 'completed';
    const matchesType = filterType === 'all' || case_.caseType === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleCreateCase = () => {
    setEditingCase(null);
    setViewingCase(null);
    setIsEditing(true);
    setShowCaseModal(true);
  };

  const handleEditCase = (case_: Case) => {
    setEditingCase(case_);
    setViewingCase(null);
    setIsEditing(true);
    setShowCaseModal(true);
  };

  const handleViewCase = (case_: Case) => {
    setViewingCase(case_);
    setEditingCase(null);
    setIsEditing(false);
    setShowCaseModal(true);
  };

  const handleSaveCase = (caseData: Partial<Case>) => {
    const saveCaseAsync = async () => {
      try {
        if (editingCase) {
          await db.updateCase(editingCase.id, caseData);
        } else {
          await db.createCase(caseData as Omit<Case, 'id'>);
        }
        loadCases();

        setShowCaseModal(false);
        setEditingCase(null);
        setViewingCase(null);
        setIsEditing(false);
      } catch (error) {
        console.error('Error saving case:', error);
        alert('حدث خطأ أثناء حفظ بيانات القضية');
      }
    };
    
    saveCaseAsync();
  };

  const handleCloseModal = () => {
    setShowCaseModal(false);
    setEditingCase(null);
    setViewingCase(null);
    setIsEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success-soft text-success-strong';
      case 'in-progress': return 'bg-primary-soft text-primary-strong';
      case 'pending': return 'bg-warning-soft text-warning-strong';
      case 'postponed': return 'bg-destructive-soft text-destructive-strong';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'مكتملة';
      case 'in-progress': return 'قيد المعالجة';
      case 'pending': return 'منظورة';
      case 'postponed': return 'مؤجلة';
      default: return status;
    }
  };

  const getOutcomeLabel = (outcome?: string) => {
    switch (outcome) {
      case 'won': return 'رابحة';
      case 'lost': return 'خاسرة';
      case 'settled': return 'تسوية';
      default: return '';
    }
  };

  const wonCases = completedCases.filter(c => c.outcome === 'won');
  const winRate = completedCases.length > 0 ? Math.round((wonCases.length / completedCases.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة القضايا</h1>
          <p className="text-muted-foreground">إدارة القضايا والأعمال القانونية</p>
        </div>
        {hasPermission('cases', 'create') && (
          <button 
            onClick={handleCreateCase}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            إضافة قضية جديدة
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-4">
        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="البحث في القضايا..."
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
              <option value="pending">منظورة</option>
              <option value="in-progress">قيد المعالجة</option>
              <option value="completed">مكتملة</option>
              <option value="postponed">مؤجلة</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring"
            >
              <option value="all">كل الأنواع</option>
              <option value="قضية تجارية">تجارية</option>
              <option value="قضية عمالية">عمالية</option>
              <option value="قضية مدنية">مدنية</option>
              <option value="قضية جزائية">جزائية</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">إجمالي القضايا</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{cases.length}</p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">قيد المعالجة</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {activeCases.filter(c => c.status === 'in-progress').length}
          </p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">المكتملة</p>
          <p className="text-xl sm:text-2xl font-bold text-success">
            {completedCases.length}
          </p>
        </div>
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">معدل الربح</p>
          <p className="text-xl sm:text-2xl font-bold text-warning">{winRate}%</p>
        </div>
      </div>

      {/* Active Cases Table */}
      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">القضايا النشطة</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                  رقم القضية
                </th>
                <th className="px-3 sm:px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell tabular-nums">
                  النوع
                </th>
                <th className="px-3 sm:px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                  العميل
                </th>
                <th className="px-3 sm:px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell tabular-nums">
                  الملخص
                </th>
                <th className="px-3 sm:px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                  الحالة
                </th>
                <th className="px-3 sm:px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell tabular-nums">
                  تاريخ الإنشاء
                </th>
                <th className="px-3 sm:px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredActiveCases.map((case_) => (
                <tr key={case_.id} className="hover:bg-muted">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap tabular-nums">
                    <button 
                      onClick={() => handleViewCase(case_)}
                      className="text-xs sm:text-sm font-medium text-primary hover:text-primary-strong hover:underline"
                    >
                      <bdi>{case_.caseNumber}</bdi>
                    </button>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell tabular-nums">
                    <div className="text-xs sm:text-sm text-foreground">{case_.caseType}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap tabular-nums">
                    <div className="text-xs sm:text-sm text-foreground truncate max-w-32">{case_.clientName}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 hidden md:table-cell tabular-nums">
                    <div className="text-xs sm:text-sm text-foreground line-clamp-2">{case_.summary}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap tabular-nums">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(case_.status)}`}>
                      {getStatusLabel(case_.status)}
                    </span>
                    {case_.outcome && (
                      <div className="text-xs text-muted-foreground mt-1 hidden sm:block">
                        {getOutcomeLabel(case_.outcome)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-muted-foreground hidden lg:table-cell tabular-nums">
                    {format(case_.createdDate, 'dd/MM/yyyy')}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium tabular-nums">
                    <div className="flex gap-2">
                      {hasPermission('cases', 'update') && (
                        <button 
                          onClick={() => handleEditCase(case_)}
                          className="text-primary hover:text-primary-strong text-xs sm:text-sm"
                        >
                          تعديل
                        </button>
                      )}
                      {case_.basecampUrl && (
                        <a
                          href={case_.basecampUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-warning-foreground bg-warning hover:bg-warning/90 px-1 sm:px-2 py-1 rounded text-xs font-medium transition-colors"
                          title="فتح في Basecamp"
                        >
                          <ExternalLink className="w-2 h-2 sm:w-3 sm:h-3" aria-hidden="true" />
                          <span className="hidden sm:inline">Basecamp</span>
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredActiveCases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.</p>
        </div>
      )}

      {/* Completed Cases Section */}
      {completedCases.length > 0 && (
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <button
            onClick={() => setShowCompletedCases(!showCompletedCases)}
            className="w-full px-6 py-4 border-b border-border flex items-center justify-between hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground">منتهية</h3>
              <span className="bg-success-soft text-success-strong px-2 py-1 rounded-full text-sm font-medium">
                {completedCases.length}
              </span>
            </div>
            <div className={`transform transition-transform ${showCompletedCases ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            </div>
          </button>
          
          {showCompletedCases && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                      رقم القضية
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                      النوع
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                      العميل
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                      الملخص
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                      النتيجة
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                      تاريخ الإنجاز
                    </th>
                    <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider tabular-nums">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCompletedCases.map((case_) => (
                    <tr key={case_.id} className="hover:bg-muted">
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums">
                        <button 
                          onClick={() => handleViewCase(case_)}
                          className="text-sm font-medium text-primary hover:text-primary-strong hover:underline"
                        >
                          <bdi>{case_.caseNumber}</bdi>
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums">
                        <div className="text-sm text-foreground">{case_.caseType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums">
                        <div className="text-sm text-foreground">{case_.clientName}</div>
                      </td>
                      <td className="px-6 py-4 tabular-nums">
                        <div className="text-sm text-foreground line-clamp-2">{case_.summary}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums">
                        {case_.outcome && (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            case_.outcome === 'won' ? 'bg-success-soft text-success-strong' :
                            case_.outcome === 'lost' ? 'bg-destructive-soft text-destructive-strong' :
                            'bg-warning-soft text-warning-strong'
                          }`}>
                            {getOutcomeLabel(case_.outcome)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                        {format(case_.updatedDate, 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium tabular-nums">
                        <div className="flex gap-2">
                          {hasPermission('cases', 'update') && (
                            <button 
                              onClick={() => handleEditCase(case_)}
                              className="text-primary hover:text-primary-strong"
                            >
                              تعديل
                            </button>
                          )}
                          {case_.basecampUrl && (
                            <a
                              href={case_.basecampUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-warning-foreground bg-warning hover:bg-warning/90 px-2 py-1 rounded text-xs font-medium transition-colors"
                              title="فتح في Basecamp"
                            >
                              <ExternalLink className="w-3 h-3" aria-hidden="true" />
                              Basecamp
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {showCompletedCases && filteredCompletedCases.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.</p>
            </div>
          )}
        </div>
      )}

      {/* Case Modal */}
      {showCaseModal && (
        <CaseModal
          case={viewingCase || editingCase || undefined}
          onClose={handleCloseModal}
          onSave={handleSaveCase}
          isEditing={isEditing}
        />
      )}
    </div>
  );
}