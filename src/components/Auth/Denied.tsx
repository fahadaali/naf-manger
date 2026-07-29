import { ArrowRight, CircleSlash } from 'lucide-react';

/* صفحة الرفض.
 *
 * الحزمة تمرّر **رمز سبب** لا جملة — `‎/denied?r=…` — وهذه الصفحة تترجمه
 * إلى المصطلح المسجَّل في `naf-terms.md`. ولو حملت الحزمة الجملة لصارت
 * مصدر نصّ ثانياً خارج السجلّ.
 *
 * ولا تكشف الصفحة تفاصيل تقنية ولا وجود مستخدمين آخرين.
 *
 * ═══ الأيقونات ═══
 * «معطّل» وحدها لها أيقونة مسجَّلة — `CircleSlash` مع `muted-foreground`
 * في جدول «حالات عامة». والبقيّة رسائلُ نصّية في جدولٍ بلا عمود أيقونة،
 * فتُترك بلا أيقونة قصداً: اختيارُ واحدةٍ لها هنا قرارٌ يخصّ السجلّ لا
 * هذه الشاشة.
 *
 * ولا يُبلَّغ شيء باللون وحده: كل حالة نصٌّ مقروء، واللون زيادةٌ عليه.
 */

/* المفاتيح هي `DEFAULT_REASONS` في naf-auth حرفياً. ورمزٌ غير معروف يأخذ
   رسالة النظام العامة — لا فراغاً، ولا الرمز نفسه معروضاً للقارئ. */
const MESSAGES: Record<string, string> = {
  inactive: 'معطّل',
  not_member: 'لا تملك صلاحية الوصول لهذه المنصة',
  bad_state: 'حدث خطأ في النظام. أعد المحاولة بعد قليل',
  auth_failed: 'حدث خطأ في النظام. أعد المحاولة بعد قليل',
};

const FALLBACK = 'حدث خطأ في النظام. أعد المحاولة بعد قليل';

export default function Denied() {
  const reason = new URLSearchParams(window.location.search).get('r') ?? '';
  const message = MESSAGES[reason] ?? FALLBACK;
  const showIcon = reason === 'inactive';

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-100 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="flex items-start gap-3">
          {showIcon && (
            <CircleSlash aria-hidden="true" className="h-5 w-5 shrink-0 mt-1 text-slate-500" />
          )}
          <p className="text-slate-700 leading-relaxed">{message}</p>
        </div>

        {/* الوجهة جذرُ المنصة: الوسيط يقود منه إلى المركز، فلا نطاق مكتوب
            هنا ولا في أي ملف كود — نقلُ المركز تعديلُ `wrangler.toml` وحده. */}
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
        >
          {/* بلا قلب: الخريطة تختار الاسم بمظهره في RTL — «رجوع → ArrowRight» —
              وهذه الصفحة RTL، فرسمُها الطبيعي هو الصحيح. والقلب يلزم في LTR. */}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
          رجوع
        </a>
      </div>
    </main>
  );
}
