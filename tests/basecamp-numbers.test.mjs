/* ═══ استخراجُ الأرقام من ملفّات بيسكامب ═══
 *
 * ما يُحرَس هنا ما شكا منه صاحبُ المكتب حرفاً:
 *
 * ١) **أرقامٌ حاضرةٌ كانت تُتجاوز.** الرقم كان يُؤخذ من السطر المعنون
 *    وحده، وملفّاتُ المكتب تكتبه بأشكالٍ شتّى: ‎+966، وبمسافات، وبفواصل،
 *    ورقمين في سطر.
 *
 * ٢) **الأرقام الهندية.** «٠٥٠» و«050» رقمٌ واحد، وحفظُهما مختلفَين يجعل
 *    البحثَ عن أحدهما لا يجد الآخر.
 *
 * ٣) **صفةُ صاحب الرقم.** رقمٌ بلا صفةٍ في ملفّ موكّل يُتصل به ولا يُعرف
 *    من يردّ. و«ابنه» ليست «أباه» وإن بدأت بحرفيه.
 *
 * ٤) **لا رقمَ هويةٍ يُفبرك**، و«عميلٌ منذ» تاريخُ مشروعه عندهم.
 */
import { freshDatabase, makeEnv } from './helpers/env.mjs';
let pass=0, fail=0;
const ok=(n,c,x='')=>{ if(c){pass++;console.log('  ✔',n);} else {fail++;console.log('  ✘',n, typeof x==='string'?x:JSON.stringify(x));} };
const grp=t=>console.log(`\n── ${t} ──`);

const N = await import('../worker/lib/basecamp/numbers.js');

grp('تطبيع الأرقام');
ok('العربية-الهندية', N.toLatinDigits('٠٥٠١٢٣٤٥٦٧') === '0501234567');
ok('الفارسية', N.toLatinDigits('۰۵۰۱۲۳') === '050123');
ok('المختلط', N.toLatinDigits('رقم ١٢٣ و 456') === 'رقم 123 و 456');

grp('توحيد الجوّال — الأشكال التي تتجاوزها المطابقةُ الحرفية');
for (const [raw, want] of [
  ['0501234567', '0501234567'],
  ['٠٥٠١٢٣٤٥٦٧', '0501234567'],
  ['+966501234567', '0501234567'],
  ['00966501234567', '0501234567'],
  ['966501234567', '0501234567'],
  ['501234567', '0501234567'],
  ['050 123 4567', '0501234567'],
  ['050-123-4567', '0501234567'],
  ['(+966) 50 123 4567', '0501234567'],
  ['011 456 7890', '0114567890'],
]) ok(`«${raw}»`, N.normalizePhone(raw) === want, String(N.normalizePhone(raw)));

grp('وما ليس جوّالاً يُردّ');
for (const raw of ['1012345678', '2345678901', '123', '2026-08-10', '12345']) {
  ok(`«${raw}» ليس جوّالاً`, N.normalizePhone(raw) === null, String(N.normalizePhone(raw)));
}
ok('والهوية الهندية تُقرأ', N.normalizeIdNumber('١٠١٢٣٤٥٦٧٨') === '1012345678');
ok('الهوية بعد التطبيع', N.normalizeIdNumber(N.toLatinDigits('١٠١٢٣٤٥٦٧٨')) === '1012345678');
ok('والجوّال ليس هوية', N.normalizeIdNumber('0501234567') === null);

grp('الصفة من السياق');
const REL = ['أصيل','وكيل','أب','أم','أخ','ابن','زوج','أخرى'];
const phones = (t) => N.extractPhones(t, REL);
let r = phones('جوال العميل 0501111111 وجوال أخيه 0552222222');
ok('رقمان بصفتين', r.length === 2 && r[0].relation === 'أصيل' && r[1].relation === 'أخ', r);
r = phones('للتواصل: 0501234567 (وكيله)');
ok('القوس يصف ما قبله', r[0]?.relation === 'وكيل', r);
r = phones('جوال والده: 0559999999');
ok('«والده» تُقرأ أباً', r[0]?.relation === 'أب', r);
r = phones('جوال ابنه: 0533333333');
ok('«ابنه» ليست أباً', r[0]?.relation === 'ابن', r);
r = phones('الجوال: 0501111111');
ok('بلا صفة → null', r[0]?.relation === null, r);
r = phones('جوال: 0501111111\nجوال: ٠٥٠١١١١١١١');
ok('المكرّر بشكلين رقمٌ واحد', r.length === 1, r);

grp('الهوية ونوعُها');
const IDT = ['هوية وطنية','إقامة','سجل تجاري'];
const ids = (t) => N.extractIdentities(t, IDT);
ok('السجل من عنوانه', ids('السجل التجاري: 1010567890')[0]?.type === 'سجل تجاري', ids('السجل التجاري: 1010567890'));
ok('الإقامة من عنوانها', ids('رقم الإقامة: 2345678901')[0]?.type === 'إقامة');
ok('وبلا عنوان يُرجَّح من أوّله', ids('1012345678')[0]?.type === 'هوية وطنية');
ok('و«2» إقامة', ids('2012345678')[0]?.type === 'إقامة');
ok('ورقمُ سطرِ الجوّال ليس هوية', ids('رقم الجوال: 0501234567').length === 0, ids('رقم الجوال: 0501234567'));

grp('«عميل منذ» و«بلا رقم هوية»');
const { buildPlan, runSync } = await import('../worker/lib/basecamp/sync.js');
const now = Math.floor(Date.now()/1000);
const db = freshDatabase(); const env = makeEnv(db);
db.prepare(`INSERT INTO basecamp_projects (project_id,name,app_url,status,vault_id,doc_id,kind,created_on,created_at,updated_at)
  VALUES ('301','قضية','https://3.basecamp.com/1/projects/301','active','31','931','client','2021-04-15T09:00:00.000Z',?,?)`).run(now,now);
db.prepare(`INSERT INTO basecamp_connection (id,account_id,account_name,access_token,refresh_token,expires_at,connected_by,connected_at)
  VALUES (1,'9','ن','a','r',9999999999,'u1',?)`).run(now);
const DOC = '<div>اسم العميل: عبدالله السالم<br>الجوال: ٠٥٠١١١١١١١ وجوال وكيله 0552222222<br>نوع القضية: قضية مدنية</div>';
globalThis.fetch = async () => ({ ok:true, status:200, headers:new Map(),
  json: async () => ({ id:931, title:'ملخص القضية', content:DOC, app_url:'x', updated_at:'x' }) });
const conn = { accountId:'9', token:'t' };
const plan = await buildPlan(env, conn);
ok('يُنبَّه على غياب الهوية', plan.plans[0].warnings.some(w=>w.includes('بلا رقم هوية')), plan.plans[0].warnings);
await runSync(env, conn, { actorId:'u1', actorName:'ف', source:'اختبار' });
const c = db.prepare(`SELECT * FROM clients`).get();
ok('العميل أُنشئ بلا رقم هوية', c.id_number === null, String(c.id_number));
ok('«عميل منذ» من تاريخ المشروع', c.join_date === '2021-04-15', c.join_date);
ok('والجوّال طُبِّع', c.phone === '0501111111', c.phone);
ok('ووكيلُه محفوظ', JSON.parse(c.contacts).some(e=>e.relation==='وكيل'&&e.number==='0552222222'), c.contacts);
await runSync(env, conn, { actorId:'u1', actorName:'ف', source:'اختبار' });
ok('ومزامنةٌ ثانية لا تُنشئ ثانياً', db.prepare(`SELECT COUNT(*) n FROM clients`).get().n === 1);

console.log(`\n${pass} نجحت، ${fail} سقطت`);
process.exit(fail?1:0);
