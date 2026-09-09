import { useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { PageHeader, SectionHeading } from '@/components/layout/AppShell'
import { Card, CardBody, CardHeader, Eyebrow } from '@/components/ui/Card'
import { Badge, MockBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ScanForm } from '@/components/scan/ScanForm'
import { isValidAddress } from '@/lib/address'
import { track } from '@/lib/analytics'
import { chainMeta, defaultChainMeta } from '@/config/chains'
import { useChainStore } from '@/store/chain'
import {
  useEarlyBuyers,
  useHealthFactors,
  useHolders,
  useRecentTrades,
  useTokenOverview,
} from '@/features/token/queries'
import { TokenNotIndexedError } from '@/features/token/types'
import { TokenHeader } from '@/features/token/components/TokenHeader'
import { HealthBreakdown } from '@/features/token/components/HealthBreakdown'
import { HolderDistribution } from '@/features/token/components/HolderDistribution'
import { EarlyBuyers } from '@/features/token/components/EarlyBuyers'
import { LiveTrades } from '@/features/token/components/LiveTrades'
import { TokenNotIndexed } from '@/features/token/components/TokenNotIndexed'

function StatePanel({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <div className="flex flex-col items-start gap-4 p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-negative/30 bg-negative/10 text-negative">
          <TriangleAlert className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 className="text-xl font-semibold tracking-heading text-primary">{title}</h2>
        <div className="text-sm leading-relaxed text-secondary">{children}</div>
        {action}
      </div>
    </Card>
  )
}

export function TokenDetail() {
  const { address = '' } = useParams()
  const [searchParams] = useSearchParams()
  const storeChainId = useChainStore((state) => state.chainId)

  /**
   * Chain comes from the URL first so a shared scan link resolves to the same
   * network for whoever opens it; the store is only a fallback for links
   * written before chains were carried in the query string.
   */
  const chainId = useMemo(() => {
    const raw = Number.parseInt(searchParams.get('chain') ?? '', 10)
    if (Number.isFinite(raw) && chainMeta(raw)) return raw
    return storeChainId
  }, [searchParams, storeChainId])

  const network = chainMeta(chainId) ?? defaultChainMeta
  const valid = isValidAddress(address)

  // Record the scan once per (chain, address). Fire-and-forget: analytics must
  // never delay or break the page it is measuring.
  useEffect(() => {
    if (!valid) return
    void track({ kind: 'token_scan', chainId, subject: address, subjectKind: 'token' })
  }, [valid, chainId, address])

  const overview = useTokenOverview(chainId, address, valid)
  const factors = useHealthFactors(chainId, address, valid)
  const holders = useHolders(chainId, address, valid)
  const earlyBuyers = useEarlyBuyers(chainId, address, valid)
  const trades = useRecentTrades(chainId, address, valid)

  // The overview query gates the page: if the token isn't indexed, none of the
  // panels have anything to show, so render one clear state instead of five.
  const notIndexed = overview.error instanceof TokenNotIndexedError
  const failed = overview.isError && !notIndexed
  const symbol = overview.data?.symbol ?? ''

  const header = (
    <PageHeader
      eyebrow={
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">Token scan</span>
          <span className="chip">{network.label}</span>
          {network.testnet ? <Badge tone="warning">Testnet</Badge> : null}
          <MockBadge />
        </div>
      }
      title="Token scanner"
      subtitle="Health, distribution, and the money that moved first."
    />
  )

  return (
    <>
      {header}

      {/* One column that owns the full content width at every breakpoint, with
          gutters that grow with the viewport. Every child below stretches to
          it, so nothing ends up hugging one side. */}
      <div className="w-full space-y-8 px-4 pb-16 sm:px-6 md:px-8 xl:px-10">
        <ScanForm target="token" />

        {!valid ? (
          <StatePanel title="Not a contract address">
            <span className="break-all font-mono text-xs text-primary">
              {address || '(empty)'}
            </span>{' '}
            is not a valid EVM address. Addresses are 40 hexadecimal characters after{' '}
            <span className="font-mono">0x</span>.
          </StatePanel>
        ) : notIndexed ? (
          <TokenNotIndexed chainId={chainId} address={address} />
        ) : failed ? (
          <StatePanel
            title="Could not load this token"
            action={
              <Button variant="primary" onClick={() => overview.refetch()}>
                Retry
              </Button>
            }
          >
            The indexer did not respond. Nothing is wrong with the contract itself.
          </StatePanel>
        ) : (
          <>
            <TokenHeader overview={overview.data} loading={overview.isLoading} />

            {/* Breakdown and distribution share the row from lg up; below that
                they stack full-width rather than squeezing side by side. */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="flex min-w-0 flex-col">
                <CardHeader
                  title="Health breakdown"
                  subtitle="What the score is made of"
                  action={
                    overview.data ? (
                      <Badge
                        tone={
                          overview.data.healthScore >= 75
                            ? 'positive'
                            : overview.data.healthScore >= 50
                              ? 'warning'
                              : 'negative'
                        }
                      >
                        {overview.data.healthScore} / 100
                      </Badge>
                    ) : null
                  }
                />
                <CardBody className="flex-1 pt-4">
                  <HealthBreakdown factors={factors.data} loading={factors.isLoading} />
                </CardBody>
              </Card>

              <Card className="flex min-w-0 flex-col">
                <CardHeader title="Holder distribution" subtitle="Top 10 addresses by supply" />
                <CardBody className="flex-1 pt-4">
                  <HolderDistribution
                    holders={holders.data}
                    loading={holders.isLoading}
                    symbol={symbol}
                  />
                </CardBody>
              </Card>
            </section>

            {/* Early buyers is the widest table, so it gets its own full row and
                only shares space with the feed on very wide screens. */}
            <section className="grid grid-cols-1 gap-4 2xl:grid-cols-5">
              <div className="min-w-0 2xl:col-span-3">
                <SectionHeading
                  eyebrow={<Eyebrow>From the creation block</Eyebrow>}
                  title="Early buyers"
                />
                <Card className="overflow-hidden">
                  <EarlyBuyers
                    buyers={earlyBuyers.data}
                    loading={earlyBuyers.isLoading}
                    symbol={symbol}
                  />
                </Card>
              </div>

              <div className="min-w-0 2xl:col-span-2">
                <SectionHeading eyebrow={<Eyebrow>Transaction feed</Eyebrow>} title="Recent activity" />
                <Card className="overflow-hidden">
                  <LiveTrades
                    trades={trades.data}
                    loading={trades.isLoading}
                    isFetching={trades.isFetching}
                    symbol={symbol}
                  />
                </Card>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  )
}
