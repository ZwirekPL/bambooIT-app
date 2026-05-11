import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Legacy palette — kept for footer/utility */
        sage: {
          50:  '#f4f6ef',
          100: '#e7ecdb',
          200: '#d0dab9',
          300: '#b2c28e',
          400: '#94a96a',
          500: '#7a8c5a',
          600: '#5e6e43',
          700: '#4a5634',
          800: '#3c4529',
          900: '#323b23',
          950: '#191e10',
        },
        cream: {
          50:  '#fdfaf4',
          100: '#f9f3e3',
          200: '#f3e7c6',
          300: '#ead4a0',
        },

        /* ── Brand tokens ── */
        'brand-green': {
          DEFAULT: 'hsl(var(--brand-green))',
          hover:   'hsl(var(--brand-green-hover))',
        },
        'brand-orange': {
          DEFAULT: 'hsl(var(--brand-orange))',
          hover:   'hsl(var(--brand-orange-hover))',
        },
        'ai-blue': {
          DEFAULT: 'hsl(var(--ai-blue))',
          soft:    'hsl(var(--ai-blue-soft))',
        },

        /* shadcn semantic tokens */
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'fade-in':        'fade-in 0.4s ease-out forwards',
        'fade-in-up':     'fade-in-up 0.6s ease-out forwards',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [typography],
};

export default config;
