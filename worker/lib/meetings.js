// الاجتماعات — تُنشأ عند Zoom ثم تُحفظ في D1.
//
// ═══ ما كان ═══
//
// نافذةُ الاجتماع تكتب `const meetingId = '2534928083'` ورابطاً ثابتاً،
// لكل اجتماع ولكل عميل، ولا نداءَ لـZoom. ثم تحفظ في `localStorage` —
// فلا يراها إلا من أنشأها على جهازه، ولا تُقرأ من شاشة.
//
// ═══ ولماذا من الخادم لا من المتصفّح ═══
//
// Zoom يوقّع بـ`client_secret`. ومن نادى واجهته من المتصفّح شحن سرَّه في
// الحزمة، فقرأه كلُّ زائرٍ وأنشأ اجتماعاتٍ باسم المكتب. فالنداء هنا،
// والسرُّ `wrangler secret` لا `VITE_*`.

const fail = (error, status) => Response.json({ ok: false, error }, { status });

const nowSeconds = () => Math.floor(Date.now() / 1000);

const ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API = 'https://api.zoom.us/v2';

/** هل رُبط المزوّد؟ ثلاثةُ أسرار، وغيابُ أحدها غيابُ الربط. */
function zoomCredentials(env) {
  const accountId = env.ZOOM_ACCOUNT_ID;
  const clientId = env.ZOOM_CLIENT_ID;
  const clientSecret = env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) return null;
  return { accountId, clientId, clientSecret };
}

/**
 * رمزُ وصولٍ من نوع Server-to-Server OAuth.
 *
 * ولا يُخبَّأ: الرمز يعيش ساعة، والـWorker لا حالةَ فيه بين طلبين — وحفظُه
 * في `KV` يضيف قراءةً وكتابةً لكل اجتماع، والاجتماعات تُنشأ نادراً.
 */
async function zoomToken({ accountId, clientId, clientSecret }) {
  const body = new URLSearchParams({
    grant_type: 'account_credentials',
    account_id: accountId,
  });

  const response = await fetch(ZOOM_TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    /* لا يُسجَّل جسمُ الردّ: قد يحمل صدى الاعتماد. والحالة تكفي للتشخيص. */
    console.error('Zoom: تعذّر الحصول على رمز الوصول —', response.status);
    return null;
  }

  const payload = await response.json();
  return payload.access_token ?? null;
}

/* الحقول التي تُقبل من الواجهة وحدود كلٍّ منها: جسمٌ يُمرَّر كما ورد إلى
   مزوّدٍ خارجي يجعل الواجهة تتحكّم بما لا تملكه. */
function readBody(body) {
  const topic = String(body?.topic ?? '').trim().slice(0, 200);
  const agenda = String(body?.agenda ?? '').trim().slice(0, 2000);
  const startAt = Number(body?.startAt);
  const duration = Number(body?.duration);
  const passcode = String(body?.passcode ?? '').trim().slice(0, 10);
  const subjectType = body?.subjectType === 'client' || body?.subjectType === 'prospect'
    ? body.subjectType
    : null;
  const subjectId = subjectType ? String(body?.subjectId ?? '').slice(0, 64) : null;

  const invitees = Array.isArray(body?.invitees)
    ? body.invitees
        .map((entry) => String(entry ?? '').trim().toLowerCase())
        .filter((entry) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry))
        .slice(0, 100)
    : [];

  if (!topic) return { error: 'topic_required' };
  if (!Number.isFinite(startAt) || startAt <= 0) return { error: 'start_required' };
  if (!Number.isFinite(duration) || duration < 5 || duration > 1440) {
    return { error: 'invalid_duration' };
  }

  return {
    value: {
      topic,
      agenda,
      startAt: Math.floor(startAt),
      duration: Math.floor(duration),
      passcode: passcode || null,
      subjectType,
      subjectId,
      invitees,
      waitingRoom: body?.waitingRoom !== false,
      autoRecording: body?.recordMeeting === true,
    },
  };
}

/** إنشاء اجتماع. */
export async function createMeeting(request, env, user) {
  /* الاجتماع يُعقد لعميل، فتصريحُه تصريحُ العملاء. ولا تصريحَ خاصّ به في
     مفردات هذه المنصة. */
  if (!user.permissions?.clients?.update) return fail('forbidden', 403);

  const credentials = zoomCredentials(env);
  /* «غير مربوط» رمزٌ مسجَّل تعرفه الشاشة وتترجمه — لا خطأُ شبكةٍ يوهم أن
     العطل عارضٌ يزول بالمحاولة. */
  if (!credentials) return fail('not_connected', 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  const parsed = readBody(body);
  if (parsed.error) return fail(parsed.error, 400);
  const input = parsed.value;

  const token = await zoomToken(credentials);
  if (!token) return fail('provider_auth_failed', 502);

  const response = await fetch(`${ZOOM_API}/users/me/meetings`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      topic: input.topic,
      type: 2, // مجدوَل بوقتٍ محدّد
      start_time: new Date(input.startAt * 1000).toISOString(),
      duration: input.duration,
      timezone: 'Asia/Riyadh',
      agenda: input.agenda,
      ...(input.passcode ? { password: input.passcode } : {}),
      settings: {
        waiting_room: input.waitingRoom,
        auto_recording: input.autoRecording ? 'cloud' : 'none',
        join_before_host: false,
      },
    }),
  });

  if (!response.ok) {
    console.error('Zoom: تعذّر إنشاء الاجتماع —', response.status);
    return fail('provider_failed', 502);
  }

  const meeting = await response.json();
  const id = crypto.randomUUID();
  const createdAt = nowSeconds();

  await env.DB.prepare(
    `INSERT INTO meetings
       (id, provider, provider_id, join_url, start_url, topic, agenda, start_at, duration,
        passcode, subject_type, subject_id, invitees, created_by, created_at)
     VALUES (?, 'zoom', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      String(meeting.id),
      meeting.join_url ?? '',
      meeting.start_url ?? null,
      input.topic,
      input.agenda,
      input.startAt,
      input.duration,
      /* كلمةُ المرور من ردّ Zoom لا من الطلب: قد يولّدها هو إن لم تُرسَل،
         وقد يرفض ما أُرسل. والمعروضُ يجب أن يكون ما يقبله الاجتماع. */
      meeting.password ?? input.passcode,
      input.subjectType,
      input.subjectId,
      JSON.stringify(input.invitees),
      user.id,
      createdAt,
    )
    .run();

  return Response.json(
    {
      ok: true,
      data: {
        id,
        providerId: String(meeting.id),
        joinUrl: meeting.join_url ?? '',
        startUrl: meeting.start_url ?? null,
        topic: input.topic,
        agenda: input.agenda,
        startAt: input.startAt,
        duration: input.duration,
        passcode: meeting.password ?? input.passcode,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        invitees: input.invitees,
        createdAt,
      },
    },
    { status: 201 },
  );
}

/** اجتماعات صفٍّ بعينه، أو الأحدث إن لم يُحدَّد. */
export async function listMeetings(env, user, url) {
  if (!user.permissions?.clients?.read) return fail('forbidden', 403);

  const subjectType = url.searchParams.get('subjectType');
  const subjectId = url.searchParams.get('subjectId');

  const statement =
    subjectType && subjectId
      ? env.DB.prepare(
          `SELECT * FROM meetings WHERE subject_type = ? AND subject_id = ? ORDER BY start_at DESC LIMIT 100`,
        ).bind(subjectType, subjectId)
      : env.DB.prepare(`SELECT * FROM meetings ORDER BY start_at DESC LIMIT 100`);

  const { results } = await statement.all();

  return Response.json({
    ok: true,
    data: (results ?? []).map((row) => ({
      id: row.id,
      providerId: row.provider_id,
      joinUrl: row.join_url,
      /* `start_url` لا يُسرَّب في السرد: من ملكه بدأ الاجتماع مضيفاً. وهو
         يُردّ مرّةً لمنشئه عند الإنشاء، ولا يُعاد بعدها. */
      topic: row.topic,
      agenda: row.agenda,
      startAt: row.start_at,
      duration: row.duration,
      passcode: row.passcode,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      invitees: safeList(row.invitees),
      createdAt: row.created_at,
    })),
  });
}

function safeList(text) {
  try {
    const parsed = JSON.parse(text ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
