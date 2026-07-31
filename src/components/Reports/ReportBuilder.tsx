import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  PlusIcon, 
  TrashIcon,
  ChartBarIcon,
  TableCellsIcon,
  EyeIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import { CustomReport, ReportField, ReportFilter, ReportVisualization } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

interface ReportBuilderProps {
  report?: CustomReport | null;
  onSave: (report: Partial<CustomReport>) => void;
  onClose: () => void;
}

export default function ReportBuilder({ report, onSave, onClose }: ReportBuilderProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [reportData, setReportData] = useState<Partial<CustomReport>>({
    name: report?.name || '',
    description: report?.description || '',
    dataSource: report?.dataSource || 'clients',
    fields: report?.fields || [],
    filters: report?.filters || [],
    grouping: report?.grouping || [],
    aggregations: report?.aggregations || [],
    visualization: report?.visualization || { type: 'table' },
    isTemplate: report?.isTemplate || false,
    isPublic: report?.isPublic || false,
    createdBy: report?.createdBy || user?.id || '',
    createdDate: report?.createdDate || new Date(),
    lastModified: new Date()
  });

  const [availableFields, setAvailableFields] = useState<ReportField[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Define available fields based on data source
  const fieldDefinitions: Record<string, ReportField[]> = {
    clients: [
      { id: 'fullName', name: 'الاسم الكامل', type: 'text', source: 'clients' },
      { id: 'clientType', name: 'نوع العميل', type: 'select', source: 'clients', options: ['individual', 'company', 'association', 'government'] },
      { id: 'status', name: 'الحالة', type: 'select', source: 'clients', options: ['current', 'former'] },
      { id: 'joinDate', name: 'تاريخ الانضمام', type: 'date', source: 'clients' },
      { id: 'email', name: 'البريد الإلكتروني', type: 'text', source: 'clients' },
      { id: 'phone', name: 'رقم الجوال', type: 'text', source: 'clients' }
    ],
    prospects: [
      { id: 'fullName', name: 'الاسم الكامل', type: 'text', source: 'prospects' },
      { id: 'prospectStatus', name: 'حالة العميل المحتمل', type: 'text', source: 'prospects' },
      { id: 'expectedValue', name: 'القيمة المتوقعة', type: 'number', source: 'prospects', aggregatable: true },
      { id: 'source', name: 'المصدر', type: 'text', source: 'prospects' },
      { id: 'joinDate', name: 'تاريخ الإضافة', type: 'date', source: 'prospects' },
      { id: 'followUpDate', name: 'موعد المتابعة', type: 'date', source: 'prospects' }
    ],
    cases: [
      { id: 'caseNumber', name: 'رقم القضية', type: 'text', source: 'cases' },
      { id: 'caseType', name: 'نوع القضية', type: 'text', source: 'cases' },
      { id: 'status', name: 'الحالة', type: 'select', source: 'cases', options: ['pending', 'in-progress', 'completed', 'postponed'] },
      { id: 'outcome', name: 'النتيجة', type: 'select', source: 'cases', options: ['won', 'lost', 'settled'] },
      { id: 'clientName', name: 'اسم العميل', type: 'text', source: 'cases' },
      { id: 'createdDate', name: 'تاريخ الإنشاء', type: 'date', source: 'cases' },
      { id: 'updatedDate', name: 'تاريخ التحديث', type: 'date', source: 'cases' }
    ]
  };

  useEffect(() => {
    if (reportData.dataSource) {
      setAvailableFields(fieldDefinitions[reportData.dataSource] || []);
    }
  }, [reportData.dataSource]);

  const handleDataSourceChange = (dataSource: string) => {
    setReportData(prev => ({
      ...prev,
      dataSource: dataSource as any,
      fields: [],
      filters: [],
      grouping: [],
      aggregations: []
    }));
  };

  const handleFieldToggle = (fieldId: string) => {
    setReportData(prev => ({
      ...prev,
      fields: prev.fields?.includes(fieldId) 
        ? prev.fields.filter(f => f !== fieldId)
        : [...(prev.fields || []), fieldId]
    }));
  };

  const handleAddFilter = () => {
    const newFilter: ReportFilter = {
      id: Date.now().toString(),
      fieldId: availableFields[0]?.id || '',
      operator: 'equals',
      value: '',
      logicalOperator: 'AND'
    };
    
    setReportData(prev => ({
      ...prev,
      filters: [...(prev.filters || []), newFilter]
    }));
  };

  const handleUpdateFilter = (filterId: string, updates: Partial<ReportFilter>) => {
    setReportData(prev => ({
      ...prev,
      filters: prev.filters?.map(f => f.id === filterId ? { ...f, ...updates } : f) || []
    }));
  };

  const handleRemoveFilter = (filterId: string) => {
    setReportData(prev => ({
      ...prev,
      filters: prev.filters?.filter(f => f.id !== filterId) || []
    }));
  };

  const handleVisualizationChange = (visualization: Partial<ReportVisualization>) => {
    setReportData(prev => ({
      ...prev,
      visualization: { ...prev.visualization!, ...visualization }
    }));
  };

  const handleSave = () => {
    if (!reportData.name?.trim()) {
      alert('يرجى إدخال اسم التقرير');
      return;
    }
    
    if (!reportData.fields?.length) {
      alert('يرجى اختيار حقل واحد على الأقل');
      return;
    }

    onSave(reportData);
  };

  const generatePreview = () => {
    // This would generate actual preview data based on the report configuration
    // For now, we'll show a placeholder
    setPreviewData([
      { id: 1, name: 'عينة بيانات 1', value: 100 },
      { id: 2, name: 'عينة بيانات 2', value: 200 },
      { id: 3, name: 'عينة بيانات 3', value: 150 }
    ]);
  };

  const steps = [
    { id: 1, name: 'المعلومات الأساسية', icon: Cog6ToothIcon },
    { id: 2, name: 'اختيار البيانات', icon: TableCellsIcon },
    { id: 3, name: 'التصفية والتجميع', icon: PlusIcon },
    { id: 4, name: 'العرض والتصور', icon: ChartBarIcon },
    { id: 5, name: 'المعاينة والحفظ', icon: EyeIcon }
  ];

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
              <XMarkIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {report ? 'تحرير التقرير' : 'إنشاء تقرير جديد'}
              </h1>
              <p className="text-sm text-muted-foreground">الخطوة {currentStep} من {steps.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={generatePreview}
              className="px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary-soft"
            >
              معاينة
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              حفظ التقرير
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Steps Sidebar */}
        <div className="w-64 bg-card border-r border-border p-6">
          <nav className="space-y-2">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-right transition-colors ${
                  currentStep === step.id
                    ? 'bg-primary-soft text-primary border border-primary/30'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <step.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{step.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6">
          {currentStep === 1 && (
            <div className="max-w-2xl space-y-6">
              <h2 className="text-lg font-semibold text-foreground">المعلومات الأساسية</h2>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  اسم التقرير *
                </label>
                <input
                  type="text"
                  value={reportData.name || ''}
                  onChange={(e) => setReportData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="مثال: تقرير الأداء الشهري"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  الوصف
                </label>
                <textarea
                  value={reportData.description || ''}
                  onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="وصف مختصر للتقرير وهدفه..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  مصدر البيانات *
                </label>
                <select
                  value={reportData.dataSource || ''}
                  onChange={(e) => handleDataSourceChange(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="clients">العملاء</option>
                  <option value="prospects">العملاء المحتملين</option>
                  <option value="cases">القضايا</option>
                  <option value="users">المستخدمين</option>
                  <option value="activities">الأنشطة</option>
                </select>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reportData.isTemplate || false}
                    onChange={(e) => setReportData(prev => ({ ...prev, isTemplate: e.target.checked }))}
                    className="rounded border-border text-primary focus-visible:ring-ring"
                  />
                  <span className="text-sm text-foreground">حفظ كقالب</span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reportData.isPublic || false}
                    onChange={(e) => setReportData(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="rounded border-border text-primary focus-visible:ring-ring"
                  />
                  <span className="text-sm text-foreground">تقرير عام (مرئي لجميع المستخدمين)</span>
                </label>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="max-w-4xl space-y-6">
              <h2 className="text-lg font-semibold text-foreground">اختيار الحقول</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-foreground mb-3">الحقول المتاحة</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {availableFields.map((field) => (
                      <label
                        key={field.id}
                        className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={reportData.fields?.includes(field.id) || false}
                          onChange={() => handleFieldToggle(field.id)}
                          className="rounded border-border text-primary focus-visible:ring-ring"
                        />
                        <div>
                          <div className="font-medium text-foreground">{field.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {field.type} {field.aggregatable && '• قابل للتجميع'}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-foreground mb-3">الحقول المختارة</h3>
                  <div className="space-y-2">
                    {reportData.fields?.map((fieldId) => {
                      const field = availableFields.find(f => f.id === fieldId);
                      return field ? (
                        <div
                          key={fieldId}
                          className="flex items-center justify-between p-3 bg-primary-soft border border-primary/30 rounded-lg"
                        >
                          <span className="font-medium text-primary-strong">{field.name}</span>
                          <button
                            onClick={() => handleFieldToggle(fieldId)}
                            className="text-primary hover:text-primary-strong"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null;
                    })}
                    {!reportData.fields?.length && (
                      <p className="text-muted-foreground text-center py-8">لم يتم اختيار أي حقول بعد</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="max-w-4xl space-y-6">
              <h2 className="text-lg font-semibold text-foreground">التصفية والتجميع</h2>
              
              {/* Filters Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-foreground">فلاتر البيانات</h3>
                  <button
                    onClick={handleAddFilter}
                    className="flex items-center gap-2 px-3 py-2 text-primary border border-primary rounded-lg hover:bg-primary-soft"
                  >
                    <PlusIcon className="h-4 w-4" />
                    إضافة فلتر
                  </button>
                </div>
                
                <div className="space-y-3">
                  {reportData.filters?.map((filter, index) => (
                    <div key={filter.id} className="flex items-center gap-3 p-4 border border-border rounded-lg">
                      {index > 0 && (
                        <select
                          value={filter.logicalOperator || 'AND'}
                          onChange={(e) => handleUpdateFilter(filter.id, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                          className="px-2 py-1 border border-border rounded text-sm"
                        >
                          <option value="AND">و</option>
                          <option value="OR">أو</option>
                        </select>
                      )}
                      
                      <select
                        value={filter.fieldId}
                        onChange={(e) => handleUpdateFilter(filter.id, { fieldId: e.target.value })}
                        className="px-3 py-2 border border-border rounded-lg"
                      >
                        {availableFields.map(field => (
                          <option key={field.id} value={field.id}>{field.name}</option>
                        ))}
                      </select>
                      
                      <select
                        value={filter.operator}
                        onChange={(e) => handleUpdateFilter(filter.id, { operator: e.target.value as any })}
                        className="px-3 py-2 border border-border rounded-lg"
                      >
                        <option value="equals">يساوي</option>
                        <option value="not_equals">لا يساوي</option>
                        <option value="contains">يحتوي على</option>
                        <option value="greater_than">أكبر من</option>
                        <option value="less_than">أصغر من</option>
                      </select>
                      
                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) => handleUpdateFilter(filter.id, { value: e.target.value })}
                        className="flex-1 px-3 py-2 border border-border rounded-lg"
                        placeholder="القيمة"
                      />
                      
                      <button
                        onClick={() => handleRemoveFilter(filter.id)}
                        className="p-2 text-destructive hover:bg-destructive-soft rounded-lg"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  
                  {!reportData.filters?.length && (
                    <p className="text-muted-foreground text-center py-8">لا توجد فلاتر مضافة</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="max-w-4xl space-y-6">
              <h2 className="text-lg font-semibold text-foreground">نوع العرض والتصور</h2>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  نوع التصور
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { type: 'table', name: 'جدول', icon: TableCellsIcon },
                    { type: 'bar', name: 'أعمدة', icon: ChartBarIcon },
                    { type: 'line', name: 'خطي', icon: ChartBarIcon },
                    { type: 'pie', name: 'دائري', icon: ChartBarIcon },
                    { type: 'doughnut', name: 'حلقي', icon: ChartBarIcon },
                    { type: 'area', name: 'منطقة', icon: ChartBarIcon }
                  ].map((viz) => (
                    <button
                      key={viz.type}
                      onClick={() => handleVisualizationChange({ type: viz.type as any })}
                      className={`p-4 border rounded-lg text-center transition-colors ${
                        reportData.visualization?.type === viz.type
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-border hover:border-ring'
                      }`}
                    >
                      <viz.icon className="h-8 w-8 mx-auto mb-2" />
                      <div className="font-medium">{viz.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="max-w-4xl space-y-6">
              <h2 className="text-lg font-semibold text-foreground">المعاينة والحفظ</h2>
              
              <div className="bg-card border border-border rounded-lg p-6">
                <h3 className="font-medium text-foreground mb-4">معاينة التقرير</h3>
                
                {previewData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          {Object.keys(previewData[0]).map(key => (
                            <th key={key} className="text-right py-2 px-4 font-medium text-foreground">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, index) => (
                          <tr key={index} className="border-b border-border">
                            {Object.values(row).map((value, cellIndex) => (
                              <td key={cellIndex} className="py-2 px-4 text-foreground">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">اضغط على "معاينة" لعرض البيانات</p>
                  </div>
                )}
              </div>
              
              <div className="bg-primary-soft border border-primary/30 rounded-lg p-4">
                <h4 className="font-medium text-primary-strong mb-2">ملخص التقرير</h4>
                <div className="text-sm text-primary-strong space-y-1">
                  <p>• الاسم: {reportData.name}</p>
                  <p>• مصدر البيانات: {reportData.dataSource}</p>
                  <p>• عدد الحقول: {reportData.fields?.length || 0}</p>
                  <p>• عدد الفلاتر: {reportData.filters?.length || 0}</p>
                  <p>• نوع العرض: {reportData.visualization?.type}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="px-4 py-2 text-muted-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              السابق
            </button>
            
            <button
              onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
              disabled={currentStep === steps.length}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              التالي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}