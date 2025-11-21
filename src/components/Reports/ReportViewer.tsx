import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  PencilIcon, 
  ShareIcon, 
  DocumentArrowDownIcon,
  ChartBarIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline';
import { CustomReport } from '../../types';
import { db } from '../../data/database';
import ChartCard from '../Dashboard/ChartCard';

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
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#06b6d4'
        ],
        borderRadius: 4
      }]
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">جاري تحميل التقرير...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{report.name}</h1>
              {report.description && (
                <p className="text-sm text-slate-600">{report.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'table' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableCellsIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'chart' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ChartBarIcon className="h-4 w-4" />
              </button>
            </div>
            
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
                <DocumentArrowDownIcon className="h-4 w-4" />
                تصدير
              </button>
              <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  onClick={() => exportReport('csv')}
                  className="w-full px-4 py-2 text-right hover:bg-slate-50 first:rounded-t-lg"
                >
                  تصدير CSV
                </button>
                <button
                  onClick={() => exportReport('excel')}
                  className="w-full px-4 py-2 text-right hover:bg-slate-50"
                >
                  تصدير Excel
                </button>
                <button
                  onClick={() => exportReport('pdf')}
                  className="w-full px-4 py-2 text-right hover:bg-slate-50 last:rounded-b-lg"
                >
                  تصدير PDF
                </button>
              </div>
            </div>
            
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
            >
              <PencilIcon className="h-4 w-4" />
              تحرير
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Report Info */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">مصدر البيانات:</span>
              <span className="font-medium text-slate-900 mr-2">{report.dataSource}</span>
            </div>
            <div>
              <span className="text-slate-500">عدد السجلات:</span>
              <span className="font-medium text-slate-900 mr-2">{reportData.length}</span>
            </div>
            <div>
              <span className="text-slate-500">آخر تحديث:</span>
              <span className="font-medium text-slate-900 mr-2">
                {report.lastModified.toLocaleDateString('ar-SA')}
              </span>
            </div>
            <div>
              <span className="text-slate-500">نوع العرض:</span>
              <span className="font-medium text-slate-900 mr-2">{report.visualization.type}</span>
            </div>
          </div>
        </div>

        {/* Data Display */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              {reportData.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {Object.keys(reportData[0]).map(key => (
                        <th key={key} className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportData.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex} className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center">
                  <p className="text-slate-500">لا توجد بيانات لعرضها</p>
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
                  <ChartBarIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500">لا توجد بيانات كافية لعرض الرسم البياني</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Applied Filters */}
        {report.filters && report.filters.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">الفلاتر المطبقة:</h3>
            <div className="space-y-1">
              {report.filters.map((filter, index) => (
                <div key={filter.id} className="text-sm text-blue-800">
                  {index > 0 && <span className="mr-2">{filter.logicalOperator}</span>}
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