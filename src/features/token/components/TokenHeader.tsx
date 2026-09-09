import { Card } from '@/components/ui/Card'
import { Badge, DeltaPill } from '@/components/ui/Badge'
import { HashRef } from '@/components/ui/Address'
import { TokenMark } from '@/components/ui/TokenMark'
import { Quote } from '@/components/ui/Stat'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { formatUsd, formatRelativeTime, splitQuote } from '@/lib/format'
import { HealthGauge } from './HealthGauge'
import type { TokenOverview } from '../types'

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-1 truncate text-base font-semibold text-primary">{value}</div>
    </div>
  )
}

/**
 * Identity, price and the health gauge.
 *
 * On mobile the gauge stacks below the identity block rather than shrinking —
 * a gauge small enough to sit beside text on a phone is unreadable.
 */
export function TokenHeader({
  overview,
  loading,
}: {
  overview?: TokenOverview
  loading: boolean
}) {
  if (loading || !overview) {
    return (
      <Card>
        <div className="flex flex-col gap-8 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="space-y-2">
                <SkeletonText width="w-48" />
                <SkeletonText width="w-32" />
              </div>
            </div>
            <Skeleton className="h-10 w-56" />
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <SkeletonText width="w-16" />
                  <SkeletonText width="w-20" />
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="h-[200px] w-[200px] shrink-0 rounded-full" />
        </div>
      </Card>
    )
  }

  const quote = splitQuote(overview.priceUsd)

  return (
    <Card>
      <div className="flex flex-col gap-8 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <TokenMark symbol={overview.symbol} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-heading text-primary">
                  {overview.name}
                </h1>
                <Badge>{overview.symbol}</Badge>
                <Badge tone={overview.verified ? 'positive' : 'warning'}>
                  {overview.verified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
              <div className="mt-1.5">
                <HashRef value={overview.address} kind="token" chainId={overview.chainId} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-3">
            <Quote whole={quote.whole} fraction={quote.fraction} />
            <DeltaPill value={overview.change24h} className="mb-1.5" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Metric label="Market cap" value={formatUsd(overview.marketCapUsd, { compact: true })} />
            <Metric label="Liquidity" value={formatUsd(overview.liquidityUsd, { compact: true })} />
            <Metric label="Holders" value={overview.holders.toLocaleString('en-US')} />
            <Metric label="Deployed" value={formatRelativeTime(overview.createdAtUnix)} />
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <HealthGauge score={overview.healthScore} />
        </div>
      </div>
    </Card>
  )
}
