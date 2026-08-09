import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/* ═══ لماذا يُحذف `_redirects` من ناتج البناء ═══
 *
 * الملفّ من عهد Pages، وقاعدتُه `/*  /index.html  200` كانت هي توجيهَ
 * اللوحة في المتصفّح. وقد حلّ محلّها `not_found_handling` في
 * `wrangler.toml`، فلم يبقَ لها عمل.
 *
 * وتركُها لا يمرّ: Workers تقرأ `_redirects` كذلك، وتردّ هذه القاعدة
 * بـ«Infinite loop detected» — فيسقط النشر عند آخر خطوة، بعد أن تُرفع
 * الأصول وتُربط الموارد كلُّها. وهو أبعد موضعٍ يظهر فيه عطلٌ سببُه ملفّ
 * لم يُقصد به إلا الخير.
 *
 * والحذف من ناتج البناء لا من `public/`: الملفّ يبقى في المستودع شاهداً
 * على ما كان، و`dist` وحدها تخلو منه.
 *
 * و`.assetsignore` كان بديلاً أقصر، غير أنه يمنع الرفع ولم أتحقّق أنه
 * يمنع القراءةَ إعداداً — والفرق بينهما هو الفرق بين نشرةٍ تمرّ وأخرى
 * تسقط. وهذا يمنع الاثنين معاً، ويُتحقَّق منه محلياً بسرد `dist`.
 */
function dropPagesRedirects() {
  return {
    name: 'naf-drop-pages-redirects',
    apply: 'build' as const,
    async closeBundle() {
      const dist = fileURLToPath(new URL('./dist/_redirects', import.meta.url));
      await rm(dist, { force: true });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dropPagesRedirects()],
  resolve: {
    /* ‎@/‎ يشير إلى ‎src‎ ليصل ملفّ السجلّ إلى أخيه بالمسار الذي كُتب به
     * في ‎naf-ui‎ نفسه — ‎@/registry/naf/lib/utils‎. وهذا ما يُبقي الملفّات
     * المنسوخة مطابقةً للأصل حرفاً بحرف، فتُقارَن بالسجلّ ويُكشف انحرافها
     * بأمر واحد، وتُحدَّث بنسخٍ فوقها لا بتعديلٍ يدويّ في كلّ سطر. */
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: './index.html',
      output: {
        /* فصلُ ما لا يتغيّر عمّا يتغيّر: كانت الحزمة ملفّاً واحداً يقارب
         * ٦٨٠ كيلوبايت، فأيُّ تعديلٍ في شاشة يُبطل تخزينَ المتصفّح للمكتبات
         * كلِّها ويُعيد تنزيلها. والرسومُ أثقلُ ما فيها ولا تتغيّر أصلاً. */
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },

  /* ═══ لا يُستثنى `lucide-react` من التحزيم المسبق ═══
   *
   * كان مستثنى، وهو أثقل ما كان في الإقلاع: حزمةُ الأيقونات تُصدِّر نحو
   * ٣٥٠٠ وحدةٍ صغيرة، كلُّ أيقونةٍ في ملفّ. والاستثناء يعني ألّا يجمعها
   * Vite قبل التشغيل، فيطلبها المتصفّح واحدةً واحدة عند كل فتحةِ صفحة —
   * آلافُ الطلبات على خادم التطوير قبل أن يُرسم شيء، فتعلق الصفحةُ
   * والجهازُ معها حتى تُغلق.
   *
   * وبالتحزيم المسبق تصير طلباً واحداً. والبناءُ للإنتاج لا يتأثّر:
   * `rollup` يهزّ الشجرة ولا يُبقي إلا الأيقونات المستعملة.
   */
});
