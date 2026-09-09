import { useId } from 'react'
import { cn } from '@/lib/cn'
import { healthTier, TIER_LABEL, type HealthTier } from '../types'

const TIER_STROKE: Record<HealthTier, string> = {
  healthy: 'stroke-positive',
  caution: 'stroke-warning',
  risk: 'stroke-negative',
}

const TIER_TEXT: Record<HealthTier, string> = {
  healthy: 'text-positive',
  caution: 'text-warning',
  risk: 'text-negative',
}

/**
 * Circular health gauge — the visual anchor of the scanner page.
 *
 * The tier is stated in words beneath the number, not just in the arc colour:
 * a red-green ring is exactly the encoding that disappears for the ~8% of men
 * with deuteranopia, and this is the single most consequential number on the
 * page.
 *
 * Note: the brief called for cyan at the top tier, but the palette no longer
 * carries a cyan — the accent is neutral by design. Green/amber/red is the
 * semantic trio the rest of the product already uses for exactly this meaning.
 */
export function HealthGauge({
  score,
  size = 200,
  className,
}: {
  score: number
  size?: number
  className?: string
}) {
  const titleId = useId()
  const clamped = Math.max(0, Math.min(100, score))
  const tier = healthTier(clamped)

  const stroke = 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  // Leave the bottom quarter open so the arc reads as a gauge, not a pie.
  const arcSpan = 0.75
  const arcLength = circumference * arcSpan
  const offset = arcLength * (1 - clamped / 100)

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-labelledby={titleId}
        // Rotate so the gap sits at the bottom, centred.
        className="-rotate-[225deg]"
      >
        <title id={titleId}>
          Health score {clamped} out of 100 — {TIER_LABEL[tier]}
        </title>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          className="stroke-hairline"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          className={cn('animate-gauge-sweep', TIER_STROKE[tier])}
          style={
            {
              '--gauge-circumference': `${arcLength}px`,
              '--gauge-offset': `${offset}px`,
            } as React.CSSProperties
          }
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={cn('tabular text-5xl font-semibold tracking-tightest', TIER_TEXT[tier])}>
            {clamped}
          </div>
          <div className="mt-0.5 text-xs text-muted">out of 100</div>
          <div className={cn('mt-2 text-sm font-medium', TIER_TEXT[tier])}>
            {TIER_LABEL[tier]}
          </div>
        </div>
      </div>
    </div>
  )
}
