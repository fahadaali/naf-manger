// المسارات التي لا يكفيها CRUD: الإعدادات والأعضاء والإحصاءات والتحويل.

import { RESOURCES, toClient } from './resources.js';
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
  caseStatuses: ['pending', 'in-progress', 'completed', 'postponed'],

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
  feeTypes: ['advance_only', 'deferred_only', 'advance_and_deferred'],
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

/* حدودُ النافذتين — يومياً لا لحظياً: «الشهر الماضي» في كلام المكتب يومٌ
   لا ثانية، والحدُّ اليوميّ يجعل الرقم ثابتاً طوال اليوم لا يتزحزح مع كل
   تحديثِ صفحة. */
const WINDOW = {
  recentDate: `date('now', '-30 days')`,
  priorDate: `date('now', '-60 days')`,
};

/* ═══ الإحصاءات ═══
   تُحسب في القاعدة لا في الذاكرة: الجمعُ على آلاف الصفوف في `Worker` يحمل
   الجدول كلَّه إليه في كل فتحةِ لوحة.

   والمؤرشفُ خارجَها كلِّها: أُخرج من شاشته بقصد، فعدُّه في لوحته يناقضها. */
export async function readStats(env) {
  const [clients, prospects, cases, newClients, newProspects, newCases] = await env.DB.batch([
    env.DB.prepare(
      `SELECT client_type, COUNT(*) n FROM clients WHERE archived_at IS NULL GROUP BY client_type`,
    ),
    env.DB.prepare(
      `SELECT prospect_status, COUNT(*) n FROM prospects WHERE archived_at IS NULL GROUP BY prospect_status`,
    ),
    env.DB.prepare(
      `SELECT status, outcome, COUNT(*) n FROM cases WHERE archived_at IS NULL GROUP BY status, outcome`,
    ),

    /* ═══ العملاء يُعدّون بـ«عميلٌ منذ» لا بلحظة إدراج الصفّ ═══
       موكّلٌ من ٢٠١٩ استُورد اليوم ليس عميلاً جديداً هذا الشهر. و`join_date`
       هو تاريخُ صيرورته عميلاً — وهو ما تعنيه اللوحة بالنموّ. */
    env.DB.prepare(
      `SELECT SUM(CASE WHEN join_date >= ${WINDOW.recentDate} THEN 1 ELSE 0 END) recent,
              SUM(CASE WHEN join_date >= ${WINDOW.priorDate}
                        AND join_date <  ${WINDOW.recentDate} THEN 1 ELSE 0 END) prior
         FROM clients WHERE archived_at IS NULL`,
    ),
    env.DB.prepare(
      `SELECT SUM(CASE WHEN join_date >= ${WINDOW.recentDate} THEN 1 ELSE 0 END) recent,
              SUM(CASE WHEN join_date >= ${WINDOW.priorDate}
                        AND join_date <  ${WINDOW.recentDate} THEN 1 ELSE 0 END) prior
         FROM prospects WHERE archived_at IS NULL`,
    ),

    /* والقضيةُ بـ`created_at` — وهو تاريخُ إنشاء مشروعها في بيسكامب منذ
       تصحيحه، أي يومُ فتحها فعلاً. والعمود ثوانٍ، فالحدُّ يُحوَّل. */
    env.DB.prepare(
      `SELECT SUM(CASE WHEN created_at >= strftime('%s', ${WINDOW.recentDate}) THEN 1 ELSE 0 END) recent,
              SUM(CASE WHEN created_at >= strftime('%s', ${WINDOW.priorDate})
                        AND created_at <  strftime('%s', ${WINDOW.recentDate}) THEN 1 ELSE 0 END) prior
         FROM cases WHERE archived_at IS NULL`,
    ),
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
  let wonCases = 0;
  for (const row of cases.results ?? []) {
    casesByStatus[row.status] = (casesByStatus[row.status] ?? 0) + row.n;
    totalCases += row.n;
    if (row.status === 'completed') completedCases += row.n;
    if (row.outcome === 'won') wonCases += row.n;
  }

  return json({
    ok: true,
    data: {
      totalClients,
      totalProspects,
      totalCases,
      pendingCases: casesByStatus.pending ?? 0,
      completedCases,
      winRate: completedCases > 0 ? Math.round((wonCases / completedCases) * 100) : 0,
      clientsByType,
      prospectsByStatus,
      casesByStatus,
      conversionRate:
        totalClients + totalProspects > 0
          ? Math.round((totalClients / (totalClients + totalProspects)) * 100)
          : 0,

      /* ولا نموَّ لـ«معدّل الربح»: لا عمودَ يقول متى أُغلقت القضية —
         `updated_at` يتحرّك مع أيّ تعديل، فبناءُ «ربحُ هذا الشهر» عليه
         يقيس التحريرَ لا الحُكم. فتُترك بطاقتُه بلا مؤشّر حتى يوجد ما
         يُقاس، ولا يُوضع رقمٌ يُقرأ قياساً وليس منه. */
      growth: {
        clients: growth(newClients.results?.[0]?.recent, newClients.results?.[0]?.prior),
        prospects: growth(newProspects.results?.[0]?.recent, newProspects.results?.[0]?.prior),
        cases: growth(newCases.results?.[0]?.recent, newCases.results?.[0]?.prior),
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
      `SELECT status, outcome, payment_status, commission_structure
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

  const tables = ['clients', 'prospects', 'cases', 'marketers', 'commission_payments', 'activity_logs'];
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
