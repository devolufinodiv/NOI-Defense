import { useMemo } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { formatUsd } from '@/lib/format'
import { useTokenSeries, MIN_POINTS_FOR_A_LINE, type Reading } from './queries'

/**
 * What we have actually seen of a token over time.
 *
 * The readings are spaced by when people looked, not by the clock, so the
 * x-axis is real elapsed time and the dots are drawn on the line to show where
 * an observation exists. A gap is a gap — nothing is interpolated into it.
 *
 * Below a handful of points there is no shape worth drawing. Two readings
 * joined by a line look exactly like a trend and are not one, so the card says
 * how many readings it has and waits.
 */
export function TokenHistory({
  chainId,
  address,
}: {
  chainId: number
  address: string
}) {
  const series = useTokenSeries(chainId, address, 168)
  const readings = series.data ?? []

  const price = useMemo(() => buildPath(readings, (r) => r.priceUsd), [readings])
  const depth = useMemo(() => buildPath(readings, (r) => r.liquidityUsd), [readings])

  if (series.isLoading) {
    return (
      <Card>
        <CardHeader title="What we have seen" />
        <CardBody className="pt-4">
          <span className="block h-28 animate-pulse rounded-lg bg-raised/50" />
        </CardBody>
      </Card>
    )
  }

  if (readings.length < MIN_POINTS_FOR_A_LINE) {
    return (
      <Card>
        <CardHeader title="What we have seen" subtitle="Readings taken when this token is scanned" />
        <CardBody className="pt-4">
          <p className="text-sm leading-relaxed text-secondary">
            {readings.length === 0
              ? 'No readings recorded yet. The first scan of this token starts its history.'
              : `Only ${readings.length} ${readings.length === 1 ? 'reading' : 'readings'} so far — not enough to show a shape. Scanning it again over the next few days will fill this in.`}
          </p>
        </CardBody>
      </Card>
    )
  }

  const first = readings[0]
  const last = readings[readings.length - 1]
  const span = last.at - first.at
  const days = span / 86_400_000

  return (
    <Card>
      <CardHeader
        title="What we have seen"
        subtitle={`${readings.length} readings over ${days < 1 ? 'under a day' : `${Math.round(days)} days`}`}
      />
      <CardBody className="space-y-5 pt-4">
        <Trace
          label="Price"
          path={price}
          latest={last.priceUsd === null ? null : formatUsd(last.priceUsd)}
          earliest={first.priceUsd === null ? null : formatUsd(first.priceUsd)}
        />
        <Trace
          label="Liquidity depth"
          path={depth}
          latest={last.liquidityUsd === null ? null : formatUsd(last.liquidityUsd, { compact: true })}
          earliest={first.liquidityUsd === null ? null : formatUsd(first.liquidityUsd, { compact: true })}
        />
        <p className="text-[11px] leading-relaxed text-muted">
          Each dot is a moment this token was scanned, so the spacing follows attention rather than
          the clock. Nothing is filled in between them.
        </p>
      </CardBody>
    </Card>
  )
}

function Trace({
  label,
  path,
  latest,
  earliest,
}: {
  label: string
  path: { line: string; dots: Array<{ x: number; y: number }> } | null
  latest: string | null
  earliest: string | null
}) {
  if (!path) {
    return (
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-1 text-sm text-muted">Not recorded</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted">{label}</span>
        <span className="tabular text-xs text-secondary">
          {earliest} <span className="text-muted">→</span> {latest}
        </span>
      </div>

      <svg
        viewBox="0 0 320 56"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} moved from ${earliest} to ${latest} across the recorded readings`}
        className="mt-1.5 h-14 w-full overflow-visible"
      >
        <path
          d={path.line}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent-text"
          vectorEffect="non-scaling-stroke"
        />
        {path.dots.map((dot, i) => (
          <circle key={i} cx={dot.x} cy={dot.y} r="1.6" className="fill-current text-muted" />
        ))}
      </svg>
    </div>
  )
}

/**
 * Points positioned by real elapsed time, not by index.
 *
 * Spacing readings evenly would hide the gaps, and the gaps are the honest part
 * — a week with no scans should look like a week with no scans.
 */
function buildPath(
  readings: Reading[],
  pick: (r: Reading) => number | null,
): { line: string; dots: Array<{ x: number; y: number }> } | null {
  const points = readings
    .map((r) => ({ at: r.at, value: pick(r) }))
    .filter((p): p is { at: number; value: number } => p.value !== null)

  if (points.length < MIN_POINTS_FOR_A_LINE) return null

  const W = 320
  const H = 56
  const pad = 4

  const times = points.map((p) => p.at)
  const values = points.map((p) => p.value)
  const tMin = Math.min(...times)
  const tSpan = Math.max(...times) - tMin || 1
  const vMin = Math.min(...values)
  const vSpan = Math.max(...values) - vMin || 1

  const dots = points.map((p) => ({
    x: ((p.at - tMin) / tSpan) * W,
    // A flat series sits in the middle rather than pinned to an edge.
    y: H - pad - ((p.value - vMin) / vSpan) * (H - pad * 2),
  }))

  const line = dots
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${d.x.toFixed(2)},${d.y.toFixed(2)}`)
    .join(' ')

  return { line, dots }
}
