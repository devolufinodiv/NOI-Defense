import { Link, useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, DeltaPill } from '@/components/ui/Badge'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { TokenMark } from '@/components/ui/TokenMark'
import { ChainMark } from '@/components/ui/ChainMark'
import { TermLabel } from '@/components/ui/Explain'
import { chainMeta } from '@/config/chains'
import { formatRelativeTime, formatUsd, truncateAddress } from '@/lib/format'
import { useMarketOverview, type MarketToken } from './queries'

/**
 * A one-word read on each row, so the table is scannable without interpreting
 * four numbers per line. Mirrors the scan verdict's thresholds, deliberately:
 * the same token must not be "risky" here and "fine" on its own page.
 */
function rowVerdict(token: MarketToken): { label: string; tone: 'positive' | 'warning' | 'negative' } {
  if (token.isHoneypot === true) return { label: "Can't sell", tone: 'negative' }
  if (token.sellTax !== null && token.sellTax >= 20) return { label: 'High fee', tone: 'negative' }
  if (token.liquidityUsd !== null && token.liquidityUsd < 10_000) {
    return { label: 'Very thin', tone: 'negative' }
  }
  if (token.liquidityUsd !== null && token.liquidityUsd < 50_000) {
    return { label: 'Thin', tone: 'warning' }
  }
  if (token.sellTax !== null && token.sellTax >= 10) return { label: 'Notable fee', tone: 'warning' }
  return { label: 'Looks OK', tone: 'positive' }
}

const columns: Array<Column<MarketToken>> = [
  {
    key: 'token',
    header: 'Token',
    sortValue: (t) => t.symbol || t.name,
    render: (token) => (
      <div className="flex min-w-0 items-center gap-3">
        <TokenMark
          symbol={token.symbol || token.name || '?'}
          size="sm"
          chainId={token.chainId}
          address={token.address}
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-primary">
            {token.name || token.symbol || truncateAddress(token.address)}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <ChainMark chainId={token.chainId} size="xs" />
            <span className="text-2xs text-muted">
              {chainMeta(token.chainId)?.label ?? token.chainId}
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: 'verdict',
    header: 'Read',
    render: (token) => {
      const v = rowVerdict(token)
      return <Badge tone={v.tone}>{v.label}</Badge>
    },
  },
  {
    key: 'price',
    header: 'Price',
    align: 'right',
    sortValue: (t) => t.priceUsd ?? -1,
    render: (token) => (
      <span className="tabular text-sm font-medium text-primary">
        {token.priceUsd !== null ? formatUsd(token.priceUsd) : <span className="text-muted">—</span>}
      </span>
    ),
  },
  {
    key: 'change',
    header: '24h',
    align: 'right',
    hideOnMobile: true,
    sortValue: (t) => t.change24h ?? 0,
    render: (token) =>
      token.change24h !== null ? (
        <DeltaPill value={token.change24h} showIcon={false} />
      ) : (
        <span className="text-xs text-muted">—</span>
      ),
  },
  {
    key: 'liquidity',
    header: <TermLabel topic="liquidity">Tradable</TermLabel>,
    align: 'right',
    hideOnMobile: true,
    sortValue: (t) => t.liquidityUsd ?? -1,
    render: (token) => (
      <span className="tabular text-sm text-secondary">
        {token.liquidityUsd !== null
          ? formatUsd(token.liquidityUsd, { compact: true })
          : <span className="text-muted">—</span>}
      </span>
    ),
  },
  {
    key: 'volume',
    header: <TermLabel topic="volume">24h traded</TermLabel>,
    align: 'right',
    hideOnMobile: true,
    sortValue: (t) => t.volume24hUsd ?? -1,
    render: (token) => (
      <span className="tabular text-sm text-secondary">
        {token.volume24hUsd !== null
          ? formatUsd(token.volume24hUsd, { compact: true })
          : <span className="text-muted">—</span>}
      </span>
    ),
  },
  {
    key: 'checked',
    header: 'Checked',
    align: 'right',
    hideOnMobile: true,
    sortValue: (t) => t.updatedAt,
    render: (token) => (
      <span className="tabular text-xs text-muted">
        {formatRelativeTime(Math.floor(new Date(token.updatedAt).getTime() / 1000))}
      </span>
    ),
  },
]

/**
 * Recently checked tokens, across everyone using the app.
 *
 * Deliberately not a curated "top tokens" list. What the community is actually
 * checking is the honest signal here, it stays current with no ingestion
 * pipeline, and it makes the page useful from the first scan rather than after
 * someone builds a watchlist.
 */
export function MarketOverview({ limit = 12 }: { limit?: number }) {
  const navigate = useNavigate()
  const market = useMarketOverview(limit)

  if (market.isLoading) {
    return (
      <Card className="overflow-hidden">
        <SkeletonRows rows={6} />
      </Card>
    )
  }

  if (market.isError) {
    return (
      <Card>
        <div className="flex flex-col items-start gap-3 p-6">
          <p className="text-sm text-secondary">Could not load recent checks.</p>
          <Button variant="secondary" size="sm" onClick={() => market.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if ((market.data?.length ?? 0) === 0) {
    return (
      <Card>
        <div className="p-8 text-center">
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted">
            Nothing checked yet. Run the first scan and it will appear here, along with everything
            else people look at.
          </p>
          <Link to="/token" className="mt-4 inline-block">
            <Button variant="primary" size="sm">
              Check a token
            </Button>
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <DataTable
        columns={columns}
        rows={market.data ?? []}
        rowKey={(token) => `${token.chainId}-${token.address}`}
        onRowClick={(token) => navigate(`/token/${token.address}?chain=${token.chainId}`)}
      />
    </Card>
  )
}
