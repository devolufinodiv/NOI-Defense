import { Check, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Skeleton } from '@/components/ui/Skeleton'
import type { FactorStatus, HealthFactor } from '../types'

const STATUS_META: Record<
  FactorStatus,
  { icon: typeof Check; text: string; bar: string; ring: string; label: string }
> = {
  pass: {
    icon: Check,
    text: 'text-positive',
    bar: 'bg-positive',
    ring: 'border-positive/30 bg-positive/10',
    label: 'Pass',
  },
  warn: {
    icon: AlertTriangle,
    text: 'text-warning',
    bar: 'bg-warning',
    ring: 'border-warning/30 bg-warning/10',
    label: 'Warning',
  },
  fail: {
    icon: X,
    text: 'text-negative',
    bar: 'bg-negative',
    ring: 'border-negative/30 bg-negative/10',
    label: 'Fail',
  },
}

function FactorRow({ factor }: { factor: HealthFactor }) {
  const meta = STATUS_META[factor.status]
  const Icon = meta.icon

  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      {/* Icon shape differs per status, so the row is legible without colour. */}
      <span
        className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border', meta.ring)}
      >
        <Icon className={cn('h-3.5 w-3.5', meta.text)} strokeWidth={2.5} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium text-primary">{factor.label}</span>
          <span className={cn('tabular shrink-0 text-sm font-semibold', meta.text)}>
            {factor.score}
            <span className="sr-only"> out of 100 — {meta.label}</span>
          </span>
        </div>

        <p className="mt-0.5 truncate text-xs text-muted">{factor.detail}</p>

        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-raised"
          role="meter"
          aria-valuenow={factor.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${factor.label}: ${meta.label}`}
        >
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', meta.bar)}
            style={{ width: `${factor.score}%` }}
          />
        </div>
      </div>
    </li>
  )
}

export function HealthBreakdown({
  factors,
  loading,
}: {
  factors?: HealthFactor[]
  loading: boolean
}) {
  if (loading || !factors) {
    return (
      <ul className="divide-y divide-hairline">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-start gap-3 py-3.5 first:pt-0">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-2.5 w-56" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="divide-y divide-hairline">
      {factors.map((factor) => (
        <FactorRow key={factor.id} factor={factor} />
      ))}
    </ul>
  )
}
