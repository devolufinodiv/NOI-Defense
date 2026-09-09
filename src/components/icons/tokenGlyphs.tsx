import type { ReactNode } from 'react'

/**
 * Bundled token glyphs.
 *
 * Inline SVG rather than remote logo files: no network round trip, no broken
 * images, crisp at every size, and each mark inherits the theme where it should.
 * These are the geometric marks the projects publish — drawn from their
 * published proportions, not traced artwork — and are used for identity only.
 *
 * Anything not listed here falls back to a lettered chip in the project's brand
 * colour, so an unknown token still reads as a distinct entity.
 */

export interface Glyph {
  /** Background disc colour. */
  bg: string
  /** Foreground mark colour. */
  fg: string
  /** Drawn inside a 24x24 viewBox. */
  path: ReactNode
}

const ETHEREUM: Glyph = {
  bg: '#627EEA',
  fg: '#FFFFFF',
  path: (
    <>
      <path fill="currentColor" fillOpacity="0.6" d="M12 3v6.65l5.62 2.51L12 3Z" />
      <path fill="currentColor" d="M12 3 6.38 12.16 12 9.65V3Z" />
      <path fill="currentColor" fillOpacity="0.6" d="M12 16.48V21l5.62-7.78L12 16.48Z" />
      <path fill="currentColor" d="M12 21v-4.52l-5.62-3.26L12 21Z" />
      <path fill="currentColor" fillOpacity="0.2" d="m12 15.43 5.62-3.27L12 9.65v5.78Z" />
      <path fill="currentColor" fillOpacity="0.6" d="m6.38 12.16 5.62 3.27V9.65l-5.62 2.51Z" />
    </>
  ),
}

const CIRCLE_USDC: Glyph = {
  bg: '#2775CA',
  fg: '#FFFFFF',
  path: (
    <>
      <path
        fill="currentColor"
        d="M12.75 11.36c-1.6-.42-2.11-.7-2.11-1.4 0-.6.5-1.02 1.4-1.02.79 0 1.28.3 1.5.95a.35.35 0 0 0 .33.23h.72a.3.3 0 0 0 .3-.36c-.24-1.1-.98-1.8-2.05-2.02V6.6a.34.34 0 0 0-.34-.35h-.62a.34.34 0 0 0-.34.35v1.11c-1.42.2-2.32 1.06-2.32 2.25 0 1.43 1.03 1.96 2.62 2.37 1.5.38 1.97.72 1.97 1.5 0 .78-.66 1.24-1.55 1.24-1.06 0-1.55-.42-1.75-1.04a.35.35 0 0 0-.33-.24h-.75a.3.3 0 0 0-.3.36c.23 1.12 1.02 1.9 2.4 2.11v1.14c0 .2.16.35.35.35h.62c.19 0 .34-.16.34-.35v-1.14c1.48-.21 2.42-1.13 2.42-2.4 0-1.5-1.03-2.05-2.51-2.44Z"
      />
      <path
        fill="currentColor"
        d="M9.9 19.6a.4.4 0 0 1-.27.75 8.02 8.02 0 0 1 .04-15.14.4.4 0 0 1 .27.75 7.22 7.22 0 0 0-.04 13.64Zm4.47-14.4a.4.4 0 0 1 .27-.75 8.02 8.02 0 0 1-.04 15.14.4.4 0 0 1-.26-.75 7.22 7.22 0 0 0 .03-13.64Z"
      />
    </>
  ),
}

const TETHER: Glyph = {
  bg: '#26A17B',
  fg: '#FFFFFF',
  path: (
    <path
      fill="currentColor"
      d="M13.2 11.35v-1.6h3.63V7.32H7.18v2.43h3.64v1.6c-2.96.13-5.18.72-5.18 1.42 0 .7 2.22 1.28 5.18 1.42v4.5h2.38v-4.5c2.95-.14 5.17-.72 5.17-1.42 0-.7-2.22-1.29-5.17-1.42Zm0 2.45v-.01c-.08 0-.48.03-1.37.03-.71 0-1.21-.02-1.39-.03v.01c-2.75-.12-4.8-.6-4.8-1.17 0-.57 2.05-1.05 4.8-1.17v1.86c.18.01.7.04 1.4.04.86 0 1.29-.03 1.36-.04v-1.86c2.74.12 4.79.6 4.79 1.17 0 .57-2.05 1.05-4.8 1.17Z"
    />
  ),
}

const COINBASE: Glyph = {
  bg: '#0052FF',
  fg: '#FFFFFF',
  path: (
    <path
      fill="currentColor"
      d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-2.02 6.4c0-.34.27-.62.61-.62h2.82c.34 0 .61.28.61.61v4.2c0 .34-.27.62-.61.62h-2.82a.61.61 0 0 1-.61-.61V9.4Z"
    />
  ),
}

const BITCOIN: Glyph = {
  bg: '#F7931A',
  fg: '#FFFFFF',
  path: (
    <path
      fill="currentColor"
      d="M15.6 10.6c.2-1.33-.81-2.05-2.2-2.53l.45-1.8-1.1-.28-.44 1.76-.87-.21.44-1.77-1.09-.27-.45 1.8-.7-.17-1.51-.38-.3 1.17s.82.19.8.2c.44.11.52.4.51.64l-.51 2.05.12.04-.12-.03-.72 2.87c-.05.14-.19.34-.5.26.01.02-.8-.2-.8-.2L6.06 15l1.42.36.78.2-.46 1.83 1.1.27.44-1.8c.3.09.59.16.87.23l-.45 1.79 1.1.27.45-1.82c1.87.35 3.28.21 3.87-1.48.48-1.36-.02-2.15-1-2.66.72-.17 1.26-.64 1.4-1.6Zm-2.5 3.51c-.34 1.36-2.63.63-3.37.44l.6-2.4c.74.18 3.13.54 2.78 1.96Zm.34-3.53c-.31 1.24-2.21.61-2.83.45l.55-2.19c.62.16 2.6.45 2.28 1.74Z"
    />
  ),
}

const SOLANA: Glyph = {
  bg: '#131316',
  fg: '#14F195',
  path: (
    <>
      <path fill="currentColor" d="M7.3 15.6a.6.6 0 0 1 .42-.18h11.1c.27 0 .4.32.21.5l-2.34 2.3a.6.6 0 0 1-.42.18H5.17a.29.29 0 0 1-.2-.5l2.33-2.3Z" />
      <path fill="currentColor" fillOpacity="0.75" d="M7.3 6.1a.6.6 0 0 1 .42-.18h11.1c.27 0 .4.32.21.5l-2.34 2.3a.6.6 0 0 1-.42.18H5.17a.29.29 0 0 1-.2-.5L7.3 6.1Z" />
      <path fill="currentColor" fillOpacity="0.5" d="M16.7 10.83a.6.6 0 0 0-.42-.18H5.17a.29.29 0 0 0-.2.5l2.33 2.3a.6.6 0 0 0 .42.18h11.1c.27 0 .4-.32.21-.5l-2.34-2.3Z" />
    </>
  ),
}

const POLYGON: Glyph = {
  bg: '#8247E5',
  fg: '#FFFFFF',
  path: (
    <path
      fill="currentColor"
      d="M15.9 9.42a.9.9 0 0 0-.9 0l-2.1 1.23-1.43.81-2.1 1.23a.9.9 0 0 1-.9 0l-1.66-.97a.9.9 0 0 1-.45-.78V8.03c0-.32.17-.62.45-.78l1.64-.94a.9.9 0 0 1 .9 0l1.64.95c.28.16.45.46.45.78v1.23l1.43-.84V7.19a.9.9 0 0 0-.45-.78L9.4 4.68a.9.9 0 0 0-.9 0L5.45 6.44a.9.9 0 0 0-.45.78v3.55c0 .32.17.62.45.78l3.05 1.76a.9.9 0 0 0 .9 0l2.1-1.2 1.43-.84 2.1-1.2a.9.9 0 0 1 .9 0l1.64.94c.28.16.45.46.45.78v1.91c0 .32-.17.62-.45.78l-1.64.97a.9.9 0 0 1-.9 0l-1.64-.94a.9.9 0 0 1-.45-.78v-1.2l-1.43.84v1.23c0 .32.17.62.45.78l3.05 1.76a.9.9 0 0 0 .9 0l3.05-1.76a.9.9 0 0 0 .45-.78v-3.58a.9.9 0 0 0-.45-.78L15.9 9.42Z"
    />
  ),
}

const BNB: Glyph = {
  bg: '#F3BA2F',
  fg: '#FFFFFF',
  path: (
    <path
      fill="currentColor"
      d="m12 4.5 2.05 2.1-3.1 3.1L8.9 7.6 12 4.5Zm3.4 3.44 2.05 2.1-6.5 6.5-2.05-2.1 6.5-6.5ZM6.55 9.9l2.05 2.1L6.55 14.1 4.5 12l2.05-2.1Zm10.9 0L19.5 12l-2.05 2.1-2.05-2.1 2.05-2.1ZM12 13.3l2.05 2.1L12 17.5l-2.05-2.1L12 13.3Z"
    />
  ),
}

const AVALANCHE: Glyph = {
  bg: '#E84142',
  fg: '#FFFFFF',
  path: (
    <path
      fill="currentColor"
      d="M14.9 15.63h2.4c.5 0 .74 0 .9-.1a.6.6 0 0 0 .27-.47c0-.17-.12-.38-.37-.8l-3.6-6.16c-.25-.43-.38-.64-.54-.72a.6.6 0 0 0-.54 0c-.16.08-.28.29-.53.72l-.83 1.42a1.7 1.7 0 0 0 0 1.72l2.09 3.6c.25.42.37.63.53.71.16.09.35.09.54.09h-.32Zm-5.14 0h-3.4c-.5 0-.75 0-.9-.1a.6.6 0 0 1-.28-.47c0-.17.13-.38.38-.8l3.4-5.83c.25-.43.37-.64.53-.72a.6.6 0 0 1 .54 0c.16.08.29.29.54.72l.78 1.35.02.03a3.1 3.1 0 0 1 0 2.8l-1.3 2.24c-.25.42-.38.64-.54.71-.16.08-.34.08-.53.08l.76-.01Z"
    />
  ),
}

/** Keyed by uppercased symbol. */
export const TOKEN_GLYPHS: Record<string, Glyph> = {
  ETH: ETHEREUM,
  WETH: ETHEREUM,
  CBETH: COINBASE,
  USDC: CIRCLE_USDC,
  USDBC: CIRCLE_USDC,
  USDT: TETHER,
  BTC: BITCOIN,
  WBTC: BITCOIN,
  SOL: SOLANA,
  MATIC: POLYGON,
  POL: POLYGON,
  BNB: BNB,
  AVAX: AVALANCHE,
}

export function glyphFor(symbol: string): Glyph | undefined {
  return TOKEN_GLYPHS[symbol.toUpperCase()]
}
