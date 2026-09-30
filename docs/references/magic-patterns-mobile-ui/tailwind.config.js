export default {
  content: [
    './*.{ts,tsx}',
    './{components,pages,contexts,data,utils,types}/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        shell: 'var(--shell)',
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          alt: 'var(--surface-2)',
        },
        line: 'var(--line)',
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-2)',
          faint: 'var(--ink-3)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
        },
        iris: { soft: 'var(--iris-soft)', ink: 'var(--iris-ink)' },
        azure: { soft: 'var(--azure-soft)', ink: 'var(--azure-ink)' },
        warm: { soft: 'var(--warm-soft)', ink: 'var(--warm-ink)' },
        moss: { soft: 'var(--moss-soft)', ink: 'var(--moss-ink)' },
        ruby: { soft: 'var(--ruby-soft)', ink: 'var(--ruby-ink)' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        phone: '44px',
      },
    },
  },
  plugins: [],
}

