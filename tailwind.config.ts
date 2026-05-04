import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // === THE FIX: Map Next.js Font Variables to Tailwind Classes ===
      fontFamily: {
        outfit: ['var(--font-outfit)', 'sans-serif'],
        'open-sans': ['var(--font-open-sans)', 'sans-serif'],
        // If you decide to use Poppins instead, you would do:
        // poppins: ['var(--font-poppins)', 'sans-serif'],
      },
      colors: {
        neutral: {
          850: '#1f1f1f',
          950: '#0a0a0a',
        }
      }
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide')
  ],
};
export default config;