import { MoreVertical } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { DeltaPill } from '@/components/ui/Badge'
import { TokenMark } from '@/components/ui/TokenMark'
import { Quote } from '@/components/ui/Stat'
import { IconButton } from '@/components/ui/Button'
import { Sparkline, type SparkPoint } from '@/components/charts/Sparkline'
import { brandColor } from '@/design/tokens'
import { splitQuote } from '@/lib/format'

export interface CoinCardProps {
  symbol: string
  name: string
  pair: string
  priceUsd: number
  change24h: number
  series: SparkPoint[]
  /** In-app destination for the card body. */
  to: string
}

/**
 * Headline quote card.
 *
 * The brand-coloured rail and mark give each token instant identity at a glance;
 * gain/loss stays exclusively on the delta pill, which carries an arrow and a
 * sign as well as colour.
 */
export function CoinCard({
  symbol,
  name,
  pair,
  priceUsd,
  change24h,
  series,
  to,
}: CoinCardProps) {
  const { whole, fraction } = splitQuote(priceUsd)
  const tone = change24h >= 0 ? 'positive' : 'negative'

  return (
    <Card railColor={brandColor(symbol)} className="group flex flex-col">
      <div className="flex items-start gap-3 px-5 pt-5">
        <TokenMark symbol={symbol} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-muted">{pair}</div>
          <Link
            to={to}
            className="block truncate text-lg font-semibold tracking-heading text-primary transition-colors duration-180 hover:text-accent-text"
          >
            {name}
          </Link>
        </div>
        <IconButton size="sm" aria-label={`More actions for ${name}`}>
          <MoreVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
        </IconButton>
      </div>

      <div className="px-5 pt-4">
        <div className="text-xs text-muted">Price</div>
        <div className="mt-1 flex flex-wrap items-end gap-3">
          <Quote whole={whole} fraction={fraction} />
          <DeltaPill value={change24h} className="mb-1" />
        </div>
      </div>

      <div className="relative mt-2 px-2 pb-2">
        <Sparkline data={series} tone={tone} />
      </div>
    </Card>
  )
}
