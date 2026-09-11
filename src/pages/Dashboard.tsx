import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  Info,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader, SectionHeading } from '@/components/layout/AppShell'
import { Card, CardBody, CardHeader, Eyebrow } from '@/components/ui/Card'
import { DeltaPill, MockBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { HashRef } from '@/components/ui/Address'
import { TokenMark } from '@/components/ui/TokenMark'
import { RingDot } from '@/components/ui/LiveDot'
import { CoinCard } from '@/components/market/CoinCard'
import { MarketOverview } from '@/features/market/MarketOverview'
import {
  formatRelativeTime,
  formatUsd,
  toneOf,
} from '@/lib/format'
import {
  MOCK_ALERTS,
  MOCK_TOKENS,
  MOCK_WATCHED_WALLETS,
  mockSeriesFor,
} from '@/mock'

// ⚠️ Every figure on this page is a fixture from src/mock — see the MockBadge in
// the header. Phase 1 replaces these with Alchemy reads.



export function Dashboard() {

  const featured = useMemo(
    () =>
      MOCK_TOKENS.slice(0, 3).map((token) => ({
        token,
        series: mockSeriesFor(token.symbol, token.change24h),
      })),
    [],
  )


  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-3">
            <span className="chip">
              <RingDot />
              Last update: 2 min ago
            </span>
            <MockBadge />
          </div>
        }
        title="Your research desk"
        subtitle="Everything you are watching, and everything that moved while you were away."
      />

      <div className="space-y-10 px-4 pb-12 pt-6 md:px-8">
        {/* Featured token scans */}
        <section>
          <SectionHeading
            eyebrow={<Eyebrow>Recently scanned</Eyebrow>}
            title="Featured token scans"
            actions={
              <Link to="/token">
                <Button variant="secondary" size="sm">
                  Scan a contract
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </Button>
              </Link>
            }
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featured.map(({ token, series }) => (
              <CoinCard
                key={token.address}
                symbol={token.symbol}
                name={token.name}
                pair={`${token.symbol}/USD`}
                priceUsd={token.priceUsd}
                change24h={token.change24h}
                series={series}
                to={`/token/${token.address}`}
              />
            ))}
          </div>
        </section>

        {/* Watchlist + alerts */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Your watchlist"
              subtitle={`${MOCK_TOKENS.length} tokens · ${MOCK_WATCHED_WALLETS.length} wallets`}
              action={
                <Link to="/token">
                  <Button variant="ghost" size="sm">
                    Add
                  </Button>
                </Link>
              }
            />
            <CardBody className="grid gap-6 pt-4 md:grid-cols-2">
              <div>
                <h4 className="text-2xs uppercase tracking-label text-muted">Tokens</h4>
                <ul className="mt-3 space-y-2.5">
                  {MOCK_TOKENS.slice(0, 3).map((token) => (
                    <li key={token.address}>
                      <Link
                        to={`/token/${token.address}`}
                        className="flex items-center gap-2.5 rounded-sm py-1 transition-colors duration-180 hover:text-primary"
                      >
                        <TokenMark symbol={token.symbol} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm text-primary">
                          {token.symbol}
                        </span>
                        <span className="tabular shrink-0 text-xs text-secondary">
                          {formatUsd(token.priceUsd)}
                        </span>
                        <DeltaPill value={token.change24h} showIcon={false} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-2xs uppercase tracking-label text-muted">Wallets</h4>
                <ul className="mt-3 space-y-2.5">
                  {MOCK_WATCHED_WALLETS.map((wallet) => {
                    const tone = toneOf(wallet.realisedPnlUsd)
                    return (
                      <li key={wallet.address} className="flex items-center gap-2.5">
                        <HashRef
                          value={wallet.address}
                          to={`/wallet/${wallet.address}`}
                          hideExplorer
                        />
                        <span
                          className={`tabular ml-auto shrink-0 text-xs font-medium ${
                            tone === 'positive' ? 'text-positive' : 'text-negative'
                          }`}
                        >
                          {wallet.realisedPnlUsd > 0 ? '+' : ''}
                          {formatUsd(wallet.realisedPnlUsd, { compact: true })}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Alerts"
              subtitle={`${MOCK_ALERTS.filter((a) => a.unread).length} unread`}
              action={
                <Link to="/alerts">
                  <Button variant="ghost" size="sm">
                    All
                  </Button>
                </Link>
              }
            />
            <ul className="divide-y divide-hairline">
              {MOCK_ALERTS.slice(0, 4).map((alert) => (
                <li key={alert.id}>
                  <Link
                    to={`/${alert.subjectKind}/${alert.subject}`}
                    className="flex items-start gap-3 px-5 py-3 transition-colors duration-180 hover:bg-raised/50"
                  >
                    {/* Icon shape differs per severity, so the row reads
                        without relying on colour. */}
                    <span
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                        alert.severity === 'critical'
                          ? 'border-negative/30 bg-negative/10 text-negative'
                          : alert.severity === 'warning'
                            ? 'border-warning/30 bg-warning/10 text-warning'
                            : 'border-hairline bg-raised text-muted'
                      }`}
                    >
                      {alert.severity === 'critical' ? (
                        <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      ) : alert.severity === 'warning' ? (
                        <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      ) : (
                        <Info className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-primary">
                          {alert.title}
                        </span>
                        {alert.unread ? (
                          <span
                            aria-label="Unread"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-text"
                          />
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {alert.detail}
                      </span>
                      <span className="tabular mt-1 block text-2xs text-muted">
                        {formatRelativeTime(alert.timestampUnix)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Recently checked, across everyone using the app */}
        <section>
          <SectionHeading
            eyebrow={
              <Eyebrow icon={<Clock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}>
                Updated continuously
              </Eyebrow>
            }
            title="Market overview"
            actions={
              <Link to="/token">
                <Button variant="secondary" size="sm">
                  Check a token
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </Button>
              </Link>
            }
          />
          <MarketOverview limit={12} />
        </section>

      </div>
    </>
  )
}
