/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
          dark: '#1d4ed8',
        },
        muted: {
          DEFAULT: '#f1f5f9',
          foreground: '#64748b',
          dark: '#1e293b',
          'dark-foreground': '#94a3b8',
        },
      },
    },
  },
  plugins: [],
};
