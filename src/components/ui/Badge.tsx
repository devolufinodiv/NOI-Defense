import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatPercent, type Tone } from '@/lib/format'

type BadgeTone = Tone | 'accent' | 'warning'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-raised text-secondary border-hairline',
  positive: 'bg-positive/12 text-positive border-positive/25',
  negative: 'bg-negative/12 text-negative border-negative/25',
  accent: 'bg-accent/12 text-accent-text border-accent/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
}

/** Pill chip. Rounded fully — this register reads as a status token, not a button. */
export function Badge({
  children,
  tone = 'neutral',
  className,
  mono = false,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
  mono?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium',
        mono && 'font-mono',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Signed percentage pill.
 *
 * Carries THREE redundant cues — arrow direction, explicit +/- sign, and colour —
 * so the value survives colour-blindness and greyscale printing. Never encode
 * direction with colour alone.
 */
export function DeltaPill({
  value,
  showIcon = true,
  className,
}: {
  value: number
  showIcon?: boolean
  className?: string
}) {
  const up = value >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
        up ? TONES.positive : TONES.negative,
        className,
      )}
    >
      {showIcon ? <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden /> : null}
      {formatPercent(value, { signed: true })}
    </span>
  )
}

/** Standing marker that surrounding figures are fixtures, not chain truth. */
export function MockBadge({ className }: { className?: string }) {
  return (
    <span
      title="Synthetic scaffolding data — not read from chain"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10',
        'px-2.5 py-1 text-2xs font-medium uppercase tracking-label text-warning',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
      Mock data
    </span>
  )
}
