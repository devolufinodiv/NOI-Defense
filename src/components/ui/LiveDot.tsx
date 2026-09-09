import { cn } from '@/lib/cn'

/** Breathing dot for live/streaming state. */
export function LiveDot({
  className,
  label,
  tone = 'positive',
}: {
  className?: string
  label?: string
  tone?: 'positive' | 'muted'
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          tone === 'positive' ? 'animate-pulse-dot bg-positive' : 'bg-muted',
        )}
      />
      {label ? <span className="text-xs text-muted">{label}</span> : null}
    </span>
  )
}

/** The ringed dot used beside "Last update" in the reference. */
export function RingDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-full border border-hairline-strong bg-raised',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
    </span>
  )
}
