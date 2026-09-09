/**
 * ⚠️  MOCK ADAPTER — Phase 1 (real indexer reads) is skipped for now. ⚠️
 *
 * Everything here is generated, deterministically seeded from the contract
 * address so a given token always looks the same across reloads. The function
 * signatures are the contract the real adapter must satisfy, so swapping this
 * file out is the whole of Phase 1 for this page.
 *
 * Rules kept from the mock policy:
 *  • Contract addresses passed in are real; the metrics returned are synthetic.
 *  • Wallet addresses and tx hashes are derived hex — correctly shaped, but not
 *    real chain entities, so no behaviour is attributed to a real address.
 *  • Amounts are `bigint` base units, exactly as the real adapter will return.
 */
import type {
  EarlyBuyer,
  HealthFactor,
  Holder,
  TokenOverview,
  TokenTrade,
} from './types'
import { TokenNotIndexedError } from './types'
import { MOCK_TOKENS } from '@/mock'
import { defaultChainMeta } from '@/config/chains'

/** Simulated network latency so loading states are actually exercised. */
const LATENCY_MS = 420

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Deterministic 32-bit hash of a string — the seed for every generator below. */
function seedFrom(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Mulberry32 — small, fast, and repeatable from a seed. */
function rng(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Correctly shaped hex derived from a seed — not a real chain entity. */
function hex(seed: number, bytes: number): `0x${string}` {
  const next = rng(seed)
  let out = ''
  while (out.length < bytes * 2) {
    out += Math.floor(next() * 0xffffffff)
      .toString(16)
      .padStart(8, '0')
  }
  return `0x${out.slice(0, bytes * 2)}` as `0x${string}`
}

/**
 * Which contracts the "indexer" knows about.
 *
 * Seeded with the known Base contracts; `requestIndexing` adds to it so the
 * not-indexed → indexing → indexed flow is real rather than a stubbed button.
 * A Set in module scope stands in for server state.
 */
const indexed = new Set<string>(
  MOCK_TOKENS.map((t) => `${defaultChainMeta.chain.id}:${t.address.toLowerCase()}`),
)

/** Indexing is per chain-and-address, never per address alone. */
const indexKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`

export function isIndexed(chainId: number, address: string): boolean {
  return indexed.has(indexKey(chainId, address))
}

function assertIndexed(chainId: number, address: string) {
  if (!isIndexed(chainId, address)) throw new TokenNotIndexedError(address)
}

/** Stand-in for `POST /index/:chainId/token/:address`. */
export async function requestIndexing(chainId: number, address: string): Promise<void> {
  await sleep(1_600)
  indexed.add(indexKey(chainId, address))
}

export async function fetchTokenOverview(chainId: number, address: string): Promise<TokenOverview> {
  await sleep(LATENCY_MS)
  assertIndexed(chainId, address)

  const known = MOCK_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())
  const seed = seedFrom(`${chainId}:${address}`)
  const next = rng(seed)

  const decimals = known?.decimals ?? 18
  const supplyUnits = known?.supplyUnits ?? Math.floor(next() * 900_000_000) + 1_000_000
  const priceUsd = known?.priceUsd ?? Number((next() * 4).toFixed(6))

  return {
    address: address as `0x${string}`,
    chainId,
    name: known?.name ?? 'Unverified Token',
    symbol: known?.symbol ?? 'UNKN',
    decimals,
    priceUsd,
    change24h: known?.change24h ?? Number((next() * 30 - 15).toFixed(2)),
    marketCapUsd: Math.round(supplyUnits * priceUsd),
    liquidityUsd: known?.liquidityUsd ?? Math.round(next() * 4_000_000),
    holders: known?.holders ?? Math.floor(next() * 40_000) + 200,
    // Exact integer supply — string-built so no float ever touches it.
    totalSupplyRaw: BigInt(supplyUnits) * 10n ** BigInt(decimals),
    healthScore: known?.healthScore ?? Math.floor(next() * 100),
    createdAtUnix: Math.floor(Date.now() / 1000) - Math.floor(next() * 400 * 86_400) - 86_400,
    verified: known ? true : next() > 0.5,
  }
}

const FACTOR_SPECS: Array<{
  id: string
  label: string
  description: string
  detail: (value: number) => string
}> = [
  {
    id: 'holder-concentration',
    label: 'Holder concentration',
    description: 'Share of supply held by the top 10 addresses',
    detail: (v) => `Top 10 hold ${(100 - v * 0.8).toFixed(1)}% of supply`,
  },
  {
    id: 'liquidity',
    label: 'Liquidity depth',
    description: 'Pool depth relative to market capitalisation',
    detail: (v) => `${(v / 100 * 18).toFixed(1)}% of market cap in pools`,
  },
  {
    id: 'lp-lock',
    label: 'LP lock',
    description: 'Whether liquidity provider tokens are locked or burned',
    detail: (v) => (v >= 70 ? 'Locked for 11 months' : v >= 40 ? 'Locked for 21 days' : 'Not locked'),
  },
  {
    id: 'ownership',
    label: 'Ownership',
    description: 'Privileged functions still callable by the deployer',
    detail: (v) =>
      v >= 70 ? 'Ownership renounced' : v >= 40 ? 'Owner can pause' : 'Owner can mint and pause',
  },
  {
    id: 'tax',
    label: 'Transfer tax',
    description: 'Buy and sell tax encoded in the contract',
    detail: (v) => `${((100 - v) / 8).toFixed(1)}% buy · ${((100 - v) / 6).toFixed(1)}% sell`,
  },
  {
    id: 'verification',
    label: 'Source verification',
    description: 'Whether verified source matches the deployed bytecode',
    detail: (v) => (v >= 60 ? 'Verified on explorer' : 'Unverified bytecode'),
  },
  {
    id: 'age',
    label: 'Contract age',
    description: 'Time elapsed since the creation block',
    detail: (v) => `${Math.max(1, Math.round((v / 100) * 400))} days since deployment`,
  },
]

export async function fetchHealthFactors(chainId: number, address: string): Promise<HealthFactor[]> {
  await sleep(LATENCY_MS + 120)
  assertIndexed(chainId, address)

  const overview = MOCK_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())
  const base = overview?.healthScore ?? 50
  const next = rng(seedFrom(`${chainId}:${address}:factors`))

  return FACTOR_SPECS.map((spec) => {
    // Spread factors around the headline score so the breakdown explains it
    // rather than contradicting it.
    const score = Math.max(0, Math.min(100, Math.round(base + (next() - 0.5) * 55)))
    return {
      id: spec.id,
      label: spec.label,
      description: spec.description,
      score,
      status: score >= 70 ? 'pass' : score >= 45 ? 'warn' : 'fail',
      detail: spec.detail(score),
    }
  })
}

export async function fetchHolders(chainId: number, address: string): Promise<Holder[]> {
  await sleep(LATENCY_MS + 60)
  assertIndexed(chainId, address)

  const overview = MOCK_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())
  const decimals = overview?.decimals ?? 18
  const supplyUnits = overview?.supplyUnits ?? 100_000_000
  const next = rng(seedFrom(`${chainId}:${address}:holders`))

  // A decaying series: realistic concentration without hand-writing values.
  const weights = Array.from({ length: 10 }, (_, i) => (1 / (i + 1.6)) * (0.75 + next() * 0.5))
  const total = weights.reduce((a, b) => a + b, 0)
  // Top 10 never hold everything; the tail is the long thin end of the book.
  const top10Share = 34 + next() * 28

  return weights.map((weight, i) => {
    const percent = (weight / total) * top10Share
    const units = Math.round((percent / 100) * supplyUnits)
    return {
      rank: i + 1,
      address: hex(seedFrom(`${address}:holder:${i}`), 20),
      balanceRaw: BigInt(units) * 10n ** BigInt(decimals),
      decimals,
      percentOfSupply: Number(percent.toFixed(2)),
      label: i === 0 ? 'Liquidity pool' : i === 2 ? 'Deployer' : undefined,
      // Pools and similar are contracts — a wallet trace on them is meaningless.
      isContract: i === 0,
    }
  })
}

export async function fetchEarlyBuyers(chainId: number, address: string, limit = 25): Promise<EarlyBuyer[]> {
  await sleep(LATENCY_MS + 200)
  assertIndexed(chainId, address)

  const overview = MOCK_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())
  const decimals = overview?.decimals ?? 18
  const price = overview?.priceUsd ?? 1
  const supplyUnits = overview?.supplyUnits ?? 100_000_000
  const next = rng(seedFrom(`${chainId}:${address}:early`))
  const creation = Math.floor(Date.now() / 1000) - 220 * 86_400

  return Array.from({ length: limit }, (_, i) => {
    const roll = next()
    const status = roll > 0.62 ? 'holding' : roll > 0.3 ? 'partial' : 'sold'
    // Early positions are a fraction of a percent of supply.
    const units = Math.max(1, Math.round(next() * supplyUnits * 0.004))
    return {
      rank: i + 1,
      address: hex(seedFrom(`${address}:buyer:${i}`), 20),
      txHash: hex(seedFrom(`${address}:buytx:${i}`), 32),
      // Buys cluster tightly right after creation, then spread out.
      boughtAtUnix: creation + Math.round(i ** 1.7 * 60 + next() * 900),
      amountRaw: BigInt(units) * 10n ** BigInt(decimals),
      decimals,
      // Early entries priced well below current — that is the whole point of
      // surfacing them.
      buyPriceUsd: Number((price * (0.04 + (i / limit) * 0.5 + next() * 0.06)).toFixed(8)),
      status,
      remainingPercent: status === 'holding' ? 100 : status === 'sold' ? 0 : Math.round(next() * 70) + 10,
    }
  })
}

/**
 * Latest trades. Called on a 15s interval, so it returns a fresh window each
 * time — seeded from the current 15s bucket so repeated calls inside one
 * interval agree with each other.
 */
export async function fetchRecentTrades(chainId: number, address: string, limit = 12): Promise<TokenTrade[]> {
  await sleep(260)
  assertIndexed(chainId, address)

  const overview = MOCK_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase())
  const decimals = overview?.decimals ?? 18
  const price = overview?.priceUsd ?? 1
  const supplyUnits = overview?.supplyUnits ?? 100_000_000
  const now = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(now / 15)
  const next = rng(seedFrom(`${chainId}:${address}:trades:${bucket}`))

  return Array.from({ length: limit }, (_, i) => {
    const units = Math.max(1, Math.round(next() * supplyUnits * 0.0009))
    const direction = next() > 0.45 ? 'buy' : 'sell'
    return {
      hash: hex(seedFrom(`${address}:trade:${bucket}:${i}`), 32),
      wallet: hex(seedFrom(`${address}:trader:${bucket}:${i}`), 20),
      direction,
      amountRaw: BigInt(units) * 10n ** BigInt(decimals),
      decimals,
      valueUsd: Number((units * price).toFixed(2)),
      timestampUnix: now - i * (18 + Math.floor(next() * 40)),
    }
  })
}
