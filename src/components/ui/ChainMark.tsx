import { chainColor } from '@/design/tokens'
import { cn } from '@/lib/cn'
import { chainMeta } from '@/config/chains'
import { glyphFor } from '@/components/icons/tokenGlyphs'

const SIZES = {
  xs: 'h-4 w-4 text-[8px]',
  sm: 'h-5 w-5 text-[9px]',
  md: 'h-6 w-6 text-[10px]',
} as const

/**
 * Network identity mark.
 *
 * Chains whose native asset has a bundled glyph (Ethereum, Polygon, BNB,
 * Avalanche) get it; L2s that settle to ETH would be indistinguishable from
 * each other with the ETH diamond, so they get a monogram in the network's own
 * brand colour instead. Being distinguishable matters more here than being
 * decorative — picking the wrong network is a real failure mode.
 */
export function ChainMark({
  chainId,
  size = 'sm',
  className,
}: {
  chainId: number
  size?: keyof typeof SIZES
  className?: string
}) {
  const meta = chainMeta(chainId)
  const color = chainColor(chainId)
  const label = meta?.label ?? '?'

  // Only L1s take the native-asset glyph; L2s must not all render as ETH.
  const isL1 = chainId === 1 || chainId === 137 || chainId === 56 || chainId === 43114
  const glyph = isL1 && meta ? glyphFor(meta.nativeSymbol) : undefined

  if (glyph) {
    return (
      <span
        aria-hidden
        className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full', SIZES[size], className)}
        style={{ backgroundColor: glyph.bg, color: glyph.fg }}
      >
        <svg viewBox="0 0 24 24" className="h-full w-full">
          {glyph.path}
        </svg>
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold', SIZES[size], className)}
      style={{
        color,
        backgroundColor: `${color}26`,
        boxShadow: `inset 0 0 0 1px ${color}5c`,
      }}
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  )
}
