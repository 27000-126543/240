/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        deep: {
          950: '#050a14',
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        tech: {
          50: '#e0f2fe',
          100: '#bae6fd',
          300: '#38bdf8',
          500: '#0EA5E9',
          600: '#0284c7',
          700: '#0369a1',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06B6D4',
        },
        plasma: {
          orange: '#F97316',
          green: '#10B981',
          red: '#EF4444',
          purple: '#8B5CF6',
        }
      },
      fontFamily: {
        display: ['Geologica', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(14, 165, 233, 0.3)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.3)',
        'glow-orange': '0 0 20px rgba(249, 115, 22, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(14, 165, 233, 0.6)' },
        }
      }
    },
  },
  plugins: [],
};
