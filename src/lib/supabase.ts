/* ═══ Supabase مفصولة ═══
 *
 * القاعدة صارت D1، والنداء يمرّ بالـWorker. فلا حزمة `supabase-js` في
 * الاعتماديات ولا مفتاح في الحزمة ولا نداءَ من متصفّح إلى قاعدةٍ رأساً.
 *
 * والملفّ باقٍ لسببين: `supabaseDatabase.ts` لا يزال في المستودع شاهداً
 * على ما كان ويستورد منه، ونوعُ `Database` أدناه يصف المخطّط القديم وصفاً
 * مفيداً لمن يقارن. فبقي السطح ولم يبقَ خلفه شيء.
 *
 * ومن ناداه بعد اليوم يُخفق صراحةً — لا صمتاً، ولا ببيانات قديمة.
 */

const REMOVED = 'supabase_removed';

/** مفصولة دائماً. تسألها الشاشات قبل أن تنادي. */
export const isSupabaseConfigured = false;

/* الوسيط يحفظ الشكل — `supabase.from(...)` — فلا يسقط تحليلُ الأنواع في
   `supabaseDatabase.ts`. وأولُ لمسةٍ فعلية ترمي. */
export const supabase: any = new Proxy(
  {},
  {
    get() {
      throw new Error(REMOVED);
    },
  },
);

// أنواع قاعدة البيانات المُولدة
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: string;
          permissions: any;
          profile_picture: string | null;
          last_login: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          role?: string;
          permissions?: any;
          profile_picture?: string | null;
          last_login?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: string;
          permissions?: any;
          profile_picture?: string | null;
          last_login?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          full_name: string;
          id_number: string;
          phone: string;
          email: string;
          join_date: string;
          client_type: string;
          status: string;
          notes: string;
          profile_picture: string | null;
          commercial_register: string | null;
          legal_representative: any | null;
          attachments: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          id_number: string;
          phone: string;
          email: string;
          join_date?: string;
          client_type?: string;
          status?: string;
          notes?: string;
          profile_picture?: string | null;
          commercial_register?: string | null;
          legal_representative?: any | null;
          attachments?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          id_number?: string;
          phone?: string;
          email?: string;
          join_date?: string;
          client_type?: string;
          status?: string;
          notes?: string;
          profile_picture?: string | null;
          commercial_register?: string | null;
          legal_representative?: any | null;
          attachments?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      prospects: {
        Row: {
          id: string;
          full_name: string;
          id_number: string;
          phone: string;
          email: string;
          join_date: string;
          client_type: string;
          prospect_status: string;
          notes: string;
          profile_picture: string | null;
          commercial_register: string | null;
          legal_representative: any | null;
          attachments: any;
          source: string | null;
          expected_value: number | null;
          follow_up_date: string | null;
          assigned_to: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          id_number: string;
          phone: string;
          email: string;
          join_date?: string;
          client_type?: string;
          prospect_status?: string;
          notes?: string;
          profile_picture?: string | null;
          commercial_register?: string | null;
          legal_representative?: any | null;
          attachments?: any;
          source?: string | null;
          expected_value?: number | null;
          follow_up_date?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          id_number?: string;
          phone?: string;
          email?: string;
          join_date?: string;
          client_type?: string;
          prospect_status?: string;
          notes?: string;
          profile_picture?: string | null;
          commercial_register?: string | null;
          legal_representative?: any | null;
          attachments?: any;
          source?: string | null;
          expected_value?: number | null;
          follow_up_date?: string | null;
          assigned_to?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      cases: {
        Row: {
          id: string;
          case_number: string;
          case_type: string;
          client_id: string;
          client_name: string;
          summary: string;
          status: string;
          outcome: string | null;
          basecamp_url: string | null;
          marketer_id: string | null;
          marketer_name: string | null;
          fee_structure: any | null;
          payment_status: any | null;
          commission_structure: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_number: string;
          case_type: string;
          client_id: string;
          client_name: string;
          summary: string;
          status?: string;
          outcome?: string | null;
          basecamp_url?: string | null;
          marketer_id?: string | null;
          marketer_name?: string | null;
          fee_structure?: any | null;
          payment_status?: any | null;
          commission_structure?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          case_number?: string;
          case_type?: string;
          client_id?: string;
          client_name?: string;
          summary?: string;
          status?: string;
          outcome?: string | null;
          basecamp_url?: string | null;
          marketer_id?: string | null;
          marketer_name?: string | null;
          fee_structure?: any | null;
          payment_status?: any | null;
          commission_structure?: any | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      marketers: {
        Row: {
          id: string;
          full_name: string;
          id_number: string;
          phone: string;
          email: string;
          relationship_type: string;
          start_date: string;
          status: string;
          notes: string;
          profile_picture: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          id_number: string;
          phone: string;
          email: string;
          relationship_type?: string;
          start_date?: string;
          status?: string;
          notes?: string;
          profile_picture?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          id_number?: string;
          phone?: string;
          email?: string;
          relationship_type?: string;
          start_date?: string;
          status?: string;
          notes?: string;
          profile_picture?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          type: string;
          description: string;
          user_id: string;
          user_name: string;
          entity_id: string | null;
          entity_type: string | null;
          details: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          description: string;
          user_id: string;
          user_name: string;
          entity_id?: string | null;
          entity_type?: string | null;
          details?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          description?: string;
          user_id?: string;
          user_name?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          details?: any | null;
          created_at?: string;
        };
      };
      system_settings: {
        Row: {
          id: string;
          key: string;
          value: any;
          description: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: any;
          description?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: any;
          description?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      commission_payments: {
        Row: {
          id: string;
          marketer_id: string;
          case_id: string;
          amount: number;
          payment_date: string;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          marketer_id: string;
          case_id: string;
          amount: number;
          payment_date?: string;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          marketer_id?: string;
          case_id?: string;
          amount?: number;
          payment_date?: string;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
    };
  };
};