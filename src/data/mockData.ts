import { Client, Prospect, Case, DashboardStats, ActivityLog, SystemSettings } from '../types';

// Mock data for demonstration
export const mockClients: Client[] = [
  {
    id: '1',
    fullName: 'أحمد محمد العلي',
    idNumber: '1234567890',
    phone: '+966501234567',
    email: 'ahmed.ali@email.com',
    joinDate: new Date('2023-01-15'),
    clientType: 'individual',
    status: 'current',
    notes: 'عميل مهم في القضايا التجارية',
    attachments: []
  },
  {
    id: '2',
    fullName: 'شركة النور للتجارة',
    idNumber: '2345678901',
    phone: '+966502345678',
    email: 'info@alnoor.com',
    joinDate: new Date('2023-02-20'),
    clientType: 'company',
    status: 'current',
    notes: 'شركة متوسطة الحجم تعمل في التجارة',
    attachments: [],
    commercialRegister: '1010123456',
    legalRepresentative: {
      name: 'سارة أحمد',
      idNumber: '3456789012',
      contact: '+966503456789'
    }
  }
];

export const mockProspects: Prospect[] = [
  {
    id: 'p1',
    fullName: 'محمد عبدالرحمن',
    idNumber: '5678901234',
    phone: '+966505678901',
    email: 'mohammed.ar@email.com',
    joinDate: new Date('2024-01-10'),
    clientType: 'individual',
    prospectStatus: 'مهتم',
    notes: 'عميل محتمل مهتم بالاستشارات القانونية',
    attachments: [],
    source: 'موقع إلكتروني',
    expectedValue: 15000,
    followUpDate: new Date('2024-01-25'),
    assignedTo: '1'
  },
  {
    id: 'p2',
    fullName: 'شركة الأمل للمقاولات',
    idNumber: '6789012345',
    phone: '+966506789012',
    email: 'info@alamal.com',
    joinDate: new Date('2024-01-05'),
    clientType: 'company',
    prospectStatus: 'تم التواصل',
    notes: 'شركة مقاولات تحتاج استشارات في العقود',
    attachments: [],
    commercialRegister: '1010987654',
    legalRepresentative: {
      name: 'خالد أحمد',
      idNumber: '7890123456',
      contact: '+966507890123'
    },
    source: 'إحالة من عميل',
    expectedValue: 50000,
    followUpDate: new Date('2024-01-20'),
    assignedTo: '2'
  },
  {
    id: 'p3',
    fullName: 'فاطمة عبدالله',
    idNumber: '4567890123',
    phone: '+966504567890',
    email: 'fatima.abdullah@email.com',
    joinDate: new Date('2023-12-15'),
    clientType: 'individual',
    prospectStatus: 'بانتظار توقيع',
    notes: 'عميلة محتملة في قضية مدنية',
    attachments: [],
    source: 'وسائل التواصل الاجتماعي',
    expectedValue: 8000,
    followUpDate: new Date('2024-01-15'),
    assignedTo: '1'
  }
];

export const mockCases: Case[] = [
  {
    id: '1',
    caseNumber: 'NAF-2023-001',
    caseType: 'قضية تجارية',
    clientId: '1',
    clientName: 'أحمد محمد العلي',
    summary: 'نزاع تجاري حول عقد توريد',
    status: 'in-progress',
    basecampUrl: 'https://basecamp.com/projects/123',
    createdDate: new Date('2023-01-20'),
    updatedDate: new Date('2023-12-15')
  },
  {
    id: '2',
    caseNumber: 'NAF-2023-002',
    caseType: 'قضية عمالية',
    clientId: '2',
    clientName: 'شركة النور للتجارة',
    summary: 'دعوى عمالية من موظف سابق',
    status: 'completed',
    outcome: 'won',
    basecampUrl: 'https://basecamp.com/projects/124',
    createdDate: new Date('2023-02-25'),
    updatedDate: new Date('2023-11-30')
  }
];

export const mockStats: DashboardStats = {
  totalClients: 2,
  totalProspects: 3,
  totalCases: 2,
  pendingCases: 1,
  completedCases: 1,
  winRate: 100,
  clientsByType: {
    'individual': 1,
    'company': 1,
    'association': 0,
    'government': 0
  },
  prospectsByStatus: {
    'مهتم': 1,
    'تم التواصل': 1,
    'بانتظار توقيع': 1,
    'غير مناسب': 0
  },
  casesByStatus: {
    'pending': 0,
    'in-progress': 1,
    'completed': 1,
    'postponed': 0
  },
  conversionRate: 40 // 2 clients converted from 5 total prospects
};

export const mockActivityLogs: ActivityLog[] = [
  {
    id: '1',
    type: 'case_created',
    description: 'تم إضافة قضية جديدة: NAF-2023-001',
    userId: '1',
    userName: 'محمد أحمد النافع',
    entityId: '1',
    entityType: 'case',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    details: { caseNumber: 'NAF-2023-001', clientName: 'أحمد محمد العلي' }
  },
  {
    id: '2',
    type: 'case_updated',
    description: 'تم تحديث حالة القضية NAF-2023-002 إلى مكتملة',
    userId: '2',
    userName: 'سارة أحمد المحامية',
    entityId: '2',
    entityType: 'case',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    details: { caseNumber: 'NAF-2023-002', status: 'completed', outcome: 'won' }
  },
  {
    id: '3',
    type: 'prospect_converted',
    description: 'تم تحويل العميل المحتمل "شركة النور للتجارة" إلى عميل فعلي',
    userId: '1',
    userName: 'محمد أحمد النافع',
    entityId: '2',
    entityType: 'client',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    details: { prospectName: 'شركة النور للتجارة', clientType: 'company' }
  },
  {
    id: '4',
    type: 'prospect_created',
    description: 'تم إضافة عميل محتمل جديد: محمد عبدالرحمن',
    userId: '1',
    userName: 'محمد أحمد النافع',
    entityId: 'p1',
    entityType: 'prospect',
    timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    details: { prospectName: 'محمد عبدالرحمن', prospectStatus: 'مهتم' }
  },
  {
    id: '5',
    type: 'user_login',
    description: 'تسجيل دخول المستخدم',
    userId: '2',
    userName: 'سارة أحمد المحامية',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
  }
];

export const mockSystemSettings: SystemSettings = {
  clientTypes: ['individual', 'company', 'association', 'government'],
  clientStatuses: ['current', 'former'],
  prospectStatuses: ['مهتم', 'تم التواصل', 'بانتظار توقيع', 'غير مناسب', 'تم الرفض'],
  caseTypes: ['قضية تجارية', 'قضية عمالية', 'قضية مدنية', 'قضية جزائية'],
  caseStatuses: ['pending', 'in-progress', 'completed', 'postponed'],
  prospectSources: ['موقع إلكتروني', 'وسائل التواصل الاجتماعي', 'إحالة من عميل', 'إعلان', 'معرض', 'أخرى']
};