// النوعان اللذان تُزامَن لوحتاهما: العملاءُ المحتملون والعملاءُ الفعليون.
//
// ═══ وصفٌ لا نسخة ═══
//
// اللوحتان تعملان بالدمج نفسِه والاستخراج نفسِه والتعليقات نفسِها. والفرقُ
// جدولٌ وعمودُ حالةٍ وحقولُ وصفٍ وجدولُ تعليقات — فيُوصف هنا مرّةً، وتأخذه
// الدوالّ في `board.js` و`sync.js` معاملاً. ونسختان من الدمج تفترقان بعد شهر.
//
// والمفاتيحُ في الصورة المحفوظة (`bc_synced_values`) أسماءُ الحقول هنا:
// `prospectStatus` للمحتمل — كما كتبتها `migrations/0030` — و`status` للعميل.

import { CARD_FIELDS } from './card-format.js';

/** مفتاحُ عمود التحويل في خريطة لوحة المحتملين — ليس حالةً في المنصة. */
export const CONVERTED = '__converted';
export const CONVERTED_TITLE = 'تحوّل إلى عميل';

/* ═══ الأسماءُ القديمة لحالات المحتمل (`migrations/0030`) ═══ */
export const LEGACY_STATUSES = {
  'مهتم': 'تم التواصل',
  'غير مناسب': 'اعتذرنا عنه',
  'تم الرفض': 'رفض العميل',
};

const pick = (keys) => CARD_FIELDS.filter(([key]) => keys.includes(key));

/* حقولُ الوصف المشتركة — وما يخصّ المحتمل (المصدرُ والقيمةُ والمتابعة) يُزاد له. */
const SHARED = ['phone', 'email', 'clientType', 'idType', 'idNumber', 'commercialRegister'];

const SHARED_COLUMNS = {
  fullName: 'full_name',
  phone: 'phone',
  email: 'email',
  clientType: 'client_type',
  idType: 'id_type',
  idNumber: 'id_number',
  commercialRegister: 'commercial_register',
  notes: 'notes',
};

/* عناوينُ أعمدة العملاء: الحالةُ رمزٌ في المنصة (`current`) ولفظٌ في اللوحة. */
const CLIENT_COLUMN_TITLES = { current: 'عملاء حاليون', former: 'عملاء سابقون' };

export const ENTITIES = {
  prospects: {
    kind: 'prospects',
    table: 'prospects',
    resource: 'prospects',
    title: 'العملاء المحتملون',
    /* وما تُعرف به اللوحةُ في «عدّة» المشروع إن لم تُختر بيد. */
    titleHint: /محتمل/,
    defaultName: 'عميل محتمل',
    statusField: 'prospectStatus',
    statusesKey: 'prospectStatuses',
    fallbackStatus: 'جديد',
    cardFields: pick([...SHARED, 'source', 'expectedValue', 'followUpDate']),
    columns: {
      ...SHARED_COLUMNS,
      prospectStatus: 'prospect_status',
      source: 'source',
      expectedValue: 'expected_value',
      followUpDate: 'follow_up_date',
    },
    commentsTable: 'prospect_comments',
    commentKey: 'prospect_id',
    conflictPrefix: 'prospect.',
    conflictKey: 'prospect_id',
    columnTitle: (status) => status,
    extraColumns: [[CONVERTED, CONVERTED_TITLE]],
    legacyStatuses: LEGACY_STATUSES,
  },

  clients: {
    kind: 'clients',
    table: 'clients',
    resource: 'clients',
    title: 'العملاء الفعليون',
    titleHint: /فعلي|حالي/,
    defaultName: 'عميل',
    statusField: 'status',
    statusesKey: 'clientStatuses',
    fallbackStatus: 'current',
    cardFields: pick(SHARED),
    columns: { ...SHARED_COLUMNS, status: 'status' },
    commentsTable: 'client_comments',
    commentKey: 'client_id',
    /* وسابقةُ `client.` نفسُها التي تكتبها مزامنةُ المشاريع — وما يفرّقهما
       `basecamp_conflicts.client_id`: يمتلئ لتعارض البطاقة وحده. */
    conflictPrefix: 'client.',
    conflictKey: 'client_id',
    columnTitle: (status) => CLIENT_COLUMN_TITLES[status] ?? status,
    extraColumns: [],
    legacyStatuses: {},
  },
};

export const KINDS = Object.keys(ENTITIES);

export function entity(kind) {
  const spec = ENTITIES[kind];
  if (!spec) throw new Error(`basecamp: نوعٌ مجهول — ${kind}`);
  return spec;
}

/** كلُّ ما يُزامَن في نوعٍ: الاسمُ والحالةُ وحقولُ الوصف والملاحظات. */
export const syncedFields = (spec) => ['fullName', spec.statusField, ...spec.cardFields.map(([key]) => key), 'notes'];
