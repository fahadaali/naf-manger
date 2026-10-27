// طبقةُ البيانات — تنادي مسارات المنصة على D1.
//
// كلُّ نداءٍ يمرّ بالـWorker، ودورُ العضو يُقرأ هناك. فلا مفتاح قاعدةٍ في
// الحزمة، ولا جدولَ يُبلَغ بغير مسارٍ محروس، ولا نداءَ من متصفّحٍ إلى قاعدةٍ
// رأساً.

import { Client, Prospect, Case, User, ActivityLog, SystemSettings } from '../types';
import { CaseTimeline, InAppNotification, CaseImportPreview, CaseImportRow, ConflictCheck, CustomReport, MailStatus, MemberEntry, DisplayToken, Marketer, ClientPayment, CommissionPayment, MarketerStats, WafeqPayment, WafeqPaymentStatus, WafeqProbe, WafeqRematch, WafeqStatus, WafeqSummary, BasecampResetImpact, WafeqProjectLink, GeneralPayment, Lawyer } from '../types';
import { AiInsightsResult, Meeting, ReportResult } from '../types';
import { BasecampProject, BasecampSample, BasecampScan, BasecampStatus } from '../types';
import { BasecampConflict, BasecampMap, BasecampMapSuggestion, BasecampPreview, BasecampSummary } from '../types';
import { BasecampReview } from '../types';
import { ProspectBoardStatus, ProspectBoardSyncResult, ProspectComment } from '../types';
import { BulkAction, BulkOutcome } from '../types';
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

const asClientPayment = (row: any): ClientPayment => ({
  ...row,
  paymentDate: toDate(row.paymentDate),
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

  async createClient(clientData: Omit<Client, 'id'>): Promise<Client | null> {
    return asClient(await api.create<any>('clients', clientData));
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
    return asClient(await api.update<any>('clients', id, updates));
  }

  /* ═══ عملياتٌ على المحدَّد ═══
     الأرشفةُ تُخرج الصفَّ من القائمة ولا تتلفه، والحذفُ يتلفه — وقضايا
     العميل تسقط معه بقيد `ON DELETE CASCADE`. والشاشة تقول ذلك قبل أن
     تسأل التأكيد. */
  async bulkClients(action: BulkAction, ids: string[]): Promise<BulkOutcome> {
    return api.bulk('clients', action, ids);
  }

  async bulkProspects(action: BulkAction, ids: string[]): Promise<BulkOutcome> {
    return api.bulk('prospects', action, ids);
  }

  async bulkCases(action: BulkAction, ids: string[]): Promise<BulkOutcome> {
    return api.bulk('cases', action, ids);
  }

  // ── العملاء المحتملون ──
  async getProspects(): Promise<Prospect[]> {
    return (await listOr(api.list<any>('prospects'), 'العملاء المحتملين')).map(asProspect);
  }

  async createProspect(prospectData: Omit<Prospect, 'id'>): Promise<Prospect | null> {
    return asProspect(await api.create<any>('prospects', prospectData));
  }

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect | null> {
    return asProspect(await api.update<any>('prospects', id, updates));
  }

  /* التحويل فعلٌ واحد على الخادم لا اثنان هنا: إنشاءٌ ثم حذفٌ من المتصفّح
     يترك محتملاً نُسخ ولم يُحذف إن انقطعت الشبكة بينهما. */
  async convertProspectToClient(prospectId: string): Promise<Client | null> {
    return asClient(await api.post<any>(`/prospects/${encodeURIComponent(prospectId)}/convert`));
  }

  /* ═══ لوحةُ بيسكامب ═══
     النقلُ بين الأعمدة تعديلُ حقلٍ واحد — والخادمُ يرسله إلى البطاقة بعده. */
  async moveProspectStatus(prospectId: string, status: string): Promise<void> {
    await api.patch(`/prospects/${encodeURIComponent(prospectId)}/status`, { status });
  }

  async getProspectComments(prospectId: string): Promise<{ comments: ProspectComment[]; basecampUrl: string | null }> {
    return api.read(`/prospects/${encodeURIComponent(prospectId)}/comments`);
  }

  async addProspectComment(prospectId: string, body: string): Promise<ProspectComment> {
    return api.post(`/prospects/${encodeURIComponent(prospectId)}/comments`, { body });
  }

  async getProspectBoard(): Promise<ProspectBoardStatus> {
    return api.read('/basecamp/prospects');
  }

  async setupProspectBoard(projectId: string): Promise<{
    projectName: string; columnsCreated: string[]; columnsRenamed: string[]; webhook: boolean; webhookError: string | null;
  }> {
    return api.post('/basecamp/prospects/setup', { projectId });
  }

  async syncProspectBoard(): Promise<ProspectBoardSyncResult> {
    return api.post('/basecamp/prospects/sync');
  }

  // ── القضايا ──
  async getCases(): Promise<Case[]> {
    return (await listOr(api.list<any>('cases'), 'القضايا')).map(asCase);
  }

  /* آخرُ ما حدث في بيسكامب — وسقوطُه يُخفي اللوحَ ولا يُسقط النافذة. */
  /* صياغةُ عنوان القضية وموضوعها — بطلب صاحبها، والأصلُ يُحفظ. */
  async phraseCase(id: string): Promise<{ title: string | null; summary: string; summaryRaw: string | null }> {
    return await api.post(`/cases/${encodeURIComponent(id)}/phrase`);
  }

  /* «صُغ القضايا الآن» — دفعةٌ بسقف، ويُضغط حتى لا يبقى شيء. */
  async phraseCasesNow(): Promise<{ phrased: number; failed: number; human: number; remaining: number }> {
    return await api.post('/basecamp/phrase');
  }

  async getCaseTimeline(id: string): Promise<CaseTimeline> {
    try {
      return await api.read<CaseTimeline>(`/cases/${encodeURIComponent(id)}/timeline`);
    } catch {
      return { linked: false, events: [] };
    }
  }

  async getCase(id: string): Promise<Case> {
    return asCase(await api.get<any>('cases', id));
  }

  /* استيرادُ القضايا: `dryRun` معاينةٌ لا تكتب، ثم التنفيذُ بالصفوف نفسِها. */
  async importCases(rows: CaseImportRow[], dryRun: boolean): Promise<CaseImportPreview> {
    return await api.post<CaseImportPreview>('/cases/import', { rows, dryRun });
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

  /* ═══ الأعضاء ═══
     المصادقة مركزية: لا يُنشأ عضوٌ من هنا ولا تُحذف هوية. المركز يمنح
     الوصول، وأولُ دخولٍ يُنشئ الصفّ، وهذه الشاشة ترقّي وتوقف لا أكثر. */
  /* دليلُ الأعضاء — لمنسدلات «المحامي المسؤول». الاسمُ والدورُ وحدهما، ولكلّ
     من يقرأ القضايا؛ لا `users.read`. */
  async getDirectory(): Promise<MemberEntry[]> {
    return await listOr(api.read<MemberEntry[]>('/members/directory'), 'دليل الأعضاء');
  }

  async getUsers(): Promise<User[]> {
    return (await listOr(api.read<any[]>('/members'), 'الأعضاء')).map(asUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    return (await this.getUsers()).find((user) => user.id === id);
  }

  /* كانت هنا `getCurrentUser()` تنادي `api.read('/me')` — و`call()` تفكّ
     `body.data`، و`‎/api/me‎` يردّ `{ok, center, user}` بلا غلاف. فالقيمةُ
     `undefined` ثمّ `.user` ترمي، فتردّ `null` أبداً. ولا مستدعيَ لها:
     العضوُ الحالي من `useAuth()` لا من هنا. */

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    await api.patch(`/members/${encodeURIComponent(id)}`, updates);
    return (await this.getUser(id)) ?? null;
  }

  /* الحذف يُيتّم سجلَّ الأنشطة، والإيقاف يقوم مقامه: الوسيط يقرأ حالة
     التفعيل في كل طلب محميّ، فيسري في الطلب التالي لا عند انتهاء الكوكي.

     وهي `setUserActive` لا `deleteUser`: الاسمُ الأول كان يَعِد بحذفٍ لا
     يقع، فتقول الشاشةُ «تم الحذف» ويبقى الصفُّ كما هو. والإيقافُ يُرجَع. */
  async setUserActive(id: string, isActive: boolean): Promise<boolean> {
    await api.patch(`/members/${encodeURIComponent(id)}`, { isActive });
    return true;
  }

  // ── الأنشطة ──
  async getActivities(): Promise<ActivityLog[]> {
    return (await listOr(api.list<any>('activities'), 'الأنشطة')).map(asActivity);
  }

  /* كانت هنا `addActivity()` تكتبه من المتصفّح — ولم تكن تُنادى إلا في
     موضعٍ واحد من كل مواضعها، فلوحةُ «النشاط الأخير» تعرض أنواعاً لا
     يكتبها أحد. والأثرُ اليوم يكتبه `worker/lib/activity.js` من `crud.js`،
     فيمرّ به كلُّ إنشاءٍ وتعديلٍ وحذفٍ ودفعة، ويُنسب إلى فاعله لا إلى
     «النظام». والمسارُ يقبل الكتابةَ المباشرة إن احتاجتها شاشة. */

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
  /* والفترةُ اختيارية: تاريخان شاملان، تُقارَن بالسابقة المساوية لها. */
  async getStats(range?: { from: string; to: string } | null) {
    const query = range ? `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : '';
    return await api.read<any>(`/stats${query}`);
  }

  // ── المسوّقون ──
  async getMarketers(): Promise<Marketer[]> {
    return (await listOr(api.list<any>('marketers'), 'المسوّقين')).map(asMarketer);
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

  /* ═══ دفعاتُ العمولة ═══
     كانت هاتان الدالّتان بلا مستدعٍ: الجدولُ والموردُ والمسار مبنيّةٌ
     كلُّها، ولا شاشةَ تسجّل دفعةً. فـ`totalCommissionPaid` في إحصاءات
     المسوّق صفرٌ أبداً، و«المتبقّي» يساوي «المستحقّ» دائماً. وشاشةُ
     المسوّق تناديهما الآن. */
  async getCommissionPayments(marketerId?: string): Promise<CommissionPayment[]> {
    const all = (await listOr(api.list<any>('commissions'), 'العمولات')).map(asPayment);
    return marketerId ? all.filter((row) => row.marketerId === marketerId) : all;
  }

  async createCommissionPayment(
    paymentData: Omit<CommissionPayment, 'id'>,
  ): Promise<CommissionPayment | null> {
    return asPayment(await api.create<any>('commissions', paymentData));
  }

  /* ═══ دفعاتُ العميل ═══
     سجلٌّ يُضاف إليه ويُحذف منه، والمحصَّلُ في القضية مجموعُه يكتبه الخادم.
     فبعد كل إضافةٍ أو حذفٍ تُقرأ القضيةُ ثانيةً لتحمل رقمها الجديد. */
  async getClientPayments(filter?: { caseId?: string; clientId?: string }): Promise<ClientPayment[]> {
    const all = (await listOr(api.list<any>('clientPayments'), 'دفعات العملاء')).map(asClientPayment);
    return all.filter((row) =>
      (!filter?.caseId || row.caseId === filter.caseId) &&
      (!filter?.clientId || row.clientId === filter.clientId));
  }

  async createClientPayment(
    payment: Pick<ClientPayment, 'caseId' | 'amount' | 'paymentDate' | 'method' | 'reference' | 'notes'>,
  ): Promise<ClientPayment> {
    return asClientPayment(await api.create<any>('clientPayments', payment));
  }

  async deleteClientPayment(id: string): Promise<void> {
    await api.remove('clientPayments', id);
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
  /* ═══ جرسُ الإشعارات ═══
     سقوطُ القراءة لا يُسقط الترويسة: يُردّ فارغاً. */
  async getNotifications(): Promise<{ unread: number; items: InAppNotification[] }> {
    try {
      return await api.read<{ unread: number; items: InAppNotification[] }>('/notifications');
    } catch {
      return { unread: 0, items: [] };
    }
  }

  async markNotificationsRead(ids?: string[]): Promise<void> {
    await api.post('/notifications/read', ids ? { ids } : {}).catch(() => {});
  }

  /* ═══ البريد ═══ */
  async getMailStatus(): Promise<MailStatus> {
    return await api.read<MailStatus>('/mail/status');
  }

  async sendTestMail(to: string): Promise<void> {
    await api.post('/mail/test', { to });
  }

  /* ═══ تعارضُ المصالح ═══
     تنبيهٌ لا منع: سقوطُه لا يوقف الحفظ، فيُردّ فارغاً ويُسجَّل. */
  async checkConflicts(query: {
    name?: string;
    idNumber?: string;
    excludeClient?: string;
    excludeCase?: string;
  }): Promise<ConflictCheck> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    try {
      return await api.read<ConflictCheck>(`/conflicts?${params.toString()}`);
    } catch (error) {
      console.error('تعذّر فحص التعارض:', error);
      return { asOpponent: [], asClient: [] };
    }
  }

  /* ═══ وافق ═══
     قراءةٌ لا كتابة. ولا `listOr`: الشاشةُ تعرض سببَ السقوط — «لم يُضبط
     المفتاح» غيرُ «رُفض المفتاح». */
  async getWafeqStatus(): Promise<WafeqStatus> {
    return await api.read<WafeqStatus>('/wafeq/status');
  }

  async testWafeq(): Promise<WafeqProbe> {
    return await api.post<WafeqProbe>('/wafeq/test');
  }

  async previewWafeq(): Promise<{ summary: WafeqSummary; items: Partial<WafeqPayment>[] }> {
    return await api.post('/wafeq/preview');
  }

  async syncWafeq(): Promise<WafeqSummary> {
    return await api.post<WafeqSummary>('/wafeq/sync');
  }

  /* على المخزَّن «بلا قضية» — بلا قراءة وافق من جديد. */
  async rematchWafeq(): Promise<WafeqRematch> {
    return await api.post<WafeqRematch>('/wafeq/rematch');
  }

  async getWafeqProjectLinks(): Promise<WafeqProjectLink[]> {
    return await api.read<WafeqProjectLink[]>('/wafeq/project-links');
  }

  async deleteWafeqProjectLink(projectId: string): Promise<void> {
    await api.remove('wafeq/project-links', projectId);
  }

  async setWafeqAutoSync(enabled: boolean): Promise<void> {
    await api.put('/wafeq/auto-sync', { enabled });
  }

  async getWafeqPayments(status?: WafeqPaymentStatus): Promise<WafeqPayment[]> {
    return await api.read<WafeqPayment[]>(`/wafeq/payments${status ? `?status=${status}` : ''}`);
  }

  /* و`general` إيرادٌ عامّ بلا قضية — و`targetId` فيه معرّفُ الموكّل لا القضية. */
  async decideWafeqPayment(
    externalId: string,
    action: 'link' | 'ignore' | 'unlink' | 'general',
    targetId?: string,
  ): Promise<void> {
    const target = action === 'general' ? { clientId: targetId || null } : targetId ? { caseId: targetId } : {};
    await api.post(`/wafeq/decide/${encodeURIComponent(externalId)}`, { action, ...target });
  }

  /* ═══ المحامون ═══ قائمةٌ من الإعدادات — `worker/lib/lawyers.js`. */
  async getLawyers(): Promise<Lawyer[]> {
    return await listOr(api.read<Lawyer[]>('/lawyers'), 'المحامين');
  }

  async saveLawyer(lawyer: Partial<Lawyer> & { name: string }): Promise<Lawyer> {
    const body = { name: lawyer.name, title: lawyer.title, email: lawyer.email, phone: lawyer.phone,
      memberId: lawyer.memberId ?? null, isActive: lawyer.isActive !== false };
    return lawyer.id
      ? await api.put<Lawyer>(`/lawyers/${encodeURIComponent(lawyer.id)}`, body)
      : await api.post<Lawyer>('/lawyers', body);
  }

  /* ومن عليه قضايا يُوقف ولا يُحذف — تُعاد قراءةُ القائمة بعدها لترى أيَّهما وقع. */
  async deleteLawyer(id: string): Promise<void> {
    await api.remove('lawyers', id);
  }

  async getClientGeneralPayments(clientId: string): Promise<GeneralPayment[]> {
    return await api.read<GeneralPayment[]>(`/clients/${encodeURIComponent(clientId)}/general-payments`);
  }

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

  async getBasecampMap(): Promise<BasecampMap> {
    return await api.read<BasecampMap>('/basecamp/map');
  }

  /* والعناوينُ تُحفظ مع الخريطة: اسمُ الملفّ وعناوينُ حقوله يُراجَعان معاً
     في شاشةٍ واحدة، فحفظُهما في نداءين يترك أحدَهما محفوظاً والآخر لا. */
  async saveBasecampMap(
    map: Record<string, string>,
    titles?: string[],
  ): Promise<{ map: Record<string, string>; titles: string[] }> {
    return await api.put('/basecamp/map', titles ? { map, titles } : { map });
  }

  /* المعاينة تقرأ ولا تكتب — و`POST` لأنها تُشغّل عملاً على بيسكامب. */
  /* اقتراحُ ربطٍ لعناوينَ لا مقابل لها — يُقرأ ولا يُحفظ حتى يُراجَع. */
  async suggestBasecampMap(): Promise<BasecampMapSuggestion> {
    return await api.post<BasecampMapSuggestion>('/basecamp/map/suggest');
  }

  async previewBasecamp(): Promise<BasecampPreview> {
    return await api.post<BasecampPreview>('/basecamp/preview');
  }

  async syncBasecamp(): Promise<BasecampSummary> {
    return await api.post<BasecampSummary>('/basecamp/sync');
  }

  async setBasecampAutoSync(enabled: boolean): Promise<{ syncEnabled: boolean }> {
    return await api.put('/basecamp/auto-sync', { enabled });
  }

  /* التلخيصُ الآليّ: مفتاحُه هنا لأنّ ما يُلخَّص يأتي من الاستيراد. */
  async setBasecampAi(enabled: boolean): Promise<{ aiEnabled: boolean }> {
    return await api.put('/basecamp/ai', { enabled });
  }

  /* إعادةُ الاستيراد من الصفر: `dryRun` يعدّ، والتنفيذُ بعبارة التأكيد. */
  async resetBasecampImport(
    dryRun: boolean,
    confirm?: string,
  ): Promise<{ dryRun: boolean; impact: BasecampResetImpact }> {
    return await api.post('/basecamp/reset', { dryRun, confirm });
  }

  /* ═══ ما يستحقّ نظرَك ═══
     تكتبه المزامنةُ وتمضي، ويُحسم متى فُتحت الشاشة — ومتى حُسم لم يعد. */
  async getBasecampReviews(): Promise<BasecampReview[]> {
    return await api.read<BasecampReview[]>('/basecamp/reviews');
  }

  async resolveBasecampReview(
    id: string,
    resolution: string,
    value?: string,
  ): Promise<{ id: string; resolution: string }> {
    return await api.post(`/basecamp/reviews/${encodeURIComponent(id)}`, { resolution, value });
  }

  async setBasecampConflictPolicy(
    policy: 'ask' | 'basecamp' | 'platform',
  ): Promise<{ conflictPolicy: string }> {
    return await api.put('/basecamp/conflict-policy', { policy });
  }

  async getBasecampConflicts(): Promise<BasecampConflict[]> {
    return await api.read<BasecampConflict[]>('/basecamp/conflicts');
  }

  async resolveBasecampConflict(
    id: string,
    resolution: 'basecamp' | 'platform' | 'ignored',
  ): Promise<{ id: string; resolution: string }> {
    return await api.post(`/basecamp/conflicts/${encodeURIComponent(id)}`, { resolution });
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
