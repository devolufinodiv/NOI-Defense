import { useId, useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import { useThemeTokens } from '@/design/useThemeTokens'
import { formatUsd } from '@/lib/format'

export interface PricePoint {
  /** Unix seconds. */
  t: number
  usd: number
}

const TIME_LABEL = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const FULL_LABEL = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload as PricePoint
  return (
    <div className="rounded-md border border-hairline bg-card px-3 py-2 shadow-lifted">
      <div className="text-2xs text-muted">{FULL_LABEL.format(point.t * 1000)}</div>
      <div className="tabular mt-1 text-sm font-semibold text-primary">
        {formatUsd(point.usd)}
      </div>
    </div>
  )
}

/**
 * Price/series chart.
 *
 * Every default Recharts affordance is overridden: no white background, no blue
 * stroke, no vertical gridlines, no dot markers. Colours come from the resolved
 * theme rather than a static import, because Recharts takes them as JS props
 * and cannot ride the CSS variables.
 */
export function PriceChart({
  data,
  height = 220,
  tone,
}: {
  data: PricePoint[]
  height?: number
  /** Force a colour; otherwise derived from first vs. last value. */
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  const gradientId = useId()
  const { color, chart } = useThemeTokens()

  const stroke = useMemo(() => {
    const resolved =
      tone ??
      (data.length < 2
        ? 'neutral'
        : data[data.length - 1].usd >= data[0].usd
          ? 'positive'
          : 'negative')
    if (resolved === 'positive') return chart.positive
    if (resolved === 'negative') return chart.negative
    return chart.line
  }, [data, tone, chart])

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Horizontal rules only — vertical gridlines add noise, not information. */}
          <CartesianGrid stroke={chart.grid} strokeDasharray="2 4" vertical={false} />

          <XAxis
            dataKey="t"
            tickFormatter={(value: number) => TIME_LABEL.format(value * 1000)}
            stroke={chart.grid}
            tick={{ fill: chart.axis, fontSize: 10, fontFamily: 'Inter' }}
            tickLine={false}
            axisLine={{ stroke: chart.grid }}
            minTickGap={40}
          />
          <YAxis
            dataKey="usd"
            domain={['dataMin - 40', 'dataMax + 40']}
            tickFormatter={(value: number) => formatUsd(value, { compact: true })}
            stroke={chart.grid}
            tick={{ fill: chart.axis, fontSize: 10, fontFamily: 'Inter' }}
            tickLine={false}
            axisLine={false}
            width={62}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: chart.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
          />

          <Area
            type="monotone"
            dataKey="usd"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: stroke, stroke: color.card, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
