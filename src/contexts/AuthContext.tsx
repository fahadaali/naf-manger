import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, LoginCredentials } from '../types';
import { goToLogin } from '../data/api';

/* ═══ الدخول صار مركزياً ═══
 *
 * لا بريدَ هنا ولا كلمةَ مرور ولا حالةَ دخولٍ محمولة في المتصفّح: الحارس في
 * `worker/index.js` يسبق كل مسار، ويحوّل من لا جلسةَ له إلى المركز قبل أن
 * يصل هذا الكود إلى المتصفّح أصلاً.
 *
 * فما بقي هنا شيئان: قراءةُ من نحن من `‎/api/me`، والخروج.
 *
 * والمصادقة مركزية والصلاحيات موزّعة: المركز يقرّر الدخول من عدمه، وما
 * يملكه الداخل يقرّره جدولُ الأعضاء في D1 وحده — ولا يقرأ المركز دورَه
 * في أي قرار.
 */

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  hasPermission: (resource: string, action: string) => boolean;
  updateUser: (userData: Partial<User>) => void;
  migrateData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** ما يعيده `‎/api/me` — أوقاتُه ثوانٍ لا مللي ثانية، كأعمدة جدول الأعضاء. */
interface MeResponse {
  ok: boolean;
  user: {
    id: string;
    role: User['role'];
    name: string | null;
    email: string | null;
    permissions: User['permissions'];
    createdAt: number | null;
    lastSeenAt: number | null;
  };
}

function toUser(payload: MeResponse['user']): User {
  return {
    id: payload.id,
    name: payload.name ?? '',
    email: payload.email ?? '',
    role: payload.role,
    permissions: payload.permissions,
    createdDate: payload.createdAt ? new Date(payload.createdAt * 1000) : new Date(),
    lastLogin: payload.lastSeenAt ? new Date(payload.lastSeenAt * 1000) : undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true
  });

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const response = await fetch('/api/me', { credentials: 'same-origin' });

      /* ٤٠١ ليست عطلاً: الرمز يعيش خمس عشرة دقيقة، فلوحةٌ مفتوحة أطول من
         ذلك تبلغها في كل مرة. والردّ يحمل عنوان الباب، فنمضي إليه بأنفسنا —
         `fetch` لا يتبع تحويلةً إلى أصل آخر بلا `CORS`، فلو انتظرنا تحويلةً
         لسقط الطلب بخطأ شبكة وبقيت اللوحة مكانها وقد أُغلقت جلستها تحتها. */
      if (response.status === 401) {
        const body = await response.json().catch(() => null);
        goToLogin(body?.login);
        return;
      }

      if (!response.ok) throw new Error(`‎/api/me ردّ ${response.status}`);

      const body: MeResponse = await response.json();
      setAuthState({
        isAuthenticated: true,
        user: toUser(body.user),
        loading: false
      });
    } catch (error) {
      console.error('Error checking auth state:', error);
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false
      });
    }
  };

  /* الباب هو المركز، والوسيط يقود إليه. وهذه الدالة باقيةٌ في السطح لأن
     شاشة الدخول القديمة لا تزال تستدعيها — فتقودها إلى الباب نفسه بدل أن
     تفشل صامتة. وكلمةُ المرور لا تُقرأ هنا ولا تُرسل إلى أي مكان. */
  const login = async (_credentials: LoginCredentials): Promise<boolean> => {
    window.location.href = '/';
    return false;
  };

  const logout = async () => {
    try {
      const response = await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin'
      });
      const body = await response.json().catch(() => null);

      /* الوجهة `‎{issuer}/` لا `‎/`: جذر المنصة محميّ، فتحويلُه إليه يعيد
         فتح جلسةٍ من جلسة المركز القائمة — فيعود الخارجُ إلى شاشته قبل أن
         يقرأ شيئاً، ويقرأ من ذلك أن الزرّ لا يعمل. */
      window.location.href = body?.next ?? '/';
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = '/';
    }
  };

  /* ملفُّ العضو الشخصي لم ينتقل بعد.
     الاسم والبريد يأتيان من المركز ويُكتبان في جدول الأعضاء عند كل دخول،
     فتعديلُهما محلياً يُدهس في الدخول التالي — وموضعُ تغييرهما هو المركز.
     والصورة الشخصية تخصّ هذه المنصة، ومكانها حاوية R2 لا عمودٌ في صفّ —
     وذلك في دفعة طبقة البيانات. فتُحدَّث الحالة في الذاكرة ولا يُدّعى حفظ. */
  const updateUser = async (userData: Partial<User>) => {
    setAuthState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...userData } : prev.user
    }));
  };

  const migrateData = async () => {
    throw new Error('نقل البيانات إلى D1 لم يبدأ بعد');
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!authState.user) return false;

    const permissions = authState.user.permissions as any;
    if (!permissions) return false;

    return permissions[resource]?.[action] || false;
  };

  return (
    <AuthContext.Provider value={{
      ...authState,
      login,
      logout,
      hasPermission,
      updateUser,
      migrateData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
