import type { Config } from 'tailwindcss'

/**
 * Tailwind theme — 把 globals.css 的 CSS 变量映射成 Tailwind 工具类
 * PRD §1.1-1.5 全部 token 化；K3 升级视觉只动 globals.css / tailwind.config.ts
 * 组件层用 bg-bg-canvas / text-ink-primary / rounded-md 等，不要写硬编码颜色
 */

const config: Config = {
  content: ['./app/**/*.{ts,tsx,mdx}', './components/**/*.{ts,tsx,mdx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        overlay: 'var(--bg-overlay)',
        hairline: 'var(--border-hairline)',
        ink: {
          DEFAULT: 'var(--ink-primary)',
          primary: 'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          tertiary: 'var(--ink-tertiary)',
        },
        sage: {
          DEFAULT: 'var(--accent-sage)',
          soft: 'var(--accent-sage-soft)',
        },
        clay: {
          DEFAULT: 'var(--accent-clay)',
          soft: 'var(--accent-clay-soft)',
        },
        honey: 'var(--accent-honey)',
        confidence: {
          low: 'var(--confidence-low)',
          mid: 'var(--confidence-mid)',
        },
      },
      borderColor: {
        DEFAULT: 'var(--border-hairline)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      fontSize: {
        display: ['var(--font-display)', { lineHeight: '1.3' }],
        h1: ['var(--font-h1)', { lineHeight: '1.3' }],
        h2: ['var(--font-h2)', { lineHeight: '1.4' }],
        h3: ['var(--font-h3)', { lineHeight: '1.4' }],
        body: ['var(--font-body)', { lineHeight: '1.7' }],
        small: ['var(--font-small)', { lineHeight: '1.55' }],
        micro: ['var(--font-micro)', { lineHeight: '1.5' }],
      },
      fontFamily: {
        sans: [
          'PingFang SC',
          'Microsoft YaHei',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        display: [
          '"LXGW WenKai"',
          '"霞鹜文楷"',
          'Source Han Serif',
          'serif',
        ],
        num: [
          'Inter',
          '"SF Pro Display"',
          'system-ui',
          'sans-serif',
        ],
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        8: 'var(--space-8)',
        10: 'var(--space-10)',
        12: 'var(--space-12)',
        16: 'var(--space-16)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-cubic': 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
      transitionDuration: {
        tap: '120ms',
        enter: '240ms',
        leave: '160ms',
        page: '320ms',
      },
      keyframes: {
        'enter-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'enter-up': 'enter-up 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer': 'shimmer 1200ms ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
