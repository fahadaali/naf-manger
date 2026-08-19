/* ═══ اختبارُ تكاملٍ على الـWorker الحقيقي ═══
 *
 * لا خادمَ صوريّ هنا: يُستورد `worker/index.js` نفسُه، فيُقاس ترتيبُ
 * مساراته ومعالجاتُه واستعلاماتُه على المخطَّط الحقيقي المُحمَّل من ملفّات
 * الهجرة. والمُبدَّل حدُّ المصادقة وحده — وهو حزمةٌ أخرى مملوكةٌ ومُختبَرة
 * عندها.
 *
 * وما يُثبَت هنا ثلاثة:
 *   ١) كلُّ ميزةٍ تدور دورتَها كاملة: تُنشأ وتُقرأ وتُعدَّل وتُحذف.
 *   ٢) الحراسة قائمة: الموظّف لا يبلغ ما ليس له، ومن لا جلسة له لا يبلغ شيئاً.
 *   ٣) ما ليس مربوطاً يقول ذلك صراحةً ولا يفبرك.
 *
 * التشغيل: npm test
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';
import { setUser } from './helpers/naf-auth-stub.mjs';

const worker = (await import('../worker/index.js')).default;

const db = freshDatabase();
const env = makeEnv(db);
const ctx = { waitUntil() {}, passThroughOnException() {} };

const ORIGIN = 'https://crm.example';

async function hit(method, path, body, envOverride) {
  const init = { method };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers = { 'content-type': 'application/json' };
  }
  const response = await worker.fetch(new Request(`${ORIGIN}${path}`, init), envOverride ?? env, ctx);
  const text = await response.text();
  let payload = null;
  try { payload = JSON.parse(text); } catch { payload = text; }
  return { status: response.status, body: payload, headers: response.headers };
}

/* الآدمن بلا `perms` — أي «افتراضُ الدور»، وهي الحالة الغالبة في الإنتاج.
   فيقيس الاختبار أنّ افتراضات الأدوار في `roles.js` تصل المعالجات فعلاً. */
const ADMIN = { id: 'u-admin', role: 'admin', name: 'فهد', perms: null };

/* والموظّف بصلاحياتٍ دقيقة مضبوطة — الفرع الآخر من `permissionsFor`. */
const STAFF_PERMS = {
  clients: { read: true, create: false, update: false, delete: false },
  cases: { read: true, create: false, update: false, delete: false },
  marketers: { read: false, create: false, update: false, delete: false },
  analytics: { read: false },
  /* كافتراض دور `staff` في `roles.js` — ولا يقرأ الإعدادات. */
  settings: { read: false, update: false },
  users: { read: false, update: false },
};

const STAFF = { id: 'u-staff', role: 'staff', name: 'موظّف', perms: STAFF_PERMS };

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

/* الأعضاء يُدرَجون كما يفعل أوّلُ دخولٍ من المركز — والمنصة لا تُنشئ عضواً. */
const now = Math.floor(Date.now() / 1000);
for (const user of [ADMIN, STAFF]) {
  db.prepare(
    `INSERT INTO members (user_id, email, display_name, role, is_active, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
  ).run(user.id, `${user.id}@example.com`, user.name, user.role, now);
}

// ═══════════════════════════════════════════════════════════
group('بلا جلسة');
setUser(null);
check('‎/api/clients‎ يردّ ٤٠١', (await hit('GET', '/api/clients')).status === 401);
check('‎/api/stats‎ يردّ ٤٠١', (await hit('GET', '/api/stats')).status === 401);
check('‎/api/basecamp/status‎ يردّ ٤٠١', (await hit('GET', '/api/basecamp/status')).status === 401);
check('‎/health‎ عامّ', (await hit('GET', '/health')).status === 200);

// ═══════════════════════════════════════════════════════════
group('العملاء — دورةٌ كاملة');
setUser(ADMIN);

let r = await hit('POST', '/api/clients', {
  fullName: 'شركة الأفق التجارية', idNumber: '7001234567', phone: '0501234567',
  email: 'afaq@example.com', clientType: 'company', status: 'current', notes: 'من بيسكامب',
});
check('يُنشأ العميل', r.status === 201 && r.body.ok, r.body);
const clientId = r.body?.data?.id;

r = await hit('GET', '/api/clients');
check('ويظهر في القائمة', r.body.data?.length === 1 && r.body.data[0].fullName === 'شركة الأفق التجارية', r.body);

r = await hit('POST', '/api/clients', { fullName: 'مكرّر', idNumber: '7001234567' });
check('رقمُ هويةٍ مكرّر يُردّ ٤٠٩', r.status === 409 && r.body.error === 'duplicate', r.body);

r = await hit('PATCH', `/api/clients/${clientId}`, { phone: '0559999999' });
check('يُعدَّل', r.body.ok && r.body.data.phone === '0559999999', r.body);

r = await hit('GET', `/api/clients/${clientId}`);
check('ويُقرأ صفّاً واحداً', r.body.data?.idNumber === '7001234567', r.body);

// ═══════════════════════════════════════════════════════════
group('الحقول الفارغة — وهي الحالة الغالبة في الشاشات');

/* نموذجُ العميل يرسل `notes: ''` دائماً، وقد يُترك الجوّال والبريد فارغَين.
   وكان `''` يصير `NULL` فيسقط بقيد `NOT NULL` — أي أنّ **كلَّ إضافةِ عميلٍ
   من الشاشة كانت تسقط** برسالة «حقلٌ ناقص» والنجومُ كلُّها ممتلئة. */
r = await hit('POST', '/api/clients', {
  fullName: 'عميلٌ بحقولٍ فارغة', idNumber: '9000000001',
  phone: '', email: '', notes: '', attachments: [], joinDate: '',
});
check('يُنشأ بحقولٍ نصّية فارغة', r.status === 201 && r.body.ok, r.body);
check('والنصُّ الفارغ يبقى نصّاً لا NULL', r.body.data?.notes === '' && r.body.data?.phone === '', r.body.data);
check('والتاريخُ الفارغ يأخذ افتراضَ العمود',
  typeof r.body.data?.joinDate === 'string' && r.body.data.joinDate.length > 0, r.body.data?.joinDate);
const emptyId = r.body?.data?.id;

r = await hit('PATCH', `/api/clients/${emptyId}`, { notes: 'شيء' });
check('ثم يُكتب فيه', r.body.ok && r.body.data.notes === 'شيء', r.body);
r = await hit('PATCH', `/api/clients/${emptyId}`, { notes: '' });
check('ويُفرَّغ ثانيةً بلا سقوط', r.body.ok && r.body.data.notes === '', r.body);

/* والتاريخُ القابل للإفراغ يصير `null` فعلاً — لا `''`: لا تاريخَ فارغ. */
r = await hit('POST', '/api/prospects', {
  fullName: 'محتملٌ بلا متابعة', idNumber: '9000000002', prospectStatus: 'مهتم',
  notes: '', followUpDate: '', expectedValue: '',
});
check('المحتمل يُنشأ بتاريخٍ ومبلغٍ فارغين', r.status === 201 && r.body.ok, r.body);
check('والتاريخ الفارغ غيابٌ لا نصّ', !r.body.data?.followUpDate, r.body.data?.followUpDate);

// ═══════════════════════════════════════════════════════════
group('الأرقام الهندية والهويةُ الغائبة');

/* من يكتب «٠٥٠…» بلوحةٍ عربية يقصد الرقمَ نفسَه الذي يكتبه غيرُه «050…».
   وحفظُهما كما وردا يجعل البحثَ عن أحدهما لا يجد الآخر. */
r = await hit('POST', '/api/clients', {
  fullName: 'من يكتب بالهندية', idNumber: '١٠٢٣٤٥٦٧٨٩', phone: '٠٥٠١٢٣٤٥٦٧',
  contacts: [{ number: '٠٥٥٧٦٥٤٣٢١', relation: 'أخ' }],
});
check('تُطبَّع أرقامُ الجوّال الهندية', r.body.data?.phone === '0501234567', r.body.data?.phone);
check('ورقمُ الهوية كذلك', r.body.data?.idNumber === '1023456789', r.body.data?.idNumber);
check('وما في الأرقام الإضافية',
  r.body.data?.contacts?.[0]?.number === '0557654321', r.body.data?.contacts);

/* والملاحظاتُ لا تُمسّ: من كتب فيها «٥٠٠٠ ريال» قصد ما كتب. */
r = await hit('POST', '/api/clients', {
  fullName: 'صاحبُ ملاحظة', idNumber: '9000000003', notes: 'المبلغ ٥٠٠٠ ريال',
});
check('ولا تُطبَّع الملاحظات', r.body.data?.notes === 'المبلغ ٥٠٠٠ ريال', r.body.data?.notes);

/* ورقمُ الهوية لم يعد لازماً: ملفٌّ قديم بلا رقم يُفتح كما هو، ولا يُفبرك
   له رقمٌ ليمرّ القيد. و`UNIQUE` يقبل غياباً متكرّراً. */
r = await hit('POST', '/api/clients', { fullName: 'موكّلٌ بلا هوية', phone: '0500000001' });
check('يُنشأ عميلٌ بلا رقم هوية', r.status === 201 && r.body.ok, r.body);
check('وهويتُه غيابٌ لا نصّ', !r.body.data?.idNumber, r.body.data?.idNumber);
r = await hit('POST', '/api/clients', { fullName: 'وآخرُ بلا هوية', phone: '0500000002' });
check('واثنان بلا هويةٍ لا يتصادمان', r.status === 201 && r.body.ok, r.body);

// ═══════════════════════════════════════════════════════════
group('العملاء المحتملون والتحويل');
r = await hit('POST', '/api/prospects', {
  fullName: 'سارة العتيبي', idNumber: '1098765432', phone: '0533333333',
  idType: 'هوية وطنية', contacts: [{ number: '0561112222', relation: 'وكيل' }],
  prospectStatus: 'مهتم', expectedValue: 50000, followUpDate: '2020-01-01',
});
check('يُنشأ المحتمل', r.status === 201 && r.body.ok, r.body);
const prospectId = r.body?.data?.id;

r = await hit('POST', `/api/prospects/${prospectId}/convert`);
check('يُحوَّل إلى عميل', r.body.ok, r.body);

/* ═══ والتحويل ينقل ما استُجدّ ═══
   محتملٌ سُجّل له نوعُ هويته ورقمُ وكيله ثم صار عميلاً — كان يصل ملفُّه
   بالرقم الأول وحده، لأنّ الإدراج بقي على أعمدته القديمة. */
const converted = (await hit('GET', '/api/clients')).body.data
  .find((entry) => entry.fullName === 'سارة العتيبي');
check('ونوعُ هويته ينتقل معه', converted?.idType === 'هوية وطنية', converted?.idType);
check('ورقمُ وكيله بصفته',
  converted?.contacts?.[0]?.number === '0561112222' && converted?.contacts?.[0]?.relation === 'وكيل',
  converted?.contacts);
/* بقي «محتملٌ بلا متابعة» من الفقرة السابقة — فالمحوَّل وحده هو الذي سقط. */
check('وسقط المحوَّل من المحتملين', (await hit('GET', '/api/prospects')).body.data.length === 1);
check('وصار عميلاً', Boolean(converted), converted);

/* عددُ العملاء يُقرأ ولا يُكتب رقماً في الاختبار: كلُّ صفٍّ جديد في فقرةٍ
   سابقة كان يُسقط ثلاثةَ تحقّقاتٍ لا علاقةَ لها به. والمقصودُ أن يتّفق
   المجموعُ مع الجدول لا أن يساوي عدداً محفوظاً. */
const clientCount = (await hit('GET', '/api/clients')).body.data.length;

// ═══════════════════════════════════════════════════════════
group('القضايا والمرفقات ورابط بيسكامب');
r = await hit('POST', '/api/cases', {
  caseNumber: 'ق-2026-014', caseType: 'قضية تجارية', clientId, clientName: 'شركة الأفق التجارية',
  summary: 'نزاعٌ تجاري', status: 'pending',
  basecampUrl: 'https://3.basecamp.com/1/projects/101',
});
check('تُنشأ القضية', r.status === 201 && r.body.ok, r.body);
const caseId = r.body?.data?.id;
check('ورابطُ بيسكامب محفوظ', r.body.data?.basecampUrl === 'https://3.basecamp.com/1/projects/101', r.body.data);

r = await hit('POST', '/api/cases', { caseNumber: 'ق-2026-014', caseType: 'x', clientId, clientName: 'y' });
check('رقمُ قضيةٍ مكرّر يُردّ ٤٠٩', r.status === 409, r.body);

r = await hit('POST', '/api/cases', {
  caseNumber: 'ق-2026-015', caseType: 'قضية عمالية', clientId, clientName: 'شركة الأفق التجارية',
  status: 'completed', outcome: 'won',
});
check('عميلٌ واحد بقضيتين', r.status === 201 && (await hit('GET', '/api/cases')).body.data.length === 2);

// ═══════════════════════════════════════════════════════════
group('المسوّقون والعمولات');
r = await hit('POST', '/api/marketers', {
  fullName: 'عبدالله القحطاني', idNumber: '1055555555', phone: '0544444444',
  relationshipType: 'freelancer', status: 'active',
});
check('يُنشأ المسوّق', r.status === 201 && r.body.ok, r.body);
const marketerId = r.body?.data?.id;

r = await hit('GET', `/api/marketers/${marketerId}/stats`);
check('إحصاءاتُ المسوّق تُقرأ', r.body.ok, r.body);

r = await hit('POST', '/api/commissions', {
  marketerId, caseId, amount: 5000, paymentDate: '2026-05-01', status: 'paid',
});
check('تُسجَّل عمولة', r.status === 201 && r.body.ok, r.body);

// ═══════════════════════════════════════════════════════════
group('الإحصاءات والإعدادات والأنشطة');
r = await hit('GET', '/api/stats');
check('الإحصاءات تُحسب',
  r.body.ok && r.body.data.totalClients === clientCount && r.body.data.totalCases === 2, r.body.data);

r = await hit('GET', '/api/settings');
check('الإعدادات تُقرأ بافتراضاتها', r.body.ok && Array.isArray(r.body.data.caseTypes), r.body.data);

r = await hit('PATCH', '/api/settings', { companyName: 'مكتب ناف' });
check('وتُكتب', r.body.ok, r.body);
check('وتثبت', (await hit('GET', '/api/settings')).body.data.companyName === 'مكتب ناف');

/* ═══ الأثرُ يكتبه الخادم عند كل فعل ═══
   كانت الشاشةُ تكتبه، ولم تكن تكتبه إلا في موضعٍ واحد من كل مواضعها —
   فلوحةُ «النشاط الأخير» تعرض أنواعاً لا يكتبها أحد. وموضعُه الآن
   `crud.js`، فيمرّ به كلُّ إنشاءٍ وتعديلٍ وحذفٍ ودفعة. */
r = await hit('GET', '/api/activities');
const logged = r.body.data ?? [];
check('الأفعالُ السابقة تركت أثرَها', r.body.ok && logged.length > 0, `${logged.length}`);
check('وفيها إنشاءُ عميل',
  logged.some((row) => row.type === 'client_created'),
  logged.map((row) => row.type).join(', '));
check('وفيها إنشاءُ قضية',
  logged.some((row) => row.type === 'case_created'),
  logged.map((row) => row.type).join(', '));
check('وفيها تعديلُ عميل',
  logged.some((row) => row.type === 'client_updated'),
  logged.map((row) => row.type).join(', '));
/* والوصفُ يسمّي الصفَّ لا معرّفَه: «أُضيف العميل «فلان»» لا «أُضيف c-1». */
check('والوصفُ يسمّي الصفّ',
  logged.some((row) => row.description.includes('«')),
  logged.map((row) => row.description).slice(0, 3).join(' | '));
check('والفاعلُ منسوبٌ لا «النظام»',
  logged.every((row) => row.userId === 'u-admin'),
  logged.map((row) => row.userId).join(', '));

/* والمسارُ يقبل كتابةً مباشرة كذلك — سجلُّ الأنشطة أثرٌ لا محتوى،
   و`permission: null` يفتحه لكل عضوٍ مفعَّل. */
const loggedBefore = logged.length;
r = await hit('POST', '/api/activities', {
  type: 'client_created', description: 'أُضيف عميل', userId: 'u-admin', userName: 'فهد',
});
check('النشاط يُكتب', r.status === 201 && r.body.ok, r.body);
r = await hit('GET', '/api/activities');
check('ويُقرأ', r.body.ok && r.body.data.length === loggedBefore + 1, `${r.body.data?.length}`);

r = await hit('GET', '/api/members');
check('الأعضاء يُسردون', r.body.ok && r.body.data.length === 2, r.body.data);

// ═══════════════════════════════════════════════════════════
group('التقارير المخصّصة');
r = await hit('POST', '/api/reports', {
  name: 'العملاء حسب النوع', dataSource: 'clients', fields: ['fullName'],
  filters: [], grouping: [{ fieldId: 'clientType', order: 'asc' }], aggregations: [],
  visualization: { type: 'bar' }, isPublic: true,
});
check('يُنشأ التقرير', r.status === 201 && r.body.ok, r.body);
const reportId = r.body?.data?.id;

r = await hit('GET', `/api/reports/${reportId}/run`);
check('ويُشغَّل فيردّ صفوفاً', r.body.ok && Array.isArray(r.body.data.rows), r.body);

r = await hit('POST', '/api/reports/preview', {
  dataSource: 'cases', fields: ['caseNumber', 'caseType'], filters: [], grouping: [], aggregations: [],
});
check('المعاينة تعمل بلا حفظ', r.body.ok && r.body.data.rows.length === 2, r.body);

r = await hit('POST', '/api/reports/preview', {
  dataSource: 'clients', fields: ['fullName'],
  filters: [{ fieldId: "fullName') OR 1=1 --", operator: 'contains', value: 'x' }],
  grouping: [], aggregations: [],
});
/* الشرط أمنيٌّ لا عدديّ: المهمّ ألّا يُنفَّذ الحقن ولا تسقط القاعدة. والحقلُ
   المجهول يُسقَط من المرشِّحات (قائمةٌ بيضاء)، فتعود كلُّ الصفوف — وهو ردٌّ
   آمن، لأنّ الحقول تأتي من قائمةٍ في الشاشة لا من كتابةٍ حرّة. */
check('حقنُ SQL في اسم حقلٍ لا يُنفَّذ', r.body.ok && Array.isArray(r.body.data?.rows), r.body);
check('ولا يُسرّب عموداً غير مطلوب', r.body.ok && r.body.data.columns.join() === 'fullName', r.body.data?.columns);

r = await hit('DELETE', `/api/reports/${reportId}`);
check('ويُحذف', r.body.ok, r.body);

// ═══════════════════════════════════════════════════════════
group('شاشات العرض — الرمز عامٌّ والبيانات مجمَّعة');
r = await hit('POST', '/api/display-tokens', { label: 'شاشة الاستقبال' });
check('يُنشأ رمزُ عرض', r.status === 201 && r.body.ok, r.body);
const token = r.body?.data?.token;

setUser(null);
r = await hit('GET', `/api/display/${token}/stats`);
check('يُقرأ بلا جلسة', r.body.ok && typeof r.body.data.totalClients === 'number', r.body);
const leak = JSON.stringify(r.body);
check('ولا يحمل اسمَ عميل', !leak.includes('شركة الأفق') && !leak.includes('ق-2026'), leak.slice(0, 200));
check('رمزٌ باطل يُردّ ٤٠٤', (await hit('GET', '/api/display/' + 'z'.repeat(43) + '/stats')).status === 404);

setUser(ADMIN);
r = await hit('DELETE', `/api/display-tokens/${token}`);
check('ويُبطَل بالحذف', r.body.ok, r.body);
setUser(null);
check('فلا يُقرأ بعده', (await hit('GET', `/api/display/${token}/stats`)).status === 404);
setUser(ADMIN);

// ═══════════════════════════════════════════════════════════
group('ما ليس مربوطاً يقول ذلك ولا يفبرك');
r = await hit('POST', '/api/meetings', { topic: 'جلسة', startAt: 1900000000, duration: 30 });
check('Zoom بلا أسرار → not_connected ٥٠٣', r.status === 503 && r.body.error === 'not_connected', r.body);

r = await hit('GET', '/api/insights');
check('الاستبصارات بلا ارتباط AI → not_connected ٥٠٣', r.status === 503 && r.body.error === 'not_connected', r.body);

r = await hit('GET', '/api/basecamp/status');
check('بيسكامب بلا أسرار → not_configured', r.body.ok && r.body.data.state === 'not_configured', r.body);

// ومع ارتباطٍ موجود يعمل الاستدلال
const withAi = makeEnv(db, {
  AI: { async run() { return { response: '{"insights":[{"title":"ملاحظة","body":"نصّ","tone":"info","action":""}]}' }; } },
});
r = await hit('GET', '/api/insights', undefined, withAi);
check('ومع الارتباط يستدلّ', r.body.ok && r.body.data.insights.length === 1, r.body);
check('ويُخبَّأ', (await hit('GET', '/api/insights', undefined, withAi)).body.data.cached === true);

// ═══════════════════════════════════════════════════════════
group('مسارات بيسكامب الجديدة');

r = await hit('GET', '/api/basecamp/map');
check('الخريطة تُقرأ بافتراضها',
  r.body.ok && r.body.data.map['اسم العميل'] === 'client.fullName', r.body.data?.map);
check('ومعها الحقول الممكنة', r.body.ok && 'case.caseNumber' in r.body.data.targets);

r = await hit('PUT', '/api/basecamp/map', { map: { 'الموكّل': 'client.fullName', 'س': 'case.مجهول' } });
check('تُحفظ الخريطة', r.body.ok, r.body);
check('ومدخلٌ يشير إلى حقلٍ مجهول يُسقَط',
  r.body.ok && !('س' in r.body.data.map) && r.body.data.map['الموكّل'] === 'client.fullName', r.body.data);

/* بلا أسرارٍ مضبوطة لا يقع شيء — والرمزُ يقول السبب لا «تعذّر». */
for (const [name, path, method] of [
  ['المعاينة', '/api/basecamp/preview', 'POST'],
  ['التنفيذ', '/api/basecamp/sync', 'POST'],
]) {
  r = await hit(method, path);
  check(`${name} بلا أسرار → not_configured`, r.status === 503 && r.body.error === 'not_configured', r.body);
}

r = await hit('PUT', '/api/basecamp/auto-sync', { enabled: true });
check('الآلية لا تُفتح بلا ربط', !r.body.ok, r.body);

r = await hit('GET', '/api/basecamp/conflicts');
check('الاختلافات تُقرأ فارغةً', r.body.ok && r.body.data.length === 0, r.body);

setUser(STAFF);
for (const [name, path, method, body] of [
  ['map', '/api/basecamp/map', 'GET', undefined],
  ['map-write', '/api/basecamp/map', 'PUT', { map: {} }],
  ['preview', '/api/basecamp/preview', 'POST', undefined],
  ['sync', '/api/basecamp/sync', 'POST', undefined],
  ['auto-sync', '/api/basecamp/auto-sync', 'PUT', { enabled: true }],
  ['conflicts', '/api/basecamp/conflicts', 'GET', undefined],
]) {
  r = await hit(method, path, body);
  check(`${name} يردّ ٤٠٣ لغير المسؤول`, r.status === 403, JSON.stringify(r));
}
setUser(ADMIN);

// ═══════════════════════════════════════════════════════════
group('التصدير');
r = await hit('GET', '/api/export');
check('التصدير يجمع كلَّ الجداول',
  r.body.ok && r.body.data.clients.length === clientCount && r.body.data.cases.length === 2,
  Object.keys(r.body.data ?? {}));

// ═══════════════════════════════════════════════════════════
group('الملفّ الشخصي');
r = await hit('GET', '/api/me');
check('‎/api/me‎ يردّ العضو', r.body.ok && r.body.user?.role === 'admin', r.body);
check('وصلاحياتُه محلولةٌ من افتراض الدور', r.body.user?.permissions?.clients?.create === true, r.body.user?.permissions);

r = await hit('PATCH', '/api/me', { notificationPrefs: { newClients: false } });
check('وتفضيلاتُه تُكتب', r.body.ok, r.body);

/* `updateMe` تُسقط `role` و`isActive` قبل البناء، فلا يبقى ما يُكتب —
   و`empty_update` هو الرفض نفسُه. والمهمّ أنّ الدور لم يُمسّ. */
r = await hit('PATCH', '/api/me', { role: 'admin', isActive: true });
check('ولا يرقّي نفسه من هنا', !r.body.ok && r.body.error === 'empty_update', r.body);
check('والدور في القاعدة لم يُمسّ',
  db.prepare(`SELECT role FROM members WHERE user_id='u-staff'`).get().role === 'staff');

// ═══════════════════════════════════════════════════════════
group('الحراسة — الموظّف');
setUser(STAFF);
check('يقرأ العملاء', (await hit('GET', '/api/clients')).body.ok);
check('ولا يُنشئ', (await hit('POST', '/api/clients', { fullName: 'x', idNumber: '9' })).status === 403);
check('ولا يعدّل', (await hit('PATCH', `/api/clients/${clientId}`, { phone: '05' })).status === 403);
check('ولا يحذف', (await hit('DELETE', `/api/clients/${clientId}`)).status === 403);
check('ولا يبلغ التحليلات', (await hit('GET', '/api/insights', undefined, withAi)).status === 403);
check('ولا يكتب الإعدادات', (await hit('PATCH', '/api/settings', { companyName: 'x' })).status === 403);
check('ولا رموزَ العرض', (await hit('GET', '/api/display-tokens')).status === 403);
check('ولا بيسكامب', (await hit('GET', '/api/basecamp/status')).status === 403);
check('ولا التصدير', (await hit('GET', '/api/export')).status === 403);
check('ولا الأعضاء', (await hit('GET', '/api/members')).status === 403);

// ═══════════════════════════════════════════════════════════
group('المسارات المجهولة');
setUser(ADMIN);
r = await hit('GET', '/api/لا-وجود-له');
check('مسارٌ مجهول تحت ‎/api‎ يردّ JSON ٤٠٤ لا صفحة', r.status === 404 && r.body.error === 'not_found', r.body);
check('ومسارُ واجهةٍ يردّ الصفحة', (await hit('GET', '/clients')).status === 200);

// ═══════════════════════════════════════════════════════════
group('نموُّ اللوحة — محسوبٌ لا مكتوب');
setUser(ADMIN);

/* كانت اللوحة تعرض «‎+١٢٪‎» و«‎+٨٪‎» و«‎+٥٪‎» مكتوبةً في التصيير: لا تُقرأ من
   شيء ولا تتغيّر أبداً. فيُقاس هنا أنّ الرقم يتبع البيانات فعلاً. */
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/* والقياسُ على الفرق لا على عددٍ مطلق: الجدولُ فيه صفوفُ الفقرات السابقة،
   وتثبيتُ رقمٍ نهائيٍّ هنا يجعل كلَّ إضافةٍ في فقرةٍ أخرى تُسقط هذه. */
const before = (await hit('GET', '/api/stats')).body.data.growth;
check('النموّ يُردّ محسوباً', before?.clients !== undefined, before);

/* واحدٌ في الشهر السابق، وثلاثةٌ في الحاضر. */
for (const [name, day] of [
  ['نموّ ١', daysAgo(45)],
  ['نموّ ٢', daysAgo(10)],
  ['نموّ ٣', daysAgo(5)],
  ['نموّ ٤', daysAgo(1)],
]) {
  await hit('POST', '/api/clients', { fullName: name, joinDate: day });
}

r = await hit('GET', '/api/stats');
const after = r.body.data.growth;
check('ثلاثةٌ تُضاف إلى الشهر الحاضر',
  after.clients.current === before.clients.current + 3, [before.clients, after.clients]);
check('وواحدٌ إلى السابق',
  after.clients.previous === before.clients.previous + 1, [before.clients, after.clients]);
check('والنسبةُ حاصلُ قسمتهما لا رقمٌ مكتوب',
  after.clients.percent ===
    Math.round(((after.clients.current - after.clients.previous) / after.clients.previous) * 100),
  after.clients);
check('والرقمُ تحرّك بتحرّك البيانات',
  after.clients.percent !== before.clients.percent, [before.clients.percent, after.clients.percent]);

/* ═══ شهرٌ سابق فارغ لا نسبةَ منه ═══
   والقسمةُ على صفرٍ تُعرض «‎∞٪‎» أو «‎١٠٠٪‎» وكلاهما كذب. */
check('وبلا شهرٍ سابق تغيب النسبة',
  r.body.data.growth.prospects.percent === null, r.body.data.growth.prospects);
check('ويبقى العددُ يُقال', typeof r.body.data.growth.prospects.current === 'number',
  r.body.data.growth.prospects);

/* ═══ والمؤرشفُ خارجَ اللوحة ═══
   أُخرج من شاشته بقصد، فعدُّه في لوحته يناقضها. */
const beforeArchive = (await hit('GET', '/api/stats')).body.data.totalClients;
const growthIds = (await hit('GET', '/api/clients')).body.data
  .filter((row) => row.fullName.startsWith('نموّ'))
  .map((row) => row.id);
await hit('POST', '/api/clients/bulk', { action: 'archive', ids: growthIds });
r = await hit('GET', '/api/stats');
check('المؤرشفُ يخرج من إجمالي اللوحة',
  r.body.data.totalClients === beforeArchive - growthIds.length,
  `${beforeArchive} → ${r.body.data.totalClients}`);
check('ومن حساب النموّ معه',
  r.body.data.growth.clients.current === before.clients.current,
  [before.clients, r.body.data.growth.clients]);
await hit('POST', '/api/clients/bulk', { action: 'delete', ids: growthIds });

// ═══════════════════════════════════════════════════════════
group('الأرشفةُ والفعلُ على جملةِ صفوف');
setUser(ADMIN);

const batch = [];
for (const name of ['دفعةٌ أولى', 'دفعةٌ ثانية', 'دفعةٌ ثالثة']) {
  const made = await hit('POST', '/api/clients', { fullName: name, phone: '0500000000' });
  batch.push(made.body?.data?.id);
}
check('تُهيَّأ ثلاثةُ صفوف', batch.every(Boolean), batch);

r = await hit('POST', '/api/clients/bulk', { action: 'archive', ids: batch });
check('تُؤرشف الثلاثة بنداءٍ واحد', r.body.ok && r.body.data.affected === 3, r.body);

let listed = (await hit('GET', '/api/clients')).body.data;
check('والأرشفةُ لا تحذف — الصفوف قائمة',
  batch.every((id) => listed.some((row) => row.id === id)), listed.length);
check('ولحظتُها محفوظة نصّاً',
  listed.filter((row) => batch.includes(row.id)).every((row) => typeof row.archivedAt === 'string'),
  listed.find((row) => batch.includes(row.id))?.archivedAt);

r = await hit('POST', '/api/clients/bulk', { action: 'restore', ids: [batch[0]] });
check('ويُرجَع واحدٌ منها', r.body.ok && r.body.data.affected === 1, r.body);
listed = (await hit('GET', '/api/clients')).body.data;
check('فيعود غيابُ اللحظة', !listed.find((row) => row.id === batch[0])?.archivedAt);

/* ═══ الصفُّ المؤرشف يبقى موصولاً ═══
   لو كانت الأرشفةُ حذفاً مؤجَّلاً لانقطعت قضيةٌ عن عميلها. وهي ليست كذلك. */
r = await hit('POST', '/api/cases', {
  caseNumber: 'ق-2026-777', caseType: 'قضية تجارية', clientId: batch[1],
  clientName: 'دفعةٌ ثانية', status: 'pending',
});
check('تُقبل قضيةٌ لعميلٍ مؤرشف', r.status === 201 && r.body.ok, r.body);
const archivedCaseId = r.body?.data?.id;

/* ═══ التصريح يُسأل عن فعل الدفعة لا عن `POST` ═══
   وهذا هو موضع الزلل: المسار `POST`، ففعلُه في الظاهر «إنشاء». ولو حُرس
   به لطُلب تصريحُ الإنشاء لمن يؤرشف — ولمُنع من يحذف ولا يُنشئ. */
setUser(STAFF);
r = await hit('POST', '/api/clients/bulk', { action: 'archive', ids: batch });
check('الموظّفُ القارئُ لا يؤرشف', r.status === 403 && r.body.error === 'forbidden', r.body);
r = await hit('POST', '/api/clients/bulk', { action: 'delete', ids: batch });
check('ولا يحذف دفعةً', r.status === 403, r.body);
listed = (await hit('GET', '/api/clients')).body.data;
check('ولم يقع شيء', batch.every((id) => listed.some((row) => row.id === id)), listed.length);

setUser(ADMIN);
r = await hit('POST', '/api/clients/bulk', { action: 'drop-database', ids: batch });
check('وفعلٌ مجهولٌ يُردّ', r.status === 400 && r.body.error === 'unknown_action', r.body);
r = await hit('POST', '/api/clients/bulk', { action: 'archive', ids: [] });
check('وقائمةٌ فارغة تُردّ', r.status === 400 && r.body.error === 'no_rows', r.body);
r = await hit('POST', '/api/marketers/bulk', { action: 'archive', ids: ['x'] });
check('ومَوردٌ بلا عمود أرشفة يُردّ', r.status === 400 && r.body.error === 'not_archivable', r.body);

r = await hit('POST', '/api/cases/bulk', { action: 'delete', ids: [archivedCaseId] });
check('ويُحذف دفعةً ما طُلب', r.body.ok && r.body.data.affected === 1, r.body);
r = await hit('POST', '/api/clients/bulk', { action: 'delete', ids: batch });
check('وتُحذف الثلاثة', r.body.ok && r.body.data.affected === 3, r.body);
r = await hit('POST', '/api/clients/bulk', { action: 'delete', ids: batch });
check('وإعادةُ الحذف تقول صفراً ولا تسقط', r.body.ok && r.body.data.affected === 0, r.body);

// ═══════════════════════════════════════════════════════════
group('الحذف — آخرَ ما يُختبر');
r = await hit('DELETE', `/api/cases/${caseId}`);
check('تُحذف القضية', r.body.ok, r.body);
r = await hit('DELETE', `/api/clients/${clientId}`);
check('ويُحذف العميل', r.body.ok, r.body);
check('وقضيتُه تسقط معه (ON DELETE CASCADE)', (await hit('GET', '/api/cases')).body.data.length === 0);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
