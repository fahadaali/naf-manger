// طبقةُ البيانات — تنادي مسارات المنصة على D1.
//
// كلُّ نداءٍ يمرّ بالـWorker، ودورُ العضو يُقرأ هناك. فلا مفتاح قاعدةٍ في
// الحزمة، ولا جدولَ يُبلَغ بغير مسارٍ محروس، ولا نداءَ من متصفّحٍ إلى قاعدةٍ
// رأساً.

import { Client, Prospect, Case, User, ActivityLog, SystemSettings } from '../types';
import { CustomReport, Prediction, AnalyticsInsight, PredictiveModel } from '../types';
import { Marketer, CommissionPayment, MarketerStats } from '../types';
import { api, ApiError, toDate, toOptionalDate } from './api';

/* ═══ التواريخ ═══
   JSON لا يحمل نوع `Date`، فتصل نصّاً وتُحوَّل هنا مرّةً واحدة — لا في كل
   مكوّن، وإلا نسي أحدُها فقارن نصّاً بتاريخ وأعطى ترتيباً خاطئاً بلا خطأ. */

const asClient = (row: any): Client => ({
  ...row,
  joinDate: toDate(row.joinDate),
});

const asProspect = (row: any): Prospect => ({
  ...row,
  joinDate: toDate(row.joinDate),
  followUpDate: toOptionalDate(row.followUpDate),
});

const asCase = (row: any): Case => ({
  ...row,
  createdDate: toDate(row.createdDate),
  updatedDate: toDate(row.updatedDate),
});

const asMarketer = (row: any): Marketer => ({
  ...row,
  startDate: toDate(row.startDate),
  createdDate: toDate(row.createdDate),
  updatedDate: toDate(row.updatedDate),
});

const asActivity = (row: any): ActivityLog => ({
  ...row,
  timestamp: toDate(row.timestamp ?? row.createdAt),
});

const asUser = (row: any): User => ({
  ...row,
  createdDate: toDate(row.createdDate),
  lastLogin: toOptionalDate(row.lastLogin),
});

const asPayment = (row: any): CommissionPayment => ({
  ...row,
  paymentDate: toDate(row.paymentDate),
});

/* قائمةٌ تسقط لا تُسقط الشاشة معها: تُسجَّل ويُعاد فراغ، فتعرض الشاشة
   حالتَها الفارغة. أمّا الكتابة فتُرمى — من ضغط «حفظ» يجب أن يعرف. */
async function listOr<T>(work: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'unauthorized') return [];
    console.error(`تعذّر جلب ${label}:`, error);
    return [];
  }
}

export class LocalDatabase {
  // ── العملاء ──
  async getClients(): Promise<Client[]> {
    return (await listOr(api.list<any>('clients'), 'العملاء')).map(asClient);
  }

  async getClient(id: string): Promise<Client | undefined> {
    try {
      return asClient(await api.get<any>('clients', id));
    } catch {
      return undefined;
    }
  }

  async createClient(clientData: Omit<Client, 'id'>): Promise<Client | null> {
    return asClient(await api.create<any>('clients', clientData));
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
    return asClient(await api.update<any>('clients', id, updates));
  }

  async deleteClient(id: string): Promise<boolean> {
    await api.remove('clients', id);
    return true;
  }

  // ── العملاء المحتملون ──
  async getProspects(): Promise<Prospect[]> {
    return (await listOr(api.list<any>('prospects'), 'العملاء المحتملين')).map(asProspect);
  }

  async getProspect(id: string): Promise<Prospect | undefined> {
    try {
      return asProspect(await api.get<any>('prospects', id));
    } catch {
      return undefined;
    }
  }

  async createProspect(prospectData: Omit<Prospect, 'id'>): Promise<Prospect | null> {
    return asProspect(await api.create<any>('prospects', prospectData));
  }

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect | null> {
    return asProspect(await api.update<any>('prospects', id, updates));
  }

  async deleteProspect(id: string): Promise<boolean> {
    await api.remove('prospects', id);
    return true;
  }

  /* التحويل فعلٌ واحد على الخادم لا اثنان هنا: إنشاءٌ ثم حذفٌ من المتصفّح
     يترك محتملاً نُسخ ولم يُحذف إن انقطعت الشبكة بينهما. */
  async convertProspectToClient(prospectId: string): Promise<Client | null> {
    return asClient(await api.post<any>(`/prospects/${encodeURIComponent(prospectId)}/convert`));
  }

  // ── القضايا ──
  async getCases(): Promise<Case[]> {
    return (await listOr(api.list<any>('cases'), 'القضايا')).map(asCase);
  }

  async getCase(id: string): Promise<Case | undefined> {
    try {
      return asCase(await api.get<any>('cases', id));
    } catch {
      return undefined;
    }
  }

  async getCasesByClient(clientId: string): Promise<Case[]> {
    return (await this.getCases()).filter((item) => item.clientId === clientId);
  }

  async createCase(caseData: Omit<Case, 'id'>): Promise<Case | null> {
    return asCase(await api.create<any>('cases', caseData));
  }

  async updateCase(id: string, updates: Partial<Case>): Promise<Case | null> {
    return asCase(await api.update<any>('cases', id, updates));
  }

  async deleteCase(id: string): Promise<boolean> {
    await api.remove('cases', id);
    return true;
  }

  /* ═══ الأعضاء ═══
     المصادقة مركزية: لا يُنشأ عضوٌ من هنا ولا تُحذف هوية. المركز يمنح
     الوصول، وأولُ دخولٍ يُنشئ الصفّ، وهذه الشاشة ترقّي وتوقف لا أكثر. */
  async getUsers(): Promise<User[]> {
    return (await listOr(api.read<any[]>('/members'), 'الأعضاء')).map(asUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    return (await this.getUsers()).find((user) => user.id === id);
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const body = await api.read<{ user: any }>('/me');
      return asUser((body as any).user ?? body);
    } catch {
      return null;
    }
  }

  /* الاسم والبريد يأتيان من المركز ويُكتبان عند كل دخول، فتعديلُهما محلياً
     يُدهس في الدخول التالي. وموضعُ تغييرهما هو المركز. */
  async updateCurrentUser(): Promise<User | null> {
    throw new ApiError('managed_by_center', 409);
  }

  async createUser(): Promise<User | null> {
    throw new ApiError('managed_by_center', 409);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    await api.patch(`/members/${encodeURIComponent(id)}`, updates);
    return (await this.getUser(id)) ?? null;
  }

  /* الحذف يُيتّم سجلَّ الأنشطة، والإيقاف يقوم مقامه: الوسيط يقرأ حالة
     التفعيل في كل طلب محميّ، فيسري في الطلب التالي لا عند انتهاء الكوكي. */
  async deleteUser(id: string): Promise<boolean> {
    await api.patch(`/members/${encodeURIComponent(id)}`, { isActive: false });
    return true;
  }

  // ── الأنشطة ──
  async getActivities(): Promise<ActivityLog[]> {
    return (await listOr(api.list<any>('activities'), 'الأنشطة')).map(asActivity);
  }

  async addActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<ActivityLog | null> {
    try {
      return asActivity(await api.create<any>('activities', activity));
    } catch (error) {
      // أثرٌ تعذّر تسجيله لا يُسقط الفعل الذي وقع.
      console.error('تعذّر تسجيل النشاط:', error);
      return null;
    }
  }

  // ── الإعدادات ──
  async getSettings(): Promise<SystemSettings> {
    return await api.read<SystemSettings>('/settings');
  }

  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    return await api.patch<SystemSettings>('/settings', updates);
  }

  // ── إحصاءات ──
  async getStats() {
    return await api.read<any>('/stats');
  }

  // ── المسوّقون ──
  async getMarketers(): Promise<Marketer[]> {
    return (await listOr(api.list<any>('marketers'), 'المسوّقين')).map(asMarketer);
  }

  async getMarketer(id: string): Promise<Marketer | undefined> {
    try {
      return asMarketer(await api.get<any>('marketers', id));
    } catch {
      return undefined;
    }
  }

  async createMarketer(marketerData: Omit<Marketer, 'id'>): Promise<Marketer | null> {
    return asMarketer(await api.create<any>('marketers', marketerData));
  }

  async updateMarketer(id: string, updates: Partial<Marketer>): Promise<Marketer | null> {
    return asMarketer(await api.update<any>('marketers', id, updates));
  }

  async deleteMarketer(id: string): Promise<boolean> {
    await api.remove('marketers', id);
    return true;
  }

  async getMarketerStats(marketerId: string): Promise<MarketerStats> {
    return await api.read<MarketerStats>(`/marketers/${encodeURIComponent(marketerId)}/stats`);
  }

  async getCommissionPayments(): Promise<CommissionPayment[]> {
    return (await listOr(api.list<any>('commissions'), 'العمولات')).map(asPayment);
  }

  async createCommissionPayment(
    paymentData: Omit<CommissionPayment, 'id'>,
  ): Promise<CommissionPayment | null> {
    return asPayment(await api.create<any>('commissions', paymentData));
  }

  // ── التصدير ──
  async exportAllData(): Promise<any> {
    return await api.read<any>('/export');
  }

  /* ═══ ما لم يُبنَ بعد ═══
     التقارير المخصّصة والتنبؤات والاستبصارات أغلفةٌ فارغة: لا جدول لها في
     D1 ولا مسار، وبناؤها عملٌ جديد. والفراغُ هنا صريحٌ كي لا تُقرأ الشاشةُ
     على أنها تحفظ شيئاً. */
  getCustomReports(): CustomReport[] {
    return [];
  }

  createCustomReport(reportData: Omit<CustomReport, 'id'>): CustomReport {
    return { ...reportData, id: Date.now().toString() } as CustomReport;
  }

  updateCustomReport(): CustomReport | null {
    return null;
  }

  deleteCustomReport(): boolean {
    return true;
  }

  generateReportData(): Promise<any[]> {
    return Promise.resolve([]);
  }

  getPredictions(): Prediction[] {
    return [];
  }

  savePrediction(): void {}

  getAnalyticsInsights(): AnalyticsInsight[] {
    return [];
  }

  saveAnalyticsInsight(): void {}

  getPredictiveModels(): PredictiveModel[] {
    return [];
  }
}

// إنشاء مثيل واحد من قاعدة البيانات
export const db = new LocalDatabase();
