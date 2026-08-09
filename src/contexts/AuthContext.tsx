import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, LoginCredentials, NotificationPrefs } from '../types';
import { ApiError, fileUrl, goToLogin } from '../data/api';

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
  /** يحفظ في `‎/api/me‎` ثم يُحدِّث الحالة بما ردّه الخادم. يرمي إن سقط. */
  updateUser: (patch: { avatarKey?: string | null; notificationPrefs?: NotificationPrefs }) => Promise<void>;
  /** عنوان المركز — موضعُ الهوية وكلمة المرور والمصادقة الثنائية. */
  center: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** ما يعيده `‎/api/me` — أوقاتُه ثوانٍ لا مللي ثانية، كأعمدة جدول الأعضاء. */
interface MeResponse {
  ok: boolean;
  /** عنوان المركز. الهويةُ وكلمةُ المرور والمصادقةُ الثنائية تعيش هناك. */
  center: string | null;
  user: {
    id: string;
    role: User['role'];
    name: string | null;
    email: string | null;
    permissions: User['permissions'];
    createdAt: number | null;
    lastSeenAt: number | null;
    avatarKey: string | null;
    notificationPrefs: NotificationPrefs;
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
    avatarKey: payload.avatarKey ?? undefined,
    /* الصورة تُعرض من مسارها لا من عمودها: العمود مفتاحٌ في الحاوية،
       والبايتات لا تمرّ بالصفّ. */
    profilePicture: fileUrl(payload.avatarKey),
    notificationPrefs: payload.notificationPrefs,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true
  });
  const [center, setCenter] = useState<string | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  /* القراءة والكتابة تمرّان بهذا وحده: `‎/api/me‎` يردّ الشكل نفسه في
     الحالتين — `{ ok, center, user }` لا مغلَّف `data` — فيُقرأ في موضعٍ
     واحد ولا ينحرف أحدُهما عن الآخر.

     ولا يمرّ بـ`api.call`: تلك تفكّ `body.data` وهذا المسار لا يغلّف. */
  const requestMe = async (init?: RequestInit): Promise<MeResponse | null> => {
    const response = await fetch('/api/me', { credentials: 'same-origin', ...init });

    /* ٤٠١ ليست عطلاً: الرمز يعيش خمس عشرة دقيقة، فلوحةٌ مفتوحة أطول من
       ذلك تبلغها في كل مرة. والردّ يحمل عنوان الباب، فنمضي إليه بأنفسنا —
       `fetch` لا يتبع تحويلةً إلى أصل آخر بلا `CORS`، فلو انتظرنا تحويلةً
       لسقط الطلب بخطأ شبكة وبقيت اللوحة مكانها وقد أُغلقت جلستها تحتها. */
    if (response.status === 401) {
      const body = await response.json().catch(() => null);
      goToLogin(body?.login);
      return null;
    }

    const body = (await response.json().catch(() => null)) as MeResponse | null;
    if (!response.ok || !body?.ok) {
      throw new ApiError((body as { error?: string } | null)?.error ?? 'me_failed', response.status);
    }
    return body;
  };

  const apply = (body: MeResponse) => {
    setCenter(body.center ?? null);
    setAuthState({ isAuthenticated: true, user: toUser(body.user), loading: false });
  };

  const checkAuthState = async () => {
    try {
      const body = await requestMe();
      if (body) apply(body);
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

  /* ═══ الحفظ يقع فعلاً، والحالةُ من ردّ الخادم ═══
   *
   * كانت هذه الدالّة تكتب في الذاكرة وحدها وتعود، والشاشة تقول «تم الحفظ» —
   * فيُدهس ما «حُفظ» عند أول تحديثٍ للصفحة.
   *
   * والآن `PATCH /api/me`، وحقلان لا ثالث: مفتاحُ الصورة وتفضيلاتُ
   * الإشعارات. أمّا الاسم والبريد فيأتيان من المركز ويُكتبان عند كل دخول،
   * فقبولُهما هنا وعدٌ يُدهس في الدخول التالي — وموضعُ تغييرهما المركز.
   *
   * والحالةُ تُبنى مما ردّه الخادم لا مما أُرسل: لو ردّ الخادم غيرَ ما
   * طُلب — لأنه نظّف قيمةً أو رفض مفتاحاً — لكانت الشاشة تعرض ما لم يُحفظ.
   *
   * ولا تُبلَع الأخطاء: من ضغط «حفظ» يجب أن يعرف. والرمي هنا يبلغ الشاشة. */
  const updateUser = async (patch: {
    avatarKey?: string | null;
    notificationPrefs?: NotificationPrefs;
  }) => {
    const body = await requestMe({
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (body) apply(body);
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
      center
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
