export type ThemeMode = 'dark' | 'light'

export interface Palette {
  base: string
  surface: string
  card: string
  raised: string
  border: string
  borderStrong: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  accentOn: string
  accentText: string
  positive: string
  negative: string
  warning: string
  glow: string
  shadowTop: string
  ash0: string
  ash1: string
  ash2: string
  ash3: string
  chrome0: string
  chrome1: string
  chrome2: string
  chrome3: string
}

export declare const palette: Record<ThemeMode, Palette>
export declare const tokenBrand: Record<string, string>
export declare function brandColor(symbol: string): string
export declare const chainBrand: Record<string, string>
export declare function chainColor(chainId: number): string

export interface ChartTokens {
  grid: string
  axis: string
  line: string
  positive: string
  negative: string
  neutral: string[]
}
export declare function chartTokens(mode: ThemeMode): ChartTokens

export declare const font: { sans: string[]; mono: string[] }
export declare function toRgbTriplet(hex: string): string
export declare function cssVar(key: string): string
