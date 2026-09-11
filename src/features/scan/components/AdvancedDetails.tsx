import { useState } from 'react'
import { ChevronDown, Loader2, Microscope } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { TermLabel } from '@/components/ui/Explain'
import { useAuth } from '@/store/auth'
import {
  useEarlyBuyers,
  useHealthFactors,
  useHolders,
  useRequestIndexing,
} from '@/features/token/queries'
import { HealthBreakdown } from '@/features/token/components/HealthBreakdown'
import { HolderDistribution } from '@/features/token/components/HolderDistribution'
import { EarlyBuyers } from '@/features/token/components/EarlyBuyers'

/**
 * Deeper history, behind a disclosure.
 *
 * The default scan answers "is this safe?" in one screen. This is the layer for
 * someone who wants to read the book rather than the verdict — holder
 * distribution, the first buyers and whether they sold. Collapsed by default
 * because showing it up front is exactly what makes these tools intimidating.
 *
 * The data comes from the background indexer, so it is absent until a deep
 * analysis has been run for this token.
 */
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
  const factors = useHealthFactors(chainId, address, open)
  const holders = useHolders(chainId, address, open)
  const buyers = useEarlyBuyers(chainId, address, open)
  const indexing = useRequestIndexing(chainId, address)

  const loading = factors.isLoading || holders.isLoading || buyers.isLoading
  const hasData =
    (factors.data?.length ?? 0) > 0 ||
    (holders.data?.length ?? 0) > 0 ||
    (buyers.data?.length ?? 0) > 0

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
          className={cn('h-4 w-4 shrink-0 text-muted transition-transform duration-180', open && 'rotate-180')}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="border-t border-hairline p-4">
          {!hasData && !loading ? (
            <div className="flex flex-col items-start gap-3 py-4">
              <p className="max-w-prose text-sm leading-relaxed text-secondary">
                Nobody has run the deep analysis for this token yet. It reads the token’s whole
                history from the blockchain, which takes a minute or two and happens in the
                background — you don’t have to wait here.
              </p>
              {user ? (
                <Button
                  variant="primary"
                  onClick={() => indexing.mutate()}
                  disabled={indexing.isPending || indexing.isSuccess}
                >
                  {indexing.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
                      Starting…
                    </>
                  ) : indexing.isSuccess ? (
                    'Queued — check back shortly'
                  ) : (
                    'Run the deep analysis'
                  )}
                </Button>
              ) : (
                <Badge tone="accent">Sign in to request this</Badge>
              )}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title={<TermLabel topic="concentration">How the score breaks down</TermLabel>}
                  subtitle="Each check, scored separately"
                />
                <CardBody className="pt-4">
                  <HealthBreakdown factors={factors.data} loading={factors.isLoading} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title={<TermLabel topic="holders">Biggest holders</TermLabel>}
                  subtitle="Top 10 wallets by share of supply"
                />
                <CardBody className="pt-4">
                  <HolderDistribution
                    holders={holders.data}
                    loading={holders.isLoading}
                    symbol={symbol}
                  />
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
          )}
        </div>
      ) : null}
    </div>
  )
}
