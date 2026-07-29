// رفع ملفّ إلى حاوية R2.
//
// المسار محميّ بالوسيط، فالرافع عضوٌ مفعَّل حتماً. ولا يُقرأ هنا دورُه:
// من يرفع ماذا قرارٌ تتخذه الشاشات، ويقع في دفعة طبقة البيانات حين تنتقل
// إليها الكتابةُ كلّها. وإلى ذلك الحين الحدُّ هو العضوية.

import { KINDS, newKey } from '../_lib/files.js';

/* الردّ رمزٌ لا جملة — كما تفعل naf-auth في أسباب الرفض. النصّ المعروض
   للمستخدم يأتي من `naf-terms.md`، وترجمتُه عملُ الشاشة لا عمل المسار.
   ولو حمل المسارُ الجملة لصار مصدر نصّ ثانياً خارج السجلّ. */
const fail = (error, status) => Response.json({ ok: false, error }, { status });

export async function onRequestPost(context) {
  let form;
  try {
    form = await context.request.formData();
  } catch {
    return fail('invalid_body', 400);
  }

  const kind = String(form.get('kind') ?? 'attachment');
  if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) return fail('invalid_kind', 400);

  const file = form.get('file');
  if (!file || typeof file === 'string') return fail('invalid_body', 400);

  const rules = KINDS[kind];

  /* الحجم يُفحص قبل القراءة: `file.size` معلومٌ من الترويسة، فالردّ يقع
     قبل أن يُحمَّل الجسم كلُّه في الذاكرة. */
  if (file.size > rules.maxBytes) return fail('file_too_large', 413);
  if (file.size === 0) return fail('invalid_body', 400);

  /* والنوع يُقرأ من الملفّ لا من حقلٍ في النموذج: حقلٌ منفصل يقوله الرافع
     مرّتين، فيُقبل بالأول ويُقدَّم بالثاني. */
  const type = file.type;
  if (!Object.prototype.hasOwnProperty.call(rules.types, type)) {
    return fail('unsupported_type', 415);
  }

  const key = newKey(kind);

  await context.env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: type },
    /* اسم الملفّ الأصلي بيانٌ مصاحب لا جزءٌ من المفتاح: يُعرض للقارئ عند
       التنزيل، ولا يدخل مساراً ولا يُشتقّ منه شيء. */
    customMetadata: {
      uploadedBy: context.data.user.id,
      originalName: typeof file.name === 'string' ? file.name.slice(0, 255) : '',
    },
  });

  return Response.json({ ok: true, key, type, size: file.size }, { status: 201 });
}
