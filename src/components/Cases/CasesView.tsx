import React, { useState, useEffect } from 'react';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Case } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import CaseModal from './CaseModal';
import { db } from '../../data/database';

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
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in-progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'postponed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
          <h1 className="text-2xl font-bold text-slate-900">إدارة القضايا</h1>
          <p className="text-slate-600">إدارة القضايا والأعمال القانونية</p>
        </div>
        {hasPermission('cases', 'create') && (
          <button 
            onClick={handleCreateCase}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            إضافة قضية جديدة
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
              placeholder="البحث في القضايا..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-xs sm:text-sm text-slate-600">إجمالي القضايا</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{cases.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-xs sm:text-sm text-slate-600">قيد المعالجة</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">
            {activeCases.filter(c => c.status === 'in-progress').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-xs sm:text-sm text-slate-600">المكتملة</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">
            {completedCases.length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-xs sm:text-sm text-slate-600">معدل الربح</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600">{winRate}%</p>
        </div>
      </div>

      {/* Active Cases Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">القضايا النشطة</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  رقم القضية
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                  النوع
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  العميل
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                  الملخص
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  الحالة
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                  تاريخ الإنشاء
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredActiveCases.map((case_) => (
                <tr key={case_.id} className="hover:bg-slate-50">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => handleViewCase(case_)}
                      className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {case_.caseNumber}
                    </button>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                    <div className="text-xs sm:text-sm text-slate-900">{case_.caseType}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm text-slate-900 truncate max-w-32">{case_.clientName}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 hidden md:table-cell">
                    <div className="text-xs sm:text-sm text-slate-900 line-clamp-2">{case_.summary}</div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(case_.status)}`}>
                      {getStatusLabel(case_.status)}
                    </span>
                    {case_.outcome && (
                      <div className="text-xs text-slate-500 mt-1 hidden sm:block">
                        {getOutcomeLabel(case_.outcome)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-slate-500 hidden lg:table-cell">
                    {format(case_.createdDate, 'dd/MM/yyyy')}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                    <div className="flex gap-2">
                      {hasPermission('cases', 'update') && (
                        <button 
                          onClick={() => handleEditCase(case_)}
                          className="text-blue-600 hover:text-blue-900 text-xs sm:text-sm"
                        >
                          تحرير
                        </button>
                      )}
                      {case_.basecampUrl && (
                        <a
                          href={case_.basecampUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-white bg-yellow-500 hover:bg-yellow-600 px-1 sm:px-2 py-1 rounded text-xs font-medium transition-colors"
                          title="فتح في Basecamp"
                        >
                          <svg className="w-2 h-2 sm:w-3 sm:h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                          </svg>
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
          <p className="text-slate-500">لا توجد قضايا نشطة مطابقة لمعايير البحث</p>
        </div>
      )}

      {/* Completed Cases Section */}
      {completedCases.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowCompletedCases(!showCompletedCases)}
            className="w-full px-6 py-4 border-b border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-900">منتهية</h3>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-medium">
                {completedCases.length}
              </span>
            </div>
            <div className={`transform transition-transform ${showCompletedCases ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          
          {showCompletedCases && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      رقم القضية
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      النوع
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      العميل
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      الملخص
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      النتيجة
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      تاريخ الإنجاز
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCompletedCases.map((case_) => (
                    <tr key={case_.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => handleViewCase(case_)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {case_.caseNumber}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{case_.caseType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{case_.clientName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900 line-clamp-2">{case_.summary}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {case_.outcome && (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            case_.outcome === 'won' ? 'bg-green-100 text-green-800' :
                            case_.outcome === 'lost' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {getOutcomeLabel(case_.outcome)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {format(case_.updatedDate, 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          {hasPermission('cases', 'update') && (
                            <button 
                              onClick={() => handleEditCase(case_)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              تحرير
                            </button>
                          )}
                          {case_.basecampUrl && (
                            <a
                              href={case_.basecampUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-white bg-yellow-500 hover:bg-yellow-600 px-2 py-1 rounded text-xs font-medium transition-colors"
                              title="فتح في Basecamp"
                            >
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                              </svg>
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
              <p className="text-slate-500">لا توجد قضايا مكتملة مطابقة لمعايير البحث</p>
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