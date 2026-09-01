// Core Types for the NAF client management system
/**
 * رقمٌ في ملفّ العميل، ومعه صفةُ صاحبه.
 *
 * ملفُّ الموكّل يحمل أرقاماً لغيره — لوكيله ولأبيه — وعمودٌ واحد كان
 * يُسقطها. و`relation` من `contactRelations` في الإعدادات.
 */
export interface ContactNumber {
  number: string;
  relation: string;
  /** اسمُ صاحب الرقم إن ذُكر — «أخوه محمد». */
  name?: string;
}

/**
 * فعلٌ على جملةِ صفوفٍ محدَّدة.
 *
 * و«الأرشفة» ليست حذفاً مؤجَّلاً: الصفُّ يبقى بمعرّفه وإشاراته، فقضيةٌ
 * لا تنقطع عن عميلها المؤرشف. إنّما يخرج من القائمة على من يبحث في
 * الحاضر — ويعود بـ`restore`.
 */
export type BulkAction = 'delete' | 'archive' | 'restore';

export interface BulkOutcome {
  /** كم صفّاً أصابه الفعل فعلاً. */
  affected: number;
  /** وكم طُلب — والفرقُ صفوفٌ حذفها غيرُك قبلك. */
  requested: number;
}

export interface Client {
  id: string;
  fullName: string;
  /** يجوز أن يغيب: لا يُفبرك رقمٌ لمن لا هوية له. */
  idNumber?: string;
  /** من `idTypes` — هوية وطنية | إقامة | سجل تجاري. */
  idType?: string;
  /** الرقم الأول. وبقيتُها في `contacts`. */
  phone: string;
  contacts?: ContactNumber[];
  email: string;
  joinDate: Date;
  clientType: 'individual' | 'company' | 'association' | 'government';
  status: 'current' | 'former';
  notes: string;
  /** ملخّصُ قضاياه مجتمعةً — يكتبه التلخيصُ الآليّ، ويُعرض تحت الملاحظات. */
  aiSummary?: string | null;
  aiSummaryAt?: string | null;
  /** لحظةُ الأرشفة نصّاً ISO — وغيابُها يعني «حاضر». */
  archivedAt?: string | null;
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
  idNumber?: string;
  idType?: string;
  phone: string;
  contacts?: ContactNumber[];
  email: string;
  joinDate: Date;
  clientType: 'individual' | 'company' | 'association' | 'government';
  prospectStatus: string; // Dynamic status from system settings
  notes: string;
  archivedAt?: string | null;
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
  /**
   * حاشيةٌ على القضية — غيرُ الموضوع.
   *
   * فـ`summary` موضوعُ المشروع، والملاحظةُ ما يُكتب حوله: «الأوراق الأصلية عند
   * وكيله». و«بيانات المشروع» في بيسكامب يحملها، فتُستورد إلى عمودها هي.
   */
  notes?: string;
  /**
   * ملخّصٌ صاغه طرازٌ عند الاستيراد — حقلٌ مستقلٌّ عن `notes` عمداً.
   *
   * فالملاحظاتُ يكتبها المحامي ويأتي فيها ما في «بيانات المشروع»، ونصٌّ
   * آليٌّ لو دخلها لاختلط بما كتبه إنسان فقُرئ بعد شهرٍ كأنه منه.
   * ويُعرض مسمّىً «ملخّصٌ آليّ»، ويُكتب من مصدره لا من الشاشة.
   */
  aiSummary?: string | null;
  /** لحظةُ كتابته نصّاً ISO. */
  aiSummaryAt?: string | null;
  status: 'pending' | 'completed' | 'postponed' | 'in-progress';
  outcome?: 'won' | 'lost' | 'settled';
  basecampUrl?: string;
  /** أوراق القضية في حاوية R2 — `migrations/0004`. */
  attachments?: Attachment[];
  /** لحظةُ الأرشفة نصّاً ISO — وغيابُها يعني «حاضرة». */
  archivedAt?: string | null;
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

  /* ═══ حقولٌ ثلاثةٌ حُذفت ═══
     كانت `commissionPayments` و`totalCommissionPaid` و`remainingCommission`
     مصرَّحةً هنا ولا يكتبها شيء — لا `RESOURCES.cases.fields` ولا الواجهة.
     وجدولُ قضايا المسوّق كان يقرأ الاثنين الأخيرين، فيعرض **٠٫٠٠ ﷼ لكلّ
     قضية** أبداً. والمدفوعُ اليوم يُحسب من `commission_payments` نفسها في
     `MarketerModal`، فلا حقلَ وهميّاً يُقرأ. */
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

/** ملاحظةٌ واحدة من استبصارات التحليلات. */
export interface ApiInsight {
  title: string;
  body: string;
  tone: 'info' | 'warning' | 'opportunity';
  action: string;
}

/**
 * ناتجُ `‎/api/insights‎`.
 *
 * `digest` هو ما مُرِّر إلى الطراز فعلاً — يُردّ ليُقرأ ما بُني عليه الرأي،
 * فلا يُقرأ استنتاجٌ بلا الأرقام التي أنتجته.
 */
export interface AiInsightsResult {
  insights: ApiInsight[];
  digest: Record<string, unknown>;
  model: string;
  /** ثوانٍ. */
  generatedAt: number;
  cached: boolean;
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

/* ═══ ربط بيسكامب ═══
   الاتّجاه واحد: يُقرأ منه ولا يُكتب فيه. والتفصيل في
   `worker/lib/basecamp/`. */

/**
 * حالةُ الربط.
 *
 * و`state` ثلاثيّةٌ لا ثنائية: «لم يُسجَّل التطبيق» غيرُ «لم يُربط الحساب».
 * الأولى يعالجها من يملك أسرارَ المنصة، والثانية ضغطةُ زرٍّ في الشاشة —
 * وخلطُهما يرسل صاحبَ المكتب يبحث في المكان الخطأ.
 */
export interface BasecampStatus {
  state: 'not_configured' | 'not_connected' | 'connected';
  accountName?: string;
  connectedAt?: number;
  syncEnabled?: boolean;
  lastSyncAt?: number | null;
  lastSyncError?: string | null;
  projects?: { total: number; client: number; internal: number; linked: number };
  openConflicts?: number;
  /** أمشغَّلٌ التلخيصُ الآليّ عند الاستيراد؟ */
  aiEnabled?: boolean;
  /** ما يستحقّ نظرَ إنسان ولم يُحسم — ولا يحجب استيراداً. */
  openReviews?: number;
  conflictPolicy?: 'ask' | 'basecamp' | 'platform';
}

/**
 * صفٌّ يستحقّ نظرَ إنسان — تكتبه المزامنةُ وتمضي.
 *
 * ولا يحجب شيئاً: الاستيرادُ وقع، وهذا سؤالٌ عنه. ويُحسم مرّةً فلا يعود —
 * الصفُّ فريدٌ بـ(المشروع + نوع السؤال + القيمة المسؤول عنها).
 */
export interface BasecampReview {
  id: string;
  kind: 'project_kind' | 'case_type' | 'unresolved_value' | 'similar_client' | 'generated_number';
  kindLabel: string;
  projectId: string;
  projectName: string;
  appUrl: string;
  /** تصنيفُ المشروع الآن — للسؤال عن تصنيفه. */
  projectKind: 'client' | 'internal' | 'unknown' | null;
  caseId: string | null;
  caseNumber: string | null;
  caseType: string | null;
  clientId: string | null;
  clientName: string | null;
  subject: string;
  detail: {
    guessed?: string;
    hasDocument?: boolean;
    suggestion?: string;
    options?: string[];
    target?: string;
    field?: string;
    value?: string;
    codes?: Record<string, string>;
    generated?: string;
    newName?: string;
    existingName?: string;
    createdClientId?: string;
  };
  createdAt: number;
}

export interface BasecampProject {
  projectId: string;
  name: string;
  appUrl: string;
  status: 'active' | 'archived' | 'trashed';
  /** أفيه ملفّ «بيانات المشروع»؟ وهو ما يرجّح أنّه مشروعُ عميل. */
  hasDocument: boolean;
  /** واسمُه كما هو عندهم — الجاري أو ما كان قبله. */
  docTitle: string | null;
  docUpdatedAt: string | null;
  kind: 'client' | 'internal' | 'unknown';
  /** صنّفه إنسانٌ بيده — فلا ينقضه مسحٌ لاحق. */
  decidedByHand: boolean;
  clientId: string | null;
  caseId: string | null;
  caseNumber: string | null;
  clientName: string | null;
  lastSyncedAt: number | null;
  lastError: string | null;
}

/** حصيلةُ مسحٍ للحساب. */
export interface BasecampScan {
  scanned: number;
  client: number;
  internal: number;
  failed: number;
  /** بلغ المسرد سقفَ الصفحات ولم يكتمل — يُقال ولا يُبتلع. */
  incomplete: boolean;
  /** ملفّاتٌ عُرفت بمعرّفها بعد أن تبدّل عنوانُها عندهم. */
  renamed: number;
  /** وعناوينُها الجديدة — تُعرض لتُضاف إلى المقبولة. */
  renamedTitles: string[];
}

/** نصُّ «بيانات المشروع» كما هو — تُبنى عليه خريطةُ الحقول. */
export interface BasecampSample {
  projectId: string;
  projectName: string;
  title: string;
  /** HTML كما يحفظه محرّر بيسكامب. */
  content: string;
  appUrl: string;
  updatedAt: string | null;
}

/** خريطةُ الحقول: عنوانٌ في «بيانات المشروع» ← حقلٌ في المنصة. */
export interface BasecampMap {
  map: Record<string, string>;
  targets: Record<string, { label: string; entity: 'client' | 'case'; required?: boolean }>;
  defaults: Record<string, string>;
  /** عناوينُ الملفّ المقبولة — أوّلُها الجاري وما بعده ما كان قبله. */
  titles: string[];
  defaultTitles: string[];
}

/** ربطٌ يقترحه الطراز لعنوانٍ لا مقابل له — يُراجَع ثم يُحفظ. */
export interface BasecampMapSuggestion {
  suggestions: { label: string; target: string }[];
  /** كلُّ العناوين التي لا ربط لها — ومنها ما لم يجد الطرازُ له حقلاً. */
  labels: string[];
}

/** ما سيقع لمشروعٍ واحد — تُعرض قبل أن يقع. */
export interface BasecampPlan {
  projectId: string;
  projectName: string;
  appUrl: string;
  error: string | null;
  warnings: string[];
  conflicts: { field: string; platformValue: string; basecampValue: string }[];
  /** عناوينُ في الملفّ بلا مقابلٍ في الخريطة — تُعرض لتُربط، فلا تضيع صامتة. */
  unmapped: string[];
  /**
   * حقولٌ قرأها الطرازُ حين عجزت القاعدة — «client.fullName» وأخواتها.
   *
   * وكلُّ قيمةٍ فيها منقولةٌ من نصّ الملفّ حرفاً ومرّت بمدقّق حقلها. ومع
   * ذلك تُعرض مسمّاةً: أقربُ ما يُخطئ فيه الاستخلاص أن ينقل قيمةً صحيحة
   * إلى الحقل الخطأ، وذلك يُرى في المعاينة قبل أن يُكتب.
   */
  aiFields: string[];
  client:
    | {
        action: 'create_client' | 'link_client';
        fullName: string;
        idNumber: string | null;
        idType: string | null;
        phone: string | null;
        clientType: string | null;
        /** اسمُ مسؤول التواصل إن حمله الملفّ. */
        representative: string | null;
        /** مقصوصةٌ للعرض — والنصُّ كلُّه في الملفّ. */
        notes: string | null;
        contacts: number;
        /** حقولٌ ستُكتب على عميلٍ قائم. */
        changes: string[];
      }
    | null;
  case:
    | {
        action: 'create_case' | 'update_case' | 'none';
        caseNumber: string;
        caseType: string;
        /** نوعٌ اقترحه الطراز لأنّ الملفّ خلا منه — يُراجَع. */
        caseTypeSuggested: boolean;
        status: string | null;
        outcome: string | null;
        notes: string | null;
        changes: string[];
      }
    | null;
}

export interface BasecampSummary {
  projects: number;
  createClients: number;
  linkClients: number;
  updateClients: number;
  createCases: number;
  updateCases: number;
  unchanged: number;
  conflicts: number;
  failed: number;
  warnings: number;
  /** بعد التنفيذ وحده. */
  clientsCreated?: number;
  clientsUpdated?: number;
  casesCreated?: number;
  casesUpdated?: number;
  /**
   * حصيلةُ التلخيص الآليّ.
   *
   * و`deferred` ليس عطلاً: للدورة سقفُ استدلالات، وما زاد يُلخَّص في
   * التي تليها. ويُقال ليُعرف أنّ الباقي آتٍ لا ساقط.
   */
  ai?: {
    enabled: boolean;
    used?: number;
    cases?: number;
    clients?: number;
    deferred?: number;
    failed?: number;
  };
}

export interface BasecampPreview {
  summary: BasecampSummary;
  plans: BasecampPlan[];
}

/** حقلٌ مسّته يدٌ وتبدّل عندهم — يُعرض بالقيمتين ولا يُكتب. */
export interface BasecampConflict {
  id: string;
  projectId: string;
  projectName: string;
  caseId: string | null;
  caseNumber: string | null;
  field: string;
  platformValue: string;
  basecampValue: string;
  detectedAt: number;
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

/**
 * نموُّ مقياسٍ بين شهرين.
 *
 * `percent` يجوز أن يغيب: شهرٌ سابق بلا صفٍّ واحد لا نسبةَ منه — والقسمةُ
 * على صفرٍ تُعرض «‎∞٪‎» أو «‎١٠٠٪‎» وكلاهما كذب. فتُعرض `current` وحدها.
 */
export interface Growth {
  /** ما وقع في الثلاثين يوماً الأخيرة. */
  current: number;
  /** وما وقع في الثلاثين التي قبلها. */
  previous: number;
  percent: number | null;
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
  /* والنموّ لثلاثةٍ فقط: «معدّل الربح» لا عمودَ يقول متى أُغلقت قضيتُه،
     فلا يُقاس نموُّه ولا يُفبرك له رقم. */
  growth?: {
    clients: Growth;
    prospects: Growth;
    cases: Growth;
  };
}

export interface SystemSettings {
  clientTypes: string[];
  clientStatuses: string[];
  prospectStatuses: string[];
  prospectSources: string[];
  caseTypes: string[];
  caseStatuses: string[];
  /** صفةُ صاحب الرقم — أوّلُها الافتراض. */
  contactRelations: string[];
  idTypes: string[];
  // إعدادات المسوّقين
  marketerStatuses: string[];
  relationshipTypes: string[];
  commissionTypes: string[];
  collectionStatuses: string[];
  feeTypes: string[];
  // إعدادات عامة
  companyName?: string;
  companyDescription?: string;
  /** مفتاحُ الشعار في الحاوية — و`null` يمحوه. وصفوفٌ قديمة قد تحمل `data:`. */
  companyLogo?: string | null;
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

/* كانت هنا `LoginCredentials` — بريدٌ وكلمةُ مرور — ولا كلمةَ مرورٍ في
   هذه المنصة أصلاً: الهويةُ في المركز، و`naf-auth` تحرس الجذر. سقطت مع
   `AuthContext.login` وهي مستعمِلُها الوحيد. */

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
  /* المصادرُ الثلاثةُ المبنيّة — مرآةُ `FIELDS` في `worker/lib/reports.js`.
     وكان النوعُ يذكر `users` و`activities` ولا وجودَ لهما هناك ولا في
     `REPORT_FIELDS`، فالمنسدلةُ تعرضهما ولا مخرجَ منهما. */
  source: 'clients' | 'prospects' | 'cases';
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