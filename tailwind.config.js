/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        sycom: {
          50:  '#f0f7ff',
          100: '#e0efff',
          200: '#b9d9ff',
          300: '#7bb8ff',
          400: '#3591ff',
          500: '#1a6fba',   // primary brand blue
          600: '#135399',
          700: '#0f4080',
          800: '#0d3369',
          900: '#0a2554',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(26,111,186,0.07)',
        'card-md': '0 4px 24px rgba(26,111,186,0.11)',
      },
    },
  },
  plugins: [],
}
