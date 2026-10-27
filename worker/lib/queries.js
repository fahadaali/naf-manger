// المسارات التي لا يكفيها CRUD: الإعدادات والأعضاء والإحصاءات والتحويل.

import { RESOURCES, toClient } from './resources.js';
import { WORK_KIND_SQL } from './work-kind.js';
import { may } from './crud.js';
import { KNOWN_ROLES, permissionsFor } from './roles.js';
import { logActivity } from './activity.js';

const json = (body, status = 200) => Response.json(body, { status });
const fail = (error, status) => json({ ok: false, error }, status);

const nowSeconds = () => Math.floor(Date.now() / 1000);

/* ═══ الإعدادات ═══
 *
 * كائنٌ واحد تحت مفتاح واحد لا صفٌّ لكل مفتاح: الواجهة تقرؤه كاملاً وتكتبه
 * كاملاً، فتفريقُه صفوفاً يضيف ترجمةً في الطرفين بلا مقابل.
 */
const SETTINGS_KEY = 'settings';

/** الافتراضي — يُعطي الشاشات مفرداتِها قبل أن يحفظ أحدٌ شيئاً. */
const DEFAULT_SETTINGS = {
  clientTypes: ['individual', 'company', 'association', 'government'],
  clientStatuses: ['current', 'former'],
  prospectStatuses: ['مهتم', 'تم التواصل', 'بانتظار توقيع', 'غير مناسب', 'تم الرفض'],
  prospectSources: [
    'موقع إلكتروني',
    'وسائل التواصل الاجتماعي',
    'إحالة من عميل',
    'إعلان',
    'معرض',
    'أخرى',
  ],
  caseTypes: ['قضية تجارية', 'قضية عمالية', 'قضية مدنية', 'قضية جزائية'],

  /* ═══ صفةُ صاحب الرقم، ونوعُ الهوية ═══
     ملفُّ الموكّل يحمل أرقاماً لغيره — لوكيله ولأبيه ولأخيه — وحفظُها بلا
     صفةٍ يجعلها أرقاماً لا يُعرف لمن. وهاتان قائمتان كبقية المفردات:
     تُحرَّران من «تكوين النظام»، وأوّلُ `contactRelations` هو الافتراض. */
  contactRelations: ['أصيل', 'وكيل', 'أب', 'أم', 'أخ', 'ابن', 'زوج', 'أخرى'],
  idTypes: ['هوية وطنية', 'إقامة', 'سجل تجاري'],
  /* و`pending` («منظورة») دُمجت في «جارية» — `migrations/0028`. */
  caseStatuses: ['in-progress', 'completed', 'postponed'],

  /* ═══ ثلاثُ قوائم كانت تخالف ما تكتبه الشاشات ═══
   *
   * `marketerStatuses` كانت `['active', 'inactive']` والنماذج تكتب
   * `suspended` و`former`؛ و`relationshipTypes` كانت تحمل `partner`
   * والنماذج تكتب `external_company`؛ و`collectionStatuses` كانت
   * `pending, partial, collected` والنوع `PaymentStatus` يقول
   * `unpaid, partially_paid, fully_paid`.
   *
   * ولم يظهر الخلاف لأن لا أحد كان يقرأ هذه القوائم أصلاً: شاشة «تكوين
   * النظام» تحرّرها وتحفظها، والمنسدلات كلُّها مكتوبةٌ بأيديها. فعطلان
   * يُخفي أحدُهما الآخر — وقد رُبطت المنسدلات بهذه القوائم، فصار الخلافُ
   * يظهر في أول فتحةِ نموذج. */
  marketerStatuses: ['active', 'suspended', 'former'],
  relationshipTypes: ['employee', 'freelancer', 'external_company'],
  commissionTypes: ['percentage', 'fixed_amount'],
  collectionStatuses: ['unpaid', 'partially_paid', 'fully_paid'],
  /* ═══ `feeTypes` كانت تحمل مفرداتٍ لا يكتبها أحد ═══
     كانت `['fixed_amount', 'percentage']` — وهو «كيف يُحسب المبلغ» —
     وشاشةُ القضية تكتب بنيةَ الاستحقاق: مقدَّمٌ ومؤخَّر. فالقائمةُ تُحرَّر
     من «تكوين النظام» ولا يقرؤها أحد، وخياراتُ الشاشة مكتوبةٌ في تصييرها.
     فصارت مفرداتِ ما يُكتب فعلاً، وصارت الشاشةُ تقرؤها. */
  /* و`pro_bono` قضيةٌ مجانيةٌ تطوّعاً — بلا أتعابٍ ولا تحصيلٍ ولا عمولة. */
  feeTypes: ['advance_only', 'deferred_only', 'advance_and_deferred', 'pro_bono'],
  companyName: 'شركة ناف',
  companyDescription: 'نظام إدارة العملاء',
};

/* ═══ ما لا يخرج إلا لمن يملك قراءة الإعدادات ═══
 *
 * هذا المسار **لا يُحرس بتصريح**، وذلك مقصود: `useSettings()` تُغذّي كلَّ
 * منسدلةٍ في نماذج العملاء والقضايا والمحتملين، فحجبُه عن الموظّف يُفرغ
 * نماذجَه. لكنّ الكائن نفسه كان يحمل `emailSettings` ومعها **كلمةُ مرور
 * SMTP** — فكانت تُنزَّل إلى متصفّح كلِّ عضو عند كل فتحةِ نموذج، ولمن
 * `settings.read` عنده `false`.
 *
 * فالمفرداتُ عامّةٌ لأنها مفردات، وما عداها يُقصّ. والقصُّ هنا لا في
 * الشاشة: من نادى المسار بيده يقرأ ما يردّه هذا السطر لا ما ترسمه شاشة.
 */
const PRIVILEGED_KEYS = ['emailSettings'];

function publicSettings(settings) {
  const out = { ...settings };
  for (const key of PRIVILEGED_KEYS) delete out[key];
  return out;
}

async function storedSettings(env) {
  const row = await env.DB.prepare(`SELECT value FROM system_settings WHERE key = ?`)
    .bind(SETTINGS_KEY)
    .first();

  try {
    return row?.value ? JSON.parse(row.value) : {};
  } catch {
    // إعدادٌ تالف يُقرأ غياباً: الشاشات تعمل بالافتراضي بدل أن تسقط.
    return {};
  }
}

/** تساوٍ بنيويّ للقيم البسيطة والقوائم — يكفي لما في الإعدادات. */
function same(one, other) {
  return JSON.stringify(one) === JSON.stringify(other);
}

export async function readSettings(env, user) {
  const merged = { ...DEFAULT_SETTINGS, ...(await storedSettings(env)) };
  const mayReadAll = Boolean(user?.permissions?.settings?.read);

  return json({ ok: true, data: mayReadAll ? merged : publicSettings(merged) });
}

export async function writeSettings(request, env, user) {
  if (!user.permissions?.settings?.update) return fail('forbidden', 403);

  let patch;
  try {
    patch = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }
  if (!patch || typeof patch !== 'object') return fail('invalid_body', 400);

  /* ═══ يُحفظ ما تغيّر وحده ═══
     كانت الشاشات ترسل الكائن الراجع كاملاً — وهو `{…DEFAULT_SETTINGS, …stored}`
     — فأوّلُ حفظٍ ينسخ المفرداتِ الافتراضية كلَّها إلى الصفّ، ولا يبلغ تلك
     النسخةَ بعدها أيُّ تعديلٍ على `DEFAULT_SETTINGS` في الشيفرة. فصارت
     الشاشاتُ ترسل حقولَها هي، ويُطرح هنا ما يساوي الافتراضَ حرفاً بحرف. */
  const stored = await storedSettings(env);
  const merged = { ...stored, ...patch };

  for (const [key, value] of Object.entries(merged)) {
    if (key in DEFAULT_SETTINGS && same(value, DEFAULT_SETTINGS[key])) delete merged[key];
  }

  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                    updated_by = excluded.updated_by,
                                    updated_at = excluded.updated_at`,
  )
    .bind(SETTINGS_KEY, JSON.stringify(merged), user.id, nowSeconds())
    .run();

  return json({ ok: true, data: { ...DEFAULT_SETTINGS, ...merged } });
}

/* ═══ الأعضاء ═══
 *
 * شاشة المستخدمين تقرأ هذا وتكتبه. ولا إنشاء هنا ولا كلمة مرور: العضوية
 * تُنشأ بأول دخولٍ من المركز، والمنصة ترقّي وتوقف لا أكثر.
 */
export async function listMembers(env, user) {
  if (!user.permissions?.users?.read) return fail('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT user_id, display_name, email, role, perms, is_active, created_at, last_seen_at
     FROM members ORDER BY created_at DESC`,
  ).all();

  const data = (results ?? []).map((row) => ({
    id: row.user_id,
    name: row.display_name ?? '',
    email: row.email ?? '',
    role: row.role,
    isActive: Number(row.is_active) === 1,
    permissions: permissionsFor(row.role, safeJson(row.perms)),
    createdDate: row.created_at ? new Date(row.created_at * 1000).toISOString() : null,
    lastLogin: row.last_seen_at ? new Date(row.last_seen_at * 1000).toISOString() : null,
  }));

  return json({ ok: true, data });
}

/**
 * دليلُ الأعضاء — الاسمُ والدورُ وحدهما، للمفعَّلين.
 *
 * `listMembers` لمن يملك `users.read` وحده، وفيها البريدُ والصلاحيات. ومنسدلةُ
 * «المحامي المسؤول» يحتاجها كلُّ من يحرّر قضية — والمحامي لا يملك قراءةَ
 * المستخدمين. فهذا ما يلزم الاختيارَ لا أكثر: لا بريدَ ولا صلاحيات.
 */
export async function listDirectory(env, user) {
  const allowed = user.permissions?.cases?.read || user.permissions?.prospects?.read;
  if (!allowed) return fail('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT user_id, display_name, role FROM members WHERE is_active = 1 ORDER BY display_name`,
  ).all();

  return json({
    ok: true,
    data: (results ?? []).map((row) => ({ id: row.user_id, name: row.display_name ?? '', role: row.role })),
  });
}

export async function updateMember(request, env, user, id) {
  if (!user.permissions?.users?.update) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  const sets = [];
  const values = [];

  /* ودورٌ لا يعرفه `roles.js` يُردّ: قيمةٌ غريبة في العمود تُغلق الأبواب
     كلَّها على صاحبها — `permissionsFor` تعطيها `NONE` — فتصير شاشتُه
     فارغةً بلا سبب ظاهر، ولا سبيل لإصلاحها إلا من القاعدة. */
  if (typeof body.role === 'string' && body.role) {
    if (!KNOWN_ROLES.has(body.role)) return fail('unknown_role', 400);
    sets.push('role = ?');
    values.push(body.role);

    /* وتبديلُ الدور يمحو الصلاحياتِ الدقيقة ما لم تُرسَل معه: عضوٌ رُقّي
       إلى «محامٍ» وله `perms` محفوظةٌ من «إداري» يبقى على صلاحيات الأدنى،
       فيُقرأ دورُه شيئاً وتعمل صلاحيتُه شيئاً آخر. والمحوُ يُعيده إلى
       افتراض دوره الجديد. */
    if (!body.permissions) {
      sets.push('perms = ?');
      values.push(null);
    }
  }
  if (body.permissions && typeof body.permissions === 'object') {
    sets.push('perms = ?');
    values.push(JSON.stringify(body.permissions));
  }
  if (typeof body.isActive === 'boolean') {
    /* إيقافُ عضوٍ هنا يمنعه من الدخول: الوسيط يقرأ `is_active` في كل طلب
       محميّ، فالإيقاف يسري في الطلب التالي لا عند انتهاء كوكيه. */
    sets.push('is_active = ?');
    values.push(body.isActive ? 1 : 0);
  }

  if (!sets.length) return fail('empty_update', 400);

  /* ولا يُوقف العضوُ نفسَه ولا يُنزّل دورَه: آخرُ آدمنٍ يفعلها يُغلق
     شاشةَ المستخدمين على الجميع، ولا سبيل للعودة إلا من القاعدة. */
  if (id === user.id && (body.isActive === false || body.role)) {
    return fail('cannot_change_self', 409);
  }

  values.push(id);
  const result = await env.DB.prepare(`UPDATE members SET ${sets.join(', ')} WHERE user_id = ?`)
    .bind(...values)
    .run();

  if (!result.meta?.changes) return fail('not_found', 404);
  return json({ ok: true });
}

/* ═══ تحويل محتملٍ إلى عميل ═══
   الصفّان يتحرّكان معاً: يُنشأ العميل ويُحذف المحتمل. و`batch` يجعلهما
   دفعةً واحدة، فلا يبقى محتملٌ نُسخ ولم يُحذف. */
export async function convertProspect(env, user, id) {
  if (!may(user, RESOURCES.prospects, 'update') || !may(user, RESOURCES.clients, 'create')) {
    return fail('forbidden', 403);
  }

  const row = await env.DB.prepare(`SELECT * FROM prospects WHERE id = ?`).bind(id).first();
  if (!row) return fail('not_found', 404);

  const clientId = crypto.randomUUID();
  const now = nowSeconds();

  await env.DB.batch([
    env.DB.prepare(
      /* ونوعُ الهوية وبقيةُ الأرقام تنتقل معه: محتملٌ سُجّل له رقمُ وكيله
         ورقمُ أخيه ثم صار عميلاً، كان يصل ملفُّه بالرقم الأول وحده. */
      `INSERT INTO clients (id, full_name, id_number, id_type, phone, contacts, email,
                            join_date, client_type,
                            status, notes, profile_picture, commercial_register,
                            legal_representative, attachments, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'current', ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      clientId,
      row.full_name,
      row.id_number,
      row.id_type,
      row.phone,
      row.contacts ?? '[]',
      row.email,
      row.join_date,
      row.client_type,
      row.notes,
      row.profile_picture,
      row.commercial_register,
      row.legal_representative,
      row.attachments,
      now,
      now,
    ),
    env.DB.prepare(`DELETE FROM prospects WHERE id = ?`).bind(id),
  ]);

  const created = await env.DB.prepare(`SELECT * FROM clients WHERE id = ?`)
    .bind(clientId)
    .first();

  const client = toClient(RESOURCES.clients, created);

  /* والأثرُ يُسجَّل هنا لا في الشاشة: كانت `ProspectsView` تكتبه بنفسها
     ونسبَته إلى «النظام» لا إلى من ضغط — والفعلُ يقع على الخادم، فمن
     يعرفه يسجّله. */
  await logActivity(env, user, { resource: 'clients', action: 'create', row: client });

  return json({ ok: true, data: client }, 201);
}

/* ═══ النموّ ═══
 *
 * كانت اللوحة تعرض «‎+١٢٪‎» و«‎+٨٪‎» و«‎+٥٪‎» — أرقاماً مكتوبةً في التصيير لا
 * تُقرأ من شيء ولا تتغيّر أبداً. ومؤشّرٌ ثابتٌ في لوحةِ مكتبٍ أسوأُ من لا
 * مؤشّر: يُقرأ على أنّه قياس، ويُبنى عليه ظنٌّ أنّ العمل ينمو.
 *
 * والحسابُ الآن: ما وقع في الثلاثين يوماً الأخيرة، منسوباً إلى الثلاثين
 * التي قبلها. وهو ما تعنيه «مقارنةً بالشهر الماضي» حرفياً.
 *
 * والنسبةُ تغيب حين لا يصحّ حسابُها — شهرٌ سابق بلا صفٍّ واحد لا نسبةَ
 * منه، فيُعرض العددُ نفسُه بدلَها («‎+٣ جديد‎») ولا تُفبرك قسمةٌ على صفر.
 */
function growth(current, previous) {
  const now = Number(current ?? 0);
  const before = Number(previous ?? 0);
  return {
    current: now,
    previous: before,
    percent: before > 0 ? Math.round(((now - before) / before) * 100) : null,
  };
}

/* ═══ نوعُ الأتعاب من بنيتها ═══
   بـ`CASE` لا بـ`AND`: بنيةٌ فارغة (`NULL`) تجعل `NOT (json_valid(…) AND …)`
   مجهولاً لا صادقاً فيُسقَط صفُّها من الجمع صامتاً — وهي أكثرُ القضايا. و
   `json_extract` على نصٍّ تالف يرمي، ولا يُضمن قصرُ `AND` قبله. */
const FEE_TYPE = `COALESCE(CASE WHEN json_valid(fee_structure)
                             THEN json_extract(fee_structure, '$.type') END, '')`;

/**
 * ═══ تبدُّلُ نسبة الكسب بالنقاط لا بالنسبة ═══
 *
 * نسبةٌ من ٥٠٪ إلى ٦٠٪ تقدّمُ عشرِ نقاط — وقولُ «‎+٢٠٪‎» عنها يُقرأ أنّها
 * صارت ٧٠٪. فـ`percent` هنا فرقُ النقاط بين نسبتَي النافذتين.
 *
 * ولا مؤشّرَ إن خلت إحدى النافذتين من قضيةٍ محسومة: نسبةٌ من لا شيء ليست
 * صفراً، والمقارنةُ بها تُفبرك تقدّماً أو تراجعاً.
 */
function rateShift(row) {
  const recent = Number(row?.recent ?? 0);
  const prior = Number(row?.prior ?? 0);
  if (!recent || !prior) return null;
  const now = Math.round((Number(row.recent_won ?? 0) / recent) * 100);
  const before = Math.round((Number(row.prior_won ?? 0) / prior) * 100);
  return { current: now, previous: before, percent: now - before };
}

/* حدودُ النافذتين بلا فترةٍ مختارة — يومياً لا لحظياً: «الشهر الماضي» في
   كلام المكتب يومٌ لا ثانية، والحدُّ اليوميّ يجعل الرقم ثابتاً طوال اليوم. */
const WINDOW = {
  recentDate: `date('now', '-30 days')`,
  priorDate: `date('now', '-60 days')`,
};

/* ═══ الفترة ═══
   `from` و`to` تاريخان شاملان `YYYY-MM-DD` من فلاتر اللوحة (سنة، ربع، شهر،
   أسبوع، أو مخصّص). وتُقارن بالفترة السابقة المساوية لها. وما لا يُفهم
   يُردّ `null` فتعمل اللوحةُ على الكلّ — لا تسقط. */
const DAY = 86400000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

export function readRange(from, to) {
  const shape = /^\d{4}-\d{2}-\d{2}$/;
  if (!shape.test(from ?? '') || !shape.test(to ?? '')) return null;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 20 * 366 * DAY) return null;
  /* فترةٌ بأشهرٍ كاملة (شهرٌ أو ربعٌ أو سنة) تُقارَن بالأشهر السابقة المساوية
     عدداً — الربعُ الثاني بالأول، لا بتسعين يوماً تبدأ آخرَ ديسمبر. وما سواها
     (أسبوعٌ أو مدى) بالأيام السابقة المساوية عدداً. */
  const s = new Date(start);
  const e = new Date(end);
  const monthEnd = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 0)).getUTCDate() === e.getUTCDate();
  if (s.getUTCDate() === 1 && monthEnd) {
    const months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1;
    const prevStart = Date.UTC(s.getUTCFullYear(), s.getUTCMonth() - months, 1);
    return { from, to, prevFrom: isoDay(prevStart), prevTo: isoDay(start - DAY) };
  }
  const days = Math.round((end - start) / DAY) + 1;
  return { from, to, prevFrom: isoDay(start - days * DAY), prevTo: isoDay(start - DAY) };
}

/* شرطُ عمودٍ في نافذة: `date` نصُّ تاريخ، و`epoch` ثوانٍ. والحدودُ معاملاتٌ
   مربوطة (`?1`…`?4`) — لا نصٌّ واردٌ في الجملة. */
function within(column, kind, a, b) {
  return kind === 'date'
    ? `(${column} >= ?${a} AND ${column} <= ?${b})`
    : `(${column} >= CAST(strftime('%s', ?${a}) AS INTEGER) AND ${column} < CAST(strftime('%s', date(?${b}, '+1 day')) AS INTEGER))`;
}

/* ═══ الإحصاءات ═══
   تُحسب في القاعدة لا في الذاكرة: الجمعُ على آلاف الصفوف في `Worker` يحمل
   الجدول كلَّه إليه في كل فتحةِ لوحة.

   والمؤرشفُ خارجَها كلِّها: أُخرج من شاشته بقصد، فعدُّه في لوحته يناقضها.

   ═══ والفترة ═══
   بفترةٍ مختارة: العملاءُ بـ«عميلٌ منذ» فيها، والقضايا بفتحها فيها، ونسبةُ
   الكسب بما حُسم فيها، والمحصَّلُ بدفعاتها — ويُقارن كلٌّ بالفترة السابقة
   المساوية. وما هو «الآن» يبقى الآن: الجاري، والمستحقّات، وحِملُ المحامين.
   وبلا فترة: الكلّ، والمؤشّرُ آخرُ ثلاثين يوماً عمّا قبلها، والمحصَّلُ هذا العام.

   ═══ و`publicBoard` لشاشات العرض ═══
   تلك تُفتح بلا دخولٍ في مكانٍ يمرّ به كلُّ أحد، وما خلفها أعدادٌ ونسبٌ
   وحدها — لا مبلغ. فالمبلغُ لا يُحسب لها أصلاً، لا يُحسب ثم يُقصّ. */
export async function readStats(env, { publicBoard = false, from = null, to = null } = {}) {
  const range = readRange(from, to);
  const params = range ? [range.from, range.to, range.prevFrom, range.prevTo] : [];

  /* الجملةُ تُربط بقدر ما تستعمل من المعاملات: `?1 ?2` للفترة، و`?3 ?4` للسابقة. */
  const q = (sql) => {
    const statement = env.DB.prepare(sql);
    const used = Math.max(0, ...[...sql.matchAll(/\?(\d)/g)].map((match) => Number(match[1])));
    return used ? statement.bind(...params.slice(0, used)) : statement;
  };
  const period = (column, kind) => (range ? within(column, kind, 1, 2) : '1 = 1');
  const recent = (column, kind) => (range
    ? within(column, kind, 1, 2)
    : kind === 'date' ? `${column} >= ${WINDOW.recentDate}` : `${column} >= CAST(strftime('%s', ${WINDOW.recentDate}) AS INTEGER)`);
  const prior = (column, kind) => (range
    ? within(column, kind, 3, 4)
    : kind === 'date'
      ? `(${column} >= ${WINDOW.priorDate} AND ${column} < ${WINDOW.recentDate})`
      /* و`CAST`: تعبيرٌ كـ`COALESCE(…)` بلا ألفةٍ عددية، فيُقارَن عددُه بنصِّ
         `strftime` نصّاً — ويسقط الشرطُ دائماً. */
      : `(${column} >= CAST(strftime('%s', ${WINDOW.priorDate}) AS INTEGER) AND ${column} < CAST(strftime('%s', ${WINDOW.recentDate}) AS INTEGER))`);
  /* ولحظةُ الحسم: `closed_at` (`migrations/0017`)، وإلا تاريخُ الفتح لما استُورد مكتملاً. */
  const DECIDED_AT = 'COALESCE(closed_at, created_at)';
  const WIN = `outcome IN ('won', 'settled')`;

  const [
    clients, prospects, cases, newClients, newProspects, newCases, proBono, closed, outstanding, byLawyer, collected,
    ongoing, undecided, decidedRows,
  ] = await env.DB.batch([
    q(`SELECT client_type, COUNT(*) n FROM clients
        WHERE archived_at IS NULL AND ${period('join_date', 'date')} GROUP BY client_type`),
    q(`SELECT prospect_status, COUNT(*) n FROM prospects
        WHERE archived_at IS NULL AND ${period('join_date', 'date')} GROUP BY prospect_status`),
    q(`SELECT status, outcome, COUNT(*) n FROM cases
        WHERE archived_at IS NULL AND ${period('created_at', 'epoch')} GROUP BY status, outcome`),

    /* ═══ العملاء يُعدّون بـ«عميلٌ منذ» لا بلحظة إدراج الصفّ ═══
       موكّلٌ من ٢٠١٩ استُورد اليوم ليس عميلاً جديداً هذا الشهر. */
    q(`SELECT SUM(CASE WHEN ${recent('join_date', 'date')} THEN 1 ELSE 0 END) recent,
              SUM(CASE WHEN ${prior('join_date', 'date')} THEN 1 ELSE 0 END) prior
         FROM clients WHERE archived_at IS NULL`),
    q(`SELECT SUM(CASE WHEN ${recent('join_date', 'date')} THEN 1 ELSE 0 END) recent,
              SUM(CASE WHEN ${prior('join_date', 'date')} THEN 1 ELSE 0 END) prior
         FROM prospects WHERE archived_at IS NULL`),
    /* والقضيةُ بـ`created_at` — تاريخُ إنشاء مشروعها في بيسكامب، أي يومُ فتحها فعلاً. */
    q(`SELECT SUM(CASE WHEN ${recent('created_at', 'epoch')} THEN 1 ELSE 0 END) recent,
              SUM(CASE WHEN ${prior('created_at', 'epoch')} THEN 1 ELSE 0 END) prior
         FROM cases WHERE archived_at IS NULL`),

    /* والتطوّعيةُ: عددُها، وقيمتُها التقديرية — في الفترة، وإلا في السنة الجارية. */
    q(`SELECT COUNT(*) n,
              COALESCE(SUM(CASE WHEN ${range ? period('created_at', 'epoch') : `created_at >= strftime('%s', date('now', 'start of year'))`}
                                THEN pro_bono_value ELSE 0 END), 0) value
         FROM cases
        WHERE archived_at IS NULL AND ${FEE_TYPE} = 'pro_bono' AND ${period('created_at', 'epoch')}`),

    /* ═══ ما حُسم في كلّ نافذة، وما كُسب منه ═══ والتسويةُ كسبٌ للموكّل. */
    q(`SELECT SUM(CASE WHEN ${recent(DECIDED_AT, 'epoch')} THEN 1 ELSE 0 END) recent,
              SUM(CASE WHEN ${recent(DECIDED_AT, 'epoch')} AND ${WIN} THEN 1 ELSE 0 END) recent_won,
              SUM(CASE WHEN ${prior(DECIDED_AT, 'epoch')} THEN 1 ELSE 0 END) prior,
              SUM(CASE WHEN ${prior(DECIDED_AT, 'epoch')} AND ${WIN} THEN 1 ELSE 0 END) prior_won
         FROM cases WHERE archived_at IS NULL AND outcome IN ('won', 'lost', 'settled')`),

    /* ما لم يُحصَّل — الآن: الإجماليُّ ناقصَ المحصَّل لكل قضيةٍ حاضرة. */
    q(`SELECT COALESCE(SUM(MAX(
                COALESCE(json_extract(payment_status, '$.totalAmount'), 0)
              - COALESCE(json_extract(payment_status, '$.collectedAmount'), 0), 0)), 0) n
         FROM cases
        WHERE archived_at IS NULL AND json_valid(payment_status) = 1
          AND ${FEE_TYPE} <> 'pro_bono'`),

    /* ═══ حِملُ المحامين ═══ — الآن. و«بلا محامٍ» صفٌّ بذاته. */
    q(`SELECT c.lawyer_id id, COALESCE(l.name, m.display_name) name, COUNT(*) n
         FROM cases c LEFT JOIN lawyers l ON l.id = c.lawyer_id LEFT JOIN members m ON m.user_id = c.lawyer_id
        WHERE c.archived_at IS NULL AND c.status <> 'completed'
        GROUP BY c.lawyer_id ORDER BY n DESC`),

    /* ═══ المحصَّل ═══ في الفترة، وإلا هذا العام: دفعاتُ القضايا والإيرادُ العامّ. */
    q(`SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM client_payments
           WHERE ${range ? period('payment_date', 'date') : `payment_date >= date('now', 'start of year')`}) cases_total,
         (SELECT COALESCE(SUM(amount), 0) FROM wafeq_payments
           WHERE status = 'general'
             AND ${range ? period('payment_date', 'date') : `payment_date >= date('now', 'start of year')`}) general_total`),

    /* ═══ الجاري بنوعه ═══ — الآن. */
    q(`SELECT ${WORK_KIND_SQL} kind, COUNT(*) n FROM cases
        WHERE archived_at IS NULL AND status IN ('in-progress', 'pending')
        GROUP BY kind`),

    /* قضايا منظورة انتهت ولم تُسجَّل نتيجتُها — تُقال لتُسجَّل. والعملُ القانونيّ خارجها. */
    q(`SELECT COUNT(*) n FROM cases
        WHERE archived_at IS NULL AND status = 'completed'
          AND (outcome IS NULL OR outcome = '') AND ${WORK_KIND_SQL} = 'litigation'
          AND ${period(DECIDED_AT, 'epoch')}`),

    /* ═══ نسبةُ كسب القضايا ═══ ما حُسم في الفترة — أو كلُّه بلا فترة. */
    q(`SELECT outcome, COUNT(*) n FROM cases
        WHERE archived_at IS NULL AND outcome IN ('won', 'lost', 'settled') AND ${period(DECIDED_AT, 'epoch')}
        GROUP BY outcome`),
  ]);

  const clientsByType = {};
  let totalClients = 0;
  for (const row of clients.results ?? []) {
    clientsByType[row.client_type] = row.n;
    totalClients += row.n;
  }

  const prospectsByStatus = {};
  let totalProspects = 0;
  for (const row of prospects.results ?? []) {
    prospectsByStatus[row.prospect_status] = row.n;
    totalProspects += row.n;
  }

  const casesByStatus = {};
  let totalCases = 0;
  let completedCases = 0;
  for (const row of cases.results ?? []) {
    casesByStatus[row.status] = (casesByStatus[row.status] ?? 0) + row.n;
    totalCases += row.n;
    if (row.status === 'completed') completedCases += row.n;
  }

  /* ═══ نسبةُ كسب القضايا ═══
     الكسبُ — رابحةٌ أو تسوية/صلح — من المحسومة، وهي ما له نتيجة. وكانت
     «الرابحة من كلّ المكتملة»، فيُنقصها كلُّ عقدٍ واستشارةٍ اكتمل، وكلُّ قضيةٍ
     انتهت ولم تُسجَّل نتيجتُها. */
  const outcomes = { won: 0, lost: 0, settled: 0 };
  for (const row of decidedRows.results ?? []) if (row.outcome in outcomes) outcomes[row.outcome] += Number(row.n ?? 0);
  const decided = outcomes.won + outcomes.lost + outcomes.settled;
  const wins = outcomes.won + outcomes.settled;

  return json({
    ok: true,
    data: {
      range: range ? { from: range.from, to: range.to, prevFrom: range.prevFrom, prevTo: range.prevTo } : null,
      totalClients,
      totalProspects,
      totalCases,
      /* «الجارية» — الآن، و`pending` القديمة منها (`migrations/0028`). */
      pendingCases: (casesByStatus['in-progress'] ?? 0) + (casesByStatus.pending ?? 0),
      ongoingByKind: Object.fromEntries(
        (ongoing.results ?? []).map((row) => [row.kind === 'litigation' ? 'litigation' : 'legalWork', Number(row.n ?? 0)]),
      ),
      completedCases,
      winRate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
      outcomes: { ...outcomes, wins, decided, undecided: Number(undecided.results?.[0]?.n ?? 0) },
      clientsByType,
      prospectsByStatus,
      casesByStatus,
      proBonoCases: Number(proBono.results?.[0]?.n ?? 0),
      /* والمبالغُ وأسماءُ الأعضاء لا تبلغ شاشات العرض — تلك أعدادٌ ونسبٌ وحدها. */
      ...(publicBoard ? {} : {
        outstandingAmount: Number(outstanding.results?.[0]?.n ?? 0),
        proBonoValue: Number(proBono.results?.[0]?.value ?? 0) / 100,
        /* في الفترة إن اختيرت، وإلا هذا العام — والاسمُ باقٍ لئلّا تنكسر شاشة. */
        collectedThisYear: {
          cases: Number(collected.results?.[0]?.cases_total ?? 0) / 100,
          general: Number(collected.results?.[0]?.general_total ?? 0) / 100,
        },
        casesByLawyer: (byLawyer.results ?? []).map((row) => ({
          lawyerId: row.id ?? null,
          name: row.id ? row.name ?? '' : '',
          open: Number(row.n ?? 0),
        })),
      }),
      conversionRate:
        totalClients + totalProspects > 0
          ? Math.round((totalClients / (totalClients + totalProspects)) * 100)
          : 0,

      growth: {
        clients: growth(newClients.results?.[0]?.recent, newClients.results?.[0]?.prior),
        prospects: growth(newProspects.results?.[0]?.recent, newProspects.results?.[0]?.prior),
        cases: growth(newCases.results?.[0]?.recent, newCases.results?.[0]?.prior),
        winRate: rateShift(closed.results?.[0]),
      },
    },
  });
}

/**
 * إحصاءاتُ مسوّقٍ بعينه.
 *
 * الحسابُ هنا لا في البطاقة: كانت تجلب قضايا المسوّق ودفعاتِه إلى المتصفّح
 * لتعدّها، فكلُّ بطاقةٍ في الشبكة نداءان إلى القاعدة — عشرُ بطاقاتٍ عشرون.
 *
 * والمقدارُ المحصَّل والعمولةُ المستحقّة يُقرآن من `payment_status` و
 * `commission_structure`، وهما بنيتان تكتبهما شاشةُ القضية بالريالات كما
 * يُدخلها المستخدم. فلا تُقسَم على مئة هنا — القسمةُ لعمودَي المبالغ وحدهما.
 */
export async function readMarketerStats(env, user, marketerId) {
  if (!may(user, RESOURCES.marketers, 'read')) return fail('forbidden', 403);

  /* والمؤرشفُ خارجَها كما هو خارج لوحة التحكّم: قضيةٌ أُخرجت من شاشتها
     بقصد لا تُحسب في أداء المسوّق ولا في عمولته المستحقّة. */
  const [cases, paid] = await env.DB.batch([
    env.DB.prepare(
      `SELECT status, outcome, fee_structure, payment_status, commission_structure
       FROM cases WHERE marketer_id = ? AND archived_at IS NULL`,
    ).bind(marketerId),
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) total FROM commission_payments WHERE marketer_id = ?`,
    ).bind(marketerId),
  ]);

  let totalCases = 0;
  let completedCases = 0;
  let wonCases = 0;
  let lostCases = 0;
  let totalRevenue = 0;
  let totalCommissionEarned = 0;

  for (const row of cases.results ?? []) {
    totalCases += 1;
    if (row.status === 'completed') completedCases += 1;
    if (row.outcome === 'won') wonCases += 1;
    if (row.outcome === 'lost') lostCases += 1;

    /* والتطوّعيةُ تُعدّ قضيةً ونتيجةً، ولا تُعدّ إيراداً ولا عمولة: لا
       أتعابَ فيها يُحسب منها شيء — وإن بقي في صفّها مبلغٌ من قبل أن
       تُعلَّم تطوّعاً. */
    if (safeJson(row.fee_structure)?.type === 'pro_bono') continue;

    const payment = safeJson(row.payment_status);
    const commission = safeJson(row.commission_structure);
    const collected = Number(payment?.collectedAmount ?? 0);
    totalRevenue += collected;

    if (commission) {
      totalCommissionEarned +=
        commission.type === 'percentage'
          ? (collected * Number(commission.value ?? 0)) / 100
          : Number(commission.value ?? 0);
    }
  }

  const totalCommissionPaid = Number(paid.results?.[0]?.total ?? 0) / 100;

  return json({
    ok: true,
    data: {
      totalCases,
      completedCases,
      wonCases,
      lostCases,
      totalRevenue,
      totalCommissionEarned,
      totalCommissionPaid,
      remainingCommission: totalCommissionEarned - totalCommissionPaid,
      conversionRate: completedCases > 0 ? Math.round((wonCases / completedCases) * 100) : 0,
      averageCaseValue: totalCases > 0 ? Math.round(totalRevenue / totalCases) : 0,
    },
  });
}

/** تصدير كل ما تملكه المنصة — للآدمن وحده. */
export async function exportAll(env, user) {
  if (!user.permissions?.settings?.read) return fail('forbidden', 403);

  /* ومعها ربطُ المشاريع ودفعاتُ وافق: النسخةُ قبل «إعادة الاستيراد» تحفظ ما تصفّره. */
  const tables = [
    'clients', 'prospects', 'cases', 'marketers', 'commission_payments', 'client_payments', 'activity_logs',
    'basecamp_projects', 'wafeq_payments',
  ];
  const data = {};

  for (const table of tables) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
    data[table] = results ?? [];
  }

  return json({ ok: true, data });
}

function safeJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
