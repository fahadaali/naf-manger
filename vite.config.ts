import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/* كان هنا `dropPagesRedirects` — إضافةٌ وظيفتُها الوحيدة حذفُ
 * `public/_redirects` من `dist`، لأن Workers تقرؤه وتردّ قاعدتَه
 * `/*  /index.html  200` بـ«Infinite loop detected» فيسقط النشر عند آخر
 * خطوة. وقد حُذف الملفّ نفسُه، فزال سببُ الإضافة معه.
 *
 * وتوجيهُ اللوحة في المتصفّح من `not_found_handling` في `wrangler.toml`. */

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
