import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useTrustedTokens } from './queries'
import { TrustedRow } from './TrustedRow'

/**
 * The landing page's trusted list.
 *
 * Asks only for tokens that pass the checks right now. An admin can curate the
 * list and set its order, but a curated token that fails its latest scan does
 * not reach the front page — it stays on the directory, marked.
 */
export function TrustedList({ limit = 5 }: { limit?: number }) {
  const trusted = useTrustedTokens(limit, false)

  // Nothing passes yet — say nothing rather than frame an empty promise.
  if (!trusted.isLoading && (!trusted.data || trusted.data.length === 0)) return null

  return (
    <div className="mx-auto w-full max-w-2xl text-left">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-heading text-primary">Trusted tokens</h2>
        <Link
          to="/trusted"
          className="inline-flex items-center gap-1 text-xs text-secondary transition-colors duration-180 hover:text-primary"
        >
          View all
          <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
        </Link>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-muted">
        Each passed its latest scan: a test sale went through, the sell fee is small, and there is
        real depth behind it. Not investment advice.
      </p>

      <ul className="glass-panel mt-4 divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
        {trusted.isLoading
          ? Array.from({ length: limit }, (_, i) => (
              <li key={i} className="h-[62px] animate-pulse bg-raised/30" />
            ))
          : trusted.data?.map((token, index) => (
              <TrustedRow key={`${token.chainId}:${token.address}`} token={token} rank={index + 1} />
            ))}
      </ul>
    </div>
  )
}
