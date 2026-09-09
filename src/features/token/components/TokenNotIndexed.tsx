import { DatabaseZap, Loader2, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HashRef } from '@/components/ui/Address'
import { useRequestIndexing } from '../queries'

/**
 * Empty state for a contract the indexer has never seen.
 *
 * Offers the one action that resolves it rather than dead-ending, and says what
 * indexing will actually do so the button isn't a leap of faith.
 */
export function TokenNotIndexed({
  chainId,
  address,
}: {
  chainId: number
  address: string
}) {
  const { mutate, isPending, isError, error } = useRequestIndexing(chainId, address)

  return (
    <Card className="mx-auto max-w-xl">
      <div className="flex flex-col items-start gap-4 p-8">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-hairline bg-raised text-muted">
          <DatabaseZap className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>

        <div>
          <h2 className="text-xl font-semibold tracking-heading text-primary">
            Token not yet indexed
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            Nothing has been ingested for this contract yet. Indexing walks it from the
            creation block to collect holders, early buyers and transfer history — usually
            under a minute for a recent token.
          </p>
        </div>

        <HashRef value={address} kind="token" chainId={chainId} />

        {isError ? (
          <p
            role="alert"
            className="flex items-start gap-2 text-sm text-negative"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <span>
              Could not start indexing
              {error instanceof Error && error.message ? `: ${error.message}` : '.'} Try again in a
              moment.
            </span>
          </p>
        ) : null}

        <Button variant="primary" onClick={() => mutate()} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
              Indexing…
            </>
          ) : (
            'Index this token'
          )}
        </Button>
      </div>
    </Card>
  )
}
