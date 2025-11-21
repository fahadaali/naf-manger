// Core Types for NAF Law System
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
  createdDate: Date;
  updatedDate: Date;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadDate: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // For local storage demo purposes
  role: 'admin' | 'lawyer' | 'staff';
  avatar?: string;
  permissions: UserPermissions;
  createdDate: Date;
  lastLogin?: Date;
  profilePicture?: string; // Base64 encoded image or URL
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

export interface PredictiveModel {
  id: string;
  name: string;
  type: 'case_outcome' | 'case_duration' | 'prospect_conversion' | 'client_satisfaction';
  accuracy: number;
  lastTrained: Date;
  features: string[];
  parameters: Record<string, any>;
}

export interface Prediction {
  id: string;
  modelId: string;
  entityId: string;
  entityType: 'case' | 'prospect' | 'client';
  prediction: any;
  confidence: number;
  factors: Array<{
    factor: string;
    impact: number;
    description: string;
  }>;
  createdDate: Date;
  isActive: boolean;
}

export interface AnalyticsInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'recommendation' | 'prediction';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'efficiency' | 'revenue' | 'client_satisfaction';
  data: any;
  actionable: boolean;
  suggestedActions?: string[];
  createdDate: Date;
  isRead: boolean;
}

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

// تحديث نوع Case لإضافة معلومات المسوّق والأتعاب
export interface EnhancedCase extends Case {
  marketerId?: string;
  marketerName?: string;
  feeStructure?: FeeStructure;
  paymentStatus?: PaymentStatus;
  commissionStructure?: CommissionStructure;
  commissionPayments?: CommissionPayment[];
  totalCommissionPaid?: number;
  remainingCommission?: number;
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