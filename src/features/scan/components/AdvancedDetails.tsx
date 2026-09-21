import { useState } from 'react'
import { ChevronDown, Loader2, Microscope } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatRelativeTime } from '@/lib/format'
import { useHistoryCoverage } from '@/features/token/queries'

/**
 * What we hold for this token, stated plainly.
 *
 * This panel used to render a holder breakdown, a list of first buyers and a
 * scored health split — all of it generated from a hash of the contract
 * address. A reader had no way to tell. It has been replaced with the one
 * thing we can actually stand behind: how much of this token's transfer
 * history has been ingested.
 *
 * The rest returns when a backfill can establish that a token's history is
 * complete. Balances derived from a partial history are not approximately
 * right, they are wrong — and wrong in a shape that reads as authoritative.
 */

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-xs text-primary">{value}</span>
    </div>
  )
}

/** Seconds since the epoch, from an ISO timestamp we may not have. */
function unix(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null
}

export function AdvancedDetails({
  chainId,
  address,
}: {
  chainId: number
  address: string
}) {
  const [open, setOpen] = useState(false)

  // Only fetch once opened: nobody should pay for queries they never look at.
  const coverage = useHistoryCoverage(chainId, address, open)
  const data = coverage.data

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
            What we have read from the chain for this token.
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
            <p className="max-w-prose py-4 text-sm leading-relaxed text-secondary">
              We could not reach our own records just now, so we cannot say what history
              exists for this token. That is a problem on our side, not a finding about
              the token.
            </p>
          ) : (
            <div className="space-y-4">
              {data && data.transfers > 0 ? (
                <>
                  <p className="max-w-prose text-sm leading-relaxed text-secondary">
                    We are recording this token’s transfers as they happen.
                  </p>
                  <div className="rounded-lg border border-hairline bg-raised/40 px-3">
                    <Line
                      label="Transfers recorded"
                      value={data.transfers.toLocaleString()}
                    />
                    <Line
                      label="Block range"
                      value={
                        data.firstBlock !== null && data.lastBlock !== null
                          ? `${data.firstBlock.toLocaleString()} – ${data.lastBlock.toLocaleString()}`
                          : 'Unknown'
                      }
                    />
                    <Line
                      label="Oldest recorded"
                      value={
                        unix(data.firstSeen) !== null
                          ? formatRelativeTime(unix(data.firstSeen) as number)
                          : 'Unknown'
                      }
                    />
                    <Line
                      label="Most recent"
                      value={
                        unix(data.lastSeen) !== null
                          ? formatRelativeTime(unix(data.lastSeen) as number)
                          : 'Unknown'
                      }
                    />
                  </div>
                </>
              ) : data?.tracked ? (
                <p className="max-w-prose text-sm leading-relaxed text-secondary">
                  This token is on our watch list, but no transfers have reached us yet.
                  We only record activity from the moment a token starts being followed,
                  so a quiet token can sit here for a while.
                </p>
              ) : (
                <p className="max-w-prose text-sm leading-relaxed text-secondary">
                  We are not recording this token’s transfers. Add it to your watchlist
                  and we will start following it from that point onward.
                </p>
              )}

              {/*
                Said out loud rather than left as an empty panel. A blank section
                reads as "nothing to worry about"; this reads as "we have not
                checked", which is the truth and a very different message.
              */}
              <p className="max-w-prose border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
                Holder distribution and first buyers are not shown yet. Both need a
                token’s complete history, and we only have what has arrived since we
                started watching — working them out from a partial record produces
                numbers that look right and are not. We would rather show you nothing
                than that.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
