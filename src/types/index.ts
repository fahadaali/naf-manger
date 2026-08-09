// Core Types for the NAF client management system
export interface Client {
  id: string;
  fullName: string;
  idNumber: string;
  phone: string;
  email: string;
  joinDate: Date;
  clientType: 'individual' | 'company' | 'association' | 'government';
  status: 'current' | 'former';
  notes: string;
  attachments: Attachment[];
  /* الحقل قائمٌ في المخطَّط (`clients.profile_picture`) وفي خريطة الأعمدة
     في `resources.js`، وتقرؤه الشاشات وتكتبه — وكان ساقطاً من النوع وحده،
     فيُقرأ كلُّ استعمالٍ له خطأً في الفحص بينما هو يعمل. */
  profilePicture?: string;
  // Company specific fields
  commercialRegister?: string;
  legalRepresentative?: {
    name: string;
    idNumber: string;
    contact: string;
  };
}

export interface Prospect {
  id: string;
  fullName: string;
  idNumber: string;
  phone: string;
  email: string;
  joinDate: Date;
  clientType: 'individual' | 'company' | 'association' | 'government';
  prospectStatus: string; // Dynamic status from system settings
  notes: string;
  attachments: Attachment[];
  profilePicture?: string; // `prospects.profile_picture`
  // Company specific fields
  commercialRegister?: string;
  legalRepresentative?: {
    name: string;
    idNumber: string;
    contact: string;
  };
  // Prospect specific fields
  source?: string; // How they found us
  expectedValue?: number; // Expected contract value
  followUpDate?: Date;
  assignedTo?: string; // User ID
}

export interface Case {
  id: string;
  caseNumber: string;
  caseType: string;
  clientId: string;
  clientName: string;
  summary: string;
  status: 'pending' | 'completed' | 'postponed' | 'in-progress';
  outcome?: 'won' | 'lost' | 'settled';
  basecampUrl?: string;
  /** أوراق القضية في حاوية R2 — `migrations/0004`. */
  attachments?: Attachment[];
  createdDate: Date;
  updatedDate: Date;

  /* ═══ المسوّق والماليّة ═══
   *
   * كانت هذه الحقول في نوعٍ ثانٍ اسمُه `EnhancedCase extends Case` لا
   * يستعمله أحد — وهي في المخطَّط (`cases.marketer_id` وأخواتها) وفي
   * خريطة الأعمدة في `worker/lib/resources.js`، وتقرؤها الشاشات وتكتبها.
   *
   * فكان كلُّ وصولٍ إليها يلتفّ بـ`(case_ as any)`: ثلاثةَ عشرَ التفافاً في
   * `CaseModal` وستّةً في `MarketerModal`. والالتفاف يُسقط الفحص عن ماليّة
   * القضايا كلِّها — وهي أكثر ما فيه أرقام.
   *
   * والنوعان صارا واحداً: `db.getCases()` يردّ هذا، والشاشات تقرؤه مفحوصاً. */
  marketerId?: string;
  marketerName?: string;
  feeStructure?: FeeStructure;
  paymentStatus?: PaymentStatus;
  commissionStructure?: CommissionStructure;
  commissionPayments?: CommissionPayment[];
  totalCommissionPaid?: number;
  remainingCommission?: number;
}

/**
 * مرفقٌ في حاوية R2.
 *
 * `key` لا `url`: العنوان يُشتقّ من المفتاح بـ`fileUrl` ويتغيّر بتغيّر
 * النطاق، والمفتاح ثابتٌ في الحاوية. وحفظُ عنوانٍ كاملاً في الصفّ يجعل
 * نقلَ النطاق يُيتّم كل مرفقٍ مخزَّن.
 *
 * و`uploadDate` نصٌّ لا `Date`: هذه البنية تُسلسَل JSON في عمود
 * `attachments`، وJSON لا يحمل نوع `Date` — فحفظُها كائناً يعيدها نصّاً
 * ولا يعرف القارئ ذلك.
 */
export interface Attachment {
  id: string;
  name: string;
  type: string;
  /** مفتاح الكائن: `attachment/<uuid>`. */
  key: string;
  size: number;
  /** ISO 8601. */
  uploadedAt: string;
}

/**
 * نتيجةُ تشغيل تقرير.
 *
 * `columns` تأتي من الخادم ولا تُشتقّ من أول صفّ: صفٌّ تخلو فيه قيمةٌ
 * يُسقط عمودَها من `Object.keys`، فتنقص ترويسةُ الجدول بلا سبب ظاهر.
 */
export interface ReportResult {
  rows: Record<string, string | number | null>[];
  columns: string[];
  grouped: boolean;
}

/** اجتماعٌ أُنشئ عند المزوّد وحُفظ في D1 — `migrations/0006`. */
export interface Meeting {
  id: string;
  /** معرّفُه عند Zoom — وهو ما يُملى على المدعوّ. */
  providerId: string;
  joinUrl: string;
  /** رابطُ البدء مضيفاً. يُردّ لمنشئه مرّةً ولا يُعاد في السرد. */
  startUrl?: string | null;
  topic: string;
  agenda: string;
  /** ثوانٍ. */
  startAt: number;
  duration: number;
  passcode?: string | null;
  subjectType?: 'client' | 'prospect' | null;
  subjectId?: string | null;
  invitees: string[];
  createdAt: number;
}

/**
 * رمزُ شاشة عرض.
 *
 * `token` سرٌّ في العنوان — من ملكه قرأ الإحصاءات المجمَّعة. ولذلك يُعرض
 * في الشاشة مرّةً لينسخه المسؤول، ويُبطَل بالحذف.
 */
export interface DisplayToken {
  token: string;
  label: string;
  /** ثوانٍ، كأعمدة الجدول. */
  createdAt: number;
  lastSeenAt: number | null;
}

/** تفضيلاتُ إشعارات العضو — مفاتيحُها عقدٌ مع `updateMe` في الخادم. */
export interface NotificationPrefs {
  newClients: boolean;
  newCases: boolean;
  caseUpdates: boolean;
  newProspects: boolean;
  followUps: boolean;
  payments: boolean;
  userLogin: boolean;
  backups: boolean;
  updates: boolean;
  errors: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'lawyer' | 'staff';
  permissions: UserPermissions;
  createdDate: Date;
  lastLogin?: Date;
  isActive?: boolean;
  /* `password` و`avatar` كانا هنا من عهد التخزين المحلي: لا كلمةَ مرورٍ
     في هذه المنصة أصلاً — الهوية في المركز — ولا حقلَ `avatar` يقرؤه أحد. */
  /** مفتاح الصورة في حاوية R2 — `avatar/<uuid>`. */
  avatarKey?: string;
  /** عنوانُ قراءة الصورة، مشتقٌّ من المفتاح. لا بايتات فيه. */
  profilePicture?: string;
  notificationPrefs?: NotificationPrefs;
}

export interface UserPermissions {
  clients: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  prospects: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    convert: boolean;
  };
  cases: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  analytics: {
    read: boolean;
  };
  settings: {
    read: boolean;
    update: boolean;
  };
  users: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  marketers: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
}

export interface ActivityLog {
  id: string;
  type: 'client_created' | 'client_updated' | 'client_deleted' | 'prospect_created' | 'prospect_updated' | 'prospect_deleted' | 'prospect_converted' | 'case_created' | 'case_updated' | 'case_deleted' | 'user_login' | 'user_created' | 'marketer_created' | 'marketer_updated' | 'marketer_deleted';
  description: string;
  userId: string;
  userName: string;
  entityId?: string;
  entityType?: 'client' | 'prospect' | 'case' | 'user' | 'marketer';
  timestamp: Date;
  details?: Record<string, any>;
}

export interface DashboardStats {
  totalClients: number;
  totalProspects: number;
  totalCases: number;
  pendingCases: number;
  completedCases: number;
  winRate: number;
  clientsByType: Record<string, number>;
  prospectsByStatus: Record<string, number>;
  casesByStatus: Record<string, number>;
  conversionRate: number; // Prospects to clients conversion rate
}

export interface SystemSettings {
  clientTypes: string[];
  clientStatuses: string[];
  prospectStatuses: string[];
  prospectSources: string[];
  caseTypes: string[];
  caseStatuses: string[];
  // إعدادات المسوّقين
  marketerStatuses: string[];
  relationshipTypes: string[];
  commissionTypes: string[];
  collectionStatuses: string[];
  feeTypes: string[];
  // إعدادات عامة
  companyName?: string;
  companyDescription?: string;
  companyLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  // إعدادات البريد الإلكتروني
  emailSettings?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromAddress: string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
}

// Advanced Reports & Analytics Types
export interface ReportField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  source: 'clients' | 'prospects' | 'cases' | 'users' | 'activities';
  aggregatable?: boolean;
  options?: string[]; // For select fields
}

export interface ReportFilter {
  id: string;
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface ReportGrouping {
  fieldId: string;
  order: 'asc' | 'desc';
}

export interface ReportAggregation {
  fieldId: string;
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  alias?: string;
}

export interface ReportVisualization {
  type: 'table' | 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
}

export interface CustomReport {
  id: string;
  name: string;
  description?: string;
  dataSource: 'clients' | 'prospects' | 'cases' | 'users' | 'activities' | 'mixed';
  fields: string[]; // Field IDs
  filters: ReportFilter[];
  grouping?: ReportGrouping[];
  aggregations?: ReportAggregation[];
  visualization: ReportVisualization;
  isTemplate: boolean;
  isPublic: boolean;
  createdBy: string;
  createdDate: Date;
  lastModified: Date;
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    nextRun?: Date;
  };
}

/* كان هنا `PredictiveModel` و`Prediction` و`AnalyticsInsight` — ثلاثةُ
   أنواعٍ لنمذجةٍ تنبؤية لم تُبنَ: لا جدول لها في D1 ولا مسار، وأغلفتُها في
   `database.ts` كانت تُرجع فراغاً ولا يناديها مكوّن. وبناؤها عملٌ جديد
   يبدأ من قرارٍ لا من نوعٍ متروك. */

// Marketers Management Types
export interface Marketer {
  id: string;
  fullName: string;
  idNumber: string;
  phone: string;
  email: string;
  relationshipType: 'employee' | 'freelancer' | 'external_company';
  startDate: Date;
  status: 'active' | 'suspended' | 'former';
  notes: string;
  profilePicture?: string; // `marketers.profile_picture`
  createdDate: Date;
  updatedDate: Date;
}

export interface FeeStructure {
  type: 'advance_only' | 'deferred_only' | 'advance_and_deferred';
  advance?: {
    feeType: 'fixed_amount' | 'percentage';
    value: number;
    baseAmount?: number; // للنسبة المئوية
  };
  deferred?: {
    feeType: 'fixed_amount' | 'percentage';
    value: number;
    baseAmount?: number; // للنسبة المئوية
  };
}

export interface CommissionStructure {
  type: 'fixed_amount' | 'percentage';
  value: number;
  baseAmount?: number; // للنسبة المئوية من الأتعاب المحصلة
}

export interface PaymentStatus {
  totalAmount: number;
  collectedAmount: number;
  remainingAmount: number;
  collectionStatus: 'fully_paid' | 'partially_paid' | 'unpaid';
  lastPaymentDate?: Date;
}

export interface CommissionPayment {
  id: string;
  marketerId: string;
  caseId: string;
  amount: number;
  paymentDate: Date;
  notes?: string;
  createdBy: string;
}

export interface MarketerStats {
  totalCases: number;
  completedCases: number;
  wonCases: number;
  lostCases: number;
  totalRevenue: number;
  totalCommissionEarned: number;
  totalCommissionPaid: number;
  remainingCommission: number;
  conversionRate: number;
  averageCaseValue: number;
}