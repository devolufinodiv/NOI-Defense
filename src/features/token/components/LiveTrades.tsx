import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { HashRef } from '@/components/ui/Address'
import { LiveDot } from '@/components/ui/LiveDot'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { formatRelativeTime, formatTokenAmount, formatUsd } from '@/lib/format'
import type { TokenTrade } from '../types'

/** Tracks which hashes are new since the previous poll, so only those flash. */
function useNewHashes(trades: TokenTrade[] | undefined): Set<string> {
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!trades) return
    const current = new Set(trades.map((t) => t.hash))

    // First load is not "new" — flashing every row on arrival is noise.
    if (seen.current === null) {
      seen.current = current
      return
    }

    const added = new Set([...current].filter((hash) => !seen.current!.has(hash)))
    seen.current = current
    if (added.size === 0) return

    setFresh(added)
    const timer = window.setTimeout(() => setFresh(new Set()), 900)
    return () => window.clearTimeout(timer)
  }, [trades])

  return fresh
}

/**
 * Live buy/sell feed, polled every 15s by the query hook.
 *
 * New rows glow briefly rather than animating in: this list sits mid-page, and
 * anything that changes its height would shove content under the reader's
 * cursor every fifteen seconds.
 */
export function LiveTrades({
  trades,
  loading,
  isFetching,
  symbol,
}: {
  trades?: TokenTrade[]
  loading: boolean
  isFetching: boolean
  symbol: string
}) {
  const fresh = useNewHashes(trades)

  if (loading || !trades) return <SkeletonRows rows={6} />

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-2.5">
        <LiveDot label={isFetching ? 'Updating…' : 'Live · every 15s'} />
        <span className="tabular text-2xs text-muted">{trades.length} recent</span>
      </div>

      <ul
        className="divide-y divide-hairline"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Recent trades"
      >
        {trades.map((trade) => {
          const buy = trade.direction === 'buy'
          const Icon = buy ? ArrowUpRight : ArrowDownRight
          return (
            <li
              key={trade.hash}
              className={cn(
                'flex items-center gap-3 px-5 py-3',
                fresh.has(trade.hash) && 'animate-flash',
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full border',
                  buy
                    ? 'border-positive/30 bg-positive/10 text-positive'
                    : 'border-negative/30 bg-negative/10 text-negative',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {/* Direction is spelled out, not just an arrow colour. */}
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      buy ? 'text-positive' : 'text-negative',
                    )}
                  >
                    {buy ? 'Buy' : 'Sell'}
                  </span>
                  <HashRef value={trade.wallet} to={`/wallet/${trade.wallet}`} hideExplorer />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <HashRef value={trade.hash} kind="tx" />
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="tabular text-sm font-medium text-primary">
                  {formatTokenAmount(trade.amountRaw, trade.decimals, { compact: true })}{' '}
                  <span className="font-normal text-muted">{symbol}</span>
                </div>
                <div className="tabular mt-0.5 text-xs text-muted">
                  {formatUsd(trade.valueUsd, { compact: true })} ·{' '}
                  {formatRelativeTime(trade.timestampUnix)}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
