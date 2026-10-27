/* ═══ لوحةُ العملاء المحتملين في بيسكامب — في الاتّجاهين ═══
 *
 * ما يُحرَس هنا:
 *
 * ١) **الصيغةُ تُقرأ كما كُتبت.** بطاقةٌ كتبتها المنصة تُقرأ بالقاعدة إلى
 *    القيم نفسِها — والملاحظةُ التي فيها نقطتان لا تُقرأ حقلاً.
 * ٢) **الدمجُ ثلاثيّ.** ما تبدّل في طرفٍ يُنقل، وما تبدّل في الطرفين
 *    يُسجَّل اختلافاً ولا يُكتب.
 * ٣) **البطاقةُ الحرّة تُستخرج منها الحقول** — ولا يُقبل ما لم يُكتب فيها.
 * ٤) **الـWebhook يُحرس بسرّه** ولا يقبل مشروعاً آخر.
 * ٥) **التعليقاتُ تُنسخ مرّةً** في الاتّجاهين.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';

let pass = 0;
let fail = 0;
const check = (name, condition, extra = '') => {
  if (condition) { pass++; console.log('  ✔', name); }
  else { fail++; console.log('  ✘', name, typeof extra === 'string' ? extra : JSON.stringify(extra)); }
};
const group = (title) => console.log(`\n── ${title} ──`);

globalThis.Response = class {
  constructor(body, init) { this._body = body; this.status = init?.status ?? 200; this.ok = this.status < 400; }
  static json(body, init) {
    const response = new globalThis.Response(JSON.stringify(body), init);
    response.body = body;
    return response;
  }
  clone() { return this; }
  async json() { return JSON.parse(this._body); }
};

const format = await import('../worker/lib/basecamp/prospects/card-format.js');
const sync = await import('../worker/lib/basecamp/prospects/sync.js');
const board = await import('../worker/lib/basecamp/prospects/board.js');
const handlers = await import('../worker/lib/basecamp/prospects/handlers.js');
const { saveConnection } = await import('../worker/lib/basecamp/oauth.js');
const { resolveConflict, listConflicts } = await import('../worker/lib/basecamp/handlers.js');

// ═══════════════════════════════════════════════════════════
group('الصيغة');

const values = {
  fullName: 'شركة الأفق للتجارة',
  prospectStatus: 'مهتم',
  phone: '0551234567',
  email: 'info@ufuq.sa',
  clientType: 'company',
  idType: '',
  idNumber: '',
  commercialRegister: '1010123456',
  source: 'إحالة من عميل',
  expectedValue: '1500000',
  followUpDate: '2026-11-03',
  notes: 'يفضّل التواصل مساءً\nالموعد: الأحد القادم',
};

const rendered = format.renderCard(values);
check('العنوانُ اسمُ العميل', rendered.title === 'شركة الأفق للتجارة');
check('وموعدُ المتابعة `due_on`', rendered.due_on === '2026-11-03');
check('ونوعُ العميل يُكتب لفظاً', rendered.content.includes('شركة</div>') || rendered.content.includes('</strong> شركة'));

const back = format.parseCard(rendered.content);
check('بطاقةُ المنصة بالصيغة', back.structured);
check('والجوّالُ يعود كما كُتب', back.values.phone === '0551234567', back.values);
check('ونوعُ العميل رمزاً', back.values.clientType === 'company', back.values);
check('والقيمةُ بالهللات', back.values.expectedValue === '1500000', back.values);
check('والتاريخ', back.values.followUpDate === '2026-11-03');
check('والملاحظةُ كاملة — وسطرُها ذو النقطتين لا يُقرأ حقلاً',
  back.values.notes === values.notes, back.values.notes);

const human = format.parseCard('<div>أحمد اتصل يسأل عن تأسيس شركة، جواله ٠٥٥٩٨٧٦٥٤٣</div>');
check('والنصُّ الحرّ ليس بالصيغة', !human.structured);
check('وأرقامُه الهندية تصير غربية', human.text.includes('0559876543'));

const handwritten = format.parseCard('<div>الجوال: 966551112233+</div><div>الايميل: Sara@Example.com</div><div>النوع: فرد</div>');
check('وعناوينُ يكتبها الناس تُعرف', handwritten.structured
  && handwritten.values.phone === '0551112233'
  && handwritten.values.email === 'sara@example.com'
  && handwritten.values.clientType === 'individual', handwritten.values);

check('«١٥٬٠٠٠ ريال» هللات', format.riyalsToHalalas('١٥٬٠٠٠ ريال') === 1500000);
check('والتاريخ اليومُ أوّلاً', format.readDate('3/11/2026') === '2026-11-03');

// ═══════════════════════════════════════════════════════════
group('الدمجُ الثلاثيّ');

check('لم يتبدّل شيء', sync.mergeField('a', 'a', 'a').value === 'a' && !sync.mergeField('a', 'a', 'a').to);
check('تبدّل في بيسكامب وحدها ← المنصة', sync.mergeField('a', 'b', 'a').to === 'platform');
check('تبدّل في المنصة وحدها ← بيسكامب', sync.mergeField('b', 'a', 'a').to === 'basecamp');
check('والبطاقةُ الصامتةُ عن حقلٍ لا تبدّله', sync.mergeField('b', undefined, 'a').to === 'basecamp');
check('وفي الطرفين ← اختلاف', sync.mergeField('b', 'c', 'a').conflict === true);

// ═══════════════════════════════════════════════════════════
/* ═══ بيسكامب مُحاكاة ═══ */

const fake = {
  /* أعمدةٌ سبقت الإعداد: «جديد» قائم، و«غير مناسب» اسمٌ قديمٌ لا جديدَ له
     فيُسمّى، و«مهتم» اسمٌ قديمٌ وجديدُه («تم التواصل») قائم فيبقى ويُقرأ به. */
  lists: [
    { id: 1, title: 'Triage', type: 'Kanban::Triage' },
    { id: 2, title: 'جديد', type: 'Kanban::Column' },
    { id: 3, title: 'غير مناسب', type: 'Kanban::Column' },
    { id: 4, title: 'مهتم', type: 'Kanban::Column' },
    { id: 5, title: 'تم التواصل', type: 'Kanban::Column' },
  ],
  cards: new Map(),
  comments: new Map(),
  nextId: 1000,
  calls: [],
  webhookOk: true,
};
const listUrl = (id) => `https://3.basecampapi.com/9/buckets/500/card_tables/lists/${id}/cards.json`;

function reply(status, body) {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    ok: status < 400,
    status,
    headers: { get: () => null },
    json: async () => JSON.parse(text),
    text: async () => text,
  };
}

globalThis.fetch = async (url, init = {}) => {
  const method = init.method ?? 'GET';
  const path = String(url).replace('https://3.basecampapi.com/9', '');
  const body = init.body ? JSON.parse(init.body) : null;
  fake.calls.push(`${method} ${path}`);
  let m;

  if (path === '/projects/500.json') {
    return reply(200, { id: 500, name: 'إدارة العملاء', dock: [{ name: 'kanban_board', id: 600, enabled: true }] });
  }
  if (path === '/buckets/500/card_tables/600.json') {
    return reply(200, { id: 600, lists: fake.lists.map((l) => ({ ...l, cards_url: listUrl(l.id) })) });
  }
  if (path === '/buckets/500/card_tables/600/columns.json' && method === 'POST') {
    const list = { id: fake.nextId++, title: body.title, type: 'Kanban::Column' };
    fake.lists.push(list);
    return reply(201, list);
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/columns\/(\d+)\.json$/)) && method === 'PUT') {
    const list = fake.lists.find((l) => l.id === Number(m[1]));
    list.title = body.title;
    return reply(200, list);
  }
  if (path === '/buckets/500/webhooks.json' && method === 'POST') {
    return fake.webhookOk ? reply(201, { id: 77, payload_url: body.payload_url }) : reply(422, {});
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/lists\/(\d+)\/cards\.json$/))) {
    const list = Number(m[1]);
    if (method === 'POST') {
      const card = {
        id: fake.nextId++, title: body.title, content: body.content, due_on: body.due_on,
        status: 'active', bucket: { id: 500 }, parent: { id: list }, comments_count: 0,
        app_url: 'https://3.basecamp.com/card', updated_at: `t${fake.nextId}`,
      };
      fake.cards.set(card.id, card);
      return reply(201, card);
    }
    return reply(200, [...fake.cards.values()].filter((c) => c.parent.id === list));
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/cards\/(\d+)\.json$/))) {
    const card = fake.cards.get(Number(m[1]));
    if (!card) return reply(404);
    if (method === 'PUT') {
      Object.assign(card, { title: body.title, content: body.content, due_on: body.due_on, updated_at: `t${fake.nextId++}` });
    }
    return reply(200, card);
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/cards\/(\d+)\/moves\.json$/))) {
    fake.cards.get(Number(m[1])).parent = { id: body.column_id };
    return reply(204);
  }
  if ((m = path.match(/^\/buckets\/500\/recordings\/(\d+)\/comments\.json$/))) {
    const cardId = Number(m[1]);
    const list = fake.comments.get(cardId) ?? [];
    if (method === 'POST') {
      const comment = { id: fake.nextId++, content: body.content, creator: { name: 'ناف' }, created_at: new Date().toISOString() };
      list.push(comment);
      fake.comments.set(cardId, list);
      fake.cards.get(cardId).comments_count = list.length;
      return reply(201, comment);
    }
    return reply(200, list);
  }
  return reply(404);
};

/* والطرازُ مُحاكى: يردّ ما في النصّ، ومعه اسمٌ مؤلَّف ليس فيه — فيُطرح. */
const stubAI = {
  async run(model, { messages }) {
    const user = messages.find((x) => x.role === 'user')?.content ?? '';
    if (user.includes('0559876543')) {
      return { response: '{"phone":"0559876543","email":"invented@x.sa","clientType":"شركة"}' };
    }
    if (user.includes('nora@')) return { response: '{"email":"nora@mail.sa"}' };
    return { response: '{}' };
  },
};

const db = freshDatabase();
const env = makeEnv(db, {
  AI: stubAI,
  BASECAMP_CLIENT_ID: 'id', BASECAMP_CLIENT_SECRET: 'secret', BASECAMP_TOKEN_KEY: 'key',
});
await saveConnection(env, {
  accountId: '9', accountName: 'ناف',
  tokens: { access_token: 'tok', refresh_token: 'ref', expires_in: 1209600 },
  userId: 'u1',
});
const connection = { accountId: '9', token: 'tok' };
const admin = { id: 'u1', role: 'admin', name: 'فهد', permissions: { prospects: { read: true, update: true, create: true }, clients: { create: true } } };
const now = Math.floor(Date.now() / 1000);

// ═══════════════════════════════════════════════════════════
group('الإعداد');

const setup = await board.setupBoard(env, connection, { projectId: '500', origin: 'https://crm.naflaw.sa', userId: 'u1' });
check('يُعدّ اللوحة', !setup.error, setup);
check('والعمودُ الموجود لا يُنشأ ثانيةً', !setup.data.columnsCreated.includes('جديد') && !setup.data.columnsCreated.includes('تم التواصل'), setup.data.columnsCreated);
check('والناقصُ يُنشأ ومعه عمودُ التحويل',
  setup.data.columnsCreated.includes('استشارة مجدولة') && setup.data.columnsCreated.includes('تحوّل إلى عميل'), setup.data.columnsCreated);
check('والاسمُ القديم يُعاد تسميتُه إلى جديده', setup.data.columnsRenamed.includes('اعتذرنا عنه')
  && fake.lists.find((l) => l.id === 3).title === 'اعتذرنا عنه', setup.data.columnsRenamed);
check('ولا يُنشأ للمُسمّى عمودٌ ثانٍ', !setup.data.columnsCreated.includes('اعتذرنا عنه'));
check('والـWebhook يُسجَّل', setup.data.webhook);

const before = fake.lists.length;
await board.setupBoard(env, connection, { projectId: '500', origin: 'https://crm.naflaw.sa', userId: 'u1' });
check('وإعادةُ الإعداد لا تُكرّر شيئاً', fake.lists.length === before);

let theBoard = await board.readBoard(env);
check('جديد ← العمود ٢', theBoard.columnMap['جديد'] === '2');
check('والعمودُ القديم «مهتم» يُقرأ «تم التواصل»', board.statusForColumn(theBoard, 4) === 'تم التواصل');

// ═══════════════════════════════════════════════════════════
group('من المنصة إلى بيسكامب');

db.prepare(
  `INSERT INTO prospects (id, full_name, phone, email, client_type, prospect_status, notes, created_at, updated_at)
   VALUES ('p1', 'سعد الحربي', '0501234567', 'saad@mail.sa', 'individual', 'تم التواصل', 'مهتم بعقد إيجار', ?, ?)`,
).run(now, now);

await sync.pushProspect(env, 'p1');
let row = db.prepare(`SELECT * FROM prospects WHERE id = 'p1'`).get();
check('تُنشأ بطاقة ويُحفظ رقمُها', Boolean(row.bc_card_id));
let card = fake.cards.get(Number(row.bc_card_id));
check('في عمود حالته', String(card.parent.id) === theBoard.columnMap['تم التواصل']);
check('ووصفُها يحمل الجوّال', format.parseCard(card.content).values.phone === '0501234567');

/* تعديلٌ في المنصة ← البطاقة. */
db.prepare(`UPDATE prospects SET email = 'saad@new.sa', prospect_status = 'جديد' WHERE id = 'p1'`).run();
await sync.pushProspect(env, 'p1');
card = fake.cards.get(Number(row.bc_card_id));
check('التعديلُ يصل الوصف', format.parseCard(card.content).values.email === 'saad@new.sa');
check('والحالةُ تنقل البطاقة', String(card.parent.id) === '2');

/* ولا كتابةَ حين لا يتبدّل شيء — الـWebhook الراجعُ بما كتبناه لا يكتب. */
fake.calls.length = 0;
await sync.applyCard(env, connection, theBoard, card.id);
check('دمجٌ بلا تغيير لا يكتب في بيسكامب', !fake.calls.some((c) => c.startsWith('PUT') || c.includes('moves')), fake.calls);

// ═══════════════════════════════════════════════════════════
group('من بيسكامب إلى المنصة');

/* يدٌ في بيسكامب تغيّر الجوّال وتنقل البطاقة. */
const edited = format.renderCard({ ...format.canonical(db.prepare(`SELECT * FROM prospects WHERE id='p1'`).get()), phone: '0507654321' });
card.content = edited.content;
card.parent = { id: Number(theBoard.columnMap['بانتظار توقيع']) };
await sync.applyCard(env, connection, theBoard, card.id);
row = db.prepare(`SELECT * FROM prospects WHERE id = 'p1'`).get();
check('الجوّالُ الجديد في المنصة', row.phone === '0507654321', row.phone);
check('والحالةُ من العمود', row.prospect_status === 'بانتظار توقيع', row.prospect_status);

/* والطرفان معاً ← اختلاف. */
db.prepare(`UPDATE prospects SET source = 'معرض' WHERE id = 'p1'`).run();
card.content = format.renderCard({ ...format.canonical(row), source: 'إعلان' }).content;
await sync.applyCard(env, connection, theBoard, card.id);
row = db.prepare(`SELECT * FROM prospects WHERE id = 'p1'`).get();
const conflict = db.prepare(`SELECT * FROM basecamp_conflicts WHERE prospect_id = 'p1'`).get();
check('الاختلافُ يُسجَّل', conflict?.field === 'prospect.source', conflict);
check('ولا يُكتب في المنصة', row.source === 'معرض');
check('ولا في البطاقة', format.parseCard(card.content).values.source === 'إعلان');

await sync.applyCard(env, connection, theBoard, card.id);
check('ولا يُفتح مرّتين', db.prepare(`SELECT COUNT(*) n FROM basecamp_conflicts WHERE prospect_id='p1'`).get().n === 1);

const listed = await listConflicts(env, admin);
check('ويظهر في شاشة الاختلافات باسمه', listed.body.data[0].projectName.includes('سعد الحربي'), listed.body.data);

await resolveConflict({ json: async () => ({ resolution: 'platform' }) }, env, admin, conflict.id);
check('«أبقِ ما في المنصة» يكتبها في البطاقة', format.parseCard(card.content).values.source === 'معرض',
  format.parseCard(card.content).values);

// ═══════════════════════════════════════════════════════════
group('بطاقةٌ حرّة أُنشئت في بيسكامب');

const freeform = {
  id: 5000, title: 'أحمد العتيبي', status: 'active', bucket: { id: 500 }, parent: { id: 1 },
  content: '<div>اتصل يسأل عن تأسيس شركة، جواله ٠٥٥٩٨٧٦٥٤٣ وسيرسل الأوراق</div>',
  comments_count: 1, app_url: 'https://3.basecamp.com/c/5000', updated_at: 'x',
};
fake.cards.set(5000, freeform);
fake.comments.set(5000, [{ id: 5001, content: '<div>طلب عرض سعر</div>', creator: { name: 'نورة' }, created_at: '2026-10-01T10:00:00Z' }]);

await sync.applyCard(env, connection, theBoard, 5000);
const created = db.prepare(`SELECT * FROM prospects WHERE bc_card_id = '5000'`).get();
check('يُنشأ عميلٌ محتمل', Boolean(created));
check('باسمه من العنوان', created?.full_name === 'أحمد العتيبي');
check('والجوّالُ مستخرَجٌ آلياً', created?.phone === '0559876543', created?.phone);
check('ونوعُ العميل', created?.client_type === 'company', created?.client_type);
check('والبريدُ المؤلَّف يُطرح — ليس في النصّ', created?.email === '', created?.email);
check('والنصُّ الحرّ محفوظٌ ملاحظةً', created?.notes.includes('تأسيس شركة'));
check('وحالتُه الأولى (صندوقُ الوارد لا حالةَ له)', created?.prospect_status === 'جديد', created?.prospect_status);
check('والتعليقُ منسوخ', db.prepare(`SELECT COUNT(*) n FROM prospect_comments WHERE prospect_id = ?`).get(created.id).n === 1);
check('والبطاقةُ أُعيدت كتابتُها بالصيغة', format.parseCard(freeform.content).structured
  && format.parseCard(freeform.content).values.phone === '0559876543');
check('وتنتقل إلى عمود حالتها', String(freeform.parent.id) === '2');

/* تعليقٌ جديدٌ فيه بريد ← يُملأ الفارغ. */
fake.comments.get(5000).push({ id: 5002, content: '<div>بريدها nora@mail.sa</div>', creator: { name: 'نورة' }, created_at: '2026-10-02T10:00:00Z' });
freeform.comments_count = 2;
await sync.applyCard(env, connection, theBoard, 5000);
const refilled = db.prepare(`SELECT * FROM prospects WHERE bc_card_id = '5000'`).get();
check('والتعليقُ الجديد يملأ البريد', refilled.email === 'nora@mail.sa', refilled.email);
check('ويصل البطاقة', format.parseCard(freeform.content).values.email === 'nora@mail.sa');
check('ولا يُنسخ تعليقٌ مرّتين',
  db.prepare(`SELECT COUNT(*) n FROM prospect_comments WHERE prospect_id = ?`).get(created.id).n === 2);

// ═══════════════════════════════════════════════════════════
group('التعليقات من المنصة');

const added = await handlers.addProspectComment(
  { json: async () => ({ body: 'اتّصلتُ به وطلب موعداً' }) }, env, admin, 'p1', null);
check('يُحفظ', added.status === 201);
await sync.pushComment(env, added.body.data.id);
const p1Card = Number(db.prepare(`SELECT bc_card_id FROM prospects WHERE id='p1'`).get().bc_card_id);
const sent = fake.comments.get(p1Card) ?? [];
check('ويصل البطاقة', sent.some((c) => c.content.includes('اتّصلتُ به')), sent);
check('ويُحفظ رقمُه', Boolean(db.prepare(`SELECT bc_comment_id FROM prospect_comments WHERE id = ?`).get(added.body.data.id).bc_comment_id));

await sync.applyCard(env, connection, theBoard, p1Card);
check('ولا يعود من بيسكامب نسخةً ثانية',
  db.prepare(`SELECT COUNT(*) n FROM prospect_comments WHERE prospect_id='p1'`).get().n === 1);

// ═══════════════════════════════════════════════════════════
group('الـWebhook');

const hookRequest = (payload) => ({ method: 'POST', json: async () => payload });
let res = await handlers.receiveWebhook(hookRequest({}), env, null, 'wrong');
check('سرٌّ خاطئ ← ٤٠٤', res.status === 404);

const secret = (await board.readBoard(env)).webhookSecret;
res = await handlers.receiveWebhook(hookRequest({ kind: 'kanban_card_created', recording: { id: 1, type: 'Kanban::Card', bucket: { id: 999 } } }), env, null, secret);
check('ومشروعٌ آخر يُتجاهل', res.body.data?.ignored === 'other_project');

fake.cards.set(6000, {
  id: 6000, title: 'منى السبيعي', status: 'active', bucket: { id: 500 }, parent: { id: 2 },
  content: '<div><strong>رقم الجوال:</strong> 0533334444</div><div><strong>نوع العميل:</strong> فرد</div>',
  comments_count: 0, app_url: 'u', updated_at: 'y',
});
res = await handlers.receiveWebhook(hookRequest({ kind: 'kanban_card_created', recording: { id: 6000, type: 'Kanban::Card', bucket: { id: 500 } } }), env, null, secret);
check('وبطاقةٌ جديدة ← عميلٌ محتمل', res.status === 200
  && db.prepare(`SELECT phone FROM prospects WHERE bc_card_id='6000'`).get()?.phone === '0533334444');

res = await handlers.receiveWebhook(hookRequest({ kind: 'comment_created', recording: { id: 1, type: 'Comment', parent: { id: 6000, type: 'Kanban::Card' }, bucket: { id: 500 } } }), env, null, secret);
check('والتعليقُ يقرأ بطاقتَه', res.status === 200);

// ═══════════════════════════════════════════════════════════
group('التحويل إلى عميل');

const converted = await handlers.convertWithCard(env, admin, 'p1', null);
check('يُحوَّل', converted.status === 201, converted.body);
const client = db.prepare(`SELECT * FROM clients WHERE full_name = 'سعد الحربي'`).get();
check('ويحفظ العميلُ رقمَ البطاقة', client?.bc_card_id === String(p1Card));
await sync.pushConversion(env, { cardId: String(p1Card), clientName: 'سعد الحربي' });
check('والبطاقةُ إلى عمود التحويل',
  String(fake.cards.get(p1Card).parent.id) === (await board.readBoard(env)).columnMap.__converted);

const recount = db.prepare(`SELECT COUNT(*) n FROM prospects`).get().n;
await sync.fullSync(env, connection, await board.readBoard(env));
check('والمطابقةُ الكاملة لا تُعيده عميلاً محتملاً', db.prepare(`SELECT COUNT(*) n FROM prospects`).get().n === recount);

// ═══════════════════════════════════════════════════════════
group('المطابقةُ الكاملة');

db.prepare(
  `INSERT INTO prospects (id, full_name, phone, email, client_type, prospect_status, notes, created_at, updated_at)
   VALUES ('p9', 'خالد', '', '', 'individual', 'جديد', '', ?, ?)`,
).run(now, now);
const result = await sync.fullSync(env, connection, await board.readBoard(env));
check('ما لا بطاقةَ له تُنشأ له', result.pushed === 1 && Boolean(db.prepare(`SELECT bc_card_id FROM prospects WHERE id='p9'`).get().bc_card_id), result);
check('بلا أخطاء', result.errors === 0, result);

fake.calls.length = 0;
await sync.fullSync(env, connection, await board.readBoard(env));
check('وما لم يتبدّل لا تُقرأ تعليقاتُه', !fake.calls.some((c) => c.includes('comments')), fake.calls);

// ═══════════════════════════════════════════════════════════
group('بطاقةٌ في عمودٍ قديم');

fake.cards.set(7000, {
  id: 7000, title: 'ريم القحطاني', status: 'active', bucket: { id: 500 }, parent: { id: 4 },
  content: '<div><strong>رقم الجوال:</strong> 0544445555</div><div><strong>نوع العميل:</strong> فرد</div>',
  comments_count: 0, app_url: 'u', updated_at: 'z',
});
await sync.applyCard(env, connection, await board.readBoard(env), 7000);
check('تُقرأ بالحالة الجديدة', db.prepare(`SELECT prospect_status FROM prospects WHERE bc_card_id='7000'`).get()?.prospect_status === 'تم التواصل');
check('وتُنقل من العمود القديم إلى عمودها', fake.cards.get(7000).parent.id === 5, fake.cards.get(7000).parent);

// ═══════════════════════════════════════════════════════════
group('نقلُ الأسماء القديمة (الهجرة ٣٠)');

{
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../migrations/0030_prospect_pipeline.sql', import.meta.url), 'utf8');
  const fresh = freshDatabase();
  const seedOld = (id, status) => fresh.prepare(
    `INSERT INTO prospects (id, full_name, prospect_status, bc_synced_values, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 1)`,
  ).run(id, id, status, JSON.stringify({ prospectStatus: status }));
  seedOld('a', 'مهتم'); seedOld('b', 'غير مناسب'); seedOld('c', 'تم الرفض'); seedOld('d', 'بانتظار توقيع');
  fresh.exec(sql);
  const status = (id) => fresh.prepare(`SELECT prospect_status s, bc_synced_values v FROM prospects WHERE id = ?`).get(id);
  check('مهتم ← تم التواصل', status('a').s === 'تم التواصل' && JSON.parse(status('a').v).prospectStatus === 'تم التواصل');
  check('غير مناسب ← اعتذرنا عنه', status('b').s === 'اعتذرنا عنه');
  check('تم الرفض ← رفض العميل', status('c').s === 'رفض العميل');
  check('وما لم يتبدّل اسمُه يبقى', status('d').s === 'بانتظار توقيع');

  const custom = freshDatabase();
  custom.prepare(`INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES ('settings', ?, 'u', 1)`)
    .run(JSON.stringify({ prospectStatuses: ['مهتم', 'متعاقد'] }));
  custom.prepare(`INSERT INTO prospects (id, full_name, prospect_status, created_at, updated_at) VALUES ('x', 'x', 'مهتم', 1, 1)`).run();
  custom.exec(sql);
  check('ومكتبٌ حرّر قائمته لا تُمسّ صفوفُه',
    custom.prepare(`SELECT prospect_status s FROM prospects WHERE id='x'`).get().s === 'مهتم');
}

// ═══════════════════════════════════════════════════════════
group('الحذف');

await handlers.beforeProspectDelete({ method: 'DELETE' }, env, 'p9');
db.prepare(`DELETE FROM prospects WHERE id = 'p9'`).run();
await sync.fullSync(env, connection, await board.readBoard(env));
check('من حُذف في المنصة لا تُعيده بطاقتُه', !db.prepare(`SELECT 1 FROM prospects WHERE full_name = 'خالد'`).get());

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
