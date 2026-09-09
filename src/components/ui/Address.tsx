import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { truncateAddress, truncateHash } from '@/lib/format'
import { explorerAddressUrl, explorerTokenUrl, explorerTxUrl } from '@/config/chains'
import { useActiveChain } from '@/store/chain'
import { CopyButton } from './CopyButton'

type Kind = 'address' | 'token' | 'tx'

export interface HashRefProps {
  value: string
  kind?: Kind
  /** Link the label to the in-app detail page. Ignored for `tx`. */
  to?: string
  chainId?: number
  className?: string
  /** Hide the explorer link (e.g. inside an already-busy cell). */
  hideExplorer?: boolean
  /** Show the full value instead of truncating. */
  full?: boolean
}

/**
 * The canonical rendering for any on-chain identifier.
 *
 * Always monospace, always truncated to `0x1234…ab90`, always with copy and an
 * explorer link — per the design system, no bare address strings anywhere.
 */
export function HashRef({
  value,
  kind = 'address',
  to,
  chainId,
  className,
  hideExplorer = false,
  full = false,
}: HashRefProps) {
  // Explorer links must follow the network being investigated, not a build
  // constant — the same address exists on every EVM chain.
  const activeChain = useActiveChain()
  const resolvedChainId = chainId ?? activeChain.chain.id

  const label = full
    ? value
    : kind === 'tx'
      ? truncateHash(value)
      : truncateAddress(value)

  const explorerHref =
    kind === 'tx'
      ? explorerTxUrl(value, resolvedChainId)
      : kind === 'token'
        ? explorerTokenUrl(value, resolvedChainId)
        : explorerAddressUrl(value, resolvedChainId)

  // Hex stays monospace even though prices do not: truncated addresses and
  // hashes must read as code, and fixed-width digits make them eyeball-matchable.
  const labelClasses = 'font-mono text-xs text-primary transition-colors duration-180'

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {to ? (
        <Link
          to={to}
          // Negative margin cancels the padding, so the tap target grows to 32px
          // without changing the row's layout. It stays inside the row's own
          // height, so adjacent rows' targets never overlap.
          className={cn(labelClasses, 'inline-block -my-2 py-2 hover:text-accent-text')}
        >
          {label}
        </Link>
      ) : (
        <span className={labelClasses}>{label}</span>
      )}

      <CopyButton value={value} label={`Copy ${kind}`} />

      {hideExplorer ? null : (
        <a
          href={explorerHref}
          target="_blank"
          rel="noreferrer noopener"
          title="View on explorer"
          aria-label={`View ${kind} on block explorer`}
          onClick={(event) => event.stopPropagation()}
          className="inline-grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-xs text-muted transition-colors duration-180 hover:bg-raised hover:text-primary"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      )}
    </span>
  )
}
