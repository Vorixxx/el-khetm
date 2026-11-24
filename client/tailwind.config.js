/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        manila: '#F4EFE6',
        ink: '#1E293B',
        'doc-green': '#15803D',
        'prank-red': '#B91C1C',
        'defense-blue': '#1D4ED8',
        'wasta-gold': '#B45309',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      boxShadow: {
        'retro': '3px 3px 0px #1E293B',
        'retro-sm': '2px 2px 0px #1E293B',
        'retro-lg': '4px 4px 0px #1E293B',
      },
    },
  },
  plugins: [],
};
