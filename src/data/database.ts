// قاعدة بيانات Supabase فقط
import { Client, Prospect, Case, User, ActivityLog, SystemSettings } from '../types';
import { CustomReport, Prediction, AnalyticsInsight, PredictiveModel } from '../types';
import { Marketer, CommissionPayment, MarketerStats } from '../types';
import { supabaseDb } from './supabaseDatabase';
import { supabase } from '../lib/supabase';

// قاعدة البيانات - Supabase فقط
export class LocalDatabase {
  constructor() {
    // No local initialization needed
  }

  // العملاء
  async getClients(): Promise<Client[]> {
    return await supabaseDb.getClients();
  }

  async getClient(id: string): Promise<Client | undefined> {
    return await supabaseDb.getClient(id);
  }

  async createClient(clientData: Omit<Client, 'id'>): Promise<Client | null> {
    return await supabaseDb.createClient(clientData);
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
    return await supabaseDb.updateClient(id, updates);
  }

  async deleteClient(id: string): Promise<boolean> {
    return await supabaseDb.deleteClient(id);
  }

  // العملاء المحتملين
  async getProspects(): Promise<Prospect[]> {
    return await supabaseDb.getProspects();
  }

  async getProspect(id: string): Promise<Prospect | undefined> {
    return await supabaseDb.getProspect(id);
  }

  async createProspect(prospectData: Omit<Prospect, 'id'>): Promise<Prospect | null> {
    return await supabaseDb.createProspect(prospectData);
  }

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect | null> {
    return await supabaseDb.updateProspect(id, updates);
  }

  async deleteProspect(id: string): Promise<boolean> {
    return await supabaseDb.deleteProspect(id);
  }

  async convertProspectToClient(prospectId: string): Promise<Client | null> {
    return await supabaseDb.convertProspectToClient(prospectId);
  }

  // القضايا
  async getCases(): Promise<Case[]> {
    return await supabaseDb.getCases();
  }

  async getCase(id: string): Promise<Case | undefined> {
    return await supabaseDb.getCase(id);
  }

  async getCasesByClient(clientId: string): Promise<Case[]> {
    return await supabaseDb.getCasesByClient(clientId);
  }

  async createCase(caseData: Omit<Case, 'id'>): Promise<Case | null> {
    return await supabaseDb.createCase(caseData);
  }

  async updateCase(id: string, updates: Partial<Case>): Promise<Case | null> {
    return await supabaseDb.updateCase(id, updates);
  }

  async deleteCase(id: string): Promise<boolean> {
    return await supabaseDb.deleteCase(id);
  }

  // المستخدمين
  async getUsers(): Promise<User[]> {
    return await supabaseDb.getUsers();
  }

  async getUser(id: string): Promise<User | undefined> {
    return await supabaseDb.getUser(id);
  }

  async getCurrentUser(): Promise<User | null> {
    return await supabaseDb.getCurrentUser();
  }

  async updateCurrentUser(updates: Partial<User>): Promise<User | null> {
    return await supabaseDb.updateCurrentUser(updates);
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User | null> {
    return await supabaseDb.createUser(userData);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    return await supabaseDb.updateUser(id, updates);
  }

  async deleteUser(id: string): Promise<boolean> {
    return await supabaseDb.deleteUser(id);
  }

  // الأنشطة
  async getActivities(): Promise<ActivityLog[]> {
    return await supabaseDb.getActivities();
  }

  async addActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<ActivityLog | null> {
    return await supabaseDb.addActivity(activity);
  }

  // الإعدادات
  async getSettings(): Promise<SystemSettings> {
    return await supabaseDb.getSettings();
  }

  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    return await supabaseDb.updateSettings(updates);
  }

  // المصادقة
  async login(email: string, password: string): Promise<User | null> {
    return await supabaseDb.login(email, password);
  }

  async logout(): Promise<void> {
    return await supabaseDb.logout();
  }

  // إحصائيات
  async getStats() {
    try {
      // جلب البيانات مباشرة من Supabase للحصول على أحدث الإحصائيات
      const [
        { data: clients, error: clientsError },
        { data: prospects, error: prospectsError },
        { data: cases, error: casesError }
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('cases').select('*')
      ]);

      if (clientsError) throw clientsError;
      if (prospectsError) throw prospectsError;
      if (casesError) throw casesError;

      const clientsData = clients || [];
      const prospectsData = prospects || [];
      const casesData = cases || [];

      // حساب الإحصائيات
      const totalClients = clientsData.length;
      const totalProspects = prospectsData.length;
      const totalCases = casesData.length;
      
      const pendingCases = casesData.filter(c => c.status === 'pending').length;
      const inProgressCases = casesData.filter(c => c.status === 'in-progress').length;
      const completedCases = casesData.filter(c => c.status === 'completed').length;
      const postponedCases = casesData.filter(c => c.status === 'postponed').length;
      
      const wonCases = casesData.filter(c => c.outcome === 'won').length;
      const winRate = completedCases > 0 ? Math.round((wonCases / completedCases) * 100) : 0;
      
      const conversionRate = (totalClients + totalProspects) > 0 ? 
        Math.round((totalClients / (totalClients + totalProspects)) * 100) : 0;

      // توزيع العملاء حسب النوع
      const clientsByType = {
        individual: clientsData.filter(c => c.client_type === 'individual').length,
        company: clientsData.filter(c => c.client_type === 'company').length,
        association: clientsData.filter(c => c.client_type === 'association').length,
        government: clientsData.filter(c => c.client_type === 'government').length
      };

      // توزيع العملاء المحتملين حسب الحالة
      const prospectsByStatus: Record<string, number> = {};
      prospectsData.forEach(p => {
        prospectsByStatus[p.prospect_status] = (prospectsByStatus[p.prospect_status] || 0) + 1;
      });

      // توزيع القضايا حسب الحالة
      const casesByStatus = {
        pending: pendingCases,
        'in-progress': inProgressCases,
        completed: completedCases,
        postponed: postponedCases
      };

      return {
        totalClients,
        totalProspects,
        totalCases,
        pendingCases,
        completedCases,
        winRate,
        clientsByType,
        prospectsByStatus,
        casesByStatus,
        conversionRate
      };
    } catch (error) {
      console.error('Error getting stats from Supabase:', error);
      // العودة إلى supabaseDb في حالة الخطأ
      return await supabaseDb.getStats();
    }
  }

  // Custom Reports
  getCustomReports(): CustomReport[] {
    // TODO: Implement in Supabase
    return [];
  }

  createCustomReport(reportData: Omit<CustomReport, 'id'>): CustomReport {
    // TODO: Implement in Supabase
    return { ...reportData, id: Date.now().toString() };
  }

  updateCustomReport(id: string, updates: Partial<CustomReport>): CustomReport | null {
    // TODO: Implement in Supabase
    return null;
  }

  deleteCustomReport(id: string): boolean {
    // TODO: Implement in Supabase
    return true;
  }

  generateReportData(report: CustomReport): Promise<any[]> {
    // TODO: Implement in Supabase
    return Promise.resolve([]);
  }

  // Predictions
  getPredictions(): Prediction[] {
    // TODO: Implement in Supabase
    return [];
  }

  savePrediction(prediction: Prediction): void {
    // TODO: Implement in Supabase
  }

  // Analytics Insights
  getAnalyticsInsights(): AnalyticsInsight[] {
    // TODO: Implement in Supabase
    return [];
  }

  saveAnalyticsInsight(insight: AnalyticsInsight): void {
    // TODO: Implement in Supabase
  }

  // Predictive Models
  getPredictiveModels(): PredictiveModel[] {
    // TODO: Implement in Supabase
    return [];
  }

  // المسوّقين
  async getMarketers(): Promise<Marketer[]> {
    return await supabaseDb.getMarketers();
  }

  async getMarketer(id: string): Promise<Marketer | undefined> {
    return await supabaseDb.getMarketer(id);
  }

  async createMarketer(marketerData: Omit<Marketer, 'id'>): Promise<Marketer | null> {
    return await supabaseDb.createMarketer(marketerData);
  }

  async updateMarketer(id: string, updates: Partial<Marketer>): Promise<Marketer | null> {
    return await supabaseDb.updateMarketer(id, updates);
  }

  async deleteMarketer(id: string): Promise<boolean> {
    return await supabaseDb.deleteMarketer(id);
  }

  async getMarketerStats(marketerId: string): Promise<MarketerStats> {
    return await supabaseDb.getMarketerStats(marketerId);
  }

  // مدفوعات العمولات
  async getCommissionPayments(): Promise<CommissionPayment[]> {
    return await supabaseDb.getCommissionPayments();
  }

  async createCommissionPayment(paymentData: Omit<CommissionPayment, 'id'>): Promise<CommissionPayment | null> {
    return await supabaseDb.createCommissionPayment(paymentData);
  }

  // ترحيل البيانات من localStorage إلى Supabase
  async migrateToSupabase(): Promise<void> {
    return await supabaseDb.migrateFromLocalStorage();
  }

  // تصدير جميع البيانات
  async exportAllData(): Promise<any> {
    return await supabaseDb.exportAllData();
  }
}

// إنشاء مثيل واحد من قاعدة البيانات
export const db = new LocalDatabase();