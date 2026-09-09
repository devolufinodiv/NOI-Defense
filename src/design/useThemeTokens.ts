import { useMemo } from 'react'
import { chartTokens, palette, type ChartTokens, type Palette } from '@/design/tokens'
import { useResolvedTheme } from '@/store/theme'

/**
 * Raw hex for the active theme.
 *
 * Components styled with Tailwind should use the token classes and never call
 * this — the CSS variables already switch. It exists for the consumers that
 * cannot read CSS: Recharts props and the force-graph canvas, both of which
 * take colour as JS values.
 */
export function useThemeTokens(): { mode: 'dark' | 'light'; color: Palette; chart: ChartTokens } {
  const mode = useResolvedTheme()
  return useMemo(
    () => ({ mode, color: palette[mode], chart: chartTokens(mode) }),
    [mode],
  )
}
