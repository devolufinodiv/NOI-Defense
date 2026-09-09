/** Domain types for the token scanner. Shared by the mock and real adapters. */

export type HealthTier = 'healthy' | 'caution' | 'risk'
export type FactorStatus = 'pass' | 'warn' | 'fail'
export type HoldStatus = 'holding' | 'partial' | 'sold'
export type TradeDirection = 'buy' | 'sell'

export interface TokenOverview {
  address: `0x${string}`
  chainId: number
  name: string
  symbol: string
  decimals: number
  /** Display-only USD, already rounded upstream. */
  priceUsd: number
  change24h: number
  marketCapUsd: number
  liquidityUsd: number
  holders: number
  /** Base units. Never a float. */
  totalSupplyRaw: bigint
  /** 0–100. */
  healthScore: number
  createdAtUnix: number
  verified: boolean
}

export interface HealthFactor {
  id: string
  label: string
  /** What this factor measures, in one line. */
  description: string
  /** 0–100 for this factor alone. */
  score: number
  status: FactorStatus
  /** The measured value, phrased for a human. */
  detail: string
}

export interface Holder {
  rank: number
  address: `0x${string}`
  balanceRaw: bigint
  decimals: number
  /** Share of total supply, 0–100. */
  percentOfSupply: number
  /** e.g. "Liquidity pool", "Deployer" — omitted when unlabelled. */
  label?: string
  /** Contracts are not wallets; the UI must not offer a wallet trace for them. */
  isContract: boolean
}

export interface EarlyBuyer {
  rank: number
  address: `0x${string}`
  txHash: `0x${string}`
  boughtAtUnix: number
  amountRaw: bigint
  decimals: number
  buyPriceUsd: number
  status: HoldStatus
  /** Share of the original position still held, 0–100. */
  remainingPercent: number
}

export interface TokenTrade {
  hash: `0x${string}`
  wallet: `0x${string}`
  direction: TradeDirection
  amountRaw: bigint
  decimals: number
  valueUsd: number
  timestampUnix: number
}

/** Thrown when the indexer has no record of a contract yet. */
export class TokenNotIndexedError extends Error {
  readonly address: string
  constructor(address: string) {
    super(`Token ${address} is not yet indexed`)
    this.name = 'TokenNotIndexedError'
    this.address = address
  }
}

export function healthTier(score: number): HealthTier {
  if (score >= 75) return 'healthy'
  if (score >= 50) return 'caution'
  return 'risk'
}

export const TIER_LABEL: Record<HealthTier, string> = {
  healthy: 'Healthy',
  caution: 'Caution',
  risk: 'High risk',
}
