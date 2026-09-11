import { ExternalLink, Network } from 'lucide-react'
import { bubblemapUrl } from '@/lib/bubblemap'
import { Explain } from '@/components/ui/Explain'

/**
 * Link out to the holder-cluster map for this address.
 *
 * Rendered for both tokens and wallets. On networks the map does not cover it
 * renders nothing at all rather than a dead link — a click that lands on
 * "unsupported chain" spends the user's trust for nothing.
 */
export function HolderMapLink({
  chainId,
  address,
  subject = 'token',
}: {
  chainId: number
  address: string
  subject?: 'token' | 'wallet'
}) {
  const href = bubblemapUrl(chainId, address)
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="glass-panel group flex items-center gap-3 rounded-lg border border-hairline p-4 transition-colors duration-180 hover:border-hairline-strong"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline bg-raised text-secondary">
        <Network className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
          See who owns it
          <Explain topic="bubblemap" />
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">
          {subject === 'token'
            ? 'Opens a visual map of the biggest holders and which wallets are linked to each other.'
            : 'Opens a visual map of this wallet’s connections to other wallets.'}
        </span>
      </span>
      <ExternalLink
        className="h-4 w-4 shrink-0 text-muted transition-colors duration-180 group-hover:text-primary"
        strokeWidth={2}
        aria-hidden
      />
    </a>
  )
}
