import { useState, useEffect } from 'react';
import { Archive, ChevronDown, CircleCheck, ExternalLink, Plus, Search, TriangleAlert } from 'lucide-react';
import { BulkAction, Case } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import CaseModal from './CaseModal';
import RowCheckbox from '../Common/RowCheckbox';
import SelectionBar from '../Common/SelectionBar';
import ViewToggle, { useViewMode } from '../Common/ViewToggle';
import { useSelection } from '../../lib/use-selection';
import { db } from '../../data/database';
import { useSettingList } from '../../lib/use-settings';
import { caseStatusLabel } from '../../lib/labels';
import { caseOutcomeBadge, caseStatusBadge } from '../../lib/status-badges';
import { formatDate, formatNumber } from '@/registry/naf/lib/format';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
import { Alert } from '@/registry/naf/ui/alert';
import { messageTone } from '../../lib/status-message';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/registry/naf/ui/table';
import { Card } from '@/registry/naf/ui/card';

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
  const [archiveView, setArchiveView] = useState<'active' | 'archived'>('active');
  /* القضايا تُقرأ جدولاً في الغالب — ففيها رقمٌ وعميلٌ وحالةٌ وتاريخ،
     والمقارنةُ بينها أكثرُ من قراءة الواحدة. فالافتراضُ صفوف. */
  const [viewMode, setViewMode] = useViewMode('cases', 'rows');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // المرشّحات من «تكوين النظام» لا من نصوصٍ في التصيير.
  const caseTypes = useSettingList('caseTypes');
  const caseStatuses = useSettingList('caseStatuses');

  // تحميل القضايا عند تحميل المكون
  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = () => {
    const loadCasesAsync = async () => {
      try {
        // جلب القضايا من مسارات المنصة على D1
        setCases(await db.getCases());
      } catch (error) {
        console.error('Error loading cases:', error);
        setCases([]);
      }
    };
    
    loadCasesAsync();
  };

  /* الأرشفةُ تسبق كلَّ تقسيمٍ آخر: قضيةٌ مؤرشفة لا تُعدّ نشطةً ولا مكتملة
     ولا تدخل في معدّل الربح — أُخرجت من الحساب كلِّه بقصد. */
  const visibleCases = cases.filter(case_ =>
    archiveView === 'archived' ? Boolean(case_.archivedAt) : !case_.archivedAt,
  );

  // فصل القضايا المكتملة عن الباقي
  const activeCases = visibleCases.filter(case_ => case_.status !== 'completed');
  const completedCases = visibleCases.filter(case_ => case_.status === 'completed');

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

  /* التحديدُ يشمل النشطةَ والمكتملةَ المعروضتين معاً: من فتح الجدولين
     وحدَّد منهما يقصد ما حدَّد، ولوحان منفصلان يجعلان «حدّد الكلّ» يكذب. */
  const shownCases = [...filteredActiveCases, ...(showCompletedCases ? filteredCompletedCases : [])];
  const selection = useSelection(shownCases);

  const runBulk = async (action: BulkAction) => {
    const ids = selection.ids;
    if (!ids.length) return;

    setBusy(true);
    setNotice('');
    try {
      const outcome = await db.bulkCases(action, ids);
      /* والصيغةُ «تم…» لأنّ `messageTone` تقرأ بها النجاح — §٤ تنصّ على
         «تم + المصدر»، ورسالةٌ تبدأ بـ«حُذفت» تُقرأ خطأً فتُعرض حمراء. */
      const noun = action === 'delete' ? 'حذف' : action === 'archive' ? 'أرشفة' : 'إرجاع';
      setNotice(`تمّ ${noun} ${formatNumber(outcome.affected)} من ${formatNumber(outcome.requested)}`);
      selection.clear();
      loadCases();
    } catch (error) {
      console.error('تعذّر تنفيذ الفعل الجماعي:', error);
      setNotice('تعذّر التنفيذ. حدّث الصفحة وأعد المحاولة.');
    } finally {
      setBusy(false);
    }
  };

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

  /* LoaderCircle لما هو بيد المكتب، و Clock لانتظار موعدٍ عند
     المحكمة — الفرق مَن يملك الخطوة التالية. مسجَّل في naf-icons.md. */
  /* الشارةُ — أيقونةً ولوناً ونصّاً — من `lib/status-badges.ts`. وكانت
     مكتوبةً هنا وفي `CaseModal` و`MarketerModal`، والثالثةُ تُسقط
     «مؤجلة» فتسمّيها «منظورة». */
  const statusOf = caseStatusBadge;
  const outcomeOf = caseOutcomeBadge;

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
        <div className="flex items-center gap-3">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          {hasPermission('cases', 'create') && (
            <Button onClick={handleCreateCase}>
              <Plus className="h-5 w-5" />
              إضافة قضية جديدة
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="البحث في القضايا"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} className="pe-10 ps-4"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">كل الحالات</option>
              {caseStatuses.map((status) => (
                <option key={status} value={status}>{caseStatusLabel(status)}</option>
              ))}
            </Select>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">كل الأنواع</option>
              {caseTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
            <Select
              value={archiveView}
              onChange={(e) => {
                setArchiveView(e.target.value as 'active' | 'archived');
                selection.clear();
              }}
            >
              <option value="active">الحاضرة</option>
              <option value="archived">المؤرشفة</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* النبرةُ من `messageTone` كبقيّة الشاشات: كانت `info` دائماً،
          فـ«تعذّر التنفيذ» يُعرض أزرق كالنجاح. */}
      {notice && (() => {
        const tone = messageTone(notice);
        const Icon = tone === 'success' ? CircleCheck : TriangleAlert;
        return (
          <Alert variant={tone}>
            <Icon aria-hidden="true" />
            <span>{notice}</span>
          </Alert>
        );
      })()}

      {(hasPermission('cases', 'update') || hasPermission('cases', 'delete')) && (
        <SelectionBar
          count={selection.count}
          onClear={selection.clear}
          onAction={runBulk}
          busy={busy}
          showRestore={archiveView === 'archived'}
          noun="قضيةً"
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">إجمالي القضايا</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground"><bdi>{formatNumber(visibleCases.length)}</bdi></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">قيد المعالجة</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">
            <bdi>{formatNumber(activeCases.filter(c => c.status === 'in-progress').length)}</bdi>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">المكتملة</p>
          <p className="text-xl sm:text-2xl font-bold text-success">
            <bdi>{formatNumber(completedCases.length)}</bdi>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">معدل الربح</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground"><bdi>{formatNumber(winRate)}%</bdi></p>
        </Card>
      </div>

      {/* ═══ بطاقات ═══
          القضيةُ الواحدة تُقرأ كاملةً هنا: رقمُها ونوعُها وعميلُها وملخّصُها
          في موضعٍ واحد بلا تمريرٍ أفقيّ — وهو ما يلزم على شاشةٍ ضيّقة. */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {shownCases.map((case_) => {
            const { variant, Icon } = statusOf(case_.status);
            return (
              <Card
                key={case_.id}
                className={`p-5 space-y-3 hover:shadow-md transition-shadow ${
                  selection.has(case_.id) ? 'ring-2 ring-primary' : ''
                } ${case_.archivedAt ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <RowCheckbox
                      checked={selection.has(case_.id)}
                      onChange={() => selection.toggle(case_.id)}
                      label={`حدّد ${case_.caseNumber}`}
                    />
                    <div className="min-w-0">
                      <button
                        onClick={() => handleViewCase(case_)}
                        className="text-sm font-semibold text-primary hover:text-primary-strong hover:underline"
                      >
                        <bdi>{case_.caseNumber}</bdi>
                      </button>
                      <p className="text-xs text-muted-foreground">{case_.caseType}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {case_.archivedAt && (
                      <Badge variant="default">
                        <Archive aria-hidden="true" />
                        مؤرشفة
                      </Badge>
                    )}
                    <Badge variant={variant}>
                      <Icon aria-hidden="true" />
                      {statusOf(case_.status).label}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-foreground">{case_.clientName}</p>
                {case_.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{case_.summary}</p>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">
                    <bdi>{formatDate(case_.createdDate)}</bdi>
                  </span>
                  <div className="flex items-center gap-3">
                    {case_.outcome && (() => {
                      const outcome = outcomeOf(case_.outcome);
                      return (
                        <Badge variant={outcome.variant}>
                          <outcome.Icon aria-hidden="true" />
                          {outcomeOf(case_.outcome).label}
                        </Badge>
                      );
                    })()}
                    {hasPermission('cases', 'update') && (
                      <button
                        onClick={() => handleEditCase(case_)}
                        className="text-primary hover:text-primary-strong text-sm"
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
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Active Cases Table */}
      {viewMode === 'rows' && (
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">القضايا النشطة</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 sm:px-6">
                  <RowCheckbox
                    checked={selection.allChosen}
                    indeterminate={selection.someChosen}
                    onChange={selection.toggleAll}
                    label="حدّد كلَّ المعروض"
                  />
                </TableHead>
                <TableHead className="sm:px-6 tracking-wider">
                  رقم القضية
                </TableHead>
                <TableHead className="sm:px-6 tracking-wider hidden sm:table-cell">
                  النوع
                </TableHead>
                <TableHead className="sm:px-6 tracking-wider">
                  العميل
                </TableHead>
                <TableHead className="sm:px-6 tracking-wider hidden md:table-cell">
                  الملخص
                </TableHead>
                <TableHead className="sm:px-6 tracking-wider">
                  الحالة
                </TableHead>
                <TableHead className="sm:px-6 tracking-wider hidden lg:table-cell">
                  تاريخ الإنشاء
                </TableHead>
                <TableHead className="sm:px-6 tracking-wider">
                  إجراءات
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActiveCases.map((case_) => (
                <TableRow
                  key={case_.id}
                  className={selection.has(case_.id) ? 'bg-primary-soft' : undefined}
                >
                  <TableCell className="sm:px-6">
                    <RowCheckbox
                      checked={selection.has(case_.id)}
                      onChange={() => selection.toggle(case_.id)}
                      label={`حدّد ${case_.caseNumber}`}
                    />
                  </TableCell>
                  <TableCell className="sm:px-6">
                    <button 
                      onClick={() => handleViewCase(case_)}
                      className="text-xs sm:text-sm font-medium text-primary hover:text-primary-strong hover:underline"
                    >
                      <bdi>{case_.caseNumber}</bdi>
                    </button>
                  </TableCell>
                  <TableCell className="sm:px-6 hidden sm:table-cell">
                    <div className="text-xs sm:text-sm text-foreground">{case_.caseType}</div>
                  </TableCell>
                  <TableCell className="sm:px-6">
                    <div className="text-xs sm:text-sm text-foreground truncate max-w-32">{case_.clientName}</div>
                  </TableCell>
                  <TableCell className="sm:px-6 hidden md:table-cell">
                    <div className="text-xs sm:text-sm text-foreground line-clamp-2">{case_.summary}</div>
                  </TableCell>
                  <TableCell className="sm:px-6">
                    {(() => {
                      const { variant, Icon } = statusOf(case_.status);
                      return (
                        <Badge variant={variant}>
                          <Icon aria-hidden="true" />
                          {statusOf(case_.status).label}
                        </Badge>
                      );
                    })()}
                    {case_.outcome && (() => {
                      const { variant, Icon } = outcomeOf(case_.outcome);
                      return (
                        <div className="mt-1 hidden sm:block">
                          <Badge variant={variant}>
                            <Icon aria-hidden="true" />
                            {outcomeOf(case_.outcome).label}
                          </Badge>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="sm:px-6 sm:text-sm hidden lg:table-cell">
                    <bdi>{formatDate(case_.createdDate)}</bdi>
                  </TableCell>
                  <TableCell className="sm:px-6 sm:text-sm">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
      )}

      {shownCases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {archiveView === 'archived'
              ? 'لا قضايا مؤرشفة. ما يُؤرشف يظهر هنا ويُرجع منه.'
              : 'لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.'}
          </p>
        </div>
      )}

      {/* Completed Cases Section */}
      {viewMode === 'rows' && completedCases.length > 0 && (
        <Card className="overflow-hidden">
          <button
            onClick={() => setShowCompletedCases(!showCompletedCases)}
            className="w-full px-6 py-4 border-b border-border flex items-center justify-between hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground">منتهية</h3>
              <Badge variant="success">
                <bdi>{formatNumber(completedCases.length)}</bdi>
              </Badge>
            </div>
            <div className={`transform transition-transform ${showCompletedCases ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
            </div>
          </button>
          
          {showCompletedCases && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="tracking-wider">
                      رقم القضية
                    </TableHead>
                    <TableHead className="tracking-wider">
                      النوع
                    </TableHead>
                    <TableHead className="tracking-wider">
                      العميل
                    </TableHead>
                    <TableHead className="tracking-wider">
                      الملخص
                    </TableHead>
                    <TableHead className="tracking-wider">
                      النتيجة
                    </TableHead>
                    <TableHead className="tracking-wider">
                      تاريخ الإنجاز
                    </TableHead>
                    <TableHead className="tracking-wider">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompletedCases.map((case_) => (
                    <TableRow
                      key={case_.id}
                      className={selection.has(case_.id) ? 'bg-primary-soft' : undefined}
                    >
                      <TableCell>
                        <RowCheckbox
                          checked={selection.has(case_.id)}
                          onChange={() => selection.toggle(case_.id)}
                          label={`حدّد ${case_.caseNumber}`}
                        />
                      </TableCell>
                      <TableCell>
                        <button 
                          onClick={() => handleViewCase(case_)}
                          className="text-sm font-medium text-primary hover:text-primary-strong hover:underline"
                        >
                          <bdi>{case_.caseNumber}</bdi>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground">{case_.caseType}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground">{case_.clientName}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground line-clamp-2">{case_.summary}</div>
                      </TableCell>
                      <TableCell>
                        {case_.outcome && (() => {
                          const { variant, Icon } = outcomeOf(case_.outcome);
                          return (
                            <Badge variant={variant}>
                              <Icon aria-hidden="true" />
                              {outcomeOf(case_.outcome).label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <bdi>{formatDate(case_.updatedDate)}</bdi>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {hasPermission('cases', 'update') && (
                            <Button onClick={() => handleEditCase(case_)} variant="link">
                              تعديل
                            </Button>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {showCompletedCases && filteredCompletedCases.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.</p>
            </div>
          )}
        </Card>
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