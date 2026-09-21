import { Badge } from '@/components/ui/Badge'
import { HashRef } from '@/components/ui/Address'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { formatPercent, formatRelativeTime, formatTokenAmount } from '@/lib/format'
import type { EarlyBuyer, HoldStatus } from '../types'

const STATUS_META: Record<HoldStatus, { label: string; tone: 'positive' | 'negative' | 'warning' }> =
  {
    holding: { label: 'Still holding', tone: 'positive' },
    partial: { label: 'Partial exit', tone: 'warning' },
    sold: { label: 'Sold', tone: 'negative' },
  }

function columns(symbol: string): Array<Column<EarlyBuyer>> {
  return [
    {
      key: 'rank',
      header: '#',
      width: '56px',
      sortValue: (buyer) => buyer.rank,
      render: (buyer) => <span className="tabular text-xs text-muted">{buyer.rank}</span>,
    },
    {
      key: 'wallet',
      header: 'Wallet',
      render: (buyer) => (
        <HashRef value={buyer.address} to={`/wallet/${buyer.address}`} hideExplorer />
      ),
    },
    {
      key: 'when',
      header: 'Bought',
      hideOnMobile: true,
      sortValue: (buyer) => buyer.boughtAtUnix ?? 0,
      render: (buyer) => (
        <span className="tabular text-secondary">
          {/* A delivery without a block timestamp gives us no time to show,
              and a dash says that better than a fabricated one. */}
          {buyer.boughtAtUnix === null ? '—' : formatRelativeTime(buyer.boughtAtUnix)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'First buy',
      align: 'right',
      sortValue: (buyer) => buyer.amountRaw,
      render: (buyer) => (
        <span className="tabular font-medium text-primary">
          {formatTokenAmount(buyer.amountRaw, buyer.decimals, { compact: true })}{' '}
          <span className="font-normal text-muted">{symbol}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      sortValue: (buyer) => buyer.remainingPercent,
      render: (buyer) => {
        const meta = STATUS_META[buyer.status]
        return (
          <span className="inline-flex items-center gap-2">
            {buyer.status === 'partial' ? (
              <span className="tabular hidden text-2xs text-muted sm:inline">
                {formatPercent(buyer.remainingPercent)} left
              </span>
            ) : null}
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </span>
        )
      },
    },
  ]
}

/**
 * The first addresses ever to receive the token, and what became of them.
 *
 * Status is measured against the most each address ever held, not against its
 * first buy: someone who bought more before selling would otherwise read as
 * still holding. There is no buy price column — we store transfers, not the
 * price at the time, and an invented one would be the most believable number
 * on the page.
 *
 * Status is a labelled badge, never a bare colour — "Sold" and "Still holding"
 * must be distinguishable in greyscale, and this table is the one people
 * screenshot.
 */
export function EarlyBuyers({
  buyers,
  loading,
  symbol,
}: {
  buyers?: EarlyBuyer[]
  loading: boolean
  symbol: string
}) {
  if (loading || !buyers) return <SkeletonRows rows={6} />

  return (
    <DataTable
      columns={columns(symbol)}
      rows={buyers}
      rowKey={(buyer) => buyer.txHash}
      empty="No buys recorded from the creation block."
    />
  )
}
