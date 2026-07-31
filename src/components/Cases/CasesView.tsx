import React, { useState, useEffect } from 'react';
import { CalendarX, ChevronDown, CircleCheck, CircleHelp, CircleX, Clock, ExternalLink, Handshake, LoaderCircle, Plus, Search } from 'lucide-react';
import { Case } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import CaseModal from './CaseModal';
import { db } from '../../data/database';
import { Select } from '@/registry/naf/ui/select';
import { Input } from '@/registry/naf/ui/input';
import { Button } from '@/registry/naf/ui/button';
import { Badge } from '@/registry/naf/ui/badge';
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

  /* LoaderCircle لما هو بيد المكتب، و Clock لانتظار موعدٍ عند
     المحكمة — الفرق مَن يملك الخطوة التالية. مسجَّل في naf-icons.md. */
  const STATUS = {
    completed: { variant: 'success' as const, Icon: CircleCheck },
    'in-progress': { variant: 'primary' as const, Icon: LoaderCircle },
    pending: { variant: 'warning' as const, Icon: Clock },
    postponed: { variant: 'destructive' as const, Icon: CalendarX }
  };

  const statusOf = (status: string) =>
    STATUS[status as keyof typeof STATUS] ??
    { variant: 'default' as const, Icon: CircleHelp };

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
          <Button onClick={handleCreateCase}>
            <Plus className="h-5 w-5" />
            إضافة قضية جديدة
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="relative flex-1">
            <Search className="absolute end-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="البحث في القضايا..."
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
              <option value="pending">منظورة</option>
              <option value="in-progress">قيد المعالجة</option>
              <option value="completed">مكتملة</option>
              <option value="postponed">مؤجلة</option>
            </Select>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">كل الأنواع</option>
              <option value="قضية تجارية">تجارية</option>
              <option value="قضية عمالية">عمالية</option>
              <option value="قضية مدنية">مدنية</option>
              <option value="قضية جزائية">جزائية</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">إجمالي القضايا</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{cases.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">قيد المعالجة</p>
          <p className="text-xl sm:text-2xl font-bold text-primary">
            {activeCases.filter(c => c.status === 'in-progress').length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">المكتملة</p>
          <p className="text-xl sm:text-2xl font-bold text-success">
            {completedCases.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs sm:text-sm text-muted-foreground">معدل الربح</p>
          <p className="text-xl sm:text-2xl font-bold text-warning">{winRate}%</p>
        </Card>
      </div>

      {/* Active Cases Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">القضايا النشطة</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow key={case_.id}>
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
                          {getStatusLabel(case_.status)}
                        </Badge>
                      );
                    })()}
                    {case_.outcome && (
                      <div className="text-xs text-muted-foreground mt-1 hidden sm:block">
                        {getOutcomeLabel(case_.outcome)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="sm:px-6 sm:text-sm hidden lg:table-cell">
                    {format(case_.createdDate, 'dd/MM/yyyy')}
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

      {filteredActiveCases.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">لا نتائج مطابقة لبحثك. جرّب كلمات أخرى.</p>
        </div>
      )}

      {/* Completed Cases Section */}
      {completedCases.length > 0 && (
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
                    <TableRow key={case_.id}>
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
                          const map = {
                            won: { variant: 'success' as const, Icon: CircleCheck },
                            lost: { variant: 'destructive' as const, Icon: CircleX },
                            settled: { variant: 'warning' as const, Icon: Handshake }
                          };
                          const { variant, Icon } =
                            map[case_.outcome as keyof typeof map] ?? map.settled;
                          return (
                            <Badge variant={variant}>
                              <Icon aria-hidden="true" />
                              {getOutcomeLabel(case_.outcome)}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {format(case_.updatedDate, 'dd/MM/yyyy')}
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