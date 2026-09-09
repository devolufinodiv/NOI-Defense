import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { CopyButton } from '@/components/ui/CopyButton'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatTokenAmount, formatPercent, truncateAddress } from '@/lib/format'
import type { Holder } from '../types'

/**
 * Top-10 holder distribution as a horizontal bar chart.
 *
 * Bars are scaled to the largest holder, not to 100%, so differences between
 * ranks 4 and 9 stay visible — against a 100% axis the tail flattens into
 * indistinguishable slivers and the chart stops informing.
 */
export function HolderDistribution({
  holders,
  loading,
  symbol,
}: {
  holders?: Holder[]
  loading: boolean
  symbol: string
}) {
  if (loading || !holders) {
    return (
      <ul className="space-y-3.5">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </li>
        ))}
      </ul>
    )
  }

  const max = Math.max(...holders.map((h) => h.percentOfSupply), 1)
  const top10Total = holders.reduce((sum, h) => sum + h.percentOfSupply, 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>
          Top 10 hold{' '}
          <span className="tabular font-semibold text-primary">
            {formatPercent(top10Total)}
          </span>{' '}
          of supply
        </span>
        <Badge tone={top10Total > 60 ? 'negative' : top10Total > 40 ? 'warning' : 'positive'}>
          {top10Total > 60 ? 'Highly concentrated' : top10Total > 40 ? 'Concentrated' : 'Distributed'}
        </Badge>
      </div>

      <ul className="space-y-3.5">
        {holders.map((holder) => {
          const label = truncateAddress(holder.address)
          return (
            <li key={holder.address}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="tabular w-6 shrink-0 text-xs text-muted">
                    #{holder.rank}
                  </span>

                  {/* Contracts get no wallet-trace link: tracing a pool's P&L
                      would be meaningless, so we don't offer the affordance. */}
                  {holder.isContract ? (
                    <span className="font-mono text-xs text-secondary">{label}</span>
                  ) : (
                    <Link
                      to={`/wallet/${holder.address}`}
                      className="-my-2 py-2 font-mono text-xs text-primary transition-colors duration-180 hover:text-accent-text"
                    >
                      {label}
                    </Link>
                  )}

                  <CopyButton value={holder.address} label="Copy holder address" />

                  {holder.label ? (
                    <Badge tone={holder.isContract ? 'neutral' : 'accent'}>{holder.label}</Badge>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-baseline gap-3">
                  <span className="tabular hidden text-xs text-muted sm:inline">
                    {formatTokenAmount(holder.balanceRaw, holder.decimals, { compact: true })}{' '}
                    {symbol}
                  </span>
                  <span className="tabular text-sm font-semibold text-primary">
                    {formatPercent(holder.percentOfSupply)}
                  </span>
                </div>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    holder.percentOfSupply > max * 0.6 ? 'bg-warning' : 'bg-accent-text',
                  )}
                  style={{ width: `${(holder.percentOfSupply / max) * 100}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
