import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
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
    },
  }
);
