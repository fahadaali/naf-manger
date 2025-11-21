import React, { useState, useEffect } from 'react';
import { 
  DocumentChartBarIcon, 
  PlusIcon, 
  FunnelIcon,
  ChartBarIcon,
  TableCellsIcon,
  ShareIcon,
  CalendarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { CustomReport } from '../../types';
import ReportBuilder from './ReportBuilder';
import ReportViewer from './ReportViewer';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';

export default function ReportsView() {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingReport, setEditingReport] = useState<CustomReport | null>(null);
  const [viewingReport, setViewingReport] = useState<CustomReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const { user, hasPermission } = useAuth();

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = () => {
    const allReports = db.getCustomReports();
    setReports(allReports);
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || 
                           (filterCategory === 'my' && report.createdBy === user?.id) ||
                           (filterCategory === 'public' && report.isPublic) ||
                           (filterCategory === 'templates' && report.isTemplate);
    
    return matchesSearch && matchesCategory;
  });

  const handleCreateReport = () => {
    setEditingReport(null);
    setShowBuilder(true);
  };

  const handleEditReport = (report: CustomReport) => {
    setEditingReport(report);
    setShowBuilder(true);
  };

  const handleViewReport = (report: CustomReport) => {
    setViewingReport(report);
  };

  const handleSaveReport = (reportData: Partial<CustomReport>) => {
    try {
      if (editingReport) {
        db.updateCustomReport(editingReport.id, reportData);
      } else {
        db.createCustomReport(reportData as Omit<CustomReport, 'id'>);
      }
      loadReports();
      setShowBuilder(false);
      setEditingReport(null);
    } catch (error) {
      console.error('Error saving report:', error);
      alert('حدث خطأ أثناء حفظ التقرير');
    }
  };

  const handleDeleteReport = (reportId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا التقرير؟')) {
      db.deleteCustomReport(reportId);
      loadReports();
    }
  };

  const handleCloseBuilder = () => {
    setShowBuilder(false);
    setEditingReport(null);
  };

  const handleCloseViewer = () => {
    setViewingReport(null);
  };

  const getReportIcon = (visualization: string) => {
    switch (visualization) {
      case 'table': return TableCellsIcon;
      case 'bar':
      case 'line':
      case 'area': return ChartBarIcon;
      default: return DocumentChartBarIcon;
    }
  };

  if (showBuilder) {
    return (
      <ReportBuilder
        report={editingReport}
        onSave={handleSaveReport}
        onClose={handleCloseBuilder}
      />
    );
  }

  if (viewingReport) {
    return (
      <ReportViewer
        report={viewingReport}
        onClose={handleCloseViewer}
        onEdit={() => handleEditReport(viewingReport)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">التقارير المخصصة</h1>
            <p className="text-blue-100">إنشاء وإدارة التقارير المخصصة والتحليلات المتقدمة</p>
          </div>
          {hasPermission('analytics', 'read') && (
            <button
              onClick={handleCreateReport}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 flex items-center gap-2 font-medium"
            >
              <PlusIcon className="h-5 w-5" />
              إنشاء تقرير جديد
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="البحث في التقارير..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">جميع التقارير</option>
            <option value="my">تقاريري</option>
            <option value="public">التقارير العامة</option>
            <option value="templates">القوالب</option>
          </select>
        </div>
      </div>

      {/* Quick Templates */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">قوالب سريعة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'تقرير الأداء الشهري', description: 'إحصائيات شاملة للشهر الحالي', icon: ChartBarIcon },
            { name: 'تقرير القضايا حسب النوع', description: 'تحليل القضايا مجمعة حسب النوع', icon: DocumentChartBarIcon },
            { name: 'تقرير العملاء المحتملين', description: 'حالة وتطور العملاء المحتملين', icon: TableCellsIcon },
            { name: 'تقرير الإيرادات', description: 'تحليل الإيرادات والنمو المالي', icon: ChartBarIcon }
          ].map((template, index) => (
            <button
              key={index}
              onClick={() => {/* Create from template */}}
              className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-right"
            >
              <template.icon className="h-8 w-8 text-blue-600 mb-2" />
              <h4 className="font-medium text-slate-900 mb-1">{template.name}</h4>
              <p className="text-sm text-slate-600">{template.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">التقارير المحفوظة</h3>
        </div>
        
        {filteredReports.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {filteredReports.map((report) => {
              const IconComponent = getReportIcon(report.visualization.type);
              return (
                <div key={report.id} className="p-6 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <IconComponent className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900 mb-1">{report.name}</h4>
                        {report.description && (
                          <p className="text-sm text-slate-600 mb-2">{report.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>مصدر البيانات: {report.dataSource}</span>
                          <span>آخر تعديل: {report.lastModified.toLocaleDateString('ar-SA')}</span>
                          {report.isTemplate && (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">قالب</span>
                          )}
                          {report.isPublic && (
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">عام</span>
                          )}
                          {report.schedule?.enabled && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full flex items-center gap-1">
                              <CalendarIcon className="h-3 w-3" />
                              مجدول
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewReport(report)}
                        className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="عرض التقرير"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {(report.createdBy === user?.id || hasPermission('analytics', 'read')) && (
                        <>
                          <button
                            onClick={() => handleEditReport(report)}
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="تحرير التقرير"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {/* Share report */}}
                            className="p-2 text-slate-600 hover:text-green-600 hover:bg-green-50 rounded-lg"
                            title="مشاركة التقرير"
                          >
                            <ShareIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title="حذف التقرير"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <DocumentChartBarIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">لا توجد تقارير</h3>
            <p className="text-slate-600 mb-4">ابدأ بإنشاء تقرير مخصص أو استخدم أحد القوالب السريعة</p>
            <button
              onClick={handleCreateReport}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              إنشاء تقرير جديد
            </button>
          </div>
        )}
      </div>
    </div>
  );
}