/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'arabic': ['Tahoma', 'Arial', 'sans-serif'],
      },
      colors: {
        'naf-blue': '#1e40af',
        'naf-gold': '#f59e0b',
      },
    },
  },
  plugins: [],
};