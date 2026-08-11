import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          DEFAULT: '#121214',
          card: '#18181B',
          border: '#27272A',
          muted: '#A1A1AA',
        },
        brand: {
          DEFAULT: '#8257E5',
          light: '#A855F7',
          dark: '#6B21A8',
          subtle: '#F3E8FF',
        },
        traffic: {
          green: '#10B981',
          greenBg: '#ECFDF5',
          yellow: '#F59E0B',
          yellowBg: '#FFFBEB',
          red: '#EF4444',
          redBg: '#FEF2F2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 30px rgba(0, 0, 0, 0.08)',
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        obsidian: '0 12px 32px -4px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
};

export default config;
