/** Shapes returned by the scan endpoint. Provider-agnostic by design. */

export type VerdictTier = 'safe' | 'caution' | 'risk' | 'unknown'
export type ReasonTone = 'good' | 'warn' | 'bad' | 'neutral'

export interface ScanToken {
  chainId: number
  address: string
  name: string
  symbol: string
  verified: boolean | null
}

export interface ScanMarket {
  priceUsd: number | null
  change24h: number | null
  liquidityUsd: number | null
  volume24hUsd: number | null
  fdvUsd: number | null
  pairCount: number
  primaryVenue: string | null
}

export interface ScanSafety {
  isHoneypot: boolean | null
  buyTax: number | null
  sellTax: number | null
  transferTax: number | null
  simulationOk: boolean
  flags: string[]
}

export interface ScanVerdict {
  tier: VerdictTier
  headline: string
  summary: string
  reasons: Array<{ tone: ReasonTone; text: string }>
}

/** When the contract was deployed, and by whom. */
export interface ScanAge {
  status: 'ok' | 'not-a-contract' | 'not-configured' | 'chain-unsupported' | 'failed'
  deployedAt: string | null
  deploymentBlock: number | null
  deployedBy: string | null
}

/**
 * How much of the pool cannot be withdrawn.
 *
 * `lockedPercent` only covers lockers we recognise, so a low number means
 * "we did not find a lock", never "there is no lock".
 */
export interface ScanLock {
  status: 'ok' | 'no-pool' | 'not-applicable' | 'chain-unsupported' | 'failed'
  pairAddress: string | null
  venue: string | null
  burnedPercent: number | null
  lockedPercent: number | null
  lockersChecked: number
}

export interface ScanResult {
  token: ScanToken
  market: ScanMarket | null
  safety: ScanSafety | null
  /** Null on a cached reply: both are read live and are never replayed. */
  age: ScanAge | null
  lock: ScanLock | null
  verdict: ScanVerdict
  cached: boolean
}

/** Turns each tier into something a first-timer can act on. */
export const TIER_COPY: Record<VerdictTier, { label: string; action: string }> = {
  safe: {
    label: 'Looks OK',
    action: 'Nothing obvious is wrong — but still only risk what you can afford to lose.',
  },
  caution: {
    label: 'Be careful',
    action: 'Read the findings below before you buy anything.',
  },
  risk: {
    label: 'High risk',
    action: 'We would not put money into this.',
  },
  unknown: {
    label: 'Unproven',
    action: 'We could not verify enough to judge it either way.',
  },
}
