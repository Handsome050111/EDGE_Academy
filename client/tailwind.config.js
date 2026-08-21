/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          navy: '#08306B',
          navyHover: '#062452',
          gold: '#D4AF37',
          goldHover: '#B5932B',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          textDark: '#0F172A',
          textMuted: '#64748B',
        },
      },
    },
  },
  plugins: [],
};
