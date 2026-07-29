import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [react(), dropPagesRedirects()],
  build: {
    rollupOptions: {
      input: './index.html'
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
