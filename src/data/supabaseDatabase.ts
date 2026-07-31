import { supabase } from '../lib/supabase';
import { Client, Prospect, Case, User, ActivityLog, SystemSettings, Marketer, CommissionPayment, MarketerStats } from '../types';
import { formatDate } from '@/registry/naf/lib/format';

// تحويل البيانات من تنسيق قاعدة البيانات إلى تنسيق التطبيق
const transformClient = (dbClient: any): Client => ({
  id: dbClient.id,
  fullName: dbClient.full_name,
  idNumber: dbClient.id_number,
  phone: dbClient.phone,
  email: dbClient.email,
  joinDate: new Date(dbClient.join_date),
  clientType: dbClient.client_type,
  status: dbClient.status,
  notes: dbClient.notes || '',
  profilePicture: dbClient.profile_picture,
  commercialRegister: dbClient.commercial_register,
  legalRepresentative: dbClient.legal_representative,
  attachments: dbClient.attachments || []
});

const transformProspect = (dbProspect: any): Prospect => ({
  id: dbProspect.id,
  fullName: dbProspect.full_name,
  idNumber: dbProspect.id_number,
  phone: dbProspect.phone,
  email: dbProspect.email,
  joinDate: new Date(dbProspect.join_date),
  clientType: dbProspect.client_type,
  prospectStatus: dbProspect.prospect_status,
  notes: dbProspect.notes || '',
  profilePicture: dbProspect.profile_picture,
  commercialRegister: dbProspect.commercial_register,
  legalRepresentative: dbProspect.legal_representative,
  attachments: dbProspect.attachments || [],
  source: dbProspect.source,
  expectedValue: dbProspect.expected_value,
  followUpDate: dbProspect.follow_up_date ? new Date(dbProspect.follow_up_date) : undefined,
  assignedTo: dbProspect.assigned_to
});

const transformCase = (dbCase: any): Case => ({
  id: dbCase.id,
  caseNumber: dbCase.case_number,
  caseType: dbCase.case_type,
  clientId: dbCase.client_id,
  clientName: dbCase.client_name,
  summary: dbCase.summary,
  status: dbCase.status,
  outcome: dbCase.outcome,
  basecampUrl: dbCase.basecamp_url,
  createdDate: new Date(dbCase.created_at),
  updatedDate: new Date(dbCase.updated_at)
});

const transformUser = (dbUser: any): User => ({
  id: dbUser.id,
  name: dbUser.name,
  email: dbUser.email,
  role: dbUser.role,
  permissions: dbUser.permissions,
  profilePicture: dbUser.profile_picture,
  lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
  createdDate: new Date(dbUser.created_at)
});

const transformMarketer = (dbMarketer: any): Marketer => ({
  id: dbMarketer.id,
  fullName: dbMarketer.full_name,
  idNumber: dbMarketer.id_number,
  phone: dbMarketer.phone,
  email: dbMarketer.email,
  relationshipType: dbMarketer.relationship_type,
  startDate: new Date(dbMarketer.start_date),
  status: dbMarketer.status,
  notes: dbMarketer.notes || '',
  profilePicture: dbMarketer.profile_picture,
  createdDate: new Date(dbMarketer.created_at),
  updatedDate: new Date(dbMarketer.updated_at)
});

const transformActivityLog = (dbActivity: any): ActivityLog => ({
  id: dbActivity.id,
  type: dbActivity.type,
  description: dbActivity.description,
  userId: dbActivity.user_id,
  userName: dbActivity.user_name,
  entityId: dbActivity.entity_id,
  entityType: dbActivity.entity_type,
  details: dbActivity.details,
  timestamp: new Date(dbActivity.created_at)
});

// قاعدة البيانات المبنية على Supabase
export class SupabaseDatabase {
  // العملاء
  async getClients(): Promise<Client[]> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map(transformClient) || [];
    } catch (error) {
      console.error('Error fetching clients:', error);
      return [];
    }
  }

  async getClient(id: string): Promise<Client | undefined> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? transformClient(data) : undefined;
    } catch (error) {
      console.error('Error fetching client:', error);
      return undefined;
    }
  }

  async createClient(clientData: Omit<Client, 'id'>): Promise<Client | null> {
    try {
      const dbData = {
        full_name: clientData.fullName,
        id_number: clientData.idNumber,
        phone: clientData.phone,
        email: clientData.email,
        join_date: clientData.joinDate.toISOString().split('T')[0],
        client_type: clientData.clientType,
        status: clientData.status,
        notes: clientData.notes,
        profile_picture: clientData.profilePicture,
        commercial_register: clientData.commercialRegister,
        legal_representative: clientData.legalRepresentative,
        attachments: clientData.attachments
      };

      const { data, error } = await supabase
        .from('clients')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      const newClient = transformClient(data);
      
      // إضافة نشاط
      await this.addActivity({
        type: 'client_created',
        description: `تم إضافة عميل جديد: ${newClient.fullName}`,
        userId: await this.getCurrentUserId() || '',
        userName: await this.getCurrentUserName() || '',
        entityId: newClient.id,
        entityType: 'client'
      });

      return newClient;
    } catch (error) {
      console.error('Error creating client:', error);
      return null;
    }
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client | null> {
    try {
      const dbUpdates: any = {};
      
      if (updates.fullName) dbUpdates.full_name = updates.fullName;
      if (updates.idNumber) dbUpdates.id_number = updates.idNumber;
      if (updates.phone) dbUpdates.phone = updates.phone;
      if (updates.email) dbUpdates.email = updates.email;
      if (updates.joinDate) dbUpdates.join_date = updates.joinDate.toISOString().split('T')[0];
      if (updates.clientType) dbUpdates.client_type = updates.clientType;
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.profilePicture !== undefined) dbUpdates.profile_picture = updates.profilePicture;
      if (updates.commercialRegister !== undefined) dbUpdates.commercial_register = updates.commercialRegister;
      if (updates.legalRepresentative !== undefined) dbUpdates.legal_representative = updates.legalRepresentative;
      if (updates.attachments) dbUpdates.attachments = updates.attachments;

      const { data, error } = await supabase
        .from('clients')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updatedClient = transformClient(data);
      
      // إضافة نشاط
      await this.addActivity({
        type: 'client_updated',
        description: `تم تحديث بيانات العميل: ${updatedClient.fullName}`,
        userId: await this.getCurrentUserId() || '',
        userName: await this.getCurrentUserName() || '',
        entityId: id,
        entityType: 'client'
      });

      return updatedClient;
    } catch (error) {
      console.error('Error updating client:', error);
      return null;
    }
  }

  async deleteClient(id: string): Promise<boolean> {
    try {
      // الحصول على بيانات العميل قبل الحذف
      const client = await this.getClient(id);
      
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // إضافة نشاط
      if (client) {
        await this.addActivity({
          type: 'client_deleted',
          description: `تم حذف العميل: ${client.fullName}`,
          userId: await this.getCurrentUserId() || '',
          userName: await this.getCurrentUserName() || '',
          entityId: id,
          entityType: 'client'
        });
      }

      return true;
    } catch (error) {
      console.error('Error deleting client:', error);
      return false;
    }
  }

  // العملاء المحتملين
  async getProspects(): Promise<Prospect[]> {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map(transformProspect) || [];
    } catch (error) {
      console.error('Error fetching prospects:', error);
      return [];
    }
  }

  async getProspect(id: string): Promise<Prospect | undefined> {
    try {
      const { data, error } = await supabase
        .from('prospects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? transformProspect(data) : undefined;
    } catch (error) {
      console.error('Error fetching prospect:', error);
      return undefined;
    }
  }

  async createProspect(prospectData: Omit<Prospect, 'id'>): Promise<Prospect | null> {
    try {
      const dbData = {
        full_name: prospectData.fullName,
        id_number: prospectData.idNumber,
        phone: prospectData.phone,
        email: prospectData.email,
        join_date: prospectData.joinDate.toISOString().split('T')[0],
        client_type: prospectData.clientType,
        prospect_status: prospectData.prospectStatus,
        notes: prospectData.notes,
        profile_picture: prospectData.profilePicture,
        commercial_register: prospectData.commercialRegister,
        legal_representative: prospectData.legalRepresentative,
        attachments: prospectData.attachments,
        source: prospectData.source,
        expected_value: prospectData.expectedValue,
        follow_up_date: prospectData.followUpDate?.toISOString().split('T')[0],
        assigned_to: prospectData.assignedTo
      };

      const { data, error } = await supabase
        .from('prospects')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      const newProspect = transformProspect(data);
      
      // إضافة نشاط
      await this.addActivity({
        type: 'prospect_created',
        description: `تم إضافة عميل محتمل جديد: ${newProspect.fullName}`,
        userId: await this.getCurrentUserId() || '',
        userName: await this.getCurrentUserName() || '',
        entityId: newProspect.id,
        entityType: 'prospect'
      });

      return newProspect;
    } catch (error) {
      console.error('Error creating prospect:', error);
      return null;
    }
  }

  async updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect | null> {
    try {
      const dbUpdates: any = {};
      
      if (updates.fullName) dbUpdates.full_name = updates.fullName;
      if (updates.idNumber) dbUpdates.id_number = updates.idNumber;
      if (updates.phone) dbUpdates.phone = updates.phone;
      if (updates.email) dbUpdates.email = updates.email;
      if (updates.joinDate) dbUpdates.join_date = updates.joinDate.toISOString().split('T')[0];
      if (updates.clientType) dbUpdates.client_type = updates.clientType;
      if (updates.prospectStatus) dbUpdates.prospect_status = updates.prospectStatus;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.profilePicture !== undefined) dbUpdates.profile_picture = updates.profilePicture;
      if (updates.commercialRegister !== undefined) dbUpdates.commercial_register = updates.commercialRegister;
      if (updates.legalRepresentative !== undefined) dbUpdates.legal_representative = updates.legalRepresentative;
      if (updates.attachments) dbUpdates.attachments = updates.attachments;
      if (updates.source !== undefined) dbUpdates.source = updates.source;
      if (updates.expectedValue !== undefined) dbUpdates.expected_value = updates.expectedValue;
      if (updates.followUpDate !== undefined) dbUpdates.follow_up_date = updates.followUpDate?.toISOString().split('T')[0];
      if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;

      const { data, error } = await supabase
        .from('prospects')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updatedProspect = transformProspect(data);
      
      // إضافة نشاط
      await this.addActivity({
        type: 'prospect_updated',
        description: `تم تحديث بيانات العميل المحتمل: ${updatedProspect.fullName}`,
        userId: await this.getCurrentUserId() || '',
        userName: await this.getCurrentUserName() || '',
        entityId: id,
        entityType: 'prospect'
      });

      return updatedProspect;
    } catch (error) {
      console.error('Error updating prospect:', error);
      return null;
    }
  }

  async deleteProspect(id: string): Promise<boolean> {
    try {
      // الحصول على بيانات العميل المحتمل قبل الحذف
      const prospect = await this.getProspect(id);
      
      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // إضافة نشاط
      if (prospect) {
        await this.addActivity({
          type: 'prospect_deleted',
          description: `تم حذف العميل المحتمل: ${prospect.fullName}`,
          userId: await this.getCurrentUserId() || '',
          userName: await this.getCurrentUserName() || '',
          entityId: id,
          entityType: 'prospect'
        });
      }

      return true;
    } catch (error) {
      console.error('Error deleting prospect:', error);
      return false;
    }
  }

  async convertProspectToClient(prospectId: string): Promise<Client | null> {
    try {
      const prospect = await this.getProspect(prospectId);
      if (!prospect) return null;

      // إنشاء عميل جديد من بيانات العميل المحتمل
      const clientData: Omit<Client, 'id'> = {
        fullName: prospect.fullName,
        idNumber: prospect.idNumber,
        phone: prospect.phone,
        email: prospect.email,
        joinDate: new Date(),
        clientType: prospect.clientType,
        status: 'current',
        notes: prospect.notes + (prospect.notes ? '\n\n' : '') + `تم التحويل من عميل محتمل في ${formatDate(new Date())}`,
        attachments: prospect.attachments,
        commercialRegister: prospect.commercialRegister,
        legalRepresentative: prospect.legalRepresentative
      };

      const newClient = await this.createClient(clientData);
      if (newClient) {
        await this.deleteProspect(prospectId);
        
        // إضافة نشاط التحويل
        await this.addActivity({
          type: 'prospect_converted',
          description: `تم تحويل العميل المحتمل "${prospect.fullName}" إلى عميل فعلي`,
          userId: await this.getCurrentUserId() || '',
          userName: await this.getCurrentUserName() || '',
          entityId: newClient.id,
          entityType: 'client'
        });
      }

      return newClient;
    } catch (error) {
      console.error('Error converting prospect to client:', error);
      return null;
    }
  }

  // القضايا
  async getCases(): Promise<Case[]> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map(transformCase) || [];
    } catch (error) {
      console.error('Error fetching cases:', error);
      return [];
    }
  }

  async getCase(id: string): Promise<Case | undefined> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? transformCase(data) : undefined;
    } catch (error) {
      console.error('Error fetching case:', error);
      return undefined;
    }
  }

  async getCasesByClient(clientId: string): Promise<Case[]> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map(transformCase) || [];
    } catch (error) {
      console.error('Error fetching cases by client:', error);
      return [];
    }
  }

  async createCase(caseData: Omit<Case, 'id'>): Promise<Case | null> {
    try {
      const dbData = {
        case_number: caseData.caseNumber,
        case_type: caseData.caseType,
        client_id: caseData.clientId,
        client_name: caseData.clientName,
        summary: caseData.summary,
        status: caseData.status,
        outcome: caseData.outcome,
        basecamp_url: caseData.basecampUrl
      };

      const { data, error } = await supabase
        .from('cases')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      const newCase = transformCase(data);
      
      // إضافة نشاط
      await this.addActivity({
        type: 'case_created',
        description: `تم إضافة قضية جديدة: ${newCase.caseNumber}`,
        userId: await this.getCurrentUserId() || '',
        userName: await this.getCurrentUserName() || '',
        entityId: newCase.id,
        entityType: 'case'
      });

      return newCase;
    } catch (error) {
      console.error('Error creating case:', error);
      return null;
    }
  }

  async updateCase(id: string, updates: Partial<Case>): Promise<Case | null> {
    try {
      const dbUpdates: any = {};
      
      if (updates.caseNumber) dbUpdates.case_number = updates.caseNumber;
      if (updates.caseType) dbUpdates.case_type = updates.caseType;
      if (updates.clientId) dbUpdates.client_id = updates.clientId;
      if (updates.clientName) dbUpdates.client_name = updates.clientName;
      if (updates.summary) dbUpdates.summary = updates.summary;
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.outcome !== undefined) dbUpdates.outcome = updates.outcome;
      if (updates.basecampUrl !== undefined) dbUpdates.basecamp_url = updates.basecampUrl;

      const { data, error } = await supabase
        .from('cases')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updatedCase = transformCase(data);
      
      // إضافة نشاط
      await this.addActivity({
        type: 'case_updated',
        description: `تم تحديث القضية: ${updatedCase.caseNumber}`,
        userId: await this.getCurrentUserId() || '',
        userName: await this.getCurrentUserName() || '',
        entityId: id,
        entityType: 'case'
      });

      return updatedCase;
    } catch (error) {
      console.error('Error updating case:', error);
      return null;
    }
  }

  async deleteCase(id: string): Promise<boolean> {
    try {
      // الحصول على بيانات القضية قبل الحذف
      const case_ = await this.getCase(id);
      
      const { error } = await supabase
        .from('cases')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // إضافة نشاط
      if (case_) {
        await this.addActivity({
          type: 'case_deleted',
          description: `تم حذف القضية: ${case_.caseNumber}`,
          userId: await this.getCurrentUserId() || '',
          userName: await this.getCurrentUserName() || '',
          entityId: id,
          entityType: 'case'
        });
      }

      return true;
    } catch (error) {
      console.error('Error deleting case:', error);
      return false;
    }
  }

  // المستخدمين
  async getUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map(transformUser) || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? transformUser(data) : undefined;
    } catch (error) {
      console.error('Error fetching user:', error);
      return undefined;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      return await this.getUser(user.id) || null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    } catch (error) {
      console.error('Error getting current user ID:', error);
      return null;
    }
  }

  async getCurrentUserName(): Promise<string | null> {
    try {
      const currentUser = await this.getCurrentUser();
      return currentUser?.name || null;
    } catch (error) {
      console.error('Error getting current user name:', error);
      return null;
    }
  }

  async updateCurrentUser(updates: Partial<User>): Promise<User | null> {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return null;

      return await this.updateUser(userId, updates);
    } catch (error) {
      console.error('Error updating current user:', error);
      return null;
    }
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User | null> {
    try {
      const dbData = {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        permissions: userData.permissions,
        profile_picture: userData.profilePicture
      };

      const { data, error } = await supabase
        .from('users')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      const newUser = transformUser(data);
      
      // إضافة نشاط
      await this.addActivity({
        type: 'user_created',
        description: `تم إنشاء مستخدم جديد: ${newUser.name}`,
        userId: await this.getCurrentUserId() || '',
        userName: await this.getCurrentUserName() || '',
        entityId: newUser.id,
        entityType: 'user'
      });

      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    try {
      const dbUpdates: any = {};
      
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.email) dbUpdates.email = updates.email;
      if (updates.role) dbUpdates.role = updates.role;
      if (updates.permissions) dbUpdates.permissions = updates.permissions;
      if (updates.profilePicture !== undefined) dbUpdates.profile_picture = updates.profilePicture;
      if (updates.lastLogin) dbUpdates.last_login = updates.lastLogin.toISOString();

      const { data, error } = await supabase
        .from('users')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return transformUser(data);
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      // التحقق من أن المستخدم ليس مديراً
      const user = await this.getUser(id);
      if (!user || user.role === 'admin') return false;

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  // المسوّقين
  async getMarketers(): Promise<Marketer[]> {
    try {
      const { data, error } = await supabase
        .from('marketers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data?.map(transformMarketer) || [];
    } catch (error) {
      console.error('Error fetching marketers:', error);
      return [];
    }
  }

  async getMarketer(id: string): Promise<Marketer | undefined> {
    try {
      const { data, error } = await supabase
        .from('marketers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? transformMarketer(data) : undefined;
    } catch (error) {
      console.error('Error fetching marketer:', error);
      return undefined;
    }
  }

  async createMarketer(marketerData: Omit<Marketer, 'id'>): Promise<Marketer | null> {
    try {
      const dbData = {
        full_name: marketerData.fullName,
        id_number: marketerData.idNumber,
        phone: marketerData.phone,
        email: marketerData.email,
        relationship_type: marketerData.relationshipType,
        start_date: marketerData.startDate.toISOString().split('T')[0],
        status: marketerData.status,
        notes: marketerData.notes,
        profile_picture: marketerData.profilePicture
      };

      const { data, error } = await supabase
        .from('marketers')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      const newMarketer = transformMarketer(data);
      
      // إضافة نشاط
      await this.addActivity({
        type: 'marketer_created',
        description: `تم إضافة مسوّق جديد: ${newMarketer.fullName}`,
        userId: await this.getCurrentUserId() || '',
        userName: await this.getCurrentUserName() || '',
        entityId: newMarketer.id,
        entityType: 'marketer'
      });

      return newMarketer;
    } catch (error) {
      console.error('Error creating marketer:', error);
      return null;
    }
  }

  async updateMarketer(id: string, updates: Partial<Marketer>): Promise<Marketer | null> {
    try {
      const dbUpdates: any = {};
      
      if (updates.fullName) dbUpdates.full_name = updates.fullName;
      if (updates.idNumber) dbUpdates.id_number = updates.idNumber;
      if (updates.phone) dbUpdates.phone = updates.phone;
      if (updates.email) dbUpdates.email = updates.email;
      if (updates.relationshipType) dbUpdates.relationship_type = updates.relationshipType;
      if (updates.startDate) dbUpdates.start_date = updates.startDate.toISOString().split('T')[0];
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.profilePicture !== undefined) dbUpdates.profile_picture = updates.profilePicture;

      const { data, error } = await supabase
        .from('marketers')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updatedMarketer = transformMarketer(data);
      
      // إضافة نشاط
      await this.addActivity({
        type: 'marketer_updated',
        description: `تم تحديث بيانات المسوّق: ${updatedMarketer.fullName}`,
        userId: await this.getCurrentUserId() || '',
        userName: await this.getCurrentUserName() || '',
        entityId: id,
        entityType: 'marketer'
      });

      return updatedMarketer;
    } catch (error) {
      console.error('Error updating marketer:', error);
      return null;
    }
  }

  async deleteMarketer(id: string): Promise<boolean> {
    try {
      // الحصول على بيانات المسوّق قبل الحذف
      const marketer = await this.getMarketer(id);
      
      const { error } = await supabase
        .from('marketers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // إضافة نشاط
      if (marketer) {
        await this.addActivity({
          type: 'marketer_deleted',
          description: `تم حذف المسوّق: ${marketer.fullName}`,
          userId: await this.getCurrentUserId() || '',
          userName: await this.getCurrentUserName() || '',
          entityId: id,
          entityType: 'marketer'
        });
      }

      return true;
    } catch (error) {
      console.error('Error deleting marketer:', error);
      return false;
    }
  }

  async getMarketerStats(marketerId: string): Promise<MarketerStats> {
    try {
      // الحصول على قضايا المسوّق
      const { data: cases, error } = await supabase
        .from('cases')
        .select('*')
        .eq('marketer_id', marketerId);

      if (error) throw error;

      const completedCases = cases?.filter(c => c.status === 'completed') || [];
      const wonCases = completedCases.filter(c => c.outcome === 'won');
      const lostCases = completedCases.filter(c => c.outcome === 'lost');

      // حساب الإيرادات والعمولات
      const totalRevenue = cases?.reduce((sum, case_) => {
        return sum + (case_.payment_status?.collectedAmount || 0);
      }, 0) || 0;

      const totalCommissionEarned = cases?.reduce((sum, case_) => {
        if (case_.commission_structure?.type === 'fixed_amount') {
          return sum + (case_.commission_structure.value || 0);
        } else if (case_.commission_structure?.type === 'percentage') {
          const baseAmount = case_.payment_status?.collectedAmount || 0;
          return sum + (baseAmount * (case_.commission_structure.value || 0) / 100);
        }
        return sum;
      }, 0) || 0;

      // الحصول على مدفوعات العمولات
      const commissionPayments = await this.getCommissionPayments();
      const marketerPayments = commissionPayments.filter(p => p.marketerId === marketerId);
      const totalCommissionPaid = marketerPayments.reduce((sum, payment) => sum + payment.amount, 0);

      return {
        totalCases: cases?.length || 0,
        completedCases: completedCases.length,
        wonCases: wonCases.length,
        lostCases: lostCases.length,
        totalRevenue,
        totalCommissionEarned,
        totalCommissionPaid,
        remainingCommission: totalCommissionEarned - totalCommissionPaid,
        conversionRate: cases?.length ? Math.round((completedCases.length / cases.length) * 100) : 0,
        averageCaseValue: cases?.length ? totalRevenue / cases.length : 0
      };
    } catch (error) {
      console.error('Error getting marketer stats:', error);
      return {
        totalCases: 0,
        completedCases: 0,
        wonCases: 0,
        lostCases: 0,
        totalRevenue: 0,
        totalCommissionEarned: 0,
        totalCommissionPaid: 0,
        remainingCommission: 0,
        conversionRate: 0,
        averageCaseValue: 0
      };
    }
  }

  // مدفوعات العمولات
  async getCommissionPayments(): Promise<CommissionPayment[]> {
    try {
      const { data, error } = await supabase
        .from('commission_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data?.map(payment => ({
        id: payment.id,
        marketerId: payment.marketer_id,
        caseId: payment.case_id,
        amount: payment.amount,
        paymentDate: new Date(payment.payment_date),
        notes: payment.notes,
        createdBy: payment.created_by
      })) || [];
    } catch (error) {
      console.error('Error fetching commission payments:', error);
      return [];
    }
  }

  async createCommissionPayment(paymentData: Omit<CommissionPayment, 'id'>): Promise<CommissionPayment | null> {
    try {
      const dbData = {
        marketer_id: paymentData.marketerId,
        case_id: paymentData.caseId,
        amount: paymentData.amount,
        payment_date: paymentData.paymentDate.toISOString().split('T')[0],
        notes: paymentData.notes,
        created_by: paymentData.createdBy
      };

      const { data, error } = await supabase
        .from('commission_payments')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        marketerId: data.marketer_id,
        caseId: data.case_id,
        amount: data.amount,
        paymentDate: new Date(data.payment_date),
        notes: data.notes,
        createdBy: data.created_by
      };
    } catch (error) {
      console.error('Error creating commission payment:', error);
      return null;
    }
  }

  // الأنشطة
  async getActivities(): Promise<ActivityLog[]> {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data?.map(transformActivityLog) || [];
    } catch (error) {
      console.error('Error fetching activities:', error);
      return [];
    }
  }

  async addActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<ActivityLog | null> {
    try {
      const dbData = {
        type: activity.type,
        description: activity.description,
        user_id: activity.userId,
        user_name: activity.userName,
        entity_id: activity.entityId,
        entity_type: activity.entityType,
        details: activity.details
      };

      const { data, error } = await supabase
        .from('activity_logs')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;
      return transformActivityLog(data);
    } catch (error) {
      console.error('Error adding activity:', error);
      return null;
    }
  }

  // الإعدادات
  async getSettings(): Promise<SystemSettings> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;

      // تحويل البيانات إلى تنسيق SystemSettings
      const settings: SystemSettings = {
        clientTypes: [],
        clientStatuses: [],
        prospectStatuses: [],
        prospectSources: [],
        caseTypes: [],
        caseStatuses: [],
        marketerStatuses: [],
        relationshipTypes: [],
        commissionTypes: [],
        collectionStatuses: [],
        feeTypes: [],
        companyName: 'NAF Law',
        companyDescription: 'نظام إدارة المكتب القانوني',
        /* الحقول الثلاثة تبقى في النوع لأن العمود ما يزال في القاعدة،
           وقيمها الفارغة مقصودة: لم تعد تُقرأ من الواجهة ولا تُحقن على
           الجذر — لوحة الهوية من naf-theme.css وحده. وكتابة رمز سداسي
           هنا يعيد المصدر الثاني من بابه الخلفيّ. */
        primaryColor: '',
        secondaryColor: '',
        accentColor: ''
      };

      data?.forEach(setting => {
        switch (setting.key) {
          case 'client_types':
            settings.clientTypes = setting.value;
            break;
          case 'client_statuses':
            settings.clientStatuses = setting.value;
            break;
          case 'prospect_statuses':
            settings.prospectStatuses = setting.value;
            break;
          case 'prospect_sources':
            settings.prospectSources = setting.value;
            break;
          case 'case_types':
            settings.caseTypes = setting.value;
            break;
          case 'case_statuses':
            settings.caseStatuses = setting.value;
            break;
          case 'marketer_statuses':
            settings.marketerStatuses = setting.value;
            break;
          case 'relationship_types':
            settings.relationshipTypes = setting.value;
            break;
          case 'commission_types':
            settings.commissionTypes = setting.value;
            break;
          case 'collection_statuses':
            settings.collectionStatuses = setting.value;
            break;
          case 'fee_types':
            settings.feeTypes = setting.value;
            break;
          case 'company_info':
            settings.companyName = setting.value.name;
            settings.companyDescription = setting.value.description;
            settings.companyLogo = setting.value.logo;
            settings.primaryColor = setting.value.primaryColor;
            settings.secondaryColor = setting.value.secondaryColor;
            settings.accentColor = setting.value.accentColor;
            break;
          case 'email_settings':
            settings.emailSettings = setting.value;
            break;
        }
      });

      return settings;
    } catch (error) {
      console.error('Error fetching settings:', error);
      // إرجاع إعدادات افتراضية في حالة الخطأ
      return {
        clientTypes: ['individual', 'company', 'association', 'government'],
        clientStatuses: ['current', 'former'],
        prospectStatuses: ['مهتم', 'تم التواصل', 'بانتظار توقيع', 'غير مناسب', 'تم الرفض'],
        prospectSources: ['موقع إلكتروني', 'وسائل التواصل الاجتماعي', 'إحالة من عميل', 'إعلان', 'معرض', 'أخرى'],
        caseTypes: ['قضية تجارية', 'قضية عمالية', 'قضية مدنية', 'قضية جزائية'],
        caseStatuses: ['pending', 'in-progress', 'completed', 'postponed'],
        marketerStatuses: ['active', 'suspended', 'former'],
        relationshipTypes: ['employee', 'freelancer', 'external_company'],
        commissionTypes: ['fixed_amount', 'percentage'],
        collectionStatuses: ['fully_paid', 'partially_paid', 'unpaid'],
        feeTypes: ['advance_only', 'deferred_only', 'advance_and_deferred'],
        companyName: 'NAF Law',
        companyDescription: 'نظام إدارة المكتب القانوني',
        /* الحقول الثلاثة تبقى في النوع لأن العمود ما يزال في القاعدة،
           وقيمها الفارغة مقصودة: لم تعد تُقرأ من الواجهة ولا تُحقن على
           الجذر — لوحة الهوية من naf-theme.css وحده. وكتابة رمز سداسي
           هنا يعيد المصدر الثاني من بابه الخلفيّ. */
        primaryColor: '',
        secondaryColor: '',
        accentColor: ''
      };
    }
  }

  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    try {
      const userId = await this.getCurrentUserId();
      
      // تحديث الإعدادات المختلفة
      const settingsToUpdate = [
        { key: 'client_types', value: updates.clientTypes },
        { key: 'client_statuses', value: updates.clientStatuses },
        { key: 'prospect_statuses', value: updates.prospectStatuses },
        { key: 'prospect_sources', value: updates.prospectSources },
        { key: 'case_types', value: updates.caseTypes },
        { key: 'case_statuses', value: updates.caseStatuses },
        { key: 'marketer_statuses', value: updates.marketerStatuses },
        { key: 'relationship_types', value: updates.relationshipTypes },
        { key: 'commission_types', value: updates.commissionTypes },
        { key: 'collection_statuses', value: updates.collectionStatuses },
        { key: 'fee_types', value: updates.feeTypes }
      ];

      // تحديث معلومات الشركة
      if (updates.companyName || updates.companyDescription || updates.companyLogo || 
          updates.primaryColor || updates.secondaryColor || updates.accentColor) {
        const currentSettings = await this.getSettings();
        const companyInfo = {
          name: updates.companyName || currentSettings.companyName,
          description: updates.companyDescription || currentSettings.companyDescription,
          logo: updates.companyLogo || currentSettings.companyLogo,
          primaryColor: updates.primaryColor || currentSettings.primaryColor,
          secondaryColor: updates.secondaryColor || currentSettings.secondaryColor,
          accentColor: updates.accentColor || currentSettings.accentColor
        };
        
        settingsToUpdate.push({ key: 'company_info', value: companyInfo });
      }
      
      // تحديث إعدادات البريد الإلكتروني
      if (updates.emailSettings) {
        settingsToUpdate.push({ key: 'email_settings', value: updates.emailSettings });
      }

      // تحديث الإعدادات في قاعدة البيانات
      for (const setting of settingsToUpdate) {
        if (setting.value !== undefined) {
          const { error } = await supabase
            .from('system_settings')
            .upsert({
              key: setting.key,
              value: setting.value,
              updated_by: userId
            });
            
          if (error) {
            console.error(`Error updating setting ${setting.key}:`, error);
          }
        }
      }

      return await this.getSettings();
    } catch (error) {
      console.error('Error updating settings:', error);
      return await this.getSettings();
    }
  }

  // المصادقة
  async login(email: string, password: string): Promise<User | null> {
    try {
      // التحقق من المستخدمين التجريبيين أولاً
      const demoUsers = [
        { email: 'admin@naflaw.com', password: 'password123', role: 'admin', name: 'محمد أحمد النافع' },
        { email: 'lawyer@naflaw.com', password: 'password123', role: 'lawyer', name: 'سارة أحمد المحامية' },
        { email: 'staff@naflaw.com', password: 'password123', role: 'staff', name: 'أحمد محمد الإداري' }
      ];

      const demoUser = demoUsers.find(u => u.email === email && u.password === password);
      
      if (demoUser) {
        // إنشاء أو تحديث المستخدم التجريبي في قاعدة البيانات
        let user = await this.getUserByEmail(email);
        
        if (!user) {
          // إنشاء المستخدم التجريبي
          user = await this.createDemoUser({
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role as User['role']
          });
        }
        
        if (user) {
          // تحديث آخر نشاط
          await this.updateUser(user.id, { lastLogin: new Date() });
          
          // إضافة نشاط تسجيل الدخول
          await this.addActivity({
            type: 'user_login',
            description: 'تسجيل دخول المستخدم',
            userId: user.id,
            userName: user.name
          });
          
          return user;
        }
      }

      // محاولة تسجيل الدخول مع Supabase Auth للمستخدمين الفعليين
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          throw new Error('بيانات الدخول غير صحيحة');
        }

        if (data.user) {
          // البحث عن المستخدم في قاعدة البيانات
          let user = await this.getUser(data.user.id);
          
          if (!user) {
            // إنشاء سجل المستخدم إذا لم يكن موجوداً
            user = await this.createUser({
              name: data.user.email?.split('@')[0] || 'مستخدم جديد',
              email: data.user.email || '',
              role: 'staff',
              permissions: this.getDefaultPermissions('staff'),
              createdDate: new Date()
            });
          }
          
          if (user) {
            // تحديث آخر نشاط
            await this.updateUser(user.id, { lastLogin: new Date() });
            
            // إضافة نشاط تسجيل الدخول
            await this.addActivity({
              type: 'user_login',
              description: 'تسجيل دخول المستخدم',
              userId: user.id,
              userName: user.name
            });
          }

          return user;
        }
      } catch (supabaseError) {
        console.log('Supabase auth failed, demo users only');
      }

      // إذا فشل كل شيء
      throw new Error('بيانات الدخول غير صحيحة');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // دالة مساعدة للبحث عن المستخدم بالإيميل
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) return null;
      return data ? transformUser(data) : null;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
  }

  // دالة لإنشاء مستخدم تجريبي
  async createDemoUser(userData: { name: string; email: string; role: User['role'] }): Promise<User | null> {
    try {
      const dbData = {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        permissions: this.getDefaultPermissions(userData.role),
        profile_picture: null
      };

      const { data, error } = await supabase
        .from('users')
        .insert(dbData)
        .select()
        .single();

      if (error) throw error;
      return transformUser(data);
    } catch (error) {
      console.error('Error creating demo user:', error);
      return null;
    }
  }

  // دالة للحصول على الصلاحيات الافتراضية
  getDefaultPermissions(role: User['role']) {
    switch (role) {
      case 'admin':
        return {
          clients: { create: true, read: true, update: true, delete: true },
          prospects: { create: true, read: true, update: true, delete: true, convert: true },
          cases: { create: true, read: true, update: true, delete: true },
          analytics: { read: true },
          settings: { read: true, update: true },
          users: { create: true, read: true, update: true, delete: true },
          marketers: { create: true, read: true, update: true, delete: true }
        };
      case 'lawyer':
        return {
          clients: { create: true, read: true, update: true, delete: false },
          prospects: { create: true, read: true, update: true, delete: false, convert: true },
          cases: { create: true, read: true, update: true, delete: false },
          analytics: { read: true },
          settings: { read: false, update: false },
          users: { create: false, read: false, update: false, delete: false },
          marketers: { create: false, read: true, update: false, delete: false }
        };
      case 'staff':
        return {
          clients: { create: false, read: true, update: false, delete: false },
          prospects: { create: true, read: true, update: true, delete: false, convert: false },
          cases: { create: false, read: true, update: false, delete: false },
          analytics: { read: false },
          settings: { read: false, update: false },
          users: { create: false, read: false, update: false, delete: false },
          marketers: { create: false, read: false, update: false, delete: false }
        };
      default:
        return {
          clients: { create: false, read: false, update: false, delete: false },
          prospects: { create: false, read: false, update: false, delete: false, convert: false },
          cases: { create: false, read: false, update: false, delete: false },
          analytics: { read: false },
          settings: { read: false, update: false },
          users: { create: false, read: false, update: false, delete: false },
          marketers: { create: false, read: false, update: false, delete: false }
        };
    }
  }

  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  async signUp(email: string, password: string, userData: { name: string; role: string; permissions: any }): Promise<User | null> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (data.user) {
        // إنشاء سجل المستخدم في جدول users
        const newUser = await this.createUser({
          name: userData.name,
          email: email,
          role: userData.role as User['role'],
          permissions: userData.permissions,
          createdDate: new Date()
        });

        return newUser;
      }

      return null;
    } catch (error) {
      console.error('Error signing up:', error);
      return null;
    }
  }

  // الإحصائيات
  async getStats() {
    try {
      const [clients, prospects, cases] = await Promise.all([
        this.getClients(),
        this.getProspects(),
        this.getCases()
      ]);

      const completedCases = cases.filter(c => c.status === 'completed');
      const wonCases = completedCases.filter(c => c.outcome === 'won');

      return {
        totalClients: clients.length,
        totalProspects: prospects.length,
        totalCases: cases.length,
        pendingCases: cases.filter(c => c.status === 'pending' || c.status === 'in-progress').length,
        completedCases: completedCases.length,
        winRate: completedCases.length > 0 ? Math.round((wonCases.length / completedCases.length) * 100) : 0,
        clientsByType: {
          individual: clients.filter(c => c.clientType === 'individual').length,
          company: clients.filter(c => c.clientType === 'company').length,
          association: clients.filter(c => c.clientType === 'association').length,
          government: clients.filter(c => c.clientType === 'government').length
        },
        prospectsByStatus: prospects.reduce((acc, p) => {
          acc[p.prospectStatus] = (acc[p.prospectStatus] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        casesByStatus: {
          pending: cases.filter(c => c.status === 'pending').length,
          'in-progress': cases.filter(c => c.status === 'in-progress').length,
          completed: cases.filter(c => c.status === 'completed').length,
          postponed: cases.filter(c => c.status === 'postponed').length
        },
        conversionRate: prospects.length + clients.length > 0 ? 
          Math.round((clients.length / (prospects.length + clients.length)) * 100) : 0
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalClients: 0,
        totalProspects: 0,
        totalCases: 0,
        pendingCases: 0,
        completedCases: 0,
        winRate: 0,
        clientsByType: { individual: 0, company: 0, association: 0, government: 0 },
        prospectsByStatus: {},
        casesByStatus: { pending: 0, 'in-progress': 0, completed: 0, postponed: 0 },
        conversionRate: 0
      };
    }
  }

  // وظائف مساعدة لترحيل البيانات من localStorage
  async migrateFromLocalStorage(): Promise<void> {
    try {
      console.log('بدء ترحيل البيانات من localStorage...');

      // ترحيل الإعدادات أولاً
      const localSettings = localStorage.getItem('naflaw_settings');
      if (localSettings) {
        const settings = JSON.parse(localSettings);
        await this.updateSettings(settings);
        console.log('✅ تم ترحيل الإعدادات');
      }

      // ترحيل المستخدمين
      const localUsers = localStorage.getItem('naflaw_users');
      if (localUsers) {
        const users = JSON.parse(localUsers);
        for (const user of users) {
          // استخدام signUp بدلاً من admin.createUser
          await this.signUp(user.email, 'password123', {
            name: user.name,
            role: user.role,
            permissions: user.permissions
          });
        }
        console.log('✅ تم ترحيل المستخدمين');
      }

      // ترحيل العملاء
      const localClients = localStorage.getItem('naflaw_clients');
      if (localClients) {
        const clients = JSON.parse(localClients, (key, value) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
          }
          return value;
        });
        
        for (const client of clients) {
          await this.createClient(client);
        }
        console.log('✅ تم ترحيل العملاء');
      }

      // ترحيل العملاء المحتملين
      const localProspects = localStorage.getItem('naflaw_prospects');
      if (localProspects) {
        const prospects = JSON.parse(localProspects, (key, value) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
          }
          return value;
        });
        
        for (const prospect of prospects) {
          await this.createProspect(prospect);
        }
        console.log('✅ تم ترحيل العملاء المحتملين');
      }

      // ترحيل المسوّقين
      const localMarketers = localStorage.getItem('naflaw_marketers');
      if (localMarketers) {
        const marketers = JSON.parse(localMarketers, (key, value) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
          }
          return value;
        });
        
        for (const marketer of marketers) {
          await this.createMarketer(marketer);
        }
        console.log('✅ تم ترحيل المسوّقين');
      }

      // ترحيل القضايا
      const localCases = localStorage.getItem('naflaw_cases');
      if (localCases) {
        const cases = JSON.parse(localCases, (key, value) => {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
          }
          return value;
        });
        
        for (const case_ of cases) {
          await this.createCase(case_);
        }
        console.log('✅ تم ترحيل القضايا');
      }

      console.log('🎉 تم ترحيل جميع البيانات بنجاح!');
    } catch (error) {
      console.error('خطأ في ترحيل البيانات:', error);
      throw error;
    }
  }

  // تصدير جميع البيانات
  async exportAllData(): Promise<any> {
    try {
      const [clients, prospects, cases, users, marketers, activities, settings] = await Promise.all([
        this.getClients(),
        this.getProspects(),
        this.getCases(),
        this.getUsers(),
        this.getMarketers(),
        this.getActivities(),
        this.getSettings()
      ]);

      return {
        clients,
        prospects,
        cases,
        users,
        marketers,
        activities,
        settings,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }
}

// إنشاء مثيل واحد من قاعدة البيانات
export const supabaseDb = new SupabaseDatabase();