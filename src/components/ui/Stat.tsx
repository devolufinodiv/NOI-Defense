import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { Tone } from '@/lib/format'

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-primary',
  positive: 'text-positive',
  negative: 'text-negative',
}

/**
 * A labelled metric. Values are tabular so a row of stats aligns digit-for-digit
 * and doesn't reflow when a live figure ticks.
 */
export function Stat({
  label,
  value,
  delta,
  tone = 'neutral',
  flash = false,
  className,
}: {
  label: string
  value: ReactNode
  delta?: ReactNode
  tone?: Tone
  /** Brief glow when the value has just changed. */
  flash?: boolean
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-xs text-muted">{label}</div>
      <div
        className={cn(
          'tabular mt-1.5 truncate text-2xl font-semibold tracking-tightest',
          TONE_TEXT[tone],
          flash && 'animate-flash rounded-sm',
        )}
      >
        {value}
      </div>
      {delta ? <div className="mt-1.5">{delta}</div> : null}
    </div>
  )
}

/**
 * Large price readout. The fractional part drops to muted so the eye lands on
 * the magnitude first — the detail that makes a quote feel designed rather than
 * merely printed.
 */
export function Quote({
  whole,
  fraction,
  prefix = '$',
  className,
}: {
  whole: string
  fraction?: string
  prefix?: string
  className?: string
}) {
  return (
    <div className={cn('tabular text-quote font-semibold text-primary', className)}>
      <span className="text-secondary">{prefix}</span>
      {whole}
      {fraction ? <span className="text-muted">.{fraction}</span> : null}
    </div>
  )
}
