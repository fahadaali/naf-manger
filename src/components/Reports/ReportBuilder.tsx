import { useState, useEffect } from 'react';
import { ChartColumn, Eye, Plus, Settings, Table2, Trash2, TriangleAlert, X } from 'lucide-react';
import { CustomReport, ReportField, ReportFilter, ReportResult, ReportVisualization } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../data/database';
import { REPORT_FIELDS, columnLabel, formatCell } from '../../lib/report-fields';
import { formatNumber } from '@/registry/naf/lib/format';
import { Textarea } from '@/registry/naf/ui/textarea';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/registry/naf/ui/table';
import { Alert } from '@/registry/naf/ui/alert';

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
  const [preview, setPreview] = useState<ReportResult | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewing, setPreviewing] = useState(false);

  /* الحقول من `lib/report-fields.ts` — موضعٌ واحد يقرؤه الباني والعارض،
     وهو مرآةُ `FIELDS` في `worker/lib/reports.js`. وكانت مكتوبةً هنا
     وحدها، فحقلٌ يُضاف في الخادم لا يظهر ولا يُعرف سببُه. */
  const fieldDefinitions = REPORT_FIELDS;

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

  /* ═══ المعاينة من القاعدة ═══
   *
   * كانت تكتب ثلاثة صفوفٍ في الشيفرة — «عينة بيانات 1» — وتسمّيها
   * معاينةً. فمن ضبط حقولاً ومرشّحات ثم عاين رأى ما لا صلة له بضبطه.
   *
   * والآن `POST /api/reports/preview`: يُبنى الاستعلام في الخادم من هذا
   * التعريف نفسه ويُشغَّل بحدّ عشرة صفوف. */
  const generatePreview = async () => {
    setPreviewError('');
    setPreviewing(true);
    try {
      setPreview(await db.previewReport(reportData));
    } catch (error) {
      console.error('تعذّر توليد المعاينة:', error);
      const code = (error as { code?: string })?.code;
      setPreview(null);
      setPreviewError(
        code === 'no_fields' ? 'اختر حقلاً واحداً على الأقل' : 'تعذّر توليد المعاينة'
      );
    } finally {
      setPreviewing(false);
    }
  };

  const steps = [
    { id: 1, name: 'المعلومات الأساسية', icon: Settings },
    { id: 2, name: 'اختيار البيانات', icon: Table2 },
    { id: 3, name: 'التصفية والتجميع', icon: Plus },
    { id: 4, name: 'العرض والتصور', icon: ChartColumn },
    { id: 5, name: 'المعاينة والحفظ', icon: Eye }
  ];

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={onClose} className="rounded-full" variant="ghost" size="icon-md">
              <X className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {report ? 'تعديل التقرير' : 'إنشاء تقرير جديد'}
              </h1>
              <p className="text-sm text-muted-foreground">الخطوة <bdi>{formatNumber(currentStep)}</bdi> من <bdi>{formatNumber(steps.length)}</bdi></p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={generatePreview} disabled={previewing} className="border-primary text-primary" variant="outline">
              {previewing ? 'جارٍ المعاينة' : 'معاينة'}
            </Button>
            <Button onClick={handleSave}>
              حفظ التقرير
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Steps Sidebar */}
        <div className="w-64 bg-card border-e border-border p-6">
          <nav className="space-y-2">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-start transition-colors ${
                  currentStep === step.id
                    ? 'bg-primary-soft text-primary-strong border border-primary/30'
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
                <Input
                  type="text"
                  value={reportData.name || ''}
                  onChange={(e) => setReportData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: تقرير الأداء الشهري"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  الوصف
                </label>
                <Textarea
                  value={reportData.description || ''}
                  onChange={(e) => setReportData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="وصف مختصر للتقرير وهدفه..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  مصدر البيانات *
                </label>
                <Select
                  value={reportData.dataSource || ''}
                  onChange={(e) => handleDataSourceChange(e.target.value)}
                >
                  <option value="clients">العملاء</option>
                  <option value="prospects">العملاء المحتملين</option>
                  <option value="cases">القضايا</option>
                  <option value="users">المستخدمين</option>
                  <option value="activities">الأنشطة</option>
                </Select>
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
                          <Button onClick={() => handleFieldToggle(fieldId)} variant="link">
                            <X className="h-4 w-4" />
                          </Button>
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
                  <Button onClick={handleAddFilter} className="border-primary text-primary" variant="outline" size="sm">
                    <Plus className="h-4 w-4" />
                    إضافة فلتر
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {reportData.filters?.map((filter, index) => (
                    <div key={filter.id} className="flex items-center gap-3 p-4 border border-border rounded-lg">
                      {index > 0 && (
                        <Select
                          value={filter.logicalOperator || 'AND'}
                          onChange={(e) => handleUpdateFilter(filter.id, { logicalOperator: e.target.value as 'AND' | 'OR' })} className="text-sm"
                        >
                          <option value="AND">و</option>
                          <option value="OR">أو</option>
                        </Select>
                      )}
                      
                      <Select
                        value={filter.fieldId}
                        onChange={(e) => handleUpdateFilter(filter.id, { fieldId: e.target.value })}
                      >
                        {availableFields.map(field => (
                          <option key={field.id} value={field.id}>{field.name}</option>
                        ))}
                      </Select>
                      
                      <Select
                        value={filter.operator}
                        onChange={(e) => handleUpdateFilter(filter.id, { operator: e.target.value as any })}
                      >
                        <option value="equals">يساوي</option>
                        <option value="not_equals">لا يساوي</option>
                        <option value="contains">يحتوي على</option>
                        <option value="greater_than">أكبر من</option>
                        <option value="less_than">أصغر من</option>
                      </Select>
                      
                      <Input
                        type="text"
                        value={filter.value}
                        onChange={(e) => handleUpdateFilter(filter.id, { value: e.target.value })} className="flex-1"
                        placeholder="القيمة"
                      />
                      
                      <Button onClick={() => handleRemoveFilter(filter.id)} className="text-destructive" variant="ghost" size="icon-md">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {!reportData.filters?.length && (
                    <p className="text-muted-foreground text-center py-8">لم تُضِف أي مرشّح بعد. أضف أول مرشّح.</p>
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
                    { type: 'table', name: 'جدول', icon: Table2 },
                    { type: 'bar', name: 'أعمدة', icon: ChartColumn },
                    { type: 'line', name: 'خطي', icon: ChartColumn },
                    { type: 'pie', name: 'دائري', icon: ChartColumn },
                    { type: 'doughnut', name: 'حلقي', icon: ChartColumn },
                    { type: 'area', name: 'منطقة', icon: ChartColumn }
                  ].map((viz) => (
                    <button
                      key={viz.type}
                      onClick={() => handleVisualizationChange({ type: viz.type as any })}
                      className={`p-4 border rounded-lg text-center transition-colors ${
                        reportData.visualization?.type === viz.type
                          ? 'border-primary bg-primary-soft text-primary-strong'
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
                
                {previewError ? (
                  <Alert variant="destructive">
                    <TriangleAlert aria-hidden="true" />
                    <span>{previewError}</span>
                  </Alert>
                ) : preview && preview.rows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {preview.columns.map((column) => (
                            <TableHead key={column} className="text-foreground">
                              {columnLabel(column)}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.rows.map((row, index) => (
                          <TableRow key={index}>
                            {preview.columns.map((column) => (
                              <TableCell key={column} className="text-foreground">
                                <bdi>{formatCell(row[column])}</bdi>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <p className="text-xs text-muted-foreground mt-3">
                      المعاينة أوّلُ <bdi>{formatNumber(preview.rows.length)}</bdi> صفّاً — والتقرير الكامل عند تشغيله.
                    </p>
                  </div>
                ) : preview ? (
                  <p className="text-muted-foreground text-center py-8">
                    لا نتائج تطابق شروط التقرير.
                  </p>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">اضغط «معاينة» لعرض البيانات</p>
                  </div>
                )}
              </div>
              
              <div className="bg-primary-soft border border-primary/30 rounded-lg p-4">
                <h4 className="font-medium text-primary-strong mb-2">ملخص التقرير</h4>
                <ul className="list-disc ps-5 text-sm text-primary-strong space-y-1">
                  <li>الاسم: {reportData.name}</li>
                  <li>مصدر البيانات: {reportData.dataSource}</li>
                  <li>عدد الحقول: <bdi>{formatNumber(reportData.fields?.length || 0)}</bdi></li>
                  <li>عدد الفلاتر: <bdi>{formatNumber(reportData.filters?.length || 0)}</bdi></li>
                  <li>نوع العرض: {reportData.visualization?.type}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button onClick={() => setCurrentStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1} variant="outline">
              السابق
            </Button>
            
            <Button onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))} disabled={currentStep === steps.length}>
              التالي
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}