/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { DEFAULT: '#12304A', 50: '#EEF3F8', 100: '#D6E2EE', 200: '#AFC4DA', 600: '#1C4566', 700: '#12304A', 800: '#0C2235', 900: '#08182A' },
        teal: { DEFAULT: '#008D95', 50: '#E6F5F6', 100: '#C2E8EA', 200: '#8ED4D8', 500: '#00A3AC', 600: '#008D95', 700: '#00727A' },
        canvas: '#F7F9FB',
        border: '#E3E8EE',
        muted: { DEFAULT: '#64748B', bg: '#F1F4F8' },
        success: { DEFAULT: '#3E8E63', bg: '#EAF5EE' },
        warning: { DEFAULT: '#B7791F', bg: '#FDF4E3' },
        danger: { DEFAULT: '#C2504A', bg: '#FBECEB' },
      },
      boxShadow: { card: '0 1px 2px rgba(18,48,74,0.04), 0 1px 3px rgba(18,48,74,0.06)' },
    },
  },
  plugins: [],
};
