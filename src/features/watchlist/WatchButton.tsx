import { Bell, BellRing, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/store/auth'
import { useToggleWatch } from './queries'

/**
 * Adds this contract to the alert watchlist.
 *
 * Offered on every scan result: the moment somebody has decided a token is
 * worth watching is the moment they are looking at its scan, not later from a
 * separate screen.
 */
export function WatchButton({
  chainId,
  address,
  symbol,
  name,
  kind = 'token',
  className,
}: {
  chainId: number
  address: string
  symbol?: string
  name?: string
  kind?: 'token' | 'wallet'
  className?: string
}) {
  const { user } = useAuth()
  const { watched, mutate, isPending, isError, error } = useToggleWatch(chainId, address)

  if (!user) {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <Button variant="secondary" disabled>
          <Bell className="h-4 w-4" strokeWidth={2} aria-hidden />
          Alert me if this changes
        </Button>
        <span className="text-xs text-muted">Sign in to turn on alerts</span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Button
        variant={watched ? 'secondary' : 'primary'}
        onClick={() => mutate({ symbol, name, kind })}
        disabled={isPending}
        aria-pressed={watched}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
        ) : watched ? (
          <BellRing className="h-4 w-4 text-positive" strokeWidth={2} aria-hidden />
        ) : (
          <Bell className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
        {watched ? 'Alerts on' : 'Alert me if this changes'}
      </Button>

      <p className="text-xs leading-relaxed text-muted">
        {watched
          ? 'We check this every few minutes and will tell you if money starts leaving, or the price moves sharply.'
          : 'We will watch the pool and the price, and tell you if something worrying happens.'}
      </p>

      {isError ? (
        <p role="alert" className="text-xs text-negative">
          {error instanceof Error ? error.message : 'Could not update your alerts.'}
        </p>
      ) : null}
    </div>
  )
}
