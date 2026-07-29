// وصفُ الموارد — أسماءُ الحقول وأنواعُها والتصريحُ الذي يحرسها.
//
// موضعٌ واحد لكل مورد: اسمُ جدوله، وخريطةُ حقوله بين صيغة الواجهة
// (`camelCase`) وصيغة القاعدة (`snake_case`)، والتصريحُ الذي يُسأل عنه.
// وتفرّقُ هذه الثلاثة على ملفّات هو ما يجعل عموداً يُقرأ باسمٍ ويُكتب بآخر.

/* ═══ الأنواع ═══
 *
 * `money`  — يُخزَّن هللاتٍ عدداً صحيحاً ويُعرض ريالات. القسمة عند الحافة
 *            وحدها، فلا يقع كسرٌ عشري في جمعٍ ولا في مقارنة.
 * `date`   — تاريخٌ مجرّد نصّاً `YYYY-MM-DD`. لا لحظة، فلا منطقة زمنية.
 * `epoch`  — لحظةٌ بالثواني.
 * `json`   — بنيةٌ تُسلسل. والتالف يُقرأ غياباً ولا يُسقط الطلب.
 * وما عداها نصّ.
 */

export const RESOURCES = {
  clients: {
    table: 'clients',
    permission: 'clients',
    fields: {
      fullName: ['full_name'],
      idNumber: ['id_number'],
      phone: ['phone'],
      email: ['email'],
      joinDate: ['join_date', 'date'],
      clientType: ['client_type'],
      status: ['status'],
      notes: ['notes'],
      profilePicture: ['profile_picture'],
      commercialRegister: ['commercial_register'],
      legalRepresentative: ['legal_representative', 'json'],
      attachments: ['attachments', 'json'],
    },
    required: ['full_name', 'id_number'],
    defaults: { phone: '', email: '', notes: '', attachments: '[]' },
  },

  prospects: {
    table: 'prospects',
    permission: 'prospects',
    fields: {
      fullName: ['full_name'],
      idNumber: ['id_number'],
      phone: ['phone'],
      email: ['email'],
      joinDate: ['join_date', 'date'],
      clientType: ['client_type'],
      prospectStatus: ['prospect_status'],
      notes: ['notes'],
      profilePicture: ['profile_picture'],
      commercialRegister: ['commercial_register'],
      legalRepresentative: ['legal_representative', 'json'],
      attachments: ['attachments', 'json'],
      source: ['source'],
      expectedValue: ['expected_value', 'money'],
      followUpDate: ['follow_up_date', 'date'],
      assignedTo: ['assigned_to'],
    },
    required: ['full_name', 'id_number'],
    defaults: { phone: '', email: '', notes: '', attachments: '[]' },
  },

  cases: {
    table: 'cases',
    permission: 'cases',
    fields: {
      caseNumber: ['case_number'],
      caseType: ['case_type'],
      clientId: ['client_id'],
      clientName: ['client_name'],
      summary: ['summary'],
      status: ['status'],
      outcome: ['outcome'],
      basecampUrl: ['basecamp_url'],
      marketerId: ['marketer_id'],
      marketerName: ['marketer_name'],
      feeStructure: ['fee_structure', 'json'],
      paymentStatus: ['payment_status', 'json'],
      commissionStructure: ['commission_structure', 'json'],
      /* الشاشات تقرأ `createdDate` و`updatedDate` لا `createdAt`. والاسمان
         مكشوفان معاً أدناه، فلا يُمسّ مكوّن. */
    },
    required: ['case_number', 'case_type', 'client_id'],
    defaults: { summary: '', client_name: '' },
  },

  marketers: {
    table: 'marketers',
    permission: 'marketers',
    fields: {
      fullName: ['full_name'],
      idNumber: ['id_number'],
      phone: ['phone'],
      email: ['email'],
      relationshipType: ['relationship_type'],
      startDate: ['start_date', 'date'],
      status: ['status'],
      notes: ['notes'],
      profilePicture: ['profile_picture'],
    },
    required: ['full_name', 'id_number'],
    defaults: { phone: '', email: '', notes: '' },
  },

  commissions: {
    table: 'commission_payments',
    /* لا تصريح خاص بالعمولات في مفردات هذه المنصة — شاشتُها شاشةُ
       المسوّقين، فتُحرس بتصريحها. */
    permission: 'marketers',
    timestamps: 'created',
    fields: {
      marketerId: ['marketer_id'],
      caseId: ['case_id'],
      amount: ['amount', 'money'],
      paymentDate: ['payment_date', 'date'],
      notes: ['notes'],
      createdBy: ['created_by'],
    },
    required: ['marketer_id', 'case_id'],
  },

  activities: {
    table: 'activity_logs',
    /* سجلُّ الأنشطة يقرؤه كل عضو ويكتب فيه كل فعل — وهو أثرٌ لا محتوى،
       وحجبُه عن الكاتب يجعل لوحته فارغةً بلا سبب. */
    permission: null,
    timestamps: 'created',
    fields: {
      type: ['type'],
      description: ['description'],
      userId: ['user_id'],
      userName: ['user_name'],
      entityId: ['entity_id'],
      entityType: ['entity_type'],
      details: ['details', 'json'],
    },
    required: ['type', 'description'],
    orderBy: 'created_at DESC',
  },
};

/** ترتيبٌ افتراضي: الأحدث أولاً. */
const DEFAULT_ORDER = 'created_at DESC';

function spec(field) {
  const [column, type] = field;
  return { column, type: type ?? 'text' };
}

/* ═══ من القاعدة إلى الواجهة ═══ */
export function toClient(resource, row) {
  if (!row) return null;
  const out = { id: row.id };

  for (const [name, field] of Object.entries(resource.fields)) {
    const { column, type } = spec(field);
    const value = row[column];

    if (value === null || value === undefined) {
      out[name] = type === 'json' ? undefined : null;
      continue;
    }

    if (type === 'money') out[name] = Number(value) / 100;
    else if (type === 'json') out[name] = parseJson(value);
    else if (type === 'date') out[name] = value;
    else out[name] = value;
  }

  /* الأوقات تُكشف بالاسمين معاً: `createdAt` لمن يقرأ الجديد، و`createdDate`
     لأن شاشات القضايا والمسوّقين تقرؤه بهذا الاسم منذ عهد Supabase. */
  if (row.created_at != null) {
    out.createdAt = toIso(row.created_at);
    out.createdDate = out.createdAt;
  }
  if (row.updated_at != null) {
    out.updatedAt = toIso(row.updated_at);
    out.updatedDate = out.updatedAt;
  }
  if (resource.table === 'activity_logs' && row.created_at != null) {
    out.timestamp = out.createdAt;
  }

  return out;
}

/* ═══ من الواجهة إلى القاعدة ═══
   ولا يُقرأ إلا ما وُصف: حقلٌ يرسله العميل ولا وصف له يُطرح صامتاً، فلا
   يكتب أحدٌ عموداً لم يُقصد له. */
export function toRow(resource, body) {
  const row = {};

  for (const [name, field] of Object.entries(resource.fields)) {
    if (!Object.prototype.hasOwnProperty.call(body, name)) continue;
    const { column, type } = spec(field);
    const value = body[name];

    if (value === null || value === undefined || value === '') {
      row[column] = null;
      continue;
    }

    if (type === 'money') row[column] = Math.round(Number(value) * 100);
    else if (type === 'json') row[column] = JSON.stringify(value);
    else if (type === 'date') row[column] = toDateOnly(value);
    else row[column] = String(value);
  }

  return row;
}

export function orderOf(resource) {
  return resource.orderBy ?? DEFAULT_ORDER;
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function toIso(seconds) {
  return new Date(Number(seconds) * 1000).toISOString();
}

/* التاريخ المجرّد يُقتطع من أول عشرة محارف: الواجهة ترسل `Date` فيصل
   ISO كاملاً، والعمود يريد اليوم وحده. والاقتطاع لا التحويل — فتحويلُه
   عبر `Date` يُدخل المنطقة الزمنية فينزلق اليوم. */
function toDateOnly(value) {
  const text = typeof value === 'string' ? value : new Date(value).toISOString();
  return text.slice(0, 10);
}
