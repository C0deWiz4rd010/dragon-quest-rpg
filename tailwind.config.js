/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  theme: {
    screens: {
      xs: '420px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
      short: { raw: '(max-height: 760px)' },
      compact: { raw: '(max-width: 980px), (max-height: 760px)' },
    },
    extend: {
      colors: {
        dragon: {
          night: '#07090f',
          panel: '#111827',
          brass: '#d4af37',
          ember: '#f97316',
          mana: '#38bdf8',
          venom: '#22c55e',
          danger: '#ef4444',
        },
      },
      fontFamily: {
        display: ['Inter', 'Roboto', 'Arial', 'sans-serif'],
        pixel: ['Courier New', 'monospace'],
      },
      spacing: {
        shell: 'clamp(8px, 1.5vw, 18px)',
      },
    },
  },
};
