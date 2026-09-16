import { Link } from 'react-router-dom'
import { Pin } from 'lucide-react'
import { TokenMark } from '@/components/ui/TokenMark'
import { chainMeta } from '@/config/chains'
import { formatPercent, formatUsd, truncateAddress } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { FeaturedToken } from './queries'

/**
 * One featured token, as a tile.
 *
 * This was a tall card carrying a headline price, a two-column stat grid, a
 * sentence of safety copy and a timestamp — five blocks of furniture around
 * four facts. At that size three tokens filled the screen and none of them were
 * quicker to read for it.
 *
 * What survives is what someone actually scans a row of tiles for: which token,
 * what it costs, which way it moved, and whether anything is wrong with it. The
 * safety finding is a dot with the full sentence on hover and for screen
 * readers, so the detail is still there without a paragraph on every tile.
 *
 * Figures never recorded stay absent rather than becoming zero.
 */
export function FeaturedScanCard({ token }: { token: FeaturedToken }) {
  const chain = chainMeta(token.chainId)
  const label = token.symbol || truncateAddress(token.address)
  const safety = safetyOf(token)

  return (
    <Link
      to={`/token/${token.address}?chain=${token.chainId}`}
      className="glass-panel group flex items-center gap-3 rounded-xl border border-hairline p-3 transition-[transform,border-color] duration-180 hover:-translate-y-0.5 hover:border-hairline-strong"
    >
      <TokenMark symbol={token.symbol || '?'} size="md" chainId={token.chainId} address={token.address} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-primary">{label}</span>
          {token.pinned ? (
            <Pin
              className="h-3 w-3 shrink-0 text-muted"
              strokeWidth={2}
              aria-label="Pinned by an admin"
            />
          ) : null}
          <span
            className={cn('ml-auto h-1.5 w-1.5 shrink-0 rounded-full', safety.dot)}
            title={safety.text}
            aria-label={safety.text}
            role="img"
          />
        </span>

        <span className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="tabular truncate text-sm text-secondary">
            {token.priceUsd === null ? (
              <span className="text-muted">No price</span>
            ) : (
              formatUsd(token.priceUsd)
            )}
          </span>
          {token.change24h === null ? null : (
            <span
              className={cn(
                'tabular shrink-0 text-xs',
                token.change24h >= 0 ? 'text-positive' : 'text-negative',
              )}
            >
              {formatPercent(token.change24h, { signed: true })}
            </span>
          )}
        </span>

        <span className="mt-0.5 block truncate text-[11px] text-muted">
          {chain ? `${chain.label} · ` : ''}
          {token.liquidityUsd === null
            ? 'depth not recorded'
            : `${formatUsd(token.liquidityUsd, { compact: true })} depth`}
          {' · '}
          {token.scanCount === 1 ? 'scanned once' : `scanned ${token.scanCount.toLocaleString('en-US')}×`}
        </span>
      </span>
    </Link>
  )
}

/**
 * The strongest thing the scan found, as a colour plus the sentence behind it.
 *
 * A check that never ran gets its own muted state — it is not a pass, and it
 * must not look like one.
 */
function safetyOf(token: FeaturedToken): { dot: string; text: string } {
  if (token.isHoneypot === true) {
    return { dot: 'bg-negative', text: 'A test sale failed — you may not be able to sell this.' }
  }
  if (token.sellTax !== null && token.sellTax >= 10) {
    return { dot: 'bg-warning', text: `Selling costs a ${token.sellTax.toFixed(0)}% fee.` }
  }
  if (token.isHoneypot === false) {
    return { dot: 'bg-positive', text: 'A test buy and sale both went through.' }
  }
  if (token.sourceVerified === false) {
    return { dot: 'bg-warning', text: 'The code behind this token has not been published.' }
  }
  return { dot: 'bg-muted', text: 'Safety checks did not run on this network.' }
}
