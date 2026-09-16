import { useState } from 'react'
import { brandColor } from '@/design/tokens'
import { cn } from '@/lib/cn'
import { glyphFor } from '@/components/icons/tokenGlyphs'
import { tokenLogoUrl } from '@/lib/tokenLogo'

const SIZES = {
  xs: { box: 'h-6 w-6', text: 'text-[9px]' },
  sm: { box: 'h-7 w-7', text: 'text-[10px]' },
  md: { box: 'h-9 w-9', text: 'text-xs' },
  lg: { box: 'h-11 w-11', text: 'text-sm' },
} as const

export interface TokenMarkProps {
  symbol: string
  size?: keyof typeof SIZES
  /**
   * Remote logo, when the indexer supplies one. Tried first; on failure the
   * component silently falls back rather than showing a broken image.
   */
  logoUrl?: string | null
  /**
   * Where the token lives. Given both, a real logo is derived from the address
   * without needing one to be stored or passed in.
   */
  chainId?: number
  address?: string | null
  className?: string
}

/**
 * Token identity mark.
 *
 * Three tiers, in order:
 *  1. A real logo — passed in, or derived from `chainId` + `address`.
 *  2. A bundled glyph — inline SVG for the tokens we know, in the project's
 *     brand colour. No network round trip and never a broken image.
 *  3. A lettered chip tinted with the brand colour, so an unknown token still
 *     reads as its own distinct entity.
 *
 * Brand colour is identity only and never encodes gain or loss — that is what
 * the positive/negative tokens are for.
 */
export function TokenMark({
  symbol,
  size = 'md',
  logoUrl,
  chainId,
  address,
  className,
}: TokenMarkProps) {
  const [remoteFailed, setRemoteFailed] = useState(false)
  const dims = SIZES[size]
  const glyph = glyphFor(symbol)
  const brand = brandColor(symbol)

  // An explicit logo wins; otherwise derive one from the address.
  const remote = logoUrl ?? tokenLogoUrl(chainId, address)

  const shell = cn('shrink-0 overflow-hidden rounded-full', dims.box, className)

  if (remote && !remoteFailed) {
    return (
      <img
        src={remote}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        onError={() => setRemoteFailed(true)}
        className={cn(shell, 'object-cover')}
        style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--c-border))' }}
      />
    )
  }

  if (glyph) {
    return (
      <span
        aria-hidden
        className={cn(shell, 'grid place-items-center')}
        style={{ backgroundColor: glyph.bg, color: glyph.fg }}
      >
        <svg viewBox="0 0 24 24" className="h-full w-full">
          {glyph.path}
        </svg>
      </span>
    )
  }

  // Two characters, not three: "AER" reads as a truncation, "AE" as a monogram.
  return (
    <span
      aria-hidden
      className={cn(shell, 'grid place-items-center font-semibold', dims.text)}
      style={{
        color: brand,
        backgroundColor: `${brand}24`,
        boxShadow: `inset 0 0 0 1px ${brand}59`,
      }}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  )
}
