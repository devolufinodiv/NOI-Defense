import { useEffect, useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { ChainMark } from '@/components/ui/ChainMark'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ScanForm } from '@/components/scan/ScanForm'
import { isValidAddress } from '@/lib/address'
import { track } from '@/lib/analytics'
import { chainMeta, defaultChainMeta } from '@/config/chains'
import { useChainStore } from '@/store/chain'
import { useScan } from '@/features/scan/queries'
import { TokenHistory } from '@/features/history/TokenHistory'
import { VerdictCard } from '@/features/scan/components/VerdictCard'
import { ScanFacts } from '@/features/scan/components/ScanFacts'
import { HolderMapLink } from '@/features/scan/components/HolderMapLink'
import { AdvancedDetails } from '@/features/scan/components/AdvancedDetails'
import { WatchButton } from '@/features/watchlist/WatchButton'

function Problem({
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

  // Chain comes from the URL first so a shared scan link resolves to the same
  // network for whoever opens it; the store is only a fallback.
  const chainId = useMemo(() => {
    const raw = Number.parseInt(searchParams.get('chain') ?? '', 10)
    if (Number.isFinite(raw) && chainMeta(raw)) return raw
    return storeChainId
  }, [searchParams, storeChainId])

  /**
   * Other networks the same contract was found on during the scan.
   *
   * One address can be a real token on several chains at once, and they are
   * different tokens with different liquidity and different risk. Carrying the
   * list here means somebody who landed on the busiest one can still reach the
   * others without pasting the address again.
   */
  const alsoOn = useMemo(() => {
    const raw = searchParams.get('also') ?? ''
    return raw
      .split(',')
      .map((part) => Number.parseInt(part, 10))
      .filter((id) => Number.isFinite(id) && id !== chainId && chainMeta(id))
  }, [searchParams, chainId])

  const network = chainMeta(chainId) ?? defaultChainMeta
  const valid = isValidAddress(address)
  const scan = useScan(chainId, address, valid)

  useEffect(() => {
    if (!valid) return
    void track({ kind: 'token_scan', chainId, subject: address, subjectKind: 'token' })
  }, [valid, chainId, address])

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">Token check</span>
            <span className="chip">{network.label}</span>
            {network.testnet ? <Badge tone="warning">Test network</Badge> : null}
          </div>
        }
        title="Is this token safe?"
        subtitle="We run the checks that catch the most common ways people lose money."
      />

      <div className="w-full space-y-6 px-4 pb-16 sm:px-6 md:px-8 xl:px-10">
        <ScanForm target="token" />

        {!valid ? (
          <Problem title="That address doesn’t look right">
            <span className="break-all font-mono text-xs text-primary">{address || '(empty)'}</span>{' '}
            isn’t a valid address. A token address starts with{' '}
            <span className="font-mono">0x</span> and has 40 characters after it. Copy it from the
            project’s official page — never from a direct message.
          </Problem>
        ) : scan.isError ? (
          <Problem
            title="We couldn’t finish the check"
            action={
              <Button variant="primary" onClick={() => scan.refetch()}>
                Try again
              </Button>
            }
          >
            {scan.error instanceof Error ? scan.error.message : 'Something went wrong.'} This is a
            problem on our side, not a verdict on the token.
          </Problem>
        ) : (
          <>
            {/* The answer first. Everything below is supporting detail. */}
            <VerdictCard verdict={scan.data?.verdict} loading={scan.isLoading} />

            <ScanFacts
              token={scan.data?.token}
              market={scan.data?.market}
              safety={scan.data?.safety}
              age={scan.data?.age}
              lock={scan.data?.lock}
              loading={scan.isLoading}
            />

            {/* Offered right under the verdict: the moment somebody decides a
                token is worth following is while they are reading its scan. */}
            <div className="glass-panel rounded-lg border border-hairline p-4">
              <WatchButton
                chainId={chainId}
                address={address}
                symbol={scan.data?.token.symbol}
                name={scan.data?.token.name}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {alsoOn.length > 0 ? (
              <div className="glass-panel flex flex-wrap items-center gap-2 rounded-lg border border-hairline p-3 text-xs">
                <span className="text-muted">This address is also a contract on</span>
                {alsoOn.map((id) => (
                  <Link
                    key={id}
                    to={`/token/${address}?chain=${id}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2 py-1 text-secondary transition-colors duration-180 hover:border-hairline-strong hover:text-primary"
                  >
                    <ChainMark chainId={id} size="xs" />
                    {chainMeta(id)?.label ?? id}
                  </Link>
                ))}
                <span className="w-full text-[11px] text-muted">
                  Same address, different token — the figures above apply only to {network.label}.
                </span>
              </div>
            ) : null}

            <TokenHistory chainId={chainId} address={address} />

              <HolderMapLink chainId={chainId} address={address} subject="token" />

              <div className="glass-panel rounded-lg border border-hairline p-4">
                <h3 className="text-sm font-medium text-primary">Before you buy</h3>
                <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-secondary">
                  <li>Check the address matches the project’s official site, character for character.</li>
                  <li>Assume you could lose all of it. Never use money you need.</li>
                  <li>Nobody legitimate will DM you a token address or rush you.</li>
                </ul>
              </div>
            </div>

            <AdvancedDetails
              chainId={chainId}
              address={address}
              symbol={scan.data?.token.symbol ?? ''}
            />

            {scan.data?.cached ? (
              <p className="text-center text-2xs text-muted">
                Showing a result from the last few minutes.{' '}
                <button
                  type="button"
                  onClick={() => scan.refetch()}
                  className="cursor-pointer underline decoration-hairline-strong underline-offset-2 hover:text-secondary"
                >
                  Check again
                </button>
              </p>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
