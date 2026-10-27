/* ═══ لوحةُ «العملاء الفعليون» — بجوار لوحة المحتملين في مشروعٍ واحد ═══
 *
 * ما يُحرَس هنا:
 *
 * ١) **كلُّ لوحةٍ تُختار بمعرّفها.** مشروعٌ فيه لوحتان لا يُربط فيه نوعٌ بلوحة
 *    الآخر، ولا تُربط لوحةٌ واحدةٌ لنوعين.
 * ٢) **العميلُ بطاقةٌ في عمود حالته**، والحالةُ تتبع العمود في الاتّجاهين.
 * ٣) **البطاقةُ الحرّة تصير عميلاً** — ولا يُكتب فيه ما ليس في نصّها.
 * ٤) **الـWebhook يوجَّه إلى لوحة البطاقة** لا إلى أوّل لوحة.
 * ٥) **التحويلُ** بطاقةٌ جديدةٌ للعميل، والقديمةُ في «تحوّل إلى عميل» برابطها،
 *    وتعليقاتُ المحتمل تنتقل.
 * ٦) **الهجرةُ ٣١** تنقل صفَّ اللوحة القديم ورقمَ بطاقة المحتمل في العميل.
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

/* ═══ بيسكامب مُحاكاة: مشروعٌ فيه لوحتان ═══ */
const API = 'https://3.basecampapi.com/9';
const fake = {
  tables: {
    600: { title: 'العملاء المحتملون', lists: [{ id: 61, title: 'Triage' }, { id: 62, title: 'جديد' }] },
    700: { title: 'العملاء الفعليون', lists: [{ id: 71, title: 'Triage' }] },
  },
  cards: new Map(),
  comments: new Map(),
  nextId: 1000,
  calls: [],
};
const tableOfList = (listId) => Object.entries(fake.tables).find(([, t]) => t.lists.some((l) => l.id === listId))?.[0];
const columnUrl = (listId) => `${API}/buckets/500/card_tables/columns/${listId}.json`;
const listUrl = (listId) => `${API}/buckets/500/card_tables/lists/${listId}/cards.json`;

function reply(status, body) {
  const text = body === undefined ? '' : JSON.stringify(body);
  return { ok: status < 400, status, headers: { get: () => null }, json: async () => JSON.parse(text), text: async () => text };
}

function makeCard(listId, fields) {
  const card = {
    id: fake.nextId++, status: 'active', bucket: { id: 500 },
    parent: { id: listId, url: columnUrl(listId) }, comments_count: 0,
    app_url: `https://3.basecamp.com/card/${fake.nextId}`, updated_at: `t${fake.nextId}`, ...fields,
  };
  fake.cards.set(card.id, card);
  return card;
}

globalThis.fetch = async (url, init = {}) => {
  const method = init.method ?? 'GET';
  const path = String(url).replace(API, '');
  const body = init.body ? JSON.parse(init.body) : null;
  fake.calls.push(`${method} ${path}`);
  let m;

  if (path === '/projects/500.json') {
    return reply(200, {
      id: 500, name: 'إدارة العملاء',
      dock: [
        { name: 'message_board', id: 1, title: 'Message Board', enabled: true },
        { name: 'kanban_board', id: 600, title: 'العملاء المحتملون', enabled: true },
        { name: 'kanban_board', id: 700, title: 'العملاء الفعليون', enabled: true },
      ],
    });
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/(\d+)\.json$/))) {
    const table = fake.tables[m[1]];
    return reply(200, { id: Number(m[1]), title: table.title, lists: table.lists.map((l) => ({ ...l, cards_url: listUrl(l.id) })) });
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/(\d+)\/columns\.json$/)) && method === 'POST') {
    const list = { id: fake.nextId++, title: body.title };
    fake.tables[m[1]].lists.push(list);
    return reply(201, list);
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/columns\/(\d+)\.json$/))) {
    const id = Number(m[1]);
    const tableId = tableOfList(id);
    const list = fake.tables[tableId].lists.find((l) => l.id === id);
    if (method === 'PUT') list.title = body.title;
    return reply(200, { ...list, parent: { id: Number(tableId), type: 'Kanban::Board' } });
  }
  if (path === '/buckets/500/webhooks.json' && method === 'POST') {
    fake.webhooks = (fake.webhooks ?? 0) + 1;
    return reply(201, { id: 77 });
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/lists\/(\d+)\/cards\.json$/))) {
    const listId = Number(m[1]);
    if (method === 'POST') return reply(201, makeCard(listId, { title: body.title, content: body.content, due_on: body.due_on }));
    return reply(200, [...fake.cards.values()].filter((c) => c.parent.id === listId));
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/cards\/(\d+)\.json$/))) {
    const card = fake.cards.get(Number(m[1]));
    if (!card) return reply(404);
    if (method === 'PUT') Object.assign(card, { title: body.title, content: body.content, updated_at: `t${fake.nextId++}` });
    return reply(200, card);
  }
  if ((m = path.match(/^\/buckets\/500\/card_tables\/cards\/(\d+)\/moves\.json$/))) {
    const card = fake.cards.get(Number(m[1]));
    card.parent = { id: body.column_id, url: columnUrl(body.column_id) };
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

const stubAI = {
  async run(model, { messages }) {
    const user = messages.find((x) => x.role === 'user')?.content ?? '';
    if (user.includes('0561112222')) return { response: '{"phone":"0561112222","email":"fake@x.sa","clientType":"شركة"}' };
    return { response: '{}' };
  },
};

const db = freshDatabase();
const env = makeEnv(db, { AI: stubAI, BASECAMP_CLIENT_ID: 'id', BASECAMP_CLIENT_SECRET: 's', BASECAMP_TOKEN_KEY: 'key' });
await saveConnection(env, {
  accountId: '9', accountName: 'ناف', tokens: { access_token: 'tok', refresh_token: 'ref', expires_in: 1209600 }, userId: 'u1',
});
const connection = { accountId: '9', token: 'tok' };
const admin = {
  id: 'u1', role: 'admin', name: 'فهد',
  permissions: { prospects: { read: true, update: true, create: true }, clients: { read: true, create: true, update: true } },
};
const now = Math.floor(Date.now() / 1000);
const url = new URL('https://crm.naflaw.sa/api/basecamp/boards');

// ═══════════════════════════════════════════════════════════
group('اختيارُ اللوحتين');

const tables = await board.listCardTables(env, connection, 'https://3.basecamp.com/9/projects/500');
check('يقرأ لوحتي المشروع وحدهما', tables.data.tables.length === 2, tables.data.tables);
check('ويقترح لكلِّ نوعٍ لوحتَه من اسمها',
  tables.data.suggested.prospects === '600' && tables.data.suggested.clients === '700', tables.data.suggested);

let res = await handlers.configureBoards(
  { json: async () => ({ projectId: '500', prospectsTableId: '700', clientsTableId: '700' }) }, env, admin, url);
check('ولا تُربط لوحةٌ واحدة لنوعين', res.status === 400 && res.body.error === 'same_card_table', res.body);

/* وبلا معرّفٍ في مشروعٍ فيه لوحتان: يُختار بالاسم لا بالترتيب. */
const guessed = await board.setupBoard(env, connection, { kind: 'clients', projectId: '500', origin: url.origin, userId: 'u1' });
check('بلا معرّفٍ تُختار لوحةُ العملاء باسمها لا الأولى', guessed.data?.cardTableName === 'العملاء الفعليون', guessed);

res = await handlers.configureBoards(
  { json: async () => ({ projectId: '500', prospectsTableId: '600', clientsTableId: '700' }) }, env, admin, url);
check('تُعدّ اللوحتان', res.status === 200, res.body);
check('وأعمدةُ العملاء بحالاتهم', ['عملاء حاليون', 'عملاء سابقون'].every((t) => fake.tables[700].lists.some((l) => l.title === t)),
  fake.tables[700].lists);
check('ولا يُنشأ عمودُ تحويلٍ في لوحة العملاء', !fake.tables[700].lists.some((l) => l.title === 'تحوّل إلى عميل'));
check('ولا تمسّ لوحةُ العملاء أعمدةَ المحتملين', !fake.tables[600].lists.some((l) => l.title === 'عملاء حاليون'));
check('والـWebhook واحدٌ للمشروع', fake.webhooks === 1, fake.webhooks);

const boards = await board.readBoards(env);
const clientsBoard = boards.find((b) => b.kind === 'clients');
const prospectsBoard = boards.find((b) => b.kind === 'prospects');
check('وسرُّهما واحد', clientsBoard.webhookSecret === prospectsBoard.webhookSecret && clientsBoard.webhookId === '77');
const currentCol = Number(clientsBoard.columnMap.current);
const formerCol = Number(clientsBoard.columnMap.former);

// ═══════════════════════════════════════════════════════════
group('من المنصة إلى بيسكامب');

db.prepare(
  `INSERT INTO clients (id, full_name, phone, email, client_type, status, notes, created_at, updated_at)
   VALUES ('c1', 'مؤسسة الريّان', '0509998888', 'info@rayyan.sa', 'company', 'current', 'عقد توريد', ?, ?)`,
).run(now, now);
await sync.pushClient(env, 'c1');
let row = db.prepare(`SELECT * FROM clients WHERE id = 'c1'`).get();
let card = fake.cards.get(Number(row.bc_card_id));
check('تُنشأ بطاقةٌ في «عملاء حاليون»', card?.parent.id === currentCol, card?.parent);
check('ووصفُها بحقول العميل', format.parseCard(card.content).values.phone === '0509998888'
  && format.parseCard(card.content).values.clientType === 'company');
check('ولا حقولَ المحتمل فيها', !card.content.includes('القيمة المتوقعة') && !card.content.includes('موعد المتابعة'));

db.prepare(`UPDATE clients SET status = 'former' WHERE id = 'c1'`).run();
await sync.pushClient(env, 'c1');
check('والسابقُ ينتقل إلى «عملاء سابقون»', fake.cards.get(card.id).parent.id === formerCol);

// ═══════════════════════════════════════════════════════════
group('من بيسكامب إلى المنصة');

card.parent = { id: currentCol, url: columnUrl(currentCol) };
card.content = format.renderCard({ ...format.canonical(db.prepare(`SELECT * FROM clients WHERE id='c1'`).get()), email: 'new@rayyan.sa' },
  [['phone', 'رقم الجوال'], ['email', 'البريد الإلكتروني'], ['clientType', 'نوع العميل']]).content;
await sync.applyCard(env, connection, clientsBoard, card.id);
row = db.prepare(`SELECT * FROM clients WHERE id = 'c1'`).get();
check('السحبُ في بيسكامب يغيّر الحالة', row.status === 'current', row.status);
check('وتعديلُ الوصف يصل', row.email === 'new@rayyan.sa', row.email);

/* والطرفان معاً ← اختلافٌ باسم العميل. */
db.prepare(`UPDATE clients SET phone = '0501111111' WHERE id = 'c1'`).run();
card.content = card.content.replace('0509998888', '0502222222');
await sync.applyCard(env, connection, clientsBoard, card.id);
const conflict = db.prepare(`SELECT * FROM basecamp_conflicts WHERE client_id = 'c1'`).get();
check('الاختلافُ يُسجَّل للعميل', conflict?.field === 'client.phone', conflict);
const listed = await listConflicts(env, admin);
check('ويظهر باسمه', listed.body.data.some((c) => c.projectName === 'عميل: مؤسسة الريّان'), listed.body.data);
await resolveConflict({ json: async () => ({ resolution: 'platform' }) }, env, admin, conflict.id);
check('و«أبقِ ما في المنصة» يكتبه في البطاقة', format.parseCard(fake.cards.get(card.id).content).values.phone === '0501111111');

// ═══════════════════════════════════════════════════════════
group('بطاقةٌ حرّة في «العملاء الفعليون» — وتوجيهُ الـWebhook');

const free = makeCard(71, { title: 'نورة القحطاني', content: '<div>عميلة جديدة، جوالها ٠٥٦١١١٢٢٢٢ وتريد عقد شراكة</div>' });
const secret = clientsBoard.webhookSecret;
const hook = (payload) => ({ method: 'POST', json: async () => payload });
res = await handlers.receiveWebhook(hook({ kind: 'kanban_card_created', recording: { id: free.id, type: 'Kanban::Card', bucket: { id: 500 } } }), env, null, secret);
const nora = db.prepare(`SELECT * FROM clients WHERE bc_card_id = ?`).get(String(free.id));
check('صندوقُ الوارد في لوحة العملاء يُنشئ عميلاً — لا محتملاً', Boolean(nora)
  && !db.prepare(`SELECT 1 FROM prospects WHERE bc_card_id = ?`).get(String(free.id)), res.body);
check('والجوّالُ مستخرَج', nora?.phone === '0561112222', nora?.phone);
check('والبريدُ المؤلَّف يُطرح', nora?.email === '', nora?.email);
check('وحالتُه الأولى', nora?.status === 'current');
check('وتنتقل بطاقتُه إلى عمود حالته', fake.cards.get(free.id).parent.id === currentCol);

const lead = makeCard(62, { title: 'سلمان', content: '<div><strong>رقم الجوال:</strong> 0543210000</div><div><strong>نوع العميل:</strong> فرد</div>' });
await handlers.receiveWebhook(hook({ kind: 'kanban_card_created', recording: { id: lead.id, type: 'Kanban::Card', bucket: { id: 500 } } }), env, null, secret);
check('وبطاقةٌ في لوحة المحتملين تبقى محتملاً',
  Boolean(db.prepare(`SELECT 1 FROM prospects WHERE bc_card_id = ?`).get(String(lead.id)))
  && !db.prepare(`SELECT 1 FROM clients WHERE bc_card_id = ?`).get(String(lead.id)));

/* بطاقةٌ مربوطةٌ بمحتمل (لوحةٌ رُبطت خطأً ثم صُحّحت) لا تصير عميلاً أيضاً. */
const stray = makeCard(71, { title: 'ربطٌ قديم', content: '<div>—</div>' });
db.prepare(`INSERT INTO prospects (id, full_name, bc_card_id, created_at, updated_at) VALUES ('p-old', 'ربطٌ قديم', ?, ?, ?)`)
  .run(String(stray.id), now, now);
const strayResult = await sync.applyCard(env, connection, clientsBoard, stray.id);
check('وبطاقةٌ مربوطةٌ بالنوع الآخر لا تُستورد مرّتين', strayResult.skipped === 'linked_elsewhere'
  && !db.prepare(`SELECT 1 FROM clients WHERE bc_card_id = ?`).get(String(stray.id)));
fake.cards.delete(stray.id);
db.prepare(`DELETE FROM prospects WHERE id = 'p-old'`).run();

// ═══════════════════════════════════════════════════════════
group('التحويلُ إلى عميل');

const prospect = db.prepare(`SELECT * FROM prospects WHERE bc_card_id = ?`).get(String(lead.id));
const said = await handlers.addComment({ json: async () => ({ body: 'اتّفقنا على الأتعاب' }) }, env, admin, 'prospects', prospect.id, null);
/* وصل بطاقةَ المحتمل كما يصلها بعد الردّ. */
await sync.pushComment(env, 'prospects', said.body.data.id);
const converted = await handlers.convertWithCard(env, admin, prospect.id, null);
check('يُحوَّل', converted.status === 201);
const salman = db.prepare(`SELECT * FROM clients WHERE full_name = 'سلمان'`).get();
check('وتعليقُ المحتمل عند العميل', db.prepare(`SELECT body FROM client_comments WHERE client_id = ?`).get(salman.id)?.body === 'اتّفقنا على الأتعاب');

await sync.pushConversion(env, { prospectCardId: String(lead.id), clientId: salman.id, clientName: 'سلمان' });
const after = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(salman.id);
const clientCard = fake.cards.get(Number(after.bc_card_id));
check('بطاقةٌ جديدةٌ له في «عملاء حاليون»', clientCard && clientCard.id !== lead.id && clientCard.parent.id === currentCol);
check('والقديمةُ في «تحوّل إلى عميل»', String(fake.cards.get(lead.id).parent.id) === prospectsBoard.columnMap.__converted);
const note = (fake.comments.get(lead.id) ?? []).at(-1)?.content ?? '';
check('وعليها رابطُ الجديدة', note.includes(clientCard.app_url), note);
check('وتعليقُ المحتمل لا يُعاد نشرُه على بطاقة العميل', !(fake.comments.get(clientCard.id) ?? []).some((c) => c.content.includes('اتّفقنا')));

const counts = () => [db.prepare(`SELECT COUNT(*) n FROM prospects`).get().n, db.prepare(`SELECT COUNT(*) n FROM clients`).get().n];
const beforeSync = counts();
await sync.scheduledProspectSync(env);
check('والمطابقةُ الكاملة لا تُعيد المحتمل ولا تُكرّر العميل', JSON.stringify(counts()) === JSON.stringify(beforeSync), [beforeSync, counts()]);

// ═══════════════════════════════════════════════════════════
group('الحذف والمطابقة');

db.prepare(`INSERT INTO clients (id, full_name, status, created_at, updated_at) VALUES ('c9', 'عميل للحذف', 'current', ?, ?)`).run(now, now);
db.prepare(`INSERT INTO clients (id, full_name, status, archived_at, created_at, updated_at) VALUES ('c8', 'مؤرشف', 'current', ?, ?, ?)`).run(now, now, now);
const sweep = await sync.fullSync(env, connection, clientsBoard);
check('المطابقةُ تُنشئ لما لا بطاقةَ له', Boolean(db.prepare(`SELECT bc_card_id FROM clients WHERE id='c9'`).get().bc_card_id), sweep);
check('والمؤرشفُ لا بطاقةَ له', !db.prepare(`SELECT bc_card_id FROM clients WHERE id='c8'`).get().bc_card_id);

await handlers.beforeRecordDelete('clients', { method: 'DELETE' }, env, 'c9');
db.prepare(`DELETE FROM clients WHERE id = 'c9'`).run();
await sync.fullSync(env, connection, clientsBoard);
check('ومن حُذف لا تُعيده بطاقتُه', !db.prepare(`SELECT 1 FROM clients WHERE full_name = 'عميل للحذف'`).get());

// ═══════════════════════════════════════════════════════════
group('الهجرة ٣١');

{
  const { readFileSync, readdirSync } = await import('node:fs');
  const { DatabaseSync } = await import('node:sqlite');
  const dir = new URL('../migrations/', import.meta.url);
  const old = new DatabaseSync(':memory:');
  for (const file of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    if (file.startsWith('0031')) break;
    old.exec(readFileSync(new URL(file, dir), 'utf8'));
  }
  old.prepare(
    `INSERT INTO basecamp_prospect_board (id, project_id, project_name, card_table_id, column_map, webhook_id, webhook_secret, configured_by, configured_at)
     VALUES (1, '500', 'إدارة العملاء', '600', '{"جديد":"62"}', '77', 'sec', 'u1', 1)`,
  ).run();
  old.prepare(`INSERT INTO clients (id, full_name, bc_card_id, created_at, updated_at) VALUES ('x', 'x', '4242', 1, 1)`).run();
  old.exec(readFileSync(new URL('0031_clients_basecamp.sql', dir), 'utf8'));

  const moved = old.prepare(`SELECT * FROM basecamp_boards WHERE kind = 'prospects'`).get();
  check('صفُّ اللوحة القديم ينتقل', moved?.card_table_id === '600' && moved.webhook_secret === 'sec' && moved.column_map.includes('62'));
  check('ورقمُ بطاقة المحتمل في العميل يُفرَّغ', old.prepare(`SELECT bc_card_id FROM clients WHERE id='x'`).get().bc_card_id === null);
  check('ويُعلَّم فلا يُعاد', Boolean(old.prepare(`SELECT 1 FROM basecamp_prospect_tombstones WHERE card_id = '4242'`).get()));
}

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail ? 1 : 0);
