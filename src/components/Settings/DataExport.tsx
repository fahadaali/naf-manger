import React, { useState } from 'react';
import { CircleCheck, FileOutput, TriangleAlert } from 'lucide-react';
import { db } from '../../data/database';
import { formatDate, formatNumber, formatTime } from '@/registry/naf/lib/format';
import { Button } from '@/registry/naf/ui/button';
import { messageTone } from '../../lib/status-message';
import { Alert } from '@/registry/naf/ui/alert';

export default function DataExport() {
  const [selectedData, setSelectedData] = useState({
    clients: true,
    prospects: true,
    cases: true,
    users: false,
    marketers: true,
    analytics: false,
    activities: false
  });
  
  const [selectedFormat, setSelectedFormat] = useState('excel');
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [selectedFields, setSelectedFields] = useState({
    clients: {
      basicInfo: true,
      contactInfo: true,
      notes: false,
      attachments: false
    },
    prospects: {
      basicInfo: true,
      contactInfo: true,
      prospectInfo: true,
      notes: false
    },
    cases: {
      basicInfo: true,
      details: true,
      basecampLinks: false,
      outcomes: true
    },
    marketers: {
      basicInfo: true,
      contactInfo: true,
      performance: true,
      notes: false
    }
  });

  const handleDataToggle = (dataType: string) => {
    setSelectedData(prev => ({
      ...prev,
      [dataType]: !prev[dataType as keyof typeof prev]
    }));
  };

  const handleFieldToggle = (category: string, field: string) => {
    setSelectedFields(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [field]: !(prev[category as keyof typeof prev] as Record<string, boolean>)[field]
      }
    }));
  };

  const generateExcelData = async () => {
    const data: any = {};

    if (selectedData.clients) {
      const clients = await db.getClients();
      const clientsData = clients.map(client => {
        const row: any = {};
        
        if (selectedFields.clients.basicInfo) {
          row['الاسم الكامل'] = client.fullName;
          row['رقم الهوية'] = client.idNumber;
          row['نوع العميل'] = client.clientType;
          row['حالة العميل'] = client.status;
          row['تاريخ الانضمام'] = formatDate(client.joinDate);
        }
        
        if (selectedFields.clients.contactInfo) {
          row['رقم الجوال'] = client.phone;
          row['البريد الإلكتروني'] = client.email;
        }
        
        if (selectedFields.clients.notes && client.notes) {
          row['الملاحظات'] = client.notes;
        }
        
        if (client.clientType === 'company' && client.commercialRegister) {
          row['السجل التجاري'] = client.commercialRegister;
        }
        
        return row;
      });
      data.clients = clientsData;
    }

    if (selectedData.prospects) {
      const prospects = await db.getProspects();
      const prospectsData = prospects.map(prospect => {
        const row: any = {};
        
        if (selectedFields.prospects.basicInfo) {
          row['الاسم الكامل'] = prospect.fullName;
          row['رقم الهوية'] = prospect.idNumber;
          row['نوع العميل'] = prospect.clientType;
          row['تاريخ الإضافة'] = formatDate(prospect.joinDate);
        }
        
        if (selectedFields.prospects.contactInfo) {
          row['رقم الجوال'] = prospect.phone;
          row['البريد الإلكتروني'] = prospect.email;
        }
        
        if (selectedFields.prospects.prospectInfo) {
          row['حالة العميل المحتمل'] = prospect.prospectStatus;
          row['المصدر'] = prospect.source || '';
          row['القيمة المتوقعة'] = prospect.expectedValue || 0;
          row['موعد المتابعة'] = prospect.followUpDate ? formatDate(prospect.followUpDate) : '';
        }
        
        if (selectedFields.prospects.notes && prospect.notes) {
          row['الملاحظات'] = prospect.notes;
        }
        
        return row;
      });
      data.prospects = prospectsData;
    }

    if (selectedData.cases) {
      const cases = await db.getCases();
      const casesData = cases.map(case_ => {
        const row: any = {};
        
        if (selectedFields.cases.basicInfo) {
          row['رقم القضية'] = case_.caseNumber;
          row['نوع القضية'] = case_.caseType;
          row['العميل'] = case_.clientName;
          row['الحالة'] = case_.status;
          row['تاريخ الإنشاء'] = formatDate(case_.createdDate);
        }
        
        if (selectedFields.cases.details) {
          row['ملخص القضية'] = case_.summary;
          row['تاريخ التحديث'] = formatDate(case_.updatedDate);
        }
        
        if (selectedFields.cases.basecampLinks && case_.basecampUrl) {
          row['رابط Basecamp'] = case_.basecampUrl;
        }
        
        if (selectedFields.cases.outcomes && case_.outcome) {
          row['نتيجة القضية'] = case_.outcome;
        }
        
        return row;
      });
      data.cases = casesData;
    }

    if (selectedData.marketers) {
      const marketers = await db.getMarketers();
      const marketersData = marketers.map(marketer => {
        const row: any = {};
        
        if (selectedFields.marketers.basicInfo) {
          row['الاسم الكامل'] = marketer.fullName;
          row['رقم الهوية'] = marketer.idNumber;
          row['نوع العلاقة'] = marketer.relationshipType;
          row['الحالة'] = marketer.status;
          row['تاريخ بدء التعاون'] = formatDate(marketer.startDate);
        }
        
        if (selectedFields.marketers.contactInfo) {
          row['رقم الجوال'] = marketer.phone;
          row['البريد الإلكتروني'] = marketer.email;
        }
        
        if (selectedFields.marketers.performance) {
          // يمكن إضافة إحصائيات الأداء هنا
          row['عدد القضايا'] = 0; // سيتم حسابها لاحقاً
        }
        
        if (selectedFields.marketers.notes && marketer.notes) {
          row['الملاحظات'] = marketer.notes;
        }
        
        return row;
      });
      data.marketers = marketersData;
    }

    if (selectedData.users) {
      const users = await db.getUsers();
      const usersData = users.map(user => ({
        'الاسم': user.name,
        'البريد الإلكتروني': user.email,
        'الدور': user.role,
        'تاريخ الإنشاء': formatDate(user.createdDate),
        'آخر نشاط': user.lastLogin ? formatDate(user.lastLogin) : 'لم يدخل بعد'
      }));
      data.users = usersData;
    }

    if (selectedData.activities) {
      const activities = await db.getActivities();
      const activitiesData = activities.map(activity => ({
        'النوع': activity.type,
        'الوصف': activity.description,
        'المستخدم': activity.userName,
        'التاريخ': formatDate(activity.timestamp),
        'الوقت': formatTime(activity.timestamp)
      }));
      data.activities = activitiesData;
    }

    return data;
  };

  const downloadExcel = async (data: any, filename: string) => {
    // Create CSV content
    let csvContent = '';
    
    Object.keys(data).forEach(sheetName => {
      const sheetTitle = {
        clients: 'العملاء',
        prospects: 'العملاء المحتملين',
        cases: 'القضايا',
        users: 'المستخدمين',
        marketers: 'المسوّقين',
        activities: 'الأنشطة'
      }[sheetName] || sheetName;
      
      csvContent += `\n=== ${sheetTitle} ===\n`;
      
      const rows = data[sheetName];
      if (rows.length > 0) {
        // Headers
        const headers = Object.keys(rows[0]);
        csvContent += headers.join(',') + '\n';
        
        // Data rows
        rows.forEach((row: any) => {
          const values = headers.map(header => {
            const value = row[header] || '';
            // Escape commas and quotes
            return `"${String(value).replace(/"/g, '""')}"`;
          });
          csvContent += values.join(',') + '\n';
        });
      }
      csvContent += '\n';
    });

    // Create and download file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateJSONContent = async () => {
    try {
      const allData = await db.exportAllData();
      return JSON.stringify(allData, null, 2);
    } catch (error) {
      console.error('Error generating JSON content:', error);
      throw error;
    }
  };

  const downloadJSON = async (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDFContent = async (data: any) => {
    let content = 'تقرير بيانات NAF Law\n';
    content += '===================\n\n';
    content += `تاريخ التصدير: ${formatDate(new Date())}\n\n`;

    Object.keys(data).forEach(sheetName => {
      const sheetTitle = {
        clients: 'بيانات العملاء',
        prospects: 'بيانات العملاء المحتملين',
        cases: 'بيانات القضايا',
        users: 'بيانات المستخدمين',
        marketers: 'بيانات المسوّقين',
        activities: 'سجل الأنشطة'
      }[sheetName] || sheetName;
      
      content += `\n${sheetTitle}\n`;
      content += '================\n\n';
      
      const rows = data[sheetName];
      rows.forEach((row: any, index: number) => {
        content += `${index + 1}. `;
        Object.entries(row).forEach(([key, value]) => {
          content += `${key}: ${value} | `;
        });
        content += '\n\n';
      });
    });

    return content;
  };

  const downloadPDF = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.replace('.pdf', '.txt'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportData = async () => {
    setIsExporting(true);
    setExportMessage('');
    
    try {
      const data = await generateExcelData();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `NAF_Law_Export_${timestamp}`;

      if (selectedFormat === 'json') {
        const jsonContent = await generateJSONContent();
        await downloadJSON(jsonContent, `${filename}.json`);
      } else if (selectedFormat === 'excel') {
        await downloadExcel(data, `${filename}.csv`);
      } else {
        const pdfContent = await generatePDFContent(data);
        downloadPDF(pdfContent, `${filename}.pdf`);
      }

      setExportMessage('تم التصدير');
      setTimeout(() => setExportMessage(''), 3000);
      
    } catch (error) {
      console.error('Export error:', error);
      setExportMessage('حدث خطأ أثناء تصدير البيانات');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground">تصدير البيانات</h3>
      
      {exportMessage && (() => {
        const tone = messageTone(exportMessage);
        const Icon = tone === 'success' ? CircleCheck : TriangleAlert;
        return (
          <Alert variant={tone}>
            <Icon aria-hidden="true" />
            <span>{exportMessage}</span>
          </Alert>
        );
      })()}
      
      {/* Data Selection */}
      <div className="bg-muted rounded-lg p-6">
        <h4 className="font-medium text-foreground mb-4">اختر البيانات المراد تصديرها</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(selectedData).map(([key, selected]) => (
            <label key={key} className="flex items-center gap-3 p-3 bg-card rounded-lg cursor-pointer hover:bg-muted">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => handleDataToggle(key)}
                className="rounded border-border text-primary focus-visible:ring-ring"
              />
              <div>
                <span className="font-medium text-foreground">
                  {key === 'clients' ? 'بيانات العملاء' :
                   key === 'prospects' ? 'بيانات العملاء المحتملين' :
                   key === 'cases' ? 'بيانات القضايا' :
                   key === 'users' ? 'بيانات المستخدمين' :
                   key === 'marketers' ? 'بيانات المسوّقين' :
                   key === 'analytics' ? 'الإحصائيات' :
                   key === 'activities' ? 'سجل الأنشطة' : key}
                </span>
                <p className="text-sm text-muted-foreground">
                  {key === 'clients' ? 'جميع العملاء المسجلين' :
                   key === 'prospects' ? 'جميع العملاء المحتملين' :
                   key === 'cases' ? 'جميع القضايا المسجلة' :
                   key === 'users' ? 'جميع المستخدمين' :
                   key === 'marketers' ? 'جميع المسوّقين' :
                   key === 'analytics' ? 'التقارير والإحصائيات' :
                   key === 'activities' ? 'سجل جميع الأنشطة في النظام' : ''}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Format Selection */}
      <div className="bg-muted rounded-lg p-6">
        <h4 className="font-medium text-foreground mb-4">تنسيق الملف</h4>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="json"
              checked={selectedFormat === 'json'}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="text-primary focus-visible:ring-ring"
            />
            <span className="text-foreground">JSON (.json) - نسخة احتياطية كاملة</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="excel"
              checked={selectedFormat === 'excel'}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="text-primary focus-visible:ring-ring"
            />
            <span className="text-foreground">Excel/CSV (.csv)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="format"
              value="pdf"
              checked={selectedFormat === 'pdf'}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="text-primary focus-visible:ring-ring"
            />
            <span className="text-foreground">نص منسق (.txt)</span>
          </label>
        </div>
      </div>

      {/* Field Selection */}
      {(selectedData.clients || selectedData.prospects || selectedData.cases || selectedData.marketers) && selectedFormat !== 'json' && (
        <div className="bg-muted rounded-lg p-6">
          <h4 className="font-medium text-foreground mb-4">اختر الحقول المراد تصديرها</h4>
          
          {selectedData.clients && (
            <div className="mb-6">
              <h5 className="font-medium text-foreground mb-3">حقول العملاء</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(selectedFields.clients).map(([field, selected]) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleFieldToggle('clients', field)}
                      className="rounded border-border text-primary focus-visible:ring-ring"
                    />
                    <span className="text-sm text-foreground">
                      {field === 'basicInfo' ? 'المعلومات الأساسية' :
                       field === 'contactInfo' ? 'معلومات التواصل' :
                       field === 'notes' ? 'الملاحظات' :
                       field === 'attachments' ? 'المرفقات' : field}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedData.prospects && (
            <div className="mb-6">
              <h5 className="font-medium text-foreground mb-3">حقول العملاء المحتملين</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(selectedFields.prospects).map(([field, selected]) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleFieldToggle('prospects', field)}
                      className="rounded border-border text-primary focus-visible:ring-ring"
                    />
                    <span className="text-sm text-foreground">
                      {field === 'basicInfo' ? 'المعلومات الأساسية' :
                       field === 'contactInfo' ? 'معلومات التواصل' :
                       field === 'prospectInfo' ? 'معلومات العميل المحتمل' :
                       field === 'notes' ? 'الملاحظات' : field}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedData.cases && (
            <div className="mb-6">
              <h5 className="font-medium text-foreground mb-3">حقول القضايا</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(selectedFields.cases).map(([field, selected]) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleFieldToggle('cases', field)}
                      className="rounded border-border text-primary focus-visible:ring-ring"
                    />
                    <span className="text-sm text-foreground">
                      {field === 'basicInfo' ? 'المعلومات الأساسية' :
                       field === 'details' ? 'تفاصيل القضية' :
                       field === 'basecampLinks' ? 'روابط Basecamp' :
                       field === 'outcomes' ? 'نتائج القضايا' : field}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedData.marketers && (
            <div>
              <h5 className="font-medium text-foreground mb-3">حقول المسوّقين</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(selectedFields.marketers).map(([field, selected]) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleFieldToggle('marketers', field)}
                      className="rounded border-border text-primary focus-visible:ring-ring"
                    />
                    <span className="text-sm text-foreground">
                      {field === 'basicInfo' ? 'المعلومات الأساسية' :
                       field === 'contactInfo' ? 'معلومات التواصل' :
                       field === 'performance' ? 'إحصائيات الأداء' :
                       field === 'notes' ? 'الملاحظات' : field}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Summary */}
      <div className="bg-primary-soft rounded-lg p-6">
        <h4 className="font-medium text-primary-strong mb-3">ملخص التصدير</h4>
        <ul className="list-disc ps-5 space-y-2 text-sm text-primary-strong">
          <li>التنسيق: {
            selectedFormat === 'json' ? 'JSON (نسخة احتياطية كاملة)' :
            selectedFormat === 'excel' ? 'CSV/Excel' : 
            'نص منسق'
          }</li>
          <li>البيانات المحددة: <bdi>{formatNumber(Object.values(selectedData).filter(Boolean).length)}</bdi> من <bdi>{formatNumber(4)}</bdi></li>
          <li>سيتم إنشاء الملف وتنزيله تلقائياً</li>
          {selectedFormat === 'json' && (
            <li>تنسيق JSON يحتوي على جميع البيانات ويمكن استخدامه لاستعادة النظام</li>
          )}
        </ul>
      </div>

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={exportData} disabled={!Object.values(selectedData).some(Boolean) || isExporting} size="lg">
          <FileOutput className="h-5 w-5" />
          {isExporting ? 'جارٍ التصدير' : 'تصدير البيانات'}
        </Button>
      </div>

      {/* Migration Notice */}
      <div className="bg-warning-soft border border-warning/30 rounded-lg p-4">
        <h4 className="font-medium text-warning-strong mb-2">ملاحظة مهمة حول قاعدة البيانات:</h4>
        <ul className="list-disc ps-5 text-sm text-warning-strong space-y-2">
          <li>التطبيق يدعم الآن قاعدة بيانات Supabase المركزية</li>
          <li>عند توصيل Supabase، ستصبح البيانات مركزية ومتاحة لجميع المستخدمين</li>
          <li>يمكنك ترحيل البيانات الحالية من localStorage إلى Supabase</li>
          <li>تنسيق JSON مناسب للنسخ الاحتياطية الكاملة واستعادة البيانات</li>
        </ul>
      </div>
    </div>
  );
}