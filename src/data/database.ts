// طبقةُ البيانات — تنادي مسارات المنصة على D1.
//
// كلُّ نداءٍ يمرّ بالـWorker، ودورُ العضو يُقرأ هناك. فلا مفتاح قاعدةٍ في
// الحزمة، ولا جدولَ يُبلَغ بغير مسارٍ محروس، ولا نداءَ من متصفّحٍ إلى قاعدةٍ
// رأساً.

import { Client, Prospect, Case, User, ActivityLog, SystemSettings } from '../types';
import { CustomReport, DisplayToken, Marketer, CommissionPayment, MarketerStats } from '../types';
import { AiInsightsResult, Meeting, ReportResult } from '../types';
import { BasecampProject, BasecampSample, BasecampScan, BasecampStatus } from '../types';
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

const asReport = (row: any): CustomReport => ({
  ...row,
  createdDate: toDate(row.createdDate),
  lastModified: toDate(row.lastModified),
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

  /* ═══ الإعدادات — نداءٌ واحد لا خمسة ═══
   *
   * خمسة مكوّنات تطلبها بأنفسها: الترويسة والشريط عند كل فتحةِ منصة، ثم
   * الإعداداتُ العامة وتكوينُ النظام والبريد داخل شاشة الإعدادات. وهي
   * كائنٌ واحد لا يتغيّر بينها، فكانت خمسَ رحلاتٍ إلى الخادم لنتيجةٍ
   * واحدة — وأبطأُ ما في الإقلاع رحلتان متزامنتان لا يحتاج إليهما أحد.
   *
   * فالوعدُ يُحفظ ويُشارَك: النداءات المتزامنة تنتظر واحداً، واللاحقةُ
   * تقرأ المحفوظ. ويُنقض عند الكتابة فلا يُقرأ قديمٌ بعد حفظ. */
  private settingsCache: Promise<SystemSettings> | null = null;

  async getSettings(): Promise<SystemSettings> {
    if (!this.settingsCache) {
      /* الوعدُ يُنسى إن سقط، وإلّا حُفظ السقوطُ نفسُه فتوارثته كلُّ محاولة
         تالية ولم تُعد المنصةُ تقرأ إعداداتها حتى تُحمَّل الصفحة. */
      this.settingsCache = api.read<SystemSettings>('/settings').catch((error) => {
        this.settingsCache = null;
        throw error;
      });
    }
    return this.settingsCache;
  }

  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    const saved = await api.patch<SystemSettings>('/settings', updates);
    this.settingsCache = Promise.resolve(saved);
    return saved;
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

  /* ═══ استبصارات التحليلات ═══
     الاستدلال على Workers AI داخل الـWorker، وما يُمرَّر إليه أرقامٌ
     مجمَّعة وحدها — التفصيل في `worker/lib/insights.js`.
     ولا `listOr` هنا: سقوطُه يجب أن يبلغ الشاشة لتقول سببَه — «غير مربوط»
     غيرُ «تعذّر الاستدلال»، والصمتُ يخلطهما. */
  async getInsights(refresh = false): Promise<AiInsightsResult> {
    return await api.read<AiInsightsResult>(`/insights${refresh ? '?refresh=1' : ''}`);
  }

  /* ═══ ربط بيسكامب ═══
     الاتّجاه واحد: يُقرأ منه ولا يُكتب فيه. ولا `listOr` في شيءٍ منها —
     شاشةُ الربط تعرض سببَ السقوط، و«لم يُسجَّل التطبيق» غيرُ «لم يُربط
     الحساب» غيرُ «بُدِّل المفتاح». والصمتُ يخلط الثلاثة. */
  async getBasecampStatus(): Promise<BasecampStatus> {
    return await api.read<BasecampStatus>('/basecamp/status');
  }

  async getBasecampProjects(): Promise<BasecampProject[]> {
    return await api.read<BasecampProject[]>('/basecamp/projects');
  }

  async scanBasecamp(): Promise<BasecampScan> {
    return await api.post<BasecampScan>('/basecamp/scan');
  }

  async classifyBasecampProject(
    projectId: string,
    kind: 'client' | 'internal',
  ): Promise<{ projectId: string; kind: string; decidedByHand: boolean }> {
    return await api.patch(`/basecamp/projects/${encodeURIComponent(projectId)}`, { kind });
  }

  async getBasecampSample(projectId: string): Promise<BasecampSample> {
    return await api.read<BasecampSample>(
      `/basecamp/sample?project=${encodeURIComponent(projectId)}`,
    );
  }

  async disconnectBasecamp(): Promise<void> {
    await api.del('/basecamp/connection');
  }

  /* ═══ رموز شاشات العرض ═══
     رابطٌ عامّ يُعلَّق في ممرّ ولا يسجّل دخولاً. وما يُقرأ به إحصاءاتٌ
     مجمَّعة وحدها — التفصيل في `worker/lib/display.js`. */
  async getDisplayTokens(): Promise<DisplayToken[]> {
    return await listOr(api.read<DisplayToken[]>('/display-tokens'), 'روابط العرض');
  }

  async createDisplayToken(label: string): Promise<DisplayToken> {
    return await api.post<DisplayToken>('/display-tokens', { label });
  }

  async deleteDisplayToken(token: string): Promise<boolean> {
    await api.remove('display-tokens', token);
    return true;
  }

  // ── التصدير ──
  async exportAllData(): Promise<any> {
    return await api.read<any>('/export');
  }

  /* ═══ التقارير المخصّصة ═══
     كانت هذه أغلفةً تُرجع فراغاً: `getCustomReports() → []` و
     `updateCustomReport() → null` و`generateReportData() → []` — وثلاثُ
     شاشاتٍ فوقها تَعِد بالحفظ. والآن جدولٌ في D1 ومساراتٌ في الـWorker،
     والاستعلام يُبنى هناك بقائمةٍ بيضاء لا من نصّ المستخدم. */
  async getCustomReports(): Promise<CustomReport[]> {
    return (await listOr(api.read<any[]>('/reports'), 'التقارير')).map(asReport);
  }

  async createCustomReport(report: Partial<CustomReport>): Promise<CustomReport> {
    return asReport(await api.post<any>('/reports', report));
  }

  async updateCustomReport(id: string, updates: Partial<CustomReport>): Promise<CustomReport> {
    return asReport(await api.patch<any>(`/reports/${encodeURIComponent(id)}`, updates));
  }

  async deleteCustomReport(id: string): Promise<boolean> {
    await api.remove('reports', id);
    return true;
  }

  /** تشغيلُ تقريرٍ محفوظ. */
  async runReport(id: string): Promise<ReportResult> {
    return await api.read<ReportResult>(`/reports/${encodeURIComponent(id)}/run`);
  }

  /** معاينةُ تعريفٍ لم يُحفظ — يستعملها الباني قبل الحفظ. */
  async previewReport(definition: Partial<CustomReport>): Promise<ReportResult> {
    return await api.post<ReportResult>('/reports/preview', definition);
  }

  /* ═══ الاجتماعات ═══
     تُنشأ عند Zoom من الـWorker: سرُّ المزوّد لا يُشحن في حزمة المتصفّح. */
  async getMeetings(subject?: { type: 'client' | 'prospect'; id: string }): Promise<Meeting[]> {
    const query = subject ? `?subjectType=${subject.type}&subjectId=${encodeURIComponent(subject.id)}` : '';
    return await listOr(api.read<Meeting[]>(`/meetings${query}`), 'الاجتماعات');
  }

}

// إنشاء مثيل واحد من قاعدة البيانات
export const db = new LocalDatabase();
