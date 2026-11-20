import type { Config } from 'tailwindcss';

// Los tokens viven en src/index.css como variables CSS; aquí solo se exponen a Tailwind.
// Regla del manual: nunca HEX sueltos en los componentes.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--hs-bg)',
        card: 'var(--hs-card)',
        borde: 'var(--hs-border)',
        texto: 'var(--hs-text)',
        muted: 'var(--hs-muted)',
        ink: 'var(--hs-ink)',
        amarillo: 'var(--hs-yellow)',
        'amarillo-tenue': 'var(--hs-yellow-tenue)',
        gull: 'var(--hs-gull)',
        rojo: 'var(--hs-red)',
        'rojo-bg': 'var(--hs-red-bg)',
      },
      fontFamily: {
        sans: ['Lexend', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['11px', '1.4'],
        sm: ['12px', '1.4'],
        md: ['13px', '1.5'],
        lg: ['15px', '1.3'],
        xl: ['18px', '1.25'],
        '2xl': ['22px', '1.2'],
        '3xl': ['28px', '1.1'],
      },
      spacing: {
        1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '24px', 6: '32px', 7: '48px',
      },
      maxWidth: { medida: '74ch' },
      boxShadow: { niko: '0 1px 3px rgba(0,0,0,.08)' },
      borderRadius: { niko: '8px', 'niko-lg': '12px' },
    },
  },
  plugins: [],
} satisfies Config;
