// التقارير المخصّصة — تعريفٌ يُحفظ، واستعلامٌ يُبنى منه.
//
// ═══ الخطر هنا واحد، وكلُّ ما في الملفّ حوله ═══
//
// التقرير يقول: «هذه الأعمدة، وهذه المرشّحات، وجمِّع بهذا». وبناءُ SQL من
// كلامٍ يكتبه مستخدم هو الحقن بعينه — واسمُ العمود لا يُربط بمعامل، فلا
// سبيل إلى تمريره `?`.
//
// فالحلّ قائمةٌ بيضاء: كلُّ معرّف حقلٍ يُطابَق بجدول `FIELDS` أدناه، وما
// لم يُطابق يُرفض الطلبُ به. ولا يُبنى اسمُ عمودٍ من نصٍّ وارد أبداً — بل
// يُنسخ من هذا الملفّ. والقيمُ تُربط بمعاملات كالمعتاد.

import { RESOURCES } from './resources.js';

const fail = (error, status) => Response.json({ ok: false, error }, { status });

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * الحقول المسموحة لكل مصدر: معرّفُ الواجهة إلى عمودِ القاعدة ونوعِه.
 *
 * وهي مرآةُ `fieldDefinitions` في `ReportBuilder.tsx` — وأيُّ حقلٍ يُضاف
 * هناك ولا يُضاف هنا يُرفض بـ`unknown_field`، وهو الاتجاه الصحيح: يُرفض
 * ما لا يعرفه الخادم لا ما لا تعرفه الشاشة.
 */
const FIELDS = {
  clients: {
    fullName: { column: 'full_name', type: 'text' },
    idNumber: { column: 'id_number', type: 'text' },
    clientType: { column: 'client_type', type: 'text' },
    status: { column: 'status', type: 'text' },
    joinDate: { column: 'join_date', type: 'date' },
    email: { column: 'email', type: 'text' },
    phone: { column: 'phone', type: 'text' },
  },
  prospects: {
    fullName: { column: 'full_name', type: 'text' },
    idNumber: { column: 'id_number', type: 'text' },
    prospectStatus: { column: 'prospect_status', type: 'text' },
    expectedValue: { column: 'expected_value', type: 'money' },
    source: { column: 'source', type: 'text' },
    joinDate: { column: 'join_date', type: 'date' },
    followUpDate: { column: 'follow_up_date', type: 'date' },
  },
  cases: {
    caseNumber: { column: 'case_number', type: 'text' },
    caseType: { column: 'case_type', type: 'text' },
    status: { column: 'status', type: 'text' },
    outcome: { column: 'outcome', type: 'text' },
    clientName: { column: 'client_name', type: 'text' },
    marketerName: { column: 'marketer_name', type: 'text' },
    createdDate: { column: 'created_at', type: 'epoch' },
    updatedDate: { column: 'updated_at', type: 'epoch' },
  },
};

/* المعاملات إلى صيغة SQL. المفتاح من قائمةٍ مغلقة، والقيمةُ تُربط دائماً. */
const OPERATORS = {
  equals: (col) => `${col} = ?`,
  not_equals: (col) => `${col} <> ?`,
  contains: (col) => `${col} LIKE ?`,
  greater_than: (col) => `${col} > ?`,
  less_than: (col) => `${col} < ?`,
};

const AGGREGATIONS = { count: 'COUNT', sum: 'SUM', avg: 'AVG', min: 'MIN', max: 'MAX' };

function tableOf(source) {
  return RESOURCES[source]?.table ?? null;
}

/** يقرأ تعريفَ التقرير ويردّ نسخةً منه لا تحمل إلا ما يعرفه هذا الملفّ. */
function sanitizeDefinition(source, definition) {
  const known = FIELDS[source];
  if (!known) return { error: 'unknown_source' };

  const raw = definition ?? {};

  const fields = (Array.isArray(raw.fields) ? raw.fields : []).filter((id) => id in known);
  if (!fields.length) return { error: 'no_fields' };

  const filters = [];
  for (const filter of Array.isArray(raw.filters) ? raw.filters : []) {
    const field = known[filter?.fieldId];
    if (!field) continue;
    if (!(filter?.operator in OPERATORS)) continue;
    if (filter.value === undefined || filter.value === null || filter.value === '') continue;
    filters.push({ fieldId: filter.fieldId, operator: filter.operator, value: filter.value });
  }

  const grouping = (Array.isArray(raw.grouping) ? raw.grouping : [])
    .filter((entry) => entry?.fieldId in known)
    .map((entry) => ({ fieldId: entry.fieldId, order: entry.order === 'desc' ? 'desc' : 'asc' }))
    .slice(0, 1); // تجميعٌ بحقلٍ واحد — والأكثر يحتاج شكلَ عرضٍ لم يُبنَ

  const aggregations = (Array.isArray(raw.aggregations) ? raw.aggregations : [])
    .filter((entry) => entry?.fieldId in known && entry?.function in AGGREGATIONS)
    .map((entry) => ({ fieldId: entry.fieldId, function: entry.function }));

  const visualization = {
    type: ['table', 'bar', 'line', 'pie', 'doughnut', 'area'].includes(raw.visualization?.type)
      ? raw.visualization.type
      : 'table',
  };

  return { value: { fields, filters, grouping, aggregations, visualization } };
}

/**
 * يبني الاستعلام من التعريف المنقّى.
 *
 * كلُّ اسمِ جدولٍ وعمودٍ هنا مقروءٌ من `FIELDS` و`RESOURCES` — أي من هذا
 * المستودع — ولا يُلصق فيه نصٌّ وارد. والقيمُ في `params` وحدها.
 */
function buildQuery(source, definition) {
  const table = tableOf(source);
  const known = FIELDS[source];
  const params = [];

  const where = definition.filters.map((filter) => {
    const { column } = known[filter.fieldId];
    /* `contains` يحتاج `%…%`، والنجمتان تُضافان إلى **القيمة** لا إلى
       الجملة — فتبقى مربوطةً ولا تصير جزءاً من SQL. */
    params.push(filter.operator === 'contains' ? `%${filter.value}%` : filter.value);
    return OPERATORS[filter.operator](column);
  });

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  /* ═══ حالة التجميع ═══
     يُجمَّع بحقلٍ واحد وتُحسب الدوالُّ عليه. والحقولُ المفردة تسقط: صفٌّ
     مجمَّعٌ لا معنى لاسمٍ فيه. */
  if (definition.grouping.length) {
    const group = known[definition.grouping[0].fieldId];
    const direction = definition.grouping[0].order === 'desc' ? 'DESC' : 'ASC';

    const selected = [`${group.column} AS "${definition.grouping[0].fieldId}"`, `COUNT(*) AS "count"`];
    for (const agg of definition.aggregations) {
      const field = known[agg.fieldId];
      const fn = AGGREGATIONS[agg.function];
      selected.push(`${fn}(${field.column}) AS "${agg.fieldId}_${agg.function}"`);
    }

    return {
      sql: `SELECT ${selected.join(', ')} FROM ${table}${whereSql} GROUP BY ${group.column} ORDER BY ${group.column} ${direction} LIMIT 1000`,
      params,
      grouped: true,
    };
  }

  const selected = definition.fields.map((id) => `${known[id].column} AS "${id}"`);
  return {
    sql: `SELECT ${selected.join(', ')} FROM ${table}${whereSql} LIMIT 1000`,
    params,
    grouped: false,
  };
}

/** يحوّل الصفوف إلى ما تعرضه الشاشة — الأنواع كما في `resources.js`. */
function shapeRows(source, definition, rows, grouped) {
  const known = FIELDS[source];

  return rows.map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
      const field = known[key];
      if (!field) {
        out[key] = value; // `count` وأعمدةُ الدوالّ
        continue;
      }
      if (field.type === 'money' && typeof value === 'number') out[key] = value / 100;
      else if (field.type === 'epoch' && typeof value === 'number') {
        out[key] = new Date(value * 1000).toISOString();
      } else out[key] = value;
    }
    return out;
  });
}

/* ═══ الصلاحية ═══
   القراءة بـ`analytics.read`، والكتابةُ على تقريرٍ لصاحبه أو لمسؤول. */
const mayRead = (user) => Boolean(user.permissions?.analytics?.read);
const mayWrite = (report, user) => report.created_by === user.id || user.role === 'admin';

function toReport(row) {
  let definition = {};
  try {
    definition = JSON.parse(row.definition ?? '{}');
  } catch {
    definition = {};
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    dataSource: row.data_source,
    fields: definition.fields ?? [],
    filters: definition.filters ?? [],
    grouping: definition.grouping ?? [],
    aggregations: definition.aggregations ?? [],
    visualization: definition.visualization ?? { type: 'table' },
    isPublic: Number(row.is_public) === 1,
    isTemplate: Number(row.is_template) === 1,
    createdBy: row.created_by,
    createdDate: new Date(row.created_at * 1000).toISOString(),
    lastModified: new Date(row.updated_at * 1000).toISOString(),
  };
}

export async function listReports(env, user) {
  if (!mayRead(user)) return fail('forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT * FROM custom_reports WHERE is_public = 1 OR created_by = ? ORDER BY updated_at DESC`,
  )
    .bind(user.id)
    .all();

  return Response.json({ ok: true, data: (results ?? []).map(toReport) });
}

function readInput(body) {
  const name = String(body?.name ?? '').trim().slice(0, 120);
  if (!name) return { error: 'name_required' };

  const dataSource = body?.dataSource;
  if (!(dataSource in FIELDS)) return { error: 'unknown_source' };

  const definition = sanitizeDefinition(dataSource, body);
  if (definition.error) return { error: definition.error };

  return {
    value: {
      name,
      description: String(body?.description ?? '').trim().slice(0, 500),
      dataSource,
      definition: definition.value,
      isPublic: body?.isPublic === true,
      isTemplate: body?.isTemplate === true,
    },
  };
}

export async function createReport(request, env, user) {
  if (!mayRead(user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  const parsed = readInput(body);
  if (parsed.error) return fail(parsed.error, 400);

  const id = crypto.randomUUID();
  const now = nowSeconds();

  await env.DB.prepare(
    `INSERT INTO custom_reports
       (id, name, description, data_source, definition, is_public, is_template, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      parsed.value.name,
      parsed.value.description,
      parsed.value.dataSource,
      JSON.stringify(parsed.value.definition),
      parsed.value.isPublic ? 1 : 0,
      parsed.value.isTemplate ? 1 : 0,
      user.id,
      now,
      now,
    )
    .run();

  const row = await env.DB.prepare(`SELECT * FROM custom_reports WHERE id = ?`).bind(id).first();
  return Response.json({ ok: true, data: toReport(row) }, { status: 201 });
}

export async function updateReport(request, env, user, id) {
  if (!mayRead(user)) return fail('forbidden', 403);

  const existing = await env.DB.prepare(`SELECT * FROM custom_reports WHERE id = ?`).bind(id).first();
  if (!existing) return fail('not_found', 404);
  if (!mayWrite(existing, user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  const parsed = readInput(body);
  if (parsed.error) return fail(parsed.error, 400);

  await env.DB.prepare(
    `UPDATE custom_reports
       SET name = ?, description = ?, data_source = ?, definition = ?, is_public = ?, is_template = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      parsed.value.name,
      parsed.value.description,
      parsed.value.dataSource,
      JSON.stringify(parsed.value.definition),
      parsed.value.isPublic ? 1 : 0,
      parsed.value.isTemplate ? 1 : 0,
      nowSeconds(),
      id,
    )
    .run();

  const row = await env.DB.prepare(`SELECT * FROM custom_reports WHERE id = ?`).bind(id).first();
  return Response.json({ ok: true, data: toReport(row) });
}

export async function deleteReport(env, user, id) {
  if (!mayRead(user)) return fail('forbidden', 403);

  const existing = await env.DB.prepare(`SELECT created_by FROM custom_reports WHERE id = ?`)
    .bind(id)
    .first();
  if (!existing) return fail('not_found', 404);
  if (!mayWrite(existing, user)) return fail('forbidden', 403);

  await env.DB.prepare(`DELETE FROM custom_reports WHERE id = ?`).bind(id).run();
  return Response.json({ ok: true });
}

/** تشغيلُ تقريرٍ محفوظ — صفوفُه من القاعدة. */
export async function runReport(env, user, id) {
  if (!mayRead(user)) return fail('forbidden', 403);

  const row = await env.DB.prepare(`SELECT * FROM custom_reports WHERE id = ?`).bind(id).first();
  if (!row) return fail('not_found', 404);
  if (Number(row.is_public) !== 1 && row.created_by !== user.id && user.role !== 'admin') {
    return fail('forbidden', 403);
  }

  const report = toReport(row);
  const definition = sanitizeDefinition(report.dataSource, report);
  if (definition.error) return fail(definition.error, 400);

  const query = buildQuery(report.dataSource, definition.value);
  const { results } = await env.DB.prepare(query.sql).bind(...query.params).all();

  return Response.json({
    ok: true,
    data: {
      rows: shapeRows(report.dataSource, definition.value, results ?? [], query.grouped),
      grouped: query.grouped,
      /* الأعمدة تُردّ مع الصفوف: العارض يرسم ترويسته منها ولا يخمّنها من
         أول صفّ — وأولُ صفٍّ قد يخلو من عمودٍ قيمتُه فارغة. */
      columns: query.grouped
        ? [definition.value.grouping[0].fieldId, 'count',
           ...definition.value.aggregations.map((a) => `${a.fieldId}_${a.function}`)]
        : definition.value.fields,
    },
  });
}

/** معاينةُ تعريفٍ لم يُحفظ بعد — يستعملها الباني قبل الحفظ. */
export async function previewReport(request, env, user) {
  if (!mayRead(user)) return fail('forbidden', 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return fail('invalid_body', 400);
  }

  if (!(body?.dataSource in FIELDS)) return fail('unknown_source', 400);

  const definition = sanitizeDefinition(body.dataSource, body);
  if (definition.error) return fail(definition.error, 400);

  const query = buildQuery(body.dataSource, definition.value);
  /* المعاينة عشرةُ صفوف: الباني يعرضها في جدولٍ صغير، وجلبُ ألفٍ لعرض
     عشرةٍ يحمّل القاعدة في كل ضغطةِ حقل. */
  const { results } = await env.DB.prepare(`${query.sql.replace(/LIMIT 1000$/, 'LIMIT 10')}`)
    .bind(...query.params)
    .all();

  return Response.json({
    ok: true,
    data: {
      rows: shapeRows(body.dataSource, definition.value, results ?? [], query.grouped),
      grouped: query.grouped,
      columns: query.grouped
        ? [definition.value.grouping[0].fieldId, 'count',
           ...definition.value.aggregations.map((a) => `${a.fieldId}_${a.function}`)]
        : definition.value.fields,
    },
  });
}
