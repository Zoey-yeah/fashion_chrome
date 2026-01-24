/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./popup.tsx",
    "./sidepanel.tsx",
    "./options.tsx"
  ],
  theme: {
    extend: {
      colors: {
        // Luxe fashion palette - deep burgundy meets champagne gold
        'runway': {
          50: '#fdf8f6',
          100: '#f9ebe5',
          200: '#f4d6cb',
          300: '#eab8a4',
          400: '#de9075',
          500: '#d06d4c',
          600: '#c4553a',
          700: '#a3432d',
          800: '#873829',
          900: '#703226',
          950: '#3c1711',
        },
        'champagne': {
          50: '#fbf9f3',
          100: '#f7f1e3',
          200: '#ede0c4',
          300: '#e1c99e',
          400: '#d4ad75',
          500: '#ca9655',
          600: '#bc7f47',
          700: '#9d653c',
          800: '#7f5236',
          900: '#68442f',
          950: '#382217',
        },
        'velvet': {
          50: '#faf5f7',
          100: '#f6ecf0',
          200: '#efdbe2',
          300: '#e3bfcb',
          400: '#d196aa',
          500: '#bf708c',
          600: '#a95270',
          700: '#8e405a',
          800: '#76384c',
          900: '#643243',
          950: '#3b1924',
        },
        'noir': {
          50: '#f6f6f7',
          100: '#e2e3e5',
          200: '#c4c6cb',
          300: '#9fa2aa',
          400: '#7a7e88',
          500: '#5f636d',
          600: '#4c4f57',
          700: '#3f4147',
          800: '#35373b',
          900: '#2e2f33',
          950: '#1a1b1d',
        }
      },
      fontFamily: {
        'display': ['"Cormorant Garamond"', 'serif'],
        'body': ['"DM Sans"', 'sans-serif'],
        'mono': ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'linear-gradient(135deg, #1a1b1d 0%, #2e2f33 25%, #3b1924 50%, #382217 75%, #1a1b1d 100%)',
        'shimmer': 'linear-gradient(90deg, transparent 0%, rgba(237,224,196,0.1) 50%, transparent 100%)',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-subtle': 'pulse-subtle 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in': 'slideIn 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      boxShadow: {
        'glow': '0 0 40px -10px rgba(212, 173, 117, 0.3)',
        'glow-sm': '0 0 20px -5px rgba(212, 173, 117, 0.2)',
        'inner-glow': 'inset 0 0 40px -10px rgba(212, 173, 117, 0.1)',
      }
    },
  },
  plugins: [],
}
