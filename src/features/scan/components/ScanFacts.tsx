import { Card, CardBody } from '@/components/ui/Card'
import { HashRef } from '@/components/ui/Address'
import { TokenMark } from '@/components/ui/TokenMark'
import { ChainMark } from '@/components/ui/ChainMark'
import { Badge, DeltaPill } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { TermLabel } from '@/components/ui/Explain'
import { chainMeta } from '@/config/chains'
import { formatUsd } from '@/lib/format'
import type { ScanAge, ScanLock, ScanMarket, ScanSafety, ScanToken } from '../types'

function Fact({
  label,
  value,
  hint,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-1 truncate text-lg font-semibold text-primary">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-2xs text-muted">{hint}</div> : null}
    </div>
  )
}

/** Unknown must never be shown as a number, or it reads as a measured zero. */
const unknown = <span className="text-muted">Not available</span>

export function ScanFacts({
  token,
  market,
  safety,
  age,
  lock,
  loading,
}: {
  token?: ScanToken
  market?: ScanMarket | null
  safety?: ScanSafety | null
  age?: ScanAge | null
  lock?: ScanLock | null
  loading: boolean
}) {
  if (loading || !token) {
    return (
      <Card>
        <CardBody className="space-y-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-52" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    )
  }

  const network = chainMeta(token.chainId)

  return (
    <Card>
      <CardBody className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <TokenMark symbol={token.symbol || token.name || '?'} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold tracking-heading text-primary">
                {token.name || 'Unnamed token'}
              </h2>
              {token.symbol ? <Badge>{token.symbol}</Badge> : null}
              {token.verified === true ? <Badge tone="positive">Code published</Badge> : null}
              {token.verified === false ? <Badge tone="warning">Code not published</Badge> : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ChainMark chainId={token.chainId} size="xs" />
              <span className="text-xs text-muted">{network?.label ?? token.chainId}</span>
              <HashRef value={token.address} kind="token" chainId={token.chainId} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-hairline pt-5 sm:grid-cols-4">
          <Fact
            label="Age"
            value={ageValue(age)}
            hint={ageHint(age)}
          />
          <Fact
            label="Pool locked"
            value={lockValue(lock)}
            hint={lockHint(lock)}
          />
          <Fact
            label="Price"
            value={market?.priceUsd != null ? formatUsd(market.priceUsd) : unknown}
            hint={market?.priceUsd == null ? 'No pool priced in dollars' : undefined}
          />
          <Fact
            label={<TermLabel topic="liquidity">Tradable pool</TermLabel>}
            value={market?.liquidityUsd != null ? formatUsd(market.liquidityUsd, { compact: true }) : unknown}
            hint={market ? `${market.pairCount} pool${market.pairCount === 1 ? '' : 's'}` : undefined}
          />
          <Fact
            label={<TermLabel topic="volume">Traded in 24h</TermLabel>}
            value={market?.volume24hUsd != null ? formatUsd(market.volume24hUsd, { compact: true }) : unknown}
          />
          <Fact
            label={<TermLabel topic="sellTax">Fee to sell</TermLabel>}
            value={safety?.sellTax != null ? `${safety.sellTax.toFixed(1)}%` : unknown}
            hint={safety?.buyTax != null ? `${safety.buyTax.toFixed(1)}% to buy` : undefined}
          />
        </div>

        {market?.change24h != null ? (
          <div className="flex items-center gap-2 border-t border-hairline pt-4">
            <span className="text-xs text-muted">Price change today</span>
            <DeltaPill value={market.change24h} />
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}


/**
 * Age and lock, as short facts.
 *
 * Both distinguish a check that did not run from a check that came back clean,
 * because the two mean opposite things to somebody about to buy.
 */
function ageValue(age?: ScanAge | null): string {
  if (!age || age.status !== 'ok' || !age.deployedAt) return '—'
  const days = (Date.now() - new Date(age.deployedAt).getTime()) / 86_400_000
  if (days < 1) return 'Under a day'
  if (days < 14) return `${Math.round(days)} days`
  if (days < 60) return `${Math.round(days / 7)} weeks`
  if (days < 730) return `${Math.round(days / 30)} months`
  return `${(days / 365).toFixed(1)} years`
}

function ageHint(age?: ScanAge | null): string | undefined {
  if (!age) return 'Read live, not cached'
  if (age.status === 'ok' && age.deployedAt) {
    return new Date(age.deployedAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  if (age.status === 'not-configured') return 'Not set up yet'
  if (age.status === 'chain-unsupported') return 'Not available on this network'
  if (age.status === 'not-a-contract') return 'This address holds no code'
  return 'Could not check'
}

function lockValue(lock?: ScanLock | null): string {
  if (!lock || lock.status !== 'ok') return '—'
  if (lock.burnedPercent === null || lock.lockedPercent === null) return '—'
  const held = lock.burnedPercent + lock.lockedPercent
  return `${held.toFixed(held >= 1 ? 0 : 2)}%`
}

function lockHint(lock?: ScanLock | null): string | undefined {
  if (!lock) return 'Read live, not cached'
  if (lock.status === 'not-applicable') return 'Pool holds positions individually'
  if (lock.status === 'no-pool') return 'No pool found'
  if (lock.status === 'chain-unsupported') return 'Not available on this network'
  if (lock.status !== 'ok') return 'Could not check'

  const held = (lock.burnedPercent ?? 0) + (lock.lockedPercent ?? 0)
  return held < 50
    ? `Not found in ${lock.lockersChecked} known lockers`
    : 'Burned or locked'
}
