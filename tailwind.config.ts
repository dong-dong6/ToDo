import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f8f4ec',
        ink: '#171717',
        clay: '#d86f45',
        moss: '#7a8f61',
        smoke: '#6f6a63',
        line: '#1f1a16',
        sand: '#e6ddcf',
      },
      boxShadow: {
        stamp: '10px 10px 0 0 rgba(23, 23, 23, 0.12)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', '"Noto Sans SC"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      backgroundImage: {
        grid: 'linear-gradient(to right, rgba(23,23,23,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(23,23,23,0.08) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
} satisfies Config
