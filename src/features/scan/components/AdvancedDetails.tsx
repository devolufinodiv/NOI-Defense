import { useMemo, useState } from 'react'
import { ChevronDown, Loader2, Microscope, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/format'
import { useContractProbe } from '@/lib/useContractProbe'
import { useTokenDecimals } from '@/lib/useTokenDecimals'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { TermLabel } from '@/components/ui/Explain'
import { useAuth } from '@/store/auth'
import {
  useBackfill,
  useEarlyBuyers,
  useHistoryCoverage,
  useHolders,
} from '@/features/token/queries'
import { HolderDistribution } from '@/features/token/components/HolderDistribution'
import { EarlyBuyers } from '@/features/token/components/EarlyBuyers'

/**
 * Deeper history, behind a disclosure.
 *
 * The default scan answers "is this safe?" in one screen. This is the layer for
 * someone who wants to read the book rather than the verdict — who holds it,
 * who bought first, and whether they sold. Collapsed by default, because
 * showing it up front is exactly what makes these tools intimidating.
 *
 * Everything here is derived from stored transfer logs, and none of it appears
 * until the token's whole history has been read. The database enforces that;
 * this only has to render the difference between "we have not looked" and "we
 * looked and there is nothing", which are opposite answers that an empty panel
 * makes look identical.
 */

/** Seconds since the epoch, from an ISO timestamp we may not have. */
function unix(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-prose text-sm leading-relaxed text-secondary">{children}</p>
  )
}

export function AdvancedDetails({
  chainId,
  address,
  symbol,
}: {
  chainId: number
  address: string
  symbol: string
}) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()

  // Only fetch once opened: nobody should pay for queries they never look at.
  const coverage = useHistoryCoverage(chainId, address, open)
  const complete = coverage.data?.complete ?? false

  /*
   * Stored amounts are base units. Without the token's decimals they cannot be
   * turned into a figure anyone would recognise, and assuming the usual 18
   * would misplace a 6-decimal token's balance by a factor of a trillion — a
   * different number, not a rounded one. So the figures wait for the answer.
   */
  const decimalsQuery = useTokenDecimals(chainId, address, open && complete)
  const decimals = decimalsQuery.data ?? null
  const readable = complete && decimals !== null

  const holders = useHolders(chainId, address, decimals ?? 18, readable)
  const buyers = useEarlyBuyers(chainId, address, decimals ?? 18, readable)
  const backfill = useBackfill(chainId, address)

  // Whether each top holder is a contract is a question for the chain, not for
  // transfer history — a pool and a person look identical in a ledger.
  const holderAddresses = useMemo(
    () => (holders.data ?? []).map((h) => h.address),
    [holders.data],
  )
  const probe = useContractProbe(chainId, holderAddresses, readable)

  const labelled = useMemo(
    () =>
      (holders.data ?? []).map((holder) => ({
        ...holder,
        isContract: probe.data?.[holder.address.toLowerCase()] ?? null,
      })),
    [holders.data, probe.data],
  )

  const data = coverage.data
  const running = backfill.isPending || data?.status === 'running'

  return (
    <div className="glass-panel overflow-hidden rounded-xl border border-hairline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors duration-180 hover:bg-raised/40"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline bg-raised text-secondary">
          <Microscope className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-primary">Dig deeper</span>
          <span className="block text-xs text-muted">
            Who owns it, who bought first, and whether they sold. Optional.
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted transition-transform duration-180',
            open && 'rotate-180',
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-hairline p-4">
          {coverage.isLoading ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
              Checking what we hold…
            </p>
          ) : coverage.isError ? (
            <Note>
              We could not reach our own records just now, so we cannot say what history
              exists for this token. That is a problem on our side, not a finding about
              the token.
            </Note>
          ) : complete && decimalsQuery.isLoading ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
              Reading the token…
            </p>
          ) : complete && decimals === null ? (
            <Note>
              We have this token’s full history, but the contract would not tell us how
              many decimals it uses — and without that, every amount below would be off
              by a factor we cannot guess at. Try again in a moment.
            </Note>
          ) : complete ? (
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader
                    title={<TermLabel topic="holders">Biggest holders</TermLabel>}
                    subtitle={
                      data?.holders
                        ? `${data.holders.toLocaleString()} addresses hold any of it`
                        : 'By share of the tokens actually held'
                    }
                  />
                  <CardBody className="pt-4">
                    <HolderDistribution
                      holders={labelled}
                      loading={holders.isLoading}
                      symbol={symbol}
                    />
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title={<TermLabel topic="concentration">What we read</TermLabel>}
                    subtitle="The history these figures come from"
                  />
                  <CardBody className="space-y-2 pt-4 text-xs">
                    <div className="flex justify-between gap-4 border-b border-hairline pb-2">
                      <span className="text-muted">Transfers read</span>
                      <span className="font-mono text-primary">
                        {(data?.transfers ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-hairline pb-2">
                      <span className="text-muted">Blocks covered</span>
                      <span className="font-mono text-primary">
                        {data?.firstBlock !== null && data?.lastBlock !== null
                          ? `${data?.firstBlock?.toLocaleString()} – ${data?.lastBlock?.toLocaleString()}`
                          : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted">Newest transfer</span>
                      <span className="font-mono text-primary">
                        {unix(data?.lastSeen ?? null) !== null
                          ? formatRelativeTime(unix(data?.lastSeen ?? null) as number)
                          : 'Unknown'}
                      </span>
                    </div>
                    <p className="pt-2 leading-relaxed text-muted">
                      Balances are worked out from every transfer this token has ever
                      had. They are current as of the newest one above.
                    </p>
                  </CardBody>
                </Card>

                <Card className="overflow-hidden xl:col-span-2">
                  <CardHeader
                    title="First buyers"
                    subtitle="Who got in earliest — and whether they are still holding"
                  />
                  <EarlyBuyers buyers={buyers.data} loading={buyers.isLoading} symbol={symbol} />
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {data && data.transfers > 0 ? (
                <Note>
                  We hold {data.transfers.toLocaleString()} of this token’s transfers,
                  recorded as they happened — but not the ones from before we started
                  watching.
                </Note>
              ) : data?.tracked ? (
                <Note>
                  This token is on our watch list, but no transfers have reached us yet.
                </Note>
              ) : (
                <Note>
                  We are not recording this token’s transfers yet.
                </Note>
              )}

              {data?.status === 'failed' && data.error ? (
                <p className="flex max-w-prose items-start gap-2 text-sm leading-relaxed text-negative">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span>Reading the full history stopped: {data.error}</span>
                </p>
              ) : null}

              {backfill.isError ? (
                <p className="flex max-w-prose items-start gap-2 text-sm leading-relaxed text-negative">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  <span>{backfill.error.message}</span>
                </p>
              ) : null}

              {/*
                Gated on the token being watched, and not as a formality. The
                walk stops at today's block; the live stream carries it on from
                there. Reading the past for a token nothing is streaming leaves
                a history that is complete for about a minute.
              */}
              {!user ? (
                <Badge tone="accent">Sign in to read the full history</Badge>
              ) : !data?.tracked ? (
                <Note>
                  Add it to your watchlist first, using the button above. We start
                  recording from that moment, and reading the past only adds up to a
                  complete picture if something is keeping it current.
                </Note>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => backfill.mutate()}
                  disabled={running}
                >
                  {running ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
                      Reading the history{data?.pages ? ` — ${data.pages} pages` : ''}…
                    </>
                  ) : (
                    'Read the full history'
                  )}
                </Button>
              )}

              <p className="max-w-prose border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
                Holder distribution and first buyers need every transfer the token has
                ever had. Working them out from a partial record produces numbers that
                look right and are not, so we show nothing until the whole history has
                been read.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
