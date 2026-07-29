import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// متغيرات البيئة لـ Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* ═══ العميل يُنشأ عند أول استعمال، لا عند تحميل الوحدة ═══
 *
 * كان هنا `throw` عارياً في جسم الوحدة حين يغيب المتغيّران. و`Vite` يحقن
 * هذين المتغيّرين **وقت البناء**، فبناءٌ لا يجدهما يُدرج الرمية في الحزمة —
 * فتقع لحظةَ تحميلها، قبل أن يُركّب React شيئاً.
 *
 * والنتيجة صفحةٌ بيضاء تامّة في كل مسار: لا رسالة، ولا تحويلة إلى المركز،
 * ولا حتى صفحة `‎/denied`. لأن `App` يستورد `data/database` وهو يستورد هذا
 * الملفّ، فالسلسلة تنكسر عند أوّل `import`.
 *
 * والدخول لم يعد يمرّ بـSupabase أصلاً — المركز هو الباب — فغيابُ إعدادها
 * يجب أن يُعطّل شاشات البيانات وحدها، لا أن يُسقط التطبيق كلَّه قبل أن يبدأ.
 *
 * فصار الخطأ يقع عند أول نداء فعليّ: من يسأل القاعدة يُخفق ويُخفق وحده.
 */
let client: SupabaseClient | null = null;

function requireClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env file.');
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }
  return client;
}

/** أهو مضبوط؟ تسأله الشاشات قبل أن تنادي، فتعرض تعذّراً بدل أن ترمي. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/* الوسيط يحفظ السطح كما هو — `supabase.from(...)` و`supabase.auth` —
   فلا يُمسّ أيٌّ من المواضع العشرة التي تستورده. والدوالُّ تُربط بالعميل
   لأن `supabase-js` يعتمد على `this` داخلها. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const instance = requireClient();
    const value = Reflect.get(instance, property, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

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