import { Link } from 'react-router-dom'
import { Pin, ShieldAlert, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { DeltaPill } from '@/components/ui/Badge'
import { TokenMark } from '@/components/ui/TokenMark'
import { brandColor } from '@/design/tokens'
import { chainMeta } from '@/config/chains'
import { formatRelativeTime, formatUsd, truncateAddress } from '@/lib/format'
import type { FeaturedToken } from './queries'

/**
 * One featured token.
 *
 * Every figure on this card was recorded by an actual scan. Where a figure was
 * never recorded the card says so rather than printing a zero — a token with no
 * price is not a token worth $0.00, and the difference matters to someone
 * deciding whether to buy it.
 *
 * There is deliberately no price chart. We keep no price history, so any curve
 * drawn here would be invented.
 */
export function FeaturedScanCard({ token }: { token: FeaturedToken }) {
  const chain = chainMeta(token.chainId)
  const label = token.symbol || truncateAddress(token.address)
  const name = token.name || 'Unnamed contract'

  const scanned = token.lastScannedAt
    ? formatRelativeTime(Math.floor(new Date(token.lastScannedAt).getTime() / 1000))
    : null

  return (
    <Card interactive railColor={brandColor(token.symbol || token.address)} className="flex flex-col">
      <Link to={`/token/${token.address}`} className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          <TokenMark symbol={token.symbol || '?'} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-lg font-semibold tracking-heading text-primary">
                {label}
              </span>
              {token.pinned ? (
                <span className="chip shrink-0 gap-1 text-[11px]" title="Chosen by an admin">
                  <Pin className="h-3 w-3" strokeWidth={2} aria-hidden />
                  Pinned
                </span>
              ) : null}
            </div>
            <div className="truncate text-xs text-muted">
              {name}
              {chain ? ` · ${chain.label}` : null}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {token.priceUsd === null ? (
            <div className="text-sm text-muted">No price recorded for this token.</div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <span className="tabular text-2xl font-semibold text-primary">
                {formatUsd(token.priceUsd)}
              </span>
              {token.change24h === null ? null : (
                <DeltaPill value={token.change24h} className="mb-1" />
              )}
            </div>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-muted">Liquidity</dt>
            <dd className="tabular mt-0.5 text-secondary">
              {token.liquidityUsd === null
                ? 'Not recorded'
                : formatUsd(token.liquidityUsd, { compact: true })}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Scanned here</dt>
            <dd className="tabular mt-0.5 text-secondary">
              {token.scanCount === 1 ? 'once' : `${token.scanCount.toLocaleString('en-US')} times`}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-start gap-2 border-t border-hairline pt-3 text-xs">
          <SafetyNote token={token} />
        </div>

        {scanned ? (
          <div className="mt-2 text-[11px] text-muted">Last scanned {scanned}</div>
        ) : null}
      </Link>
    </Card>
  )
}

/**
 * The single most important thing the scan found, in plain words.
 *
 * Silence is reported as silence: a check that never ran reads as "not checked",
 * never as a clean bill of health.
 */
function SafetyNote({ token }: { token: FeaturedToken }) {
  if (token.isHoneypot === true) {
    return (
      <>
        <ShieldAlert className="h-4 w-4 shrink-0 text-negative" strokeWidth={2} aria-hidden />
        <span className="text-negative">A test sale failed — you may not be able to sell this.</span>
      </>
    )
  }

  if (token.sellTax !== null && token.sellTax >= 10) {
    return (
      <>
        <TriangleAlert className="h-4 w-4 shrink-0 text-warning" strokeWidth={2} aria-hidden />
        <span className="text-secondary">
          Selling costs a {token.sellTax.toFixed(0)}% fee.
        </span>
      </>
    )
  }

  if (token.isHoneypot === false) {
    return (
      <>
        <ShieldCheck className="h-4 w-4 shrink-0 text-positive" strokeWidth={2} aria-hidden />
        <span className="text-secondary">A test buy and sale both went through.</span>
      </>
    )
  }

  if (token.sourceVerified === false) {
    return (
      <>
        <TriangleAlert className="h-4 w-4 shrink-0 text-warning" strokeWidth={2} aria-hidden />
        <span className="text-secondary">The code behind this token has not been published.</span>
      </>
    )
  }

  return (
    <>
      <TriangleAlert className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
      <span className="text-muted">Safety checks did not run on this network.</span>
    </>
  )
}
