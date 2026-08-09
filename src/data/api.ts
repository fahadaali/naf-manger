/* عميلُ الواجهة البرمجية — المنفذ الوحيد بين الشاشات وقاعدة D1.
 *
 * كلُّ نداءٍ يمرّ بالـWorker، والحراسةُ دورُ العضو يُقرأ هناك — فلا مفتاح
 * قاعدةٍ في المتصفّح أصلاً، ولا جدولَ يُبلَغ بغير مسارٍ محروس.
 */

/** ردُّ المسارات: `{ ok, data }` أو `{ ok:false, error }` — رمزٌ لا جملة. */
interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  login?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/* ═══ التحويل إلى الباب يقع مرّةً واحدة ═══
 *
 * الشاشة الواحدة تفتح عدّة نداءات معاً — الترويسة والشريط واللوحة وسجلُّ
 * الأنشطة — وفيها مؤقّتان يعيدان النداء كل خمس عشرة ثانية وكل ثلاثين.
 * فإن انتهى الرمز ردّت كلُّها ٤٠١ في آنٍ واحد، وكان كلُّ واحدٍ منها يكتب
 * `window.location.href` من جديد: تحويلةٌ تُلغى وتُستأنف مراراً، فتقف
 * الصفحة على حالها ويقرأ صاحبُها من وقوفها أنها «علّقت».
 *
 * فأوّلُ ٤٠١ يقود، والباقي يُرمى خطأً ولا يمسّ العنوان. */
let leaving = false;

export function goToLogin(login?: string): void {
  if (leaving) return;
  leaving = true;
  window.location.href = login ?? '/';
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
  });

  /* ٤٠١ ليست عطلاً: الرمز يعيش خمس عشرة دقيقة، فلوحةٌ مفتوحة أطول من ذلك
     تبلغها. والردُّ يحمل عنوان الباب فنمضي إليه بأنفسنا — `fetch` لا يتبع
     تحويلةً إلى أصلٍ آخر بلا `CORS`، فانتظارُها يُسقط الطلب بخطأ شبكة
     وتبقى اللوحة مكانها وقد أُغلقت جلستها تحتها. */
  if (response.status === 401) {
    const body = (await response.json().catch(() => null)) as ApiEnvelope<never> | null;
    goToLogin(body?.login);
    throw new ApiError('unauthorized', 401);
  }

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !body?.ok) {
    throw new ApiError(body?.error ?? 'request_failed', response.status);
  }

  return body.data as T;
}

export const api = {
  list: <T>(resource: string) => call<T[]>(`/${resource}`),
  get: <T>(resource: string, id: string) => call<T>(`/${resource}/${encodeURIComponent(id)}`),

  create: <T>(resource: string, body: unknown) =>
    call<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(body) }),

  update: <T>(resource: string, id: string, body: unknown) =>
    call<T>(`/${resource}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  remove: (resource: string, id: string) =>
    call<{ ok: true }>(`/${resource}/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  post: <T>(path: string, body?: unknown) =>
    call<T>(path, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) }),

  patch: <T>(path: string, body: unknown) =>
    call<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  read: <T>(path: string) => call<T>(path),
};

/* التواريخ تصل نصّاً — لا يحمل JSON نوعَ `Date`. والشاشات تنتظر `Date`،
   فتُحوَّل هنا مرّةً واحدة لا في كل مكوّن. */
export function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value ?? ''));
}

export function toOptionalDate(value: unknown): Date | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return toDate(value);
}
