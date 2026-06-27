/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#2D6A4F',
        'brand-light': '#52B788',
        'brand-dark': '#1B4332',
        surface: '#F8F7F4',
        'surface-2': '#FFFFFF',
        muted: '#6B7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
