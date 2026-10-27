/* ═══ وافق — القراءةُ والربطُ ونزولُ المربوط إلى السجلّ ═══
 *
 * ما يُحرَس هنا:
 *
 * ١) **لا ينزل إلى سجلّ الدفعات إلا ما رُبط.** رقمُ القضية حرفاً يربط
 *    آلياً؛ وما اقترحه الطرازُ أو دلّ عليه الموكّل ينتظر تأكيداً — فلا
 *    يتحرّك المحصَّلُ بترجيح.
 * ٢) **الطرازُ يختار من قائمةٍ مغلقة**، وجوابٌ خارجها يُطرح، ولا يُسأل
 *    عن النصّ نفسِه مرّتين.
 * ٣) **لا تكرار ولا نقض**: الدورةُ الثانية لا تكتب ثانيةً، وما حسمه إنسانٌ
 *    يبقى، وتبدُّلُ المبلغ عند وافق يُنقل إلى السجلّ.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

const { normalizePayment, amountOf } = await import('../worker/lib/wafeq/api.js');
const { runWafeqSync, scheduledWafeqSync } = await import('../worker/lib/wafeq/sync.js');
const handlers = await import('../worker/lib/wafeq/handlers.js');

globalThis.Response = globalThis.Response ?? class {
  static json(body, init) { return { body, status: init?.status ?? 200 }; }
};
/* `Response` حقيقيّةٌ في Node 22، و`body` فيها مجرى لا JSON. */
const bodyOf = async (response) =>
  (typeof response.json === 'function' ? await response.json() : response.body);

// ═══════════════════════════════════════════════════════════
group('التوحيد');

check('مبلغٌ نصّاً بفواصل', amountOf('1,250.50') === 1250.5);
check('ومبلغٌ بأرقامٍ هندية', amountOf('٣٠٠٠') === 3000);
check('وما لا يُفهم `null`', amountOf('—') === null);

const shaped = normalizePayment({
  id: 77, date: '2026-09-01T10:00:00Z', amount: '5000.00', reference: 'TRX',
  contact: { name: 'شركة الأفق', tax_registration_number: '300000000000003' },
  invoice_payments: [{ invoice: { id: 'inv-1', invoice_number: 'INV-9', line_items: [{ description: 'أتعاب' }] }, amount: 5000 }],
});
check('دفعةٌ تُفهم بحقولها المحتملة',
  shaped.externalId === '77' && shaped.date === '2026-09-01' && shaped.amount === 5000 &&
    shaped.contactName === 'شركة الأفق' && shaped.contactNumber === '300000000000003' &&
    shaped.invoices[0].number === 'INV-9' && shaped.invoices[0].text.includes('أتعاب'),
  shaped);
check('ودفعةُ مورّدٍ تُطرح', normalizePayment({ id: 1, amount: 10, bill_payments: [{ bill: 'b' }] }) === null);
check('ودفعةٌ بلا مبلغٍ تُطرح لا تُكتب صفراً', normalizePayment({ id: 2, amount: 'x' }) === null);

// ═══════════════════════════════════════════════════════════
group('المطابقة والكتابة');

const now = Math.floor(Date.now() / 1000);
let aiCalls = 0;
let aiAnswer = '{"case":"ق-2026-020","reason":"الوصف يذكر عقد الإيجار"}';

function setup() {
  const db = freshDatabase();
  const env = makeEnv(db, {
    WAFEQ_API_KEY: 'test-key',
    AI: { run: async () => { aiCalls++; return { response: aiAnswer }; } },
  });
  db.prepare(
    `INSERT INTO clients (id, full_name, id_number, commercial_register, created_at, updated_at) VALUES
       ('c-afaq', 'شركة الأفق التجارية', NULL, '7001234567', ?, ?),
       ('c-noor', 'مؤسسة النور', NULL, NULL, ?, ?),
       ('c-saad', 'سعد العتيبي', NULL, NULL, ?, ?)`,
  ).run(now, now, now, now, now, now);
  const kase = db.prepare(
    `INSERT INTO cases (id, case_number, case_type, client_id, client_name, summary, payment_status,
                        fee_structure, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const fees = (total) => JSON.stringify({ totalAmount: total, collectedAmount: 0 });
  kase.run('k-afaq-1', 'ق-2026-014', 'تجارية', 'c-afaq', 'الأفق', 'نزاع توريد', fees(10000), null, now, now);
  kase.run('k-afaq-2', 'ق-2026-015', 'عمالية', 'c-afaq', 'الأفق', 'مستحقات', fees(8000), null, now, now);
  kase.run('k-noor', 'ق-2026-016', 'إدارية', 'c-noor', 'النور', 'ترخيص', fees(3000), null, now, now);
  kase.run('k-saad-1', 'ق-2026-020', 'إيجارات', 'c-saad', 'سعد', 'عقد إيجار', fees(6000), null, now, now);
  kase.run('k-saad-2', 'ق-2026-021', 'أحوال', 'c-saad', 'سعد', 'حضانة', fees(4000), null, now, now);
  kase.run('k-free', 'ق-2026-030', 'أحوال', 'c-saad', 'سعد', 'تطوّع', fees(0), JSON.stringify({ type: 'pro_bono' }), now, now);
  return { db, env };
}

let payments = [];
let fetches = 0;
globalThis.fetch = async (url) => {
  fetches++;
  const path = new URL(url).pathname;
  if (path.startsWith('/v1/invoices/')) {
    return { ok: true, status: 200, json: async () => ({ id: 'inv-x', reference: 'مرجع ق-2026-016' }) };
  }
  return { ok: true, status: 200, json: async () => ({ count: payments.length, next: null, results: payments }) };
};

const P = {
  byNumber: { id: 'p1', date: '2026-09-01', amount: '2500', reference: 'دفعة ق-2026-014', contact: { name: 'شركة الأفق التجارية' } },
  byInvoice: { id: 'p2', date: '2026-09-02', amount: 1000, invoice_payments: [{ invoice: 'inv-x', amount: 1000 }], contact: { name: 'مجهول' } },
  oneCase: { id: 'p3', date: '2026-09-03', amount: 500, contact: { name: 'مؤسسة النور' } },
  ai: { id: 'p4', date: '2026-09-04', amount: 2000, description: 'أتعاب قضية الإيجار', contact: { name: 'سعد العتيبي' } },
  byRegister: { id: 'p5', date: '2026-09-05', amount: 300, contact: { name: 'اسمٌ آخر', commercial_registration_number: '٧٠٠١٢٣٤٥٦٧' } },
};

let { db, env } = setup();
const collected = (id) => JSON.parse(db.prepare(`SELECT payment_status FROM cases WHERE id = ?`).get(id).payment_status).collectedAmount;
const ledger = () => db.prepare(`SELECT * FROM client_payments ORDER BY external_id`).all();
const row = (id) => db.prepare(`SELECT * FROM wafeq_payments WHERE external_id = ?`).get(id);

payments = Object.values(P);
const dry = await runWafeqSync(env, { actorId: 'u1', dryRun: true });
check('المعاينةُ تقول ما سيقع', dry.summary.linked === 2 && dry.items.length === 5, dry.summary);
check('ولا تكتب حرفاً',
  db.prepare(`SELECT COUNT(*) n FROM wafeq_payments`).get().n === 0 && ledger().length === 0);

aiCalls = 0;
const first = await runWafeqSync(env, { actorId: 'u1' });
check('رقمُ القضية في المرجع → رُبطت', row('p1').status === 'linked' && row('p1').case_id === 'k-afaq-1', row('p1'));
check('ورقمُها في الفاتورة المقروءة → رُبطت', row('p2').status === 'linked' && row('p2').case_id === 'k-noor', row('p2'));
check('والمربوطُ نزل إلى السجلّ بمصدره', ledger().length === 2 && ledger().every((entry) => entry.source === 'wafeq'), ledger());
check('والمحصَّلُ تحرّك', collected('k-afaq-1') === 2500 && collected('k-noor') === 1000);

check('موكّلٌ له قضيةٌ واحدة → مقترَحة لا مربوطة',
  row('p3').status === 'suggested' && row('p3').suggested_case_id === 'k-noor' && row('p3').match_by === 'client', row('p3'));
check('والطرازُ يقترح من قضايا الموكّل', row('p4').status === 'suggested' && row('p4').suggested_case_id === 'k-saad-1' &&
  row('p4').match_by === 'ai' && row('p4').reason.includes('الإيجار'), row('p4'));
check('والموكّلُ يُعرف بسجلّه التجاري وإن اختلف الاسم',
  row('p5').client_id === 'c-afaq', row('p5'));
check('والمقترَحُ لا يُحرّك المحصَّل', collected('k-saad-1') === 0 && collected('k-noor') === 1000);

// ── الدورة الثانية ──
aiCalls = 0;
const second = await runWafeqSync(env, { actorId: 'u1' });
check('دورةٌ ثانية لا تكرّر', ledger().length === 2 && second.summary.unchanged === 2, second.summary);
check('ولا تسأل الطرازَ عن نصٍّ سُئل عنه', aiCalls === 0, aiCalls);
check('ولا تطمس اقتراحاً سبق', row('p4').status === 'suggested' && row('p4').suggested_case_id === 'k-saad-1');

// ── تبدُّلُ المبلغ عند وافق ──
payments = Object.values(P).map((entry) => (entry.id === 'p1' ? { ...entry, amount: 3000 } : entry));
await runWafeqSync(env, { actorId: 'u1' });
check('تبدُّلُ مبلغِ دفعةٍ مربوطة يُنقل إلى السجلّ', collected('k-afaq-1') === 3000, collected('k-afaq-1'));

// ═══════════════════════════════════════════════════════════
group('الطرازُ من قائمةٍ مغلقة');

({ db, env } = setup());
aiAnswer = '{"case":"ق-9999-999","reason":"مخترع"}';
payments = [P.ai];
await runWafeqSync(env, { actorId: 'u1' });
check('رقمٌ خارج القائمة يُطرح', row('p4').status === 'unmatched' && !row('p4').suggested_case_id, row('p4'));

({ db, env } = setup());
aiAnswer = '{"case":"ق-2026-030","reason":"تطوّع"}';
await runWafeqSync(env, { actorId: 'u1' });
check('والتطوّعيةُ ليست مرشّحة', row('p4').suggested_case_id !== 'k-free', row('p4'));
aiAnswer = '{"case":"ق-2026-020","reason":"الوصف يذكر عقد الإيجار"}';

// ═══════════════════════════════════════════════════════════
group('قرارُ الإنسان');

({ db, env } = setup());
payments = Object.values(P);
await runWafeqSync(env, { actorId: 'u1' });

const admin = { id: 'u1', role: 'admin', name: 'فهد' };
const staff = { id: 'u2', role: 'staff', name: 'موظّف', permissions: { cases: { read: true } } };
const request = (body) => ({ json: async () => body });

let res = await handlers.decideWafeqPayment(request({ action: 'link' }), env, staff, 'p4');
check('من لا يملك تعديلَ القضايا لا يقرّر', res.status === 403);

res = await handlers.decideWafeqPayment(request({ action: 'link' }), env, admin, 'p4');
check('«صحيح» يربط بالمقترحة', (await bodyOf(res)).ok && row('p4').status === 'linked' && row('p4').case_id === 'k-saad-1');
check('وينزل إلى السجلّ', collected('k-saad-1') === 2000);

res = await handlers.decideWafeqPayment(request({ action: 'link', caseId: 'k-saad-2' }), env, admin, 'p4');
check('ونقلُها إلى قضيةٍ أخرى يُعيد حسابَ الاثنتين',
  collected('k-saad-1') === 0 && collected('k-saad-2') === 2000 && row('p4').match_by === 'manual',
  { a: collected('k-saad-1'), b: collected('k-saad-2'), by: row('p4').match_by });

res = await handlers.decideWafeqPayment(request({ action: 'link', caseId: 'k-free' }), env, admin, 'p3');
check('ولا تُربط بتطوّعية', res.status === 409);

await handlers.decideWafeqPayment(request({ action: 'unlink' }), env, admin, 'p4');
check('وفكُّ الربط يرفعها من السجلّ', collected('k-saad-2') === 0 && row('p4').status === 'unmatched');

await handlers.decideWafeqPayment(request({ action: 'ignore' }), env, admin, 'p5');
await runWafeqSync(env, { actorId: 'u1' });
check('والمتجاهَلةُ تبقى متجاهَلةً بعد دورة', row('p5').status === 'ignored');

res = await handlers.listWafeqPayments(env, admin, new URL('https://x/api/wafeq/payments?status=linked'));
const listed = (await bodyOf(res)).data;
check('والقائمةُ بحالتها ورقمِ قضيتها',
  listed.length === 2 && listed.every((entry) => entry.status === 'linked' && entry.caseNumber), listed);

// ═══════════════════════════════════════════════════════════
group('الجدولة والحالة');

({ db, env } = setup());
fetches = 0;
await scheduledWafeqSync(env);
check('الجدولةُ لا تعمل قبل التفعيل', fetches === 0);

res = await handlers.setWafeqAutoSync(request({ enabled: true }), env, admin);
check('ولا تُفعَّل قبل مزامنةٍ يدوية', res.status === 409);

await handlers.syncWafeq(env, admin);
res = await handlers.setWafeqAutoSync(request({ enabled: true }), env, admin);
check('وبعدها تُفعَّل', (await bodyOf(res)).data?.syncEnabled === true);
fetches = 0;
await scheduledWafeqSync(env);
check('فتعمل', fetches > 0);

res = await handlers.readWafeqStatus(makeEnv(db), admin);
check('وبلا مفتاحٍ: «لم يُضبط»', (await bodyOf(res)).data.state === 'not_configured');

/* واختبارُ الاتصال يردّ أسماءَ الحقول لا قيمَها. */
res = await handlers.testWafeq(env, admin);
const probe = (await bodyOf(res)).data;
check('اختبارُ الاتصال يردّ أسماءَ الحقول',
  probe.reachable && probe.fields.includes('amount') && !JSON.stringify(probe).includes('شركة الأفق'), probe);

/* والمفتاحُ المرفوض يُسمّى. */
globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
res = await handlers.syncWafeq(env, admin);
const refused = await bodyOf(res);
check('ومفتاحٌ مرفوض يُردّ «unauthorized»', refused.error === 'unauthorized', refused);

// ═══════════════════════════════════════════════════════════
group('الطرازُ يُسأل حين لا يُعرف الدافع');

check('الجهةُ معرّفاً تُحمل بمعرّفها',
  normalizePayment({ id: 'x', amount: 10, contact: 'ct-9' }).contactId === 'ct-9');

({ db, env } = setup());
/* كأكثر قضايا المكتب: بلا أتعابٍ مكتوبة — فكان «ما بقي عليه شيء» فارغاً. */
db.prepare(`UPDATE cases SET payment_status = NULL`).run();
db.prepare(`UPDATE cases SET court_case_number = '4470001234', authority = 'المحكمة العامة' WHERE id = 'k-noor'`).run();

let asked = [];
aiAnswer = '{"case":"ق-2026-021","reason":"الدافع Saad Alotaibi هو الموكّل سعد"}';
env.AI = { run: async (model, input) => { asked.push(JSON.parse(input.messages[1].content)); return { response: aiAnswer }; } };
let contactReads = 0;
globalThis.fetch = async (url) => {
  const path = new URL(url).pathname;
  if (path.startsWith('/v1/contacts/')) {
    contactReads++;
    return { ok: true, status: 200, json: async () => ({ id: 'ct-1', name: 'Saad Alotaibi' }) };
  }
  return { ok: true, status: 200, json: async () => ({ count: payments.length, next: null, results: payments }) };
};
payments = [
  { id: 'q1', date: '2026-10-01', amount: 900, description: 'تحويل', contact: 'ct-1' },
  { id: 'q2', date: '2026-10-02', amount: 400, description: 'تحويل ثانٍ', contact: 'ct-1' },
  { id: 'q3', date: '2026-10-03', amount: 700, reference: 'سداد القضية 4470001234', contact: 'ct-1' },
];
let result = await runWafeqSync(env, { actorId: 'u1' });
check('الجهةُ تُقرأ بمعرّفها مرّةً في الدورة', contactReads === 1 && row('q1').contact_name === 'Saad Alotaibi',
  { contactReads, name: row('q1').contact_name });
check('ومعرّفُها يُحفظ', row('q1').contact_id === 'ct-1');
check('والطرازُ يُسأل بلا أتعابٍ مكتوبة', asked.length === 2 && result.summary.ai.used === 2, result.summary.ai);
check('ومع كلّ مرشّحٍ اسمُ موكّله',
  asked[0]?.القضايا?.some((item) => item.الموكّل === 'سعد'), asked[0]?.القضايا);
check('واقتراحُه ينتظر تأكيداً', row('q1').status === 'suggested' && row('q1').suggested_case_id === 'k-saad-2', row('q1'));
check('ورقمُ القضية لدى الجهة في المرجع يربط',
  row('q3').status === 'linked' && row('q3').case_id === 'k-noor', row('q3'));

// ── وبلا طرازٍ مشغَّل: يُقال لماذا ──
({ db, env } = setup());
db.prepare(`INSERT INTO system_settings (key, value, updated_at) VALUES ('ai_import', '{"enabled":false}', 1)`).run();
payments = [{ id: 'r1', date: '2026-10-01', amount: 900, description: 'تحويل', contact: { name: 'مجهولٌ تماماً' } }];
result = await runWafeqSync(env, { actorId: 'u1' });
check('والطرازُ المطفأ يُعدّ سبباً', result.summary.ai.skipped.disabled === 1 && result.summary.ai.used === 0, result.summary.ai);

// ── «اربط بالذكاء الاصطناعي الآن» على المخزَّن ──
({ db, env } = setup());
db.prepare(`UPDATE cases SET payment_status = NULL`).run();
db.prepare(
  `INSERT INTO wafeq_payments (external_id, payment_date, amount, status, contact_id, description, created_at, updated_at)
   VALUES ('s1', '2026-08-01', 50000, 'unmatched', 'ct-1', 'دفعةٌ قديمة', 1, 1)`,
).run();
asked = [];
contactReads = 0;
env.AI = { run: async (model, input) => { asked.push(JSON.parse(input.messages[1].content)); return { response: aiAnswer }; } };
res = await handlers.rematchWafeqPayments(env, { id: 'u1', role: 'admin' });
const rematched = (await bodyOf(res)).data;
check('يُسأل الطرازُ عن المخزَّن بلا قراءة الدفعات', asked.length === 1 && rematched.suggested === 1 && contactReads === 1, rematched);
check('ويُكتب اقتراحُه واسمُ الجهة',
  row('s1').status === 'suggested' && row('s1').suggested_case_id === 'k-saad-2' && row('s1').contact_name === 'Saad Alotaibi', row('s1'));
check('ولا ينزل إلى السجلّ قبل التأكيد', !db.prepare(`SELECT 1 FROM client_payments`).get());

res = await handlers.rematchWafeqPayments(env, { id: 'u2', role: 'lawyer', permissions: { cases: { update: true } } });
check('وهو للمسؤول وحده', res.status === 403);

res = await handlers.readWafeqStatus(env, { id: 'u1', role: 'admin' });
check('والحالةُ تقول حالَ الطراز', (await bodyOf(res)).data.ai?.available === true);

// ═══════════════════════════════════════════════════════════
group('الفاتورةُ والجهةُ والمشروع — كما يردّها وافق');

/* كما في «اختبار الاتصال» عند المكتب: الجهةُ معرّف، والفاتورةُ معرّف، ولا وصفَ في الدفعة. */
({ db, env } = setup());
db.prepare(`UPDATE cases SET payment_status = NULL`).run();
asked = [];
env.AI = { run: async (model, input) => { asked.push(JSON.parse(input.messages[1].content)); return { response: '{"case":"لا-أعرف"}' }; } };
let reads = { invoice: 0, contact: 0, project: 0 };
let invoiceDown = false;
globalThis.fetch = async (url) => {
  const path = new URL(url).pathname;
  const json = (body) => ({ ok: true, status: 200, json: async () => body });
  if (path.startsWith('/v1/invoices/inv-')) {
    reads.invoice++;
    if (invoiceDown) return { ok: false, status: 500, json: async () => ({}) };
    return json({ id: 'inv-7', invoice_number: 'INV-7', contact: 'ct-noor',
      line_items: [{ description: 'أتعاب الترافع في قضية الترخيص البلدي', item: { name: 'أتعاب' } }] });
  }
  if (path.startsWith('/v1/contacts/')) { reads.contact++; return json({ id: 'ct-noor', name: 'مؤسسة النور' }); }
  if (path.startsWith('/v1/projects/')) { reads.project++; return json({ id: 'pr-1', name: 'ترخيص النور' }); }
  return json({ count: payments.length, next: null, results: payments });
};
payments = [{ id: 't1', date: '2026-10-05', amount: 1500, reference: 'TRX-1', project: 'pr-1',
  invoice_payments: [{ amount: 1500, amount_to_pcy: 1500, invoice: 'inv-7' }] }];
result = await runWafeqSync(env, { actorId: 'u1' });
check('وصفُ البند يُقرأ من الفاتورة بمعرّفها',
  row('t1').invoice_text?.includes('الترافع في قضية الترخيص') && reads.invoice === 1, row('t1'));
check('والجهةُ من الفاتورة حين لا تحملها الدفعة', row('t1').contact_name === 'مؤسسة النور' && row('t1').contact_id === 'ct-noor', row('t1'));
check('فيُعرف الموكّلُ ويُقترح', row('t1').client_id === 'c-noor' && row('t1').status === 'suggested', row('t1'));
check('واسمُ المشروع يُقرأ ويُحفظ', row('t1').project_name === 'ترخيص النور' && reads.project === 1);
check('ومعرّفاتُ الفواتير تُحفظ', JSON.parse(row('t1').invoice_ids).includes('inv-7'));

// ── فاتورةٌ سقطت قراءتُها: تُعدّ، ويُعيدها الزرّ ──
({ db, env } = setup());
env.AI = { run: async () => ({ response: '{"case":"لا-أعرف"}' }) };
invoiceDown = true;
payments = [{ id: 't2', date: '2026-10-06', amount: 800, reference: 'TRX-2',
  invoice_payments: [{ amount: 800, invoice: 'inv-8' }] }];
result = await runWafeqSync(env, { actorId: 'u1' });
check('سقوطُ قراءة الفاتورة يُقال في الحصيلة', result.summary.invoiceErrors === 1 && !row('t2').invoice_text, result.summary);
invoiceDown = false;
res = await handlers.rematchWafeqPayments(env, { id: 'u1', role: 'admin' });
check('و«اربط بالذكاء الاصطناعي» يعيد قراءتها بلا جلب الدفعات',
  row('t2').invoice_text?.includes('الترافع') && row('t2').contact_name === 'مؤسسة النور', row('t2'));

// ── والاختبارُ يعرض حقولَ الفاتورة والجهة ──
globalThis.fetch = async (url) => {
  const path = new URL(url).pathname;
  const body = path.startsWith('/v1/invoices/') ? { results: [{ id: 'i', line_items: [{ description: 'x' }], notes: 'n' }] }
    : path.startsWith('/v1/contacts/') ? { results: [{ id: 'c', name: 'سرّي' }] }
      : { count: 1, next: null, results: [{ id: 'p', amount: 1, contact: 'c' }] };
  return { ok: true, status: 200, json: async () => body };
};
res = await handlers.testWafeq(env, { id: 'u1', role: 'admin' });
const shapes = (await bodyOf(res)).data;
check('الاختبارُ يعرض حقولَ الفاتورة والجهة — لا قيمَها',
  shapes.invoice?.nested?.line_items?.includes('description') && shapes.contact?.fields?.includes('name') &&
    !JSON.stringify(shapes).includes('سرّي'), shapes);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
