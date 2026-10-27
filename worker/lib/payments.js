// دفعاتُ العميل — والمحصَّلُ مجموعُها، يُحسب هنا وحده.
//
// ═══ لماذا يُكتب المجموعُ في `payment_status` ولا يُحسب عند القراءة ═══
//
// `payment_status.collectedAmount` يقرؤه كثيرون: إحصاءاتُ المسوّق في
// `queries.js`، وجدولُ قضاياه في `MarketerModal`، ونافذةُ القضية. ولو صار
// يُحسب عند القراءة لزم كلَّ قارئٍ أن يجمع الدفعات — ويُنسى أحدُهم فيقرأ
// رقماً قديماً. فيُكتب المجموعُ في موضعه بعد كل دفعةٍ تُضاف أو تُحذف، وبعد
// كل حفظٍ للقضية، والقرّاءُ كما هم.
//
// والشاشةُ لا تكتب المحصَّل بعد اليوم: ما ترسله منه يُطمس هنا بمجموع السجلّ.

const safeJson = (raw) => {
  try { return JSON.parse(raw ?? 'null'); } catch { return null; }
};

/**
 * حالةُ التحصيل من الرقمين.
 *
 * وإجماليٌّ صفرٌ ولا محصَّل: «غير مدفوع» — لا «مدفوع كاملاً» لأنّ صفراً
 * يساوي صفراً. قضيةٌ لم تُكتب أتعابُها بعد ليست قضيةً سُدِّدت.
 */
export function collectionStatusOf(total, collected) {
  if (collected <= 0) return 'unpaid';
  if (total > 0 && collected >= total) return 'fully_paid';
  return 'partially_paid';
}

/**
 * يعيد حسابَ المحصَّل والمتبقّي وحالةِ التحصيل لقضيةٍ من دفعاتها.
 *
 * والتطوّعيةُ أصفارٌ كلُّها: لا أتعابَ فيها يُحصَّل منها شيء، وما بقي في
 * صفّها من رقمٍ قديم لا يُحسب.
 */
export async function recomputeCollected(env, caseId) {
  if (!caseId) return null;

  const row = await env.DB.prepare(
    `SELECT payment_status, fee_structure FROM cases WHERE id = ?`,
  )
    .bind(caseId)
    .first();
  if (!row) return null;

  const current = safeJson(row.payment_status) ?? {};
  const proBono = safeJson(row.fee_structure)?.type === 'pro_bono';

  const sum = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount), 0) total, MAX(payment_date) last FROM client_payments WHERE case_id = ?`,
  )
    .bind(caseId)
    .first();

  /* المبالغُ في `payment_status` ريالاتٌ كما تكتبها الشاشة، والدفعاتُ
     هللات — والقسمةُ هنا عند الحدّ وحده. */
  const total = proBono ? 0 : Number(current.totalAmount ?? 0) || 0;
  const collected = proBono ? 0 : Number(sum?.total ?? 0) / 100;

  const next = {
    ...current,
    totalAmount: total,
    collectedAmount: collected,
    remainingAmount: Math.max(total - collected, 0),
    collectionStatus: collectionStatusOf(total, collected),
  };
  if (sum?.last) next.lastPaymentDate = sum.last;
  else delete next.lastPaymentDate;

  const serialized = JSON.stringify(next);
  if (serialized !== row.payment_status) {
    await env.DB.prepare(`UPDATE cases SET payment_status = ? WHERE id = ?`)
      .bind(serialized, caseId)
      .run();
  }
  return next;
}

/**
 * يجهّز دفعةً قبل كتابتها: قضيتُها موجودة، وليست تطوّعية، وموكّلُها منها.
 *
 * `client_id` يُؤخذ من القضية لا من الجسم الوارد — دفعةٌ تُنسب إلى غير
 * صاحبها خطأٌ في دفترٍ ماليّ، ومن كتبها بيده نسبها إلى من شاء.
 */
export async function preparePayment(env, body) {
  const caseId = typeof body?.caseId === 'string' ? body.caseId : '';
  if (!caseId) return { error: 'missing_field', status: 400 };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'invalid_amount', status: 400 };

  const row = await env.DB.prepare(`SELECT client_id, fee_structure FROM cases WHERE id = ?`)
    .bind(caseId)
    .first();
  if (!row) return { error: 'invalid_reference', status: 409 };
  if (safeJson(row.fee_structure)?.type === 'pro_bono') return { error: 'pro_bono_case', status: 409 };

  return { body: { ...body, clientId: row.client_id } };
}
