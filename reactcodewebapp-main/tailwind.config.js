/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  corePlugins: { preflight: false },
  plugins: [],
};
