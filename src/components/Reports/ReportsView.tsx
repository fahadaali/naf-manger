import { useState, useEffect } from 'react';
import { Calendar, ChartColumn, Eye, Funnel, Pencil, Plus, Share2, Table2, Trash2 } from 'lucide-react';
import { CustomReport } from '../../types';
import ReportBuilder from './ReportBuilder';
import ReportViewer from './ReportViewer';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import { formatDate } from '@/registry/naf/lib/format';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Card } from '@/registry/naf/ui/card';

export default function ReportsView() {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingReport, setEditingReport] = useState<CustomReport | null>(null);
  const [viewingReport, setViewingReport] = useState<CustomReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const { user, hasPermission } = useAuth();

  useEffect(() => {
    loadReports().catch((error) => console.error('تعذّر جلب التقارير:', error));
  }, []);

  const loadReports = async () => {
    setReports(await db.getCustomReports());
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

  const handleSaveReport = async (reportData: Partial<CustomReport>) => {
    try {
      if (editingReport) {
        await db.updateCustomReport(editingReport.id, reportData);
      } else {
        await db.createCustomReport(reportData);
      }
      await loadReports();
      setShowBuilder(false);
      setEditingReport(null);
    } catch (error) {
      console.error('Error saving report:', error);
      alert('تعذّر حفظ التقرير');
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التقرير؟')) return;
    try {
      await db.deleteCustomReport(reportId);
      await loadReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('تعذّر حذف التقرير');
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
      case 'table': return Table2;
      case 'bar':
      case 'line':
      case 'area': return ChartColumn;
      default: return ChartColumn;
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
      <div className="bg-surface-deep text-surface-deep-foreground rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">التقارير المخصصة</h1>
            <p className="text-surface-deep-muted">إنشاء وإدارة التقارير المخصصة والتحليلات المتقدمة</p>
          </div>
          {hasPermission('analytics', 'read') && (
            <Button onClick={handleCreateReport} className="text-primary" variant="outline">
              <Plus className="h-5 w-5" />
              إنشاء تقرير جديد
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Funnel className="absolute end-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="البحث في التقارير"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="pe-10 ps-4"
            />
          </div>
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">جميع التقارير</option>
            <option value="my">تقاريري</option>
            <option value="public">التقارير العامة</option>
            <option value="templates">القوالب</option>
          </Select>
        </div>
      </Card>

      {/* Quick Templates */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">قوالب سريعة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'تقرير الأداء الشهري', description: 'إحصائيات شاملة للشهر الحالي', icon: ChartColumn },
            { name: 'تقرير القضايا حسب النوع', description: 'تحليل القضايا مجمعة حسب النوع', icon: ChartColumn },
            { name: 'تقرير العملاء المحتملين', description: 'حالة وتطور العملاء المحتملين', icon: Table2 },
            { name: 'تقرير الإيرادات', description: 'تحليل الإيرادات والنمو المالي', icon: ChartColumn }
          ].map((template, index) => (
            <button
              key={index}
              onClick={() => {/* Create from template */}}
              className="p-4 border border-border rounded-lg hover:border-ring hover:bg-primary-soft transition-colors text-start"
            >
              <template.icon className="h-8 w-8 text-primary-strong mb-2" />
              <h4 className="font-medium text-foreground mb-1">{template.name}</h4>
              <p className="text-sm text-muted-foreground">{template.description}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Reports List */}
      <Card>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">التقارير المحفوظة</h3>
        </div>
        
        {filteredReports.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredReports.map((report) => {
              const IconComponent = getReportIcon(report.visualization.type);
              return (
                <div key={report.id} className="p-6 hover:bg-muted">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary-soft rounded-lg">
                        <IconComponent className="h-6 w-6 text-primary-strong" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground mb-1">{report.name}</h4>
                        {report.description && (
                          <p className="text-sm text-muted-foreground mb-2">{report.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>مصدر البيانات: {report.dataSource}</span>
                          <span>آخر تعديل: <bdi>{formatDate(report.lastModified)}</bdi></span>
                          {report.isTemplate && (
                            <span className="bg-success-soft text-success-strong px-2 py-1 rounded-full">قالب</span>
                          )}
                          {report.isPublic && (
                            <span className="bg-primary-soft text-primary-strong px-2 py-1 rounded-full">عام</span>
                          )}
                          {report.schedule?.enabled && (
                            <span className="bg-info-soft text-info-strong px-2 py-1 rounded-full flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              مجدول
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button onClick={() => handleViewReport(report)} title="عرض التقرير" variant="ghost" size="icon-md">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(report.createdBy === user?.id || hasPermission('analytics', 'read')) && (
                        <>
                          <Button onClick={() => handleEditReport(report)} title="تعديل التقرير" variant="ghost" size="icon-md">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button onClick={() => {/* Share report */}} title="مشاركة التقرير" variant="ghost" size="icon-md">
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button onClick={() => handleDeleteReport(report.id)} title="حذف التقرير" variant="ghost" size="icon-md">
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
            <ChartColumn className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">لم تُنشئ أي تقرير بعد. ابدأ بإنشاء أول تقرير.</h3>
            <p className="text-muted-foreground mb-4">ابدأ بإنشاء تقرير مخصص أو استخدم أحد القوالب السريعة</p>
            <Button onClick={handleCreateReport}>
              إنشاء تقرير جديد
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}