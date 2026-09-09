import { Link } from 'react-router-dom'
import { TokenMark } from '@/components/ui/TokenMark'
import { truncateAddress } from '@/lib/format'

/**
 * Real contracts on different networks, offered as one-tap starting points.
 *
 * Doing more work than a "try this" link: it proves the multi-chain claim in
 * the headline concretely, and gets a first-time visitor to a populated screen
 * without having to go and find an address themselves.
 *
 * These are real, publicly verifiable mainnet contracts — the metrics behind
 * them are synthetic while the indexer is being built.
 */
const EXAMPLES = [
  { symbol: 'WETH', label: 'WETH', chainId: 8453, chain: 'Base', address: '0x4200000000000000000000000000000000000006' },
  { symbol: 'USDC', label: 'USDC', chainId: 1, chain: 'Ethereum', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { symbol: 'AERO', label: 'AERO', chainId: 8453, chain: 'Base', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631' },
]

export function HeroExamples() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">Try one:</span>
      {EXAMPLES.map((example) => (
        <Link
          key={`${example.chainId}-${example.address}`}
          to={`/token/${example.address}?chain=${example.chainId}`}
          className="glass-panel group flex items-center gap-2 rounded-full border border-hairline py-1 pl-1 pr-3 transition-colors duration-180 hover:border-hairline-strong"
        >
          <TokenMark symbol={example.symbol} size="sm" />
          <span className="text-xs font-medium text-primary">{example.label}</span>
          <span className="font-mono text-2xs text-muted">
            {truncateAddress(example.address, 6, 4)}
          </span>
          <span className="rounded-full border border-hairline bg-raised px-1.5 py-0.5 text-[10px] text-muted">
            {example.chain}
          </span>
        </Link>
      ))}
    </div>
  )
}
