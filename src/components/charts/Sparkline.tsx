import { useId, useMemo } from 'react'
import { useThemeTokens } from '@/design/useThemeTokens'

export interface SparkPoint {
  t: number
  usd: number
}

/**
 * Inline trend line for a coin card.
 *
 * Hand-drawn SVG rather than a chart library: at this size Recharts' axes,
 * tooltips and responsive container are pure overhead, and one path lets the
 * last point carry a label exactly where the reference puts it.
 *
 * Decorative — the numeric delta is always stated next to it in text, so this
 * is aria-hidden and never the sole carrier of the trend.
 */
export function Sparkline({
  data,
  tone,
  height = 84,
  label,
}: {
  data: SparkPoint[]
  tone: 'positive' | 'negative'
  height?: number
  /** Small callout pinned to the final point. */
  label?: string
}) {
  const gradientId = useId()
  const { color } = useThemeTokens()
  const stroke = tone === 'positive' ? color.positive : color.negative

  const { line, area, lastX, lastY } = useMemo(() => {
    const W = 320
    const H = height
    const pad = 10
    if (data.length < 2) return { line: '', area: '', lastX: 0, lastY: 0 }

    const values = data.map((d) => d.usd)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1

    const pts = data.map((d, i) => {
      const x = (i / (data.length - 1)) * W
      const y = H - pad - ((d.usd - min) / span) * (H - pad * 2)
      return [x, y] as const
    })

    // Catmull-Rom -> cubic bezier. A polyline reads as raw telemetry; the
    // smoothed curve is what makes the card feel considered, and with a low
    // tension it never overshoots the real data points.
    const path = pts.reduce((acc, point, i) => {
      if (i === 0) return `M${point[0].toFixed(1)},${point[1].toFixed(1)}`
      const p0 = pts[i - 2] ?? pts[i - 1]
      const p1 = pts[i - 1]
      const p2 = point
      const p3 = pts[i + 1] ?? point
      const t = 0.18
      const c1x = p1[0] + (p2[0] - p0[0]) * t
      const c1y = p1[1] + (p2[1] - p0[1]) * t
      const c2x = p2[0] - (p3[0] - p1[0]) * t
      const c2y = p2[1] - (p3[1] - p1[1]) * t
      return `${acc} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
    }, '')
    const [lx, ly] = pts[pts.length - 1]
    return {
      line: path,
      area: `${path} L${W},${H} L0,${H} Z`,
      lastX: lx,
      lastY: ly,
    }
  }, [data, height])

  if (!line) return null

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        aria-hidden
        viewBox={`0 0 320 ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.24} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Terminal marker + callout, positioned in percentage space so it tracks
          the path when the card resizes. */}
      <span
        aria-hidden
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${(lastX / 320) * 100}%`, top: `${(lastY / height) * 100}%` }}
      >
        <span
          className="block h-2 w-2 rounded-full border-2"
          style={{ borderColor: stroke, backgroundColor: color.card }}
        />
      </span>
      {label ? (
        <span
          aria-hidden
          className="tabular absolute right-1 top-0 text-xs font-medium text-secondary"
        >
          {label}
        </span>
      ) : null}
    </div>
  )
}
