import { CheckCircle2, CircleAlert, HelpCircle, OctagonAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Skeleton } from '@/components/ui/Skeleton'
import { TIER_COPY, type ReasonTone, type ScanVerdict, type VerdictTier } from '../types'

const TIER_STYLE: Record<VerdictTier, { ring: string; text: string; bar: string; icon: typeof CheckCircle2 }> = {
  safe:    { ring: 'border-positive/30 bg-positive/10', text: 'text-positive', bar: 'bg-positive', icon: CheckCircle2 },
  caution: { ring: 'border-warning/30 bg-warning/10',   text: 'text-warning',  bar: 'bg-warning',  icon: CircleAlert },
  risk:    { ring: 'border-negative/30 bg-negative/10', text: 'text-negative', bar: 'bg-negative', icon: OctagonAlert },
  unknown: { ring: 'border-hairline bg-raised',         text: 'text-muted',    bar: 'bg-muted',    icon: HelpCircle },
}

const TONE_STYLE: Record<ReasonTone, { dot: string; text: string }> = {
  good:    { dot: 'bg-positive', text: 'text-secondary' },
  warn:    { dot: 'bg-warning',  text: 'text-secondary' },
  bad:     { dot: 'bg-negative', text: 'text-primary' },
  neutral: { dot: 'bg-muted',    text: 'text-muted' },
}

/**
 * The answer, before any of the detail.
 *
 * A newcomer opens a scan wanting one thing: should I touch this? So the plain
 * verdict and the recommended action come first, at the largest size on the
 * page, and every supporting finding is a full sentence rather than a metric.
 * The numbers are still below for anyone who wants them.
 */
export function VerdictCard({
  verdict,
  loading,
}: {
  verdict?: ScanVerdict
  loading: boolean
}) {
  if (loading || !verdict) {
    return (
      <div className="glass-panel rounded-xl border border-hairline p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="mt-5 space-y-2.5">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      </div>
    )
  }

  const style = TIER_STYLE[verdict.tier]
  const Icon = style.icon
  const copy = TIER_COPY[verdict.tier]

  // Worst-first: if something serious is wrong, it must be the first line read.
  const order: Record<ReasonTone, number> = { bad: 0, warn: 1, neutral: 2, good: 3 }
  const reasons = [...verdict.reasons].sort((a, b) => order[a.tone] - order[b.tone])

  return (
    <div className="glass-panel relative overflow-hidden rounded-xl border border-hairline">
      {/* Colour bar carries the verdict at a glance; the words carry it for
          anyone who cannot separate the colours. */}
      <div aria-hidden className={cn('absolute inset-x-0 top-0 h-1', style.bar)} />

      <div className="p-6 pt-7">
        <div className="flex flex-wrap items-start gap-4">
          <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-full border', style.ring)}>
            <Icon className={cn('h-7 w-7', style.text)} strokeWidth={2} aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className={cn('text-2xl font-semibold tracking-heading', style.text)}>
              {copy.label}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-secondary">{verdict.summary}</p>
            <p className="mt-2 text-sm font-medium text-primary">{copy.action}</p>
          </div>
        </div>

        {reasons.length > 0 ? (
          <ul className="mt-6 space-y-3 border-t border-hairline pt-5">
            {reasons.map((reason, i) => {
              const tone = TONE_STYLE[reason.tone]
              return (
                <li key={i} className="flex items-start gap-3">
                  <span aria-hidden className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />
                  <span className={cn('text-sm leading-relaxed', tone.text)}>{reason.text}</span>
                </li>
              )
            })}
          </ul>
        ) : null}

        <p className="mt-6 border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
          These are automated checks, not financial advice. They catch common traps — they cannot
          tell you whether a price will go up, and a clean result is not a promise.
        </p>
      </div>
    </div>
  )
}
