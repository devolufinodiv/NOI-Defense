import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/store/auth'
import { useMyPoints } from './queries'

/**
 * Running points total, shown in the top bar.
 *
 * Flashes when the number goes up. The award happens in the database after the
 * action, so the increment arrives a moment later — the flash is what connects
 * the two in the user's head, otherwise points appear to change at random.
 */
export function PointsBadge({ className }: { className?: string }) {
  const { user } = useAuth()
  const { data } = useMyPoints()
  const previous = useRef<number | null>(null)
  const [bumped, setBumped] = useState(false)

  useEffect(() => {
    if (data?.total === undefined) return
    if (previous.current !== null && data.total > previous.current) {
      setBumped(true)
      const timer = window.setTimeout(() => setBumped(false), 900)
      previous.current = data.total
      return () => window.clearTimeout(timer)
    }
    previous.current = data.total
  }, [data?.total])

  if (!user || data === undefined) return null

  return (
    <Link
      to="/rewards"
      title={`${data.total} points · ranked ${data.rank} of ${data.of}`}
      className={cn(
        'flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-hairline bg-raised/50 px-3',
        'transition-colors duration-180 hover:border-hairline-strong',
        bumped && 'animate-flash',
        className,
      )}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-warning" strokeWidth={2} aria-hidden />
      <span className="tabular text-sm font-semibold text-primary">
        {data.total.toLocaleString('en-US')}
      </span>
      <span className="hidden text-xs text-muted sm:inline">pts</span>
    </Link>
  )
}
