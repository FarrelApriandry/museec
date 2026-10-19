/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace', 'ui-monospace'],
      },
      colors: {
        retro: {
          bg: '#0a0d14',
          surface: '#121722',
          card: '#181f2f',
          border: '#2b354c',
          accent: '#10b981',
          cyan: '#06b6d4',
          magenta: '#ec4899',
          amber: '#f59e0b',
          rose: '#f43f5e',
          violet: '#8b5cf6',
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 15px rgba(6, 182, 212, 0.4)',
        'glow-magenta': '0 0 15px rgba(236, 72, 153, 0.4)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.4)',
        'glow-amber': '0 0 15px rgba(245, 158, 11, 0.4)',
        'retro-hard': '3px 3px 0px 0px #000000',
      },
    },
  },
  plugins: [],
};
