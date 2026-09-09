/**
 * NOI Defense — design tokens (single source of truth).
 *
 * Plain JS on purpose: imported by BOTH tailwind.config.js (Node, no TS
 * transform) and application code (typed via the tokens.d.ts sidecar). Charts
 * and the graph canvas need raw hex at runtime, which CSS variables can't give.
 *
 * Direction: chrome on black. A neutral monochrome system — no blue cast, no
 * hue in the accent — so the only chromatic signals are semantic: green gain,
 * red loss, amber caution, plus token brand marks for identity. Surfaces are
 * glass in both modes; headings get a brushed-metal gradient.
 *
 * Every text/surface pairing in BOTH modes is verified at >= 4.5:1 (WCAG AA
 * normal text). Tightest pair: muted-on-raised, 5.02 dark / 4.80 light.
 */

/** @type {Record<'dark'|'light', Record<string, string>>} */
export const palette = {
  dark: {
    base: '#08080A',
    surface: '#0E0E11',
    card: '#131316',
    raised: '#1B1B1F',
    border: '#232327',
    borderStrong: '#33333A',

    textPrimary: '#F5F5F7',
    textSecondary: '#A8A8B0',
    textMuted: '#8A8A93',

    /** Solid fill for the single primary action per view. */
    accent: '#F5F5F7',
    /** Foreground on `accent`. */
    accentOn: '#08080A',
    /** The accent used as text or icon on a normal surface. */
    accentText: '#C9C9D1',

    positive: '#3DD68C',
    negative: '#F2555F',
    warning: '#F0A93B',

    /** Ambient bloom. Neutral — a light source, not a colour wash. */
    glow: '#9A9AA4',
    /** Top inner highlight that gives surfaces their lift. */
    shadowTop: '#FFFFFF',

    /** Ash ramp — the graphite the gradients are built from. */
    ash0: '#050506',
    ash1: '#0C0C0F',
    ash2: '#16161A',
    ash3: '#242429',

    /** Brushed-metal ramp for display headings. */
    chrome0: '#FFFFFF',
    chrome1: '#D6D6DE',
    chrome2: '#8C8C97',
    chrome3: '#5A5A63',
  },

  light: {
    base: '#F4F4F6',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    raised: '#EDEDF1',
    border: '#E3E3E8',
    borderStrong: '#CFCFD6',

    textPrimary: '#121214',
    textSecondary: '#55555E',
    textMuted: '#67676F',

    accent: '#131316',
    accentOn: '#FFFFFF',
    accentText: '#3A3A42',

    // Darker than their dark-mode counterparts: the same green fails AA on
    // white. Semantic colour is re-picked per mode, never reused.
    positive: '#0F7B4F',
    negative: '#C0243A',
    warning: '#8A5A00',

    glow: '#B4B4BE',
    shadowTop: '#FFFFFF',

    // The ash ramp inverts to a paper ramp so the same gradient utilities read
    // correctly in both modes instead of being dark-only.
    ash0: '#FFFFFF',
    ash1: '#F7F7F9',
    ash2: '#EFEFF3',
    ash3: '#E3E3E9',

    // Chrome inverts too: dark metal on light ground.
    chrome0: '#101013',
    chrome1: '#33333B',
    chrome2: '#6E6E79',
    chrome3: '#9A9AA4',
  },
}

/**
 * Token brand marks. Real project colours, used for identity only — never to
 * encode gain/loss, which is what positive/negative are for.
 */
export const tokenBrand = {
  WETH: '#627EEA',
  ETH: '#627EEA',
  USDC: '#2775CA',
  USDT: '#26A17B',
  AERO: '#0433FF',
  DEGEN: '#A36EFD',
  cbETH: '#0052FF',
  BTC: '#F7931A',
  SOL: '#14F195',
  ARB: '#2D374B',
  OP: '#FF0420',
  MATIC: '#8247E5',
  BNB: '#F3BA2F',
  AVAX: '#E84142',
  DEFAULT: '#7E7E88',
}

export function brandColor(symbol) {
  return tokenBrand[symbol] ?? tokenBrand.DEFAULT
}

/** Network brand colours, keyed by chain id. Identity only. */
export const chainBrand = {
  1: '#627EEA',       // Ethereum
  8453: '#0052FF',    // Base
  42161: '#12AAFF',   // Arbitrum
  10: '#FF0420',      // Optimism
  137: '#8247E5',     // Polygon
  56: '#F3BA2F',      // BNB Chain
  43114: '#E84142',   // Avalanche
  534352: '#EBC28E',  // Scroll
  324: '#8C8DFC',     // zkSync
  84532: '#0052FF',   // Base Sepolia
  11155111: '#627EEA',// Sepolia
  DEFAULT: '#7E7E88',
}

export function chainColor(chainId) {
  return chainBrand[chainId] ?? chainBrand.DEFAULT
}

/** Chart palette for a given mode. Consumed by Recharts and the graph canvas. */
export function chartTokens(mode) {
  const p = palette[mode] ?? palette.dark
  return {
    grid: p.border,
    axis: p.textMuted,
    line: p.accentText,
    positive: p.positive,
    negative: p.negative,
    neutral: [p.accentText, p.textMuted, p.positive, p.warning],
  }
}

export const font = {
  /**
   * One family throughout. Inter carries the technical-precision register this
   * product needs and has the tabular figures the data tables depend on.
   */
  sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  /**
   * Hex only — addresses and transaction hashes. Never prices: amounts sit in
   * the sans face with tabular figures, but truncated hex must read as code.
   */
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
}

/** `#RRGGBB` -> `"R G B"`, the form Tailwind needs for `rgb(var(--x) / <alpha>)`. */
export function toRgbTriplet(hex) {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16))
  return `${r} ${g} ${b}`
}

/** CSS custom property name for a token key. */
export function cssVar(key) {
  return `--c-${key.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`)}`
}
