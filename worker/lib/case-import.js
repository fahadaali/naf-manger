// استيرادُ القضايا من ملف — معاينةٌ ثم تنفيذ، والخطّةُ واحدة.
//
// ═══ ما كان يمنعه ═══
//
// القضيةُ تشير إلى عميلٍ بمعرّفه، والملفُّ يذكره باسمه وربما بهويته. فلزم
// قرار: يُطابَق **بالهوية ثم بالاسم الموحَّد** — المطابقةُ نفسُها التي تجري
// في مزامنة بيسكامب (`findClient`)، لا نسخةٌ ثانية تفترق عنها — وما لم يُطابَق
// **يُنشأ**. واسمٌ يشبه عميلاً قائماً بلا هويةٍ تفصل يُنشأ ويُقال ذلك، ولا يُدمج.
//
// ═══ والمعاينةُ هي التخطيطُ بلا تنفيذ ═══
//
// كمزامنة بيسكامب: «ما الذي سيقع؟» و«أَوقِعْه» سؤالان على المعطيات نفسها،
// فالخطّةُ تُبنى مرّةً وتُعرض كما هي ثم تُنفَّذ كما عُرضت.
//
// ═══ ولا يدخل لفظٌ حرٌّ عموداً مغلقاً ═══
//
// الحالةُ والنتيجةُ تمرّان بمفردات «بيانات المشروع» (`coerceTarget`): «منجزة»
// تصير `completed`، و«ربحانة» `won`. وما لم يُفهَم يُترك فارغاً ويُقال — لا
// يُكتب نصّاً يغيب عن كلّ إحصاء.

import { RESOURCES } from './resources.js';
import { createRow, may } from './crud.js';
import { coerceTarget } from './basecamp/parse.js';
import { findClient } from './basecamp/sync.js';
import { normalizeArabic } from './basecamp/discover.js';
import { nameRelation } from './basecamp/names.js';
import { recomputeCollected } from './payments.js';
import { toLatinDigits } from './digits.js';

const fail = (error, status) => Response.json({ ok: false, error }, { status });

/** أقصى الصفوف في الملفّ الواحد — الأكبرُ يُقسَم. */
const MAX_ROWS = 500;

/* نوعُ الأتعاب يُكتب رمزاً أو بوجهه العربي — كما يُصدَّر. */
const FEE_TYPES = {
  advance_only: 'مقدم فقط',
  deferred_only: 'مؤخر فقط',
  advance_and_deferred: 'مقدم ومؤخر',
  pro_bono: 'مجاني تطوعي',
};

function feeTypeOf(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (value in FEE_TYPES) return value;
  const normalized = normalizeArabic(value).replace(/[-—–]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [code, label] of Object.entries(FEE_TYPES)) {
    if (normalizeArabic(label) === normalized) return code;
  }
  if (/تطوع|مجان/.test(normalized)) return 'pro_bono';
  return undefined;
}

const amountOf = (raw) => {
  const text = toLatinDigits(String(raw ?? '')).replace(/[,\s٬]/g, '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
};

const dayOf = (raw) => {
  const match = toLatinDigits(String(raw ?? '').trim()).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

/* حقلٌ مغلقٌ يمرّ بالمفردات: رمزُه إن فُهم، أو `undefined` إن لم يُفهم. */
function closed(target, raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const codes = target === 'case.status'
    ? ['pending', 'in-progress', 'completed', 'postponed']
    : ['won', 'lost', 'settled'];
  if (codes.includes(value)) return value;
  const coerced = coerceTarget(target, value);
  const field = target.split('.')[1];
  return coerced?.values?.[field] ?? undefined;
}

/**
 * خطّةُ صفٍّ واحد — ماذا سيقع له ولماذا. ولا تكتب.
 *
 * `seen` يحمل ما ستنشئه صفوفٌ سابقة في الملفّ نفسِه: عميلٌ بقضيتين في ملفٍّ
 * واحد يُنشأ مرّةً ويُربط في الثانية، ورقمُ قضيةٍ يتكرّر في الملفّ يُردّ.
 */
async function planRow(env, raw, line, seen, members) {
  const plan = { line, status: 'create', reasons: [], warnings: [], client: null, case: null };
  const reject = (reason) => { plan.status = 'rejected'; plan.reasons.push(reason); return plan; };

  const caseNumber = toLatinDigits(String(raw.caseNumber ?? '')).trim();
  const clientName = String(raw.clientName ?? '').trim();
  if (!caseNumber) return reject('رقم المشروع مطلوب');
  if (!clientName) return reject('اسم العميل مطلوب');

  if (seen.cases.has(caseNumber)) return reject('رقم المشروع مكرّر في الملفّ');
  seen.cases.add(caseNumber);
  const taken = await env.DB.prepare(`SELECT id FROM cases WHERE case_number = ?`).bind(caseNumber).first();
  if (taken) return reject('رقم المشروع موجودٌ في المنصة');

  // ── العميل ──
  const idNumber = toLatinDigits(String(raw.clientIdNumber ?? '')).replace(/\s+/g, '') || null;
  const key = idNumber ? `#${idNumber}` : `@${normalizeArabic(clientName)}`;
  const pending = seen.clients.get(key) ?? seen.clients.get(`@${normalizeArabic(clientName)}`);

  if (pending) {
    plan.client = { action: 'pending', key: pending };
  } else {
    const found = await findClient(env, { idNumber, fullName: clientName });
    if (found?.row) {
      plan.client = { action: 'link', id: found.row.id, name: found.row.full_name };
      if (found.matchedBy === 'fullName') plan.warnings.push('طوبق العميل بالاسم لا بالهوية');
    } else {
      plan.client = { action: 'create', key, values: { fullName: clientName, idNumber, phone: String(raw.clientPhone ?? '').trim() } };
      seen.clients.set(key, key);
      seen.clients.set(`@${normalizeArabic(clientName)}`, key);
      if (found?.candidate) plan.warnings.push(`يشبه عميلاً قائماً: «${found.candidate.full_name}» — يُنشأ ولا يُدمج`);
    }
  }

  // ── القضية ──
  const values = {
    caseNumber,
    caseType: String(raw.caseType ?? '').trim() || 'غير محدّد',
    summary: String(raw.summary ?? '').trim(),
    notes: String(raw.notes ?? '').trim(),
  };
  /* الجهةُ ورقمُ القضية لديها: توثيقٌ يتكرّر بين القضايا، فلا يُفحص تفرّده. */
  const authority = String(raw.authority ?? '').trim();
  const courtCaseNumber = toLatinDigits(String(raw.courtCaseNumber ?? '')).trim();
  if (authority) values.authority = authority;
  if (courtCaseNumber) values.courtCaseNumber = courtCaseNumber;

  const status = closed('case.status', raw.status);
  if (status === undefined) plan.warnings.push(`حالةٌ لم تُفهم: «${raw.status}» — تُكتب «منظورة»`);
  values.status = status || 'pending';

  const outcome = closed('case.outcome', raw.outcome);
  if (outcome === undefined) plan.warnings.push(`نتيجةٌ لم تُفهم: «${raw.outcome}» — لم تُكتب`);
  if (outcome) values.outcome = outcome;

  const feeType = feeTypeOf(raw.feeType);
  if (feeType === undefined) plan.warnings.push(`نوعُ أتعابٍ لم يُفهم: «${raw.feeType}» — لم يُكتب`);
  const total = amountOf(raw.totalAmount);
  const collected = amountOf(raw.collectedAmount);
  if (total === undefined) plan.warnings.push('المبلغ الإجمالي ليس رقماً — لم يُكتب');
  if (collected === undefined) plan.warnings.push('المبلغ المحصَّل ليس رقماً — لم يُكتب');

  if (feeType) values.feeStructure = { type: feeType };
  if (feeType !== 'pro_bono' && (total || collected)) {
    values.paymentStatus = { totalAmount: total || 0, collectedAmount: 0, remainingAmount: total || 0, collectionStatus: 'unpaid' };
  }
  /* والمحصَّلُ في الملفّ يصير دفعةً افتتاحية — كما صار المحصَّلُ القديم في
     الهجرة `0018` — فالمحصَّلُ مجموعُ السجلّ أبداً. */
  plan.opening = feeType !== 'pro_bono' && collected > 0 ? collected : 0;

  const created = dayOf(raw.createdDate);
  if (raw.createdDate && !created) plan.warnings.push('تاريخ الإنشاء لا يُقرأ — يُكتب اليوم');
  plan.createdDate = created;

  // المحامي المسؤول — بعضوٍ مفعَّلٍ واحد، كما في بيسكامب.
  const lawyer = String(raw.lawyer ?? '').trim();
  if (lawyer) {
    const exact = members.filter((member) => normalizeArabic(member.name) === normalizeArabic(lawyer));
    const close = exact.length ? exact : members.filter((member) => nameRelation(member.name, lawyer) !== 'different');
    if (close.length === 1) values.lawyerId = close[0].id;
    else plan.warnings.push(`المحامي «${lawyer}» لم يُعرف بين الأعضاء — لم يُكتب`);
  }

  if (raw.opposingParties) {
    const parties = coerceTarget('case.opposingParties', raw.opposingParties)?.values?.opposingParties;
    if (parties?.length) values.opposingParties = parties;
  }

  plan.case = values;
  return plan;
}

/**
 * `POST /api/cases/import { rows, dryRun }`
 *
 * والتصريحُ إنشاءُ القضايا **وإنشاءُ العملاء** معاً: الاستيرادُ ينشئ الثاني
 * حين لا يجده، ومن لا يملك إنشاءَ عميلٍ لا يملكه من باب الاستيراد.
 */
export async function importCases(request, env, user) {
  if (!may(user, RESOURCES.cases, 'create') || !may(user, RESOURCES.clients, 'create')) {
    return fail('forbidden', 403);
  }

  let body;
  try { body = await request.json(); } catch { return fail('invalid_body', 400); }
  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) return fail('no_rows', 400);
  if (rows.length > MAX_ROWS) return fail('too_many_rows', 400);
  const dryRun = body?.dryRun !== false;

  const { results } = await env.DB.prepare(
    `SELECT user_id, display_name FROM members WHERE is_active = 1 AND display_name IS NOT NULL`,
  ).all();
  const members = (results ?? []).map((row) => ({ id: row.user_id, name: row.display_name }));

  const seen = { cases: new Set(), clients: new Map() };
  const plans = [];
  for (const [index, raw] of rows.entries()) {
    plans.push(await planRow(env, raw ?? {}, Number(raw?.line) || index + 2, seen, members));
  }

  const summary = {
    rows: plans.length,
    cases: plans.filter((plan) => plan.status === 'create').length,
    clientsCreated: plans.filter((plan) => plan.status === 'create' && plan.client?.action === 'create').length,
    clientsLinked: plans.filter((plan) => plan.status === 'create' && plan.client?.action !== 'create').length,
    rejected: plans.filter((plan) => plan.status === 'rejected').length,
    warnings: plans.reduce((count, plan) => count + plan.warnings.length, 0),
  };

  const shape = (plan) => ({
    line: plan.line,
    status: plan.status,
    reasons: plan.reasons,
    warnings: plan.warnings,
    caseNumber: plan.case?.caseNumber ?? null,
    client: plan.client ? { action: plan.client.action, name: plan.client.name ?? plan.client.values?.fullName ?? null } : null,
  });

  if (dryRun) return Response.json({ ok: true, data: { summary, rows: plans.map(shape) } });

  // ═══ التنفيذ — كما عُرضت الخطّة ═══
  const createdClients = new Map();
  let written = 0;
  const failures = [];

  for (const plan of plans) {
    if (plan.status !== 'create') continue;
    try {
      let clientId = plan.client.id;
      let clientName = plan.client.name;
      if (plan.client.action === 'create') {
        const made = await createRow(env, RESOURCES.clients, plan.client.values, user);
        if (made.error) throw new Error(made.error);
        clientId = made.data.id;
        clientName = made.data.fullName;
        createdClients.set(plan.client.key, made.data);
      } else if (plan.client.action === 'pending') {
        const made = createdClients.get(plan.client.key);
        if (!made) throw new Error('client_not_created');
        clientId = made.id;
        clientName = made.fullName;
      }

      const made = await createRow(env, RESOURCES.cases, { ...plan.case, clientId, clientName }, user);
      if (made.error) throw new Error(made.error);
      const caseId = made.data.id;

      if (plan.createdDate) {
        await env.DB.prepare(`UPDATE cases SET created_at = CAST(strftime('%s', ?) AS INTEGER) WHERE id = ?`)
          .bind(plan.createdDate, caseId)
          .run();
      }
      if (plan.opening > 0) {
        await env.DB.prepare(
          `INSERT INTO client_payments (id, case_id, client_id, amount, payment_date, notes, source, created_by, created_at)
           VALUES (?, ?, ?, ?, COALESCE(?, date('now')), 'رصيدٌ افتتاحيّ — من ملفّ الاستيراد', 'opening', ?, ?)`,
        )
          .bind(crypto.randomUUID(), caseId, clientId, Math.round(plan.opening * 100), plan.createdDate,
            user.id, Math.floor(Date.now() / 1000))
          .run();
      }
      await recomputeCollected(env, caseId);
      written++;
    } catch (error) {
      failures.push({ line: plan.line, reason: String(error?.message ?? error) });
    }
  }

  await env.DB.prepare(
    `INSERT INTO activity_logs (id, type, description, user_id, user_name, entity_type, details, created_at)
     VALUES (?, 'case_imported', ?, ?, ?, 'case', ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      `استُوردت ${written} قضيةً من ملف، وأُنشئ ${createdClients.size} عميلاً`,
      user.id,
      user.name ?? '',
      JSON.stringify({ ...summary, written, failures }),
      Math.floor(Date.now() / 1000),
    )
    .run()
    .catch(() => {});

  return Response.json({
    ok: true,
    data: { summary: { ...summary, written, clientsCreated: createdClients.size, failed: failures.length }, failures },
  });
}
