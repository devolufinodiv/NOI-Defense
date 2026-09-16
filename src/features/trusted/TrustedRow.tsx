import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BadgeCheck, Check, TriangleAlert } from 'lucide-react'
import { chainMeta } from '@/config/chains'
import { TokenMark } from '@/components/ui/TokenMark'
import { ChainMark } from '@/components/ui/ChainMark'
import { DeltaPill } from '@/components/ui/Badge'
import { formatUsd } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { TrustedToken } from './queries'

/**
 * One trusted token, as a single scannable line.
 *
 * Shared by the landing list and the directory so the two can never disagree
 * about what a row says. The evidence line is always the checks result — never
 * the admin's note in its place — so curation adds context without replacing
 * the facts.
 */
export function TrustedRow({
  token,
  rank,
  showNote = false,
  actions,
}: {
  token: TrustedToken
  rank?: number
  showNote?: boolean
  /** Admin controls, rendered outside the link so they are separate targets. */
  actions?: ReactNode
}) {
  const chain = chainMeta(token.chainId)

  return (
    <li className="flex items-stretch">
      <Link
        to={`/token/${token.address}?chain=${token.chainId}`}
        className="group flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors duration-180 hover:bg-raised/60"
      >
        {rank !== undefined ? (
          <span className="tabular w-4 shrink-0 text-xs text-muted">{rank}</span>
        ) : null}

        <span className="relative shrink-0">
          <TokenMark symbol={token.symbol || '?'} size="md" chainId={token.chainId} address={token.address} />
          <ChainMark
            chainId={token.chainId}
            size="xs"
            className="absolute -bottom-0.5 -right-0.5 ring-2 ring-surface"
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-primary">{token.symbol || token.name}</span>
            {token.curated ? (
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 text-accent-text"
                strokeWidth={2}
                aria-label="Chosen by our team"
              />
            ) : null}
            {token.category ? (
              <span className="rounded-full border border-hairline px-1.5 py-px text-[10px] text-muted">
                {token.category}
              </span>
            ) : null}
          </span>

          <Evidence token={token} chainLabel={chain?.label} />

          {showNote && token.note ? (
            <span className="mt-1 block text-xs leading-snug text-secondary">{token.note}</span>
          ) : null}
        </span>

        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-xs text-muted">Depth</span>
          <span className="tabular block text-xs text-secondary">
            {token.liquidityUsd === null ? '—' : formatUsd(token.liquidityUsd, { compact: true })}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="tabular block text-sm text-primary">
            {token.priceUsd === null ? '—' : formatUsd(token.priceUsd)}
          </span>
          {token.change24h === null ? null : (
            <DeltaPill value={token.change24h} showIcon={false} className="mt-0.5" />
          )}
        </span>

        <ArrowUpRight
          className="hidden h-4 w-4 shrink-0 text-muted transition-colors duration-180 group-hover:text-primary sm:block"
          strokeWidth={2}
          aria-hidden
        />
      </Link>

      {actions ? (
        <span className="flex shrink-0 items-center gap-1 border-l border-hairline px-2">{actions}</span>
      ) : null}
    </li>
  )
}

function Evidence({ token, chainLabel }: { token: TrustedToken; chainLabel?: string }) {
  if (!token.passesChecks) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-warning">
        <TriangleAlert className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
        <span className="truncate">
          {token.isHoneypot === true
            ? 'Test sale failed on the latest scan'
            : token.sellTax !== null && token.sellTax >= 10
              ? `Sell fee is ${token.sellTax.toFixed(0)}% on the latest scan`
              : token.liquidityUsd !== null && token.liquidityUsd < 50_000
                ? 'Liquidity is thin on the latest scan'
                : 'Does not currently pass our checks'}
        </span>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <Check className="h-3 w-3 shrink-0 text-positive" strokeWidth={2.5} aria-hidden />
      <span className={cn('truncate')}>
        {token.sellTax === 0
          ? 'Sells with no fee'
          : token.sellTax === null
            ? 'Sale tested'
            : `Sells at a ${token.sellTax.toFixed(1)}% fee`}
        {chainLabel ? ` · ${chainLabel}` : null}
      </span>
    </span>
  )
}
