import { useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Info, TriangleAlert, Users, Wallet as WalletIcon } from 'lucide-react'
import { PageHeader, SectionHeading } from '@/components/layout/AppShell'
import { Card, CardBody, CardHeader, Eyebrow } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton'
import { HashRef } from '@/components/ui/Address'
import { ChainMark } from '@/components/ui/ChainMark'
import { TokenMark } from '@/components/ui/TokenMark'
import { ScanForm } from '@/components/scan/ScanForm'
import { HolderMapLink } from '@/features/scan/components/HolderMapLink'
import { WatchButton } from '@/features/watchlist/WatchButton'
import { isValidAddress } from '@/lib/address'
import { track } from '@/lib/analytics'
import { chainMeta, defaultChainMeta } from '@/config/chains'
import { useChainStore } from '@/store/chain'
import { ACCOUNT_COPY, HISTORY_GAP, useWalletTrace } from '@/features/wallet/queries'
import { formatRelativeTime } from '@/lib/format'

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-1 truncate text-lg font-semibold text-primary">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-2xs text-muted">{hint}</div> : null}
    </div>
  )
}

const unknown = <span className="text-muted">Not available</span>

export function WalletDetail() {
  const { address = '' } = useParams()
  const [searchParams] = useSearchParams()
  const storeChainId = useChainStore((state) => state.chainId)

  const chainId = useMemo(() => {
    const raw = Number.parseInt(searchParams.get('chain') ?? '', 10)
    if (Number.isFinite(raw) && chainMeta(raw)) return raw
    return storeChainId
  }, [searchParams, storeChainId])

  const network = chainMeta(chainId) ?? defaultChainMeta
  const valid = isValidAddress(address)
  const trace = useWalletTrace(chainId, address, valid)

  useEffect(() => {
    if (!valid) return
    void track({ kind: 'wallet_trace', chainId, subject: address, subjectKind: 'wallet' })
  }, [valid, chainId, address])

  const account = trace.data?.address.accountType
  const history = trace.data?.history

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">Wallet trace</span>
            <span className="chip">{network.label}</span>
            {network.testnet ? <Badge tone="warning">Test network</Badge> : null}
          </div>
        }
        title="Who is behind this address?"
        subtitle="Balances and activity, read straight from the blockchain."
      />

      <div className="w-full space-y-6 px-4 pb-16 sm:px-6 md:px-8 xl:px-10">
        <ScanForm target="wallet" />

        {!valid ? (
          <Card className="mx-auto w-full max-w-xl">
            <div className="flex flex-col items-start gap-4 p-8">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-negative/30 bg-negative/10 text-negative">
                <TriangleAlert className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h2 className="text-xl font-semibold tracking-heading text-primary">
                That address doesn’t look right
              </h2>
              <p className="text-sm leading-relaxed text-secondary">
                <span className="break-all font-mono text-xs text-primary">
                  {address || '(empty)'}
                </span>{' '}
                isn’t a valid address. They start with{' '}
                <span className="font-mono">0x</span> and have 40 characters after it.
              </p>
            </div>
          </Card>
        ) : trace.isError ? (
          <Card className="mx-auto w-full max-w-xl">
            <div className="flex flex-col items-start gap-4 p-8">
              <h2 className="text-xl font-semibold tracking-heading text-primary">
                We couldn’t finish the trace
              </h2>
              <p className="text-sm leading-relaxed text-secondary">
                {trace.error instanceof Error ? trace.error.message : 'Something went wrong.'}
              </p>
              <Button variant="primary" onClick={() => trace.refetch()}>
                Try again
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <CardBody className="space-y-6">
                <div className="flex flex-wrap items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-hairline bg-raised text-secondary">
                    <WalletIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    {trace.isLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-44" />
                        <Skeleton className="h-4 w-72" />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold tracking-heading text-primary">
                            {account ? ACCOUNT_COPY[account].label : 'Address'}
                          </h2>
                          {account === 'contract' ? <Badge tone="warning">Not a person</Badge> : null}
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-secondary">
                          {trace.data?.summary}
                        </p>
                      </>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ChainMark chainId={chainId} size="xs" />
                      <span className="text-xs text-muted">{network.label}</span>
                      <HashRef value={address} kind="address" chainId={chainId} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-hairline pt-5 sm:grid-cols-4">
                  <Stat
                    label={`Balance (${trace.data?.address.nativeSymbol ?? 'ETH'})`}
                    value={
                      trace.isLoading ? (
                        <Skeleton className="h-6 w-20" />
                      ) : trace.data?.onchain.balance !== null &&
                        trace.data?.onchain.balance !== undefined ? (
                        trace.data.onchain.balance.toLocaleString('en-US', {
                          maximumFractionDigits: 4,
                        })
                      ) : (
                        unknown
                      )
                    }
                  />
                  <Stat
                    label="Transactions sent"
                    value={
                      trace.isLoading ? (
                        <Skeleton className="h-6 w-16" />
                      ) : trace.data?.onchain.outgoingTransactions !== null &&
                        trace.data?.onchain.outgoingTransactions !== undefined ? (
                        trace.data.onchain.outgoingTransactions.toLocaleString('en-US')
                      ) : (
                        unknown
                      )
                    }
                    hint="From this address, on this network"
                  />
                  <Stat
                    label="First activity"
                    value={
                      history?.firstSeen
                        ? formatRelativeTime(history.firstSeen)
                        : trace.isLoading
                          ? <Skeleton className="h-6 w-20" />
                          : unknown
                    }
                  />
                  <Stat
                    label="Last activity"
                    value={
                      history?.lastSeen
                        ? formatRelativeTime(history.lastSeen)
                        : trace.isLoading
                          ? <Skeleton className="h-6 w-20" />
                          : unknown
                    }
                  />
                </div>
              </CardBody>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <HolderMapLink chainId={chainId} address={address} subject="wallet" />
              <div className="glass-panel rounded-lg border border-hairline p-4">
                <WatchButton
                  chainId={chainId}
                  address={address}
                  kind="wallet"
                  name={account ? ACCOUNT_COPY[account].label : undefined}
                />
              </div>
            </div>

            {/* Coverage gap is stated as a coverage gap. Rendering an empty
                history here would read as "this wallet has never done
                anything", which is a different and false claim. */}
            {!trace.isLoading && !trace.data?.historyAvailable ? (
              <Card>
                <CardBody className="flex items-start gap-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                  <p className="text-sm leading-relaxed text-secondary">
                    {HISTORY_GAP[trace.data?.historyStatus ?? 'failed'] ?? HISTORY_GAP.failed}
                  </p>
                </CardBody>
              </Card>
            ) : null}

            {history && history.counterparties.length > 0 ? (
              <section className="grid gap-4 xl:grid-cols-2">
                <div className="min-w-0">
                  <SectionHeading
                    eyebrow={<Eyebrow icon={<Users className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}>Most frequent</Eyebrow>}
                    title="Who it deals with"
                  />
                  <Card className="overflow-hidden">
                    <ul className="divide-y divide-hairline">
                      {history.counterparties.map((cp) => (
                        <li key={cp.address} className="flex items-center gap-3 px-5 py-3">
                          <HashRef
                            value={cp.address}
                            to={`/wallet/${cp.address}?chain=${chainId}`}
                            chainId={chainId}
                            hideExplorer
                          />
                          <span className="tabular ml-auto text-xs text-muted">
                            {cp.count} {cp.count === 1 ? 'time' : 'times'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>

                <div className="min-w-0">
                  <SectionHeading eyebrow={<Eyebrow>Moved most often</Eyebrow>} title="Tokens touched" />
                  <Card className="overflow-hidden">
                    {history.tokens.length === 0 ? (
                      <div className="px-5 py-10 text-center text-sm text-muted">
                        No token movements in the recent history we read.
                      </div>
                    ) : (
                      <ul className="divide-y divide-hairline">
                        {history.tokens.map((token) => (
                          <li key={token.address} className="flex items-center gap-3 px-5 py-3">
                            <TokenMark symbol={token.symbol || '?'} size="sm" />
                            <a
                              href={`/token/${token.address}?chain=${chainId}`}
                              className="min-w-0 flex-1"
                            >
                              <span className="block truncate text-sm text-primary">
                                {token.name || token.symbol}
                              </span>
                              <span className="block truncate text-2xs text-muted">
                                {token.symbol}
                              </span>
                            </a>
                            <span className="tabular shrink-0 text-xs text-muted">
                              {token.transfers}×
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
              </section>
            ) : trace.isLoading ? (
              <Card className="overflow-hidden">
                <CardHeader title="History" subtitle="Reading the chain" />
                <SkeletonRows rows={4} />
              </Card>
            ) : null}

            {history?.truncated ? (
              <p className="text-center text-2xs text-muted">
                Showing the most recent activity only — this address has more history than we read
                in one pass.
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
