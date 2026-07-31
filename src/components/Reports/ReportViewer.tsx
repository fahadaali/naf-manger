import React, { useState, useEffect } from 'react';
import { ChartColumn, FileOutput, Pencil, Share2, Table2, X } from 'lucide-react';
import { chartPalette } from '../../lib/chart-tokens';
import { CustomReport } from '../../types';
import { db } from '../../data/database';
import ChartCard from '../Dashboard/ChartCard';
import { formatDate, formatDateTime, formatTime } from '@/registry/naf/lib/format';

interface ReportViewerProps {
  report: CustomReport;
  onClose: () => void;
  onEdit: () => void;
}

export default function ReportViewer({ report, onClose, onEdit }: ReportViewerProps) {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  useEffect(() => {
    generateReportData();
  }, [report]);

  const generateReportData = async () => {
    setLoading(true);
    try {
      // Generate actual report data based on the report configuration
      const data = await db.generateReportData(report);
      setReportData(data);
    } catch (error) {
      console.error('Error generating report data:', error);
      // Fallback to sample data
      setReportData([
        { id: 1, name: 'عينة بيانات 1', value: 100, date: '2024-01-01' },
        { id: 2, name: 'عينة بيانات 2', value: 200, date: '2024-01-02' },
        { id: 3, name: 'عينة بيانات 3', value: 150, date: '2024-01-03' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format: 'csv' | 'pdf' | 'excel') => {
    // Implementation for exporting report data
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.name}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getChartData = () => {
    if (!reportData.length) return null;

    // Convert report data to chart format
    const labels = reportData.map(item => item.name || item.id);
    const values = reportData.map(item => item.value || 0);

    return {
      labels,
      datasets: [{
        label: report.name,
        data: values,
        // ستّ درجات كانت مكتوبةً بيدها، والمسجَّل خمس. اللوحة تدور على
        // الخمس بدل اختراع سادسة تقارب إحداها فتُبطل التمييز الذي وُضعت له.
        backgroundColor: chartPalette(values.length),
        borderRadius: 4
      }]
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جارٍ تحميل التقرير...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">{report.name}</h1>
              {report.description && (
                <p className="text-sm text-muted-foreground">{report.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'table' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Table2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'chart' 
                    ? 'bg-card text-foreground shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ChartColumn className="h-4 w-4" />
              </button>
            </div>
            
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 text-muted-foreground border border-border rounded-lg hover:bg-muted">
                <FileOutput className="h-4 w-4" />
                تصدير
              </button>
              <div className="absolute end-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => exportReport('csv')}
                  className="w-full px-4 py-2 text-start hover:bg-muted first:rounded-t-lg"
                >
                  تصدير CSV
                </button>
                <button
                  onClick={() => exportReport('excel')}
                  className="w-full px-4 py-2 text-start hover:bg-muted"
                >
                  تصدير Excel
                </button>
                <button
                  onClick={() => exportReport('pdf')}
                  className="w-full px-4 py-2 text-start hover:bg-muted last:rounded-b-lg"
                >
                  تصدير PDF
                </button>
              </div>
            </div>
            
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary-soft"
            >
              <Pencil className="h-4 w-4" />
              تعديل
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Report Info */}
        <div className="bg-card rounded-lg border border-border p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">مصدر البيانات:</span>
              <span className="font-medium text-foreground ms-2">{report.dataSource}</span>
            </div>
            <div>
              <span className="text-muted-foreground">عدد السجلات:</span>
              <span className="font-medium text-foreground ms-2">{reportData.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">آخر تحديث:</span>
              <span className="font-medium text-foreground ms-2">
                <bdi>{formatDate(report.lastModified)}</bdi>
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">نوع العرض:</span>
              <span className="font-medium text-foreground ms-2">{report.visualization.type}</span>
            </div>
          </div>
        </div>

        {/* Data Display */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              {reportData.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      {Object.keys(reportData[0]).map(key => (
                        <th key={key} className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.map((row, index) => (
                      <tr key={index} className="hover:bg-muted">
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-muted-foreground">لا نتائج تطابق شروط التقرير. وسّع المدى أو امسح الشروط.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              {getChartData() ? (
                <ChartCard
                  title={report.name}
                  type={report.visualization.type === 'bar' ? 'bar' : 'doughnut'}
                  data={getChartData()!}
                />
              ) : (
                <div className="text-center py-12">
                  <ChartColumn className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">يظهر الرسم بعد أول مجموعة مكتملة من البيانات.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Applied Filters */}
        {report.filters && report.filters.length > 0 && (
          <div className="mt-6 bg-primary-soft border border-primary/30 rounded-lg p-4">
            <h3 className="font-medium text-primary-strong mb-2">الفلاتر المطبقة:</h3>
            <div className="space-y-1">
              {report.filters.map((filter, index) => (
                <div key={filter.id} className="text-sm text-primary-strong">
                  {index > 0 && <span className="ms-2">{filter.logicalOperator}</span>}
                  <span className="font-medium">{filter.fieldId}</span>
                  <span className="mx-2">{filter.operator}</span>
                  <span className="font-medium">{filter.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}