import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    /* `src/registry/naf` نسخةٌ حرفية من سجلّ `naf-ui` — تُحدَّث بنسخٍ فوقها
       لا بتعديلٍ يدوي، وتُقارَن بالأصل حرفاً بحرف. وهي مكتوبةٌ لـNext.js
       فتحمل توجيهاتٍ لقواعد غير مثبَّتة هنا (`@next/next/no-img-element`)،
       فيردّها eslint أخطاءً على شيفرةٍ ليست لنا. والحُكم عليها في مستودعها. */
    ignores: ['dist', 'src/registry/naf/**'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      /* ═══ الحارس على تصادم الأسماء ═══
       *
       * شاشةُ الإعدادات كانت تستورد أيقونة اسمُها `Settings` وتُعرّف دالّةً
       * اسمُها `Settings`. فيُدهَس المستورَد بالمُعرَّف، وتصير كلُّ
       * `<Settings />` في الملفّ نداءً للشاشة نفسها — تستدعي ذاتها بلا
       * قرار توقّف حتى يعلق المتصفّح والجهاز معه.
       *
       * ولم يكن في المسار ما يمسك ذلك: `tsc` يقول `TS2440` ولا يُنادى في
       * البناء، و`esbuild` يمرّره صامتاً. فالقاعدة هنا تجعله خطأً يوقف
       * `npm run lint` قبل أن يبلغ النشر. */
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',

      /* وسيطٌ يبدأ بشرطةٍ سفلية مقصودٌ إهمالُه: أغلفةُ ما لم يُبنَ بعد
         تُصرّح بعقدها كاملاً ولا تستعمله، والعقدُ هو الفائدة. */
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      /* ═══ `any` تنبيهٌ لا خطأ ═══
       *
       * القاعدة أسلوبٌ لا صحّة، وأكثرُ مواضعها هنا مقصود: `api.list<any>`
       * وأخواتُها في `database.ts` تستقبل صفوف JSON خاماً ثم تحوّلها
       * `asClient` و`asCase` — والنوع يُبنى عند التحويل لا عند الشبكة.
       *
       * وإبقاؤها خطأً يجعل `npm run lint` ساقطاً أبداً، فلا يصلح بوّابةً —
       * وبوّابةٌ لا تُغلق أبداً كلا بوّابة. فتبقى مرئيةً ولا تحجب ما يهمّ:
       * تصادمَ الأسماء والمتغيّراتِ الميتة وقواعدَ الخُطّافات. */
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
