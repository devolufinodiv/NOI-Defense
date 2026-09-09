import plugin from 'tailwindcss/plugin'
import { palette, font, toRgbTriplet, cssVar } from './src/design/tokens.js'

/** `rgb(var(--c-x) / <alpha-value>)` so opacity modifiers keep working. */
const v = (key) => `rgb(var(${cssVar(key)}) / <alpha-value>)`

const vars = (mode) =>
  Object.fromEntries(
    Object.entries(palette[mode]).map(([key, hex]) => [cssVar(key), toRgbTriplet(hex)]),
  )

/**
 * Emits the palette as CSS custom properties for both modes.
 *
 * Light is the `:root` default; dark applies when the user's OS asks for it
 * (unless they explicitly chose light) or when `data-theme="dark"` is set. That
 * ordering means an explicit choice always beats the OS preference, and the
 * page never flashes the wrong theme before JS runs.
 */
const themeVars = plugin(({ addBase }) => {
  addBase({
    ':root': { ...vars('light'), 'color-scheme': 'light' },
    '@media (prefers-color-scheme: dark)': {
      ':root:not([data-theme="light"])': { ...vars('dark'), 'color-scheme': 'dark' },
    },
    ':root[data-theme="dark"]': { ...vars('dark'), 'color-scheme': 'dark' },
    ':root[data-theme="light"]': { ...vars('light'), 'color-scheme': 'light' },
  })
})

/**
 * NOI Defense — monochrome instrument.
 *
 * Token naming: `base`/`surface`/`card`/`raised` are registered under
 * `backgroundColor` (not the global `colors` map) so `bg-card` exists WITHOUT
 * hijacking Tailwind's `text-base` font-size utility. The same values stay
 * reachable elsewhere as `surface-*`.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Escape hatch for the rare rule that can't be expressed as a token swap.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        surface: {
          base: v('base'),
          DEFAULT: v('surface'),
          card: v('card'),
          raised: v('raised'),
        },
        accent: {
          DEFAULT: v('accent'),
          on: v('accentOn'),
          text: v('accentText'),
        },
        positive: v('positive'),
        negative: v('negative'),
        warning: v('warning'),
        primary: v('textPrimary'),
        secondary: v('textSecondary'),
        muted: v('textMuted'),
        hairline: v('border'),
        'hairline-strong': v('borderStrong'),
        glow: v('glow'),
        ash: {
          0: v('ash0'),
          1: v('ash1'),
          2: v('ash2'),
          3: v('ash3'),
        },
        chrome: {
          0: v('chrome0'),
          1: v('chrome1'),
          2: v('chrome2'),
          3: v('chrome3'),
        },
      },
      backgroundColor: {
        base: v('base'),
        surface: v('surface'),
        card: v('card'),
        raised: v('raised'),
      },
      borderColor: {
        hairline: v('border'),
        DEFAULT: v('border'),
      },
      fontFamily: { sans: font.sans, mono: font.mono },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        display: ['3.25rem', { lineHeight: '1.03', letterSpacing: '-0.035em' }],
        'display-sm': ['2.25rem', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        quote: ['2.125rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
      },
      letterSpacing: {
        tightest: '-0.035em',
        heading: '-0.02em',
        label: '0.06em',
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
      },
      boxShadow: {
        // Depth from a lifted top edge, not a drop shadow.
        card: 'inset 0 1px 0 0 rgb(var(--c-shadow-top) / 0.05), 0 1px 2px 0 rgb(0 0 0 / 0.06)',
        lifted:
          'inset 0 1px 0 0 rgb(var(--c-shadow-top) / 0.08), 0 8px 28px -12px rgb(0 0 0 / 0.28)',
        nav: 'inset 0 1px 0 0 rgb(var(--c-shadow-top) / 0.09), 0 2px 8px -2px rgb(0 0 0 / 0.16)',
        glass:
          'inset 0 1px 0 0 rgb(var(--c-shadow-top) / 0.10), inset 0 -1px 0 0 rgb(0 0 0 / 0.22), 0 18px 44px -20px rgb(0 0 0 / 0.55)',
        'glass-lift':
          'inset 0 1px 0 0 rgb(var(--c-shadow-top) / 0.16), inset 0 -1px 0 0 rgb(0 0 0 / 0.24), 0 28px 64px -24px rgb(0 0 0 / 0.68)',
      },
      backgroundImage: {
        'glow-corner':
          'radial-gradient(60rem 40rem at 12% -8%, rgb(var(--c-glow) / 0.20) 0%, rgb(var(--c-glow) / 0.07) 38%, transparent 70%)',
        'sheen-active':
          'linear-gradient(180deg, rgb(var(--c-shadow-top) / 0.10) 0%, rgb(var(--c-shadow-top) / 0.03) 45%, transparent 100%)',
        'card-top':
          'linear-gradient(180deg, rgb(var(--c-shadow-top) / 0.04) 0%, transparent 42%)',

        // Ash gradients. Two stacked layers give graphite real depth: a broad
        // diagonal wash plus a soft top-light, so large surfaces never read as
        // one flat grey.
        'ash-panel':
          'linear-gradient(158deg, rgb(var(--c-ash-2) / 0.92) 0%, rgb(var(--c-ash-1) / 0.96) 46%, rgb(var(--c-ash-0) / 0.98) 100%)',
        'ash-card':
          'linear-gradient(160deg, rgb(var(--c-shadow-top) / 0.055) 0%, rgb(var(--c-shadow-top) / 0.012) 38%, rgb(var(--c-shadow-top) / 0) 72%)',
        'ash-deep':
          'radial-gradient(120% 90% at 50% -20%, rgb(var(--c-ash-3) / 0.55) 0%, rgb(var(--c-ash-1) / 0.6) 42%, rgb(var(--c-ash-0) / 0.85) 100%)',
        // Hairline that catches light at the top and fades away at the bottom —
        // the detail that separates real glass from a flat translucent box.
        'edge-light':
          'linear-gradient(180deg, rgb(var(--c-shadow-top) / 0.22) 0%, rgb(var(--c-shadow-top) / 0.06) 32%, rgb(var(--c-shadow-top) / 0) 68%)',

        // Brushed metal for display headings. Two highlight bands and a
        // shadowed base give the type an actual sheen instead of a flat tint.
        chrome:
          'linear-gradient(168deg, rgb(var(--c-chrome-0)) 0%, rgb(var(--c-chrome-1)) 26%, rgb(var(--c-chrome-2)) 52%, rgb(var(--c-chrome-1)) 74%, rgb(var(--c-chrome-3)) 100%)',
        'chrome-soft':
          'linear-gradient(180deg, rgb(var(--c-chrome-0)) 0%, rgb(var(--c-chrome-1)) 55%, rgb(var(--c-chrome-2)) 100%)',

        // Faint engineering grid, used behind hero sections.
        'grid-fine':
          'linear-gradient(to right, rgb(var(--c-border) / 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--c-border) / 0.7) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-fine': '56px 56px',
      },
      transitionDuration: { DEFAULT: '180ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      keyframes: {
        scan: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        flash: {
          '0%': { backgroundColor: 'rgb(var(--c-accent-text) / 0.20)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgb(var(--c-positive) / 0.35)' },
          '50%': { opacity: '0.65', boxShadow: '0 0 0 5px rgb(var(--c-positive) / 0)' },
        },
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'gauge-sweep': {
          '0%': { strokeDashoffset: 'var(--gauge-circumference)' },
          '100%': { strokeDashoffset: 'var(--gauge-offset)' },
        },
      },
      animation: {
        scan: 'scan 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        flash: 'flash 700ms ease-out 1',
        'pulse-dot': 'pulse-dot 2.4s ease-in-out infinite',
        'rise-in': 'rise-in 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'gauge-sweep': 'gauge-sweep 900ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
      },
    },
  },
  plugins: [themeVars],
}
