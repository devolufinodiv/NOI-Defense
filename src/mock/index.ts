/**
 * ⚠️  MOCK FIXTURES — SCAFFOLDING ONLY. NOT ON-CHAIN TRUTH. ⚠️
 *
 * Phase 0 ships no data layer, so the style guide and placeholder pages read
 * from here. Rules this file follows so mock data is never mistaken for real:
 *
 *  • TOKEN CONTRACT ADDRESSES ARE REAL Base mainnet (8453) contracts — they are
 *    publicly verifiable on basescan.org. Their attached *metrics* (holders,
 *    liquidity, risk scores, price series) are SYNTHETIC.
 *  • WALLET ADDRESSES AND TX HASHES ARE SYNTHETIC — deterministic sha256
 *    digests, correctly shaped (20-byte / 32-byte hex) but not real chain
 *    entities. They are NOT real wallets, so no behaviour is attributed to a
 *    real person or entity.
 *  • Every amount is a `bigint` in base units with an explicit `decimals`,
 *    exactly as the real adapters will return them.
 *
 * Anything rendering from this module must show the <MockBadge /> so the
 * distinction is visible on screen, not just in source.
 *
 * DELETE THIS MODULE once Phase 1 wires real Alchemy reads.
 */

export const IS_MOCK_DATA = true

export interface MockToken {
  /** Real Base mainnet contract address. */
  address: `0x${string}`
  symbol: string
  name: string
  decimals: number
  /** SYNTHETIC 0–100 health score. */
  healthScore: number
  /** SYNTHETIC. */
  holders: number
  /** SYNTHETIC. Display-only USD, already rounded. */
  liquidityUsd: number
  /** SYNTHETIC circulating supply in whole tokens (not base units). */
  supplyUnits: number
  priceUsd: number
  change24h: number
}

/** Real Base mainnet contracts; synthetic metrics. */
export const MOCK_TOKENS: MockToken[] = [
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    healthScore: 96,
    holders: 412_883,
    liquidityUsd: 184_300_000,
    supplyUnits: 118_400,
    priceUsd: 3128.44,
    change24h: 1.82,
  },
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    healthScore: 99,
    holders: 1_204_551,
    liquidityUsd: 421_900_000,
    supplyUnits: 3_900_000_000,
    priceUsd: 1.0,
    change24h: 0.01,
  },
  {
    address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    symbol: 'AERO',
    name: 'Aerodrome Finance',
    decimals: 18,
    healthScore: 78,
    holders: 96_240,
    liquidityUsd: 38_600_000,
    supplyUnits: 880_000_000,
    priceUsd: 0.8412,
    change24h: -4.37,
  },
  {
    address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    symbol: 'DEGEN',
    name: 'Degen',
    decimals: 18,
    healthScore: 54,
    holders: 168_902,
    liquidityUsd: 6_140_000,
    supplyUnits: 37_000_000_000,
    priceUsd: 0.00612,
    change24h: -11.93,
  },
  {
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
    healthScore: 91,
    holders: 21_774,
    liquidityUsd: 22_450_000,
    supplyUnits: 6_620,
    priceUsd: 3376.9,
    change24h: 1.64,
  },
]

export type WalletTag = 'smart-money' | 'sniper' | 'whale' | 'bot' | 'fresh' | 'flagged'

export interface MockWallet {
  /** SYNTHETIC address — not a real wallet. */
  address: `0x${string}`
  tags: WalletTag[]
  /** SYNTHETIC. Realised P&L in USD, display-only. */
  realisedPnlUsd: number
  winRate: number
  trades: number
  /** SYNTHETIC. Portfolio value in wei-equivalent base units. */
  balanceRaw: bigint
  balanceDecimals: number
  lastActiveUnix: number
}

// Anchored to load time, not a fixed date: every timestamp below is expressed
// as an offset from "now", so ages always read as elapsed ("2 min ago") instead
// of drifting into the future against a hardcoded date.
const NOW = Math.floor(Date.now() / 1000)

export const MOCK_WALLETS: MockWallet[] = [
  {
    address: '0x4edf9825a1f099fc02df523eef7a1a25f7a7d96d',
    tags: ['smart-money', 'whale'],
    realisedPnlUsd: 1_284_402.18,
    winRate: 71.4,
    trades: 318,
    balanceRaw: 4_182_940_113_772_004_881n,
    balanceDecimals: 18,
    lastActiveUnix: NOW - 92,
  },
  {
    address: '0xd6a8cff1a64effb6584e7c292848fae04bd57802',
    tags: ['sniper', 'bot'],
    realisedPnlUsd: 218_930.55,
    winRate: 63.9,
    trades: 4_182,
    balanceRaw: 812_004_991_002_113_400n,
    balanceDecimals: 18,
    lastActiveUnix: NOW - 14,
  },
  {
    address: '0xb18b6c47cf3bd9fad12b894985536ddc1c9535c1',
    tags: ['smart-money'],
    realisedPnlUsd: 64_118.02,
    winRate: 58.2,
    trades: 211,
    balanceRaw: 22_940_118_002_774_119_004n,
    balanceDecimals: 18,
    lastActiveUnix: NOW - 3_600 * 4,
  },
  {
    address: '0x83a25fba15849a59e12729c83e6d29602e7c5e90',
    tags: ['flagged'],
    realisedPnlUsd: -91_442.77,
    winRate: 22.8,
    trades: 96,
    balanceRaw: 118_004_991_002n,
    balanceDecimals: 18,
    lastActiveUnix: NOW - 3_600 * 29,
  },
  {
    address: '0x53d77550b5ec2271a81ed1a3c6d58e7a95b4ec31',
    tags: ['fresh'],
    realisedPnlUsd: -1_204.4,
    winRate: 41.0,
    trades: 12,
    balanceRaw: 990_118_774_002_004_118n,
    balanceDecimals: 18,
    lastActiveUnix: NOW - 3_600 * 76,
  },
  {
    address: '0x7e64858d0f093056afbd6a0f05e2ee45683d6c56',
    tags: ['whale'],
    realisedPnlUsd: 402_776.9,
    winRate: 66.7,
    trades: 84,
    balanceRaw: 118_402_940_113_772_004_881n,
    balanceDecimals: 18,
    lastActiveUnix: NOW - 3_600 * 11,
  },
]

export interface MockTransfer {
  /** SYNTHETIC 32-byte hash — not a real transaction. */
  hash: `0x${string}`
  from: `0x${string}`
  to: `0x${string}`
  symbol: string
  decimals: number
  /** Base units. Never a float. */
  valueRaw: bigint
  direction: 'in' | 'out'
  timestampUnix: number
}

export const MOCK_TRANSFERS: MockTransfer[] = [
  {
    hash: '0x8d8eb1146cedb4da9bb68f9f7ab5144b991ab269ecf1bf02827984bd38e8de42',
    from: '0x4edf9825a1f099fc02df523eef7a1a25f7a7d96d',
    to: '0xd6a8cff1a64effb6584e7c292848fae04bd57802',
    symbol: 'WETH',
    decimals: 18,
    valueRaw: 12_400_918_002_774_119_004n,
    direction: 'out',
    timestampUnix: NOW - 92,
  },
  {
    hash: '0xfccfa06d360dcd7cbd3dd6b19b00f33d1cb83b6b2f8dd692eac189099b908da0',
    from: '0xcf69493d6a9d0abb77a95e41322c602c2096eafc',
    to: '0x4edf9825a1f099fc02df523eef7a1a25f7a7d96d',
    symbol: 'USDC',
    decimals: 6,
    valueRaw: 4_182_004_119n,
    direction: 'in',
    timestampUnix: NOW - 604,
  },
  {
    hash: '0x2be18c2fcd8572dca542bff4e85cc0a7983b35251007894a36e26dd071c48a7c',
    from: '0x6a3d35d2e8df2c38b4f1fd8043570881140c049e',
    to: '0xb18b6c47cf3bd9fad12b894985536ddc1c9535c1',
    symbol: 'AERO',
    decimals: 18,
    valueRaw: 88_402_940_113_772_004_881_223n,
    direction: 'in',
    timestampUnix: NOW - 2_140,
  },
  {
    hash: '0x0ed0db571279f1d7fb49510390f6ac05881a314df4d16502284281df38d043d0',
    from: '0x83a25fba15849a59e12729c83e6d29602e7c5e90',
    to: '0x63ab903f6b6af1719e2f46505096a36dfe93f1e9',
    symbol: 'DEGEN',
    decimals: 18,
    valueRaw: 918_774_002_004_118_990_442_118n,
    direction: 'out',
    timestampUnix: NOW - 8_806,
  },
  {
    hash: '0xd572153b040c9f6148bfc894bcf9aa50493c1fd03077362b52fc911446b3acb9',
    from: '0x65e9546aa9081b848ed4e9ee82a2aefb9c78f512',
    to: '0x7e64858d0f093056afbd6a0f05e2ee45683d6c56',
    symbol: 'cbETH',
    decimals: 18,
    valueRaw: 402_940_113_772n,
    direction: 'in',
    timestampUnix: NOW - 21_400,
  },
  {
    hash: '0xa3c618ca78426085637b548487e6dd317517e5c9bd45b3dd33d19edf10c83766',
    from: '0x132a7a6fd91c8ff551e916afbc99c42aaf40252c',
    to: '0x517bb47203eee0903cd06d0456071e764138e340',
    symbol: 'WETH',
    decimals: 18,
    valueRaw: 774_002_004_118_990n,
    direction: 'out',
    timestampUnix: NOW - 40_118,
  },
]

export interface MockPricePoint {
  /** Unix seconds. */
  t: number
  /** Display-only USD price. */
  usd: number
}

/** SYNTHETIC 48-point hourly series, deterministic so the chart never jitters. */
export const MOCK_PRICE_SERIES: MockPricePoint[] = Array.from({ length: 48 }, (_, i) => {
  const drift = Math.sin(i / 5.5) * 84 + Math.sin(i / 1.7) * 21
  return {
    t: NOW - (47 - i) * 3_600,
    usd: Number((3_040 + drift + i * 2.4).toFixed(2)),
  }
})

/** SYNTHETIC counterparty graph — addresses are the mock wallets above. */
export const MOCK_GRAPH = {
  nodes: [
    { id: '0x4edf9825a1f099fc02df523eef7a1a25f7a7d96d', weight: 1.0, tone: 'accent' as const },
    { id: '0xd6a8cff1a64effb6584e7c292848fae04bd57802', weight: 0.7, tone: 'neutral' as const },
    { id: '0xb18b6c47cf3bd9fad12b894985536ddc1c9535c1', weight: 0.55, tone: 'neutral' as const },
    { id: '0x83a25fba15849a59e12729c83e6d29602e7c5e90', weight: 0.5, tone: 'negative' as const },
    { id: '0x53d77550b5ec2271a81ed1a3c6d58e7a95b4ec31', weight: 0.3, tone: 'neutral' as const },
    { id: '0x7e64858d0f093056afbd6a0f05e2ee45683d6c56', weight: 0.75, tone: 'positive' as const },
    { id: '0xcf69493d6a9d0abb77a95e41322c602c2096eafc', weight: 0.4, tone: 'neutral' as const },
    { id: '0x6a3d35d2e8df2c38b4f1fd8043570881140c049e', weight: 0.35, tone: 'neutral' as const },
    { id: '0x63ab903f6b6af1719e2f46505096a36dfe93f1e9', weight: 0.25, tone: 'neutral' as const },
    { id: '0x132a7a6fd91c8ff551e916afbc99c42aaf40252c', weight: 0.45, tone: 'neutral' as const },
  ],
  links: [
    { source: '0x4edf9825a1f099fc02df523eef7a1a25f7a7d96d', target: '0xd6a8cff1a64effb6584e7c292848fae04bd57802', weight: 0.9 },
    { source: '0x4edf9825a1f099fc02df523eef7a1a25f7a7d96d', target: '0xcf69493d6a9d0abb77a95e41322c602c2096eafc', weight: 0.6 },
    { source: '0x4edf9825a1f099fc02df523eef7a1a25f7a7d96d', target: '0x7e64858d0f093056afbd6a0f05e2ee45683d6c56', weight: 0.5 },
    { source: '0xd6a8cff1a64effb6584e7c292848fae04bd57802', target: '0xb18b6c47cf3bd9fad12b894985536ddc1c9535c1', weight: 0.4 },
    { source: '0xb18b6c47cf3bd9fad12b894985536ddc1c9535c1', target: '0x6a3d35d2e8df2c38b4f1fd8043570881140c049e', weight: 0.35 },
    { source: '0x83a25fba15849a59e12729c83e6d29602e7c5e90', target: '0x63ab903f6b6af1719e2f46505096a36dfe93f1e9', weight: 0.7 },
    { source: '0x83a25fba15849a59e12729c83e6d29602e7c5e90', target: '0x53d77550b5ec2271a81ed1a3c6d58e7a95b4ec31', weight: 0.3 },
    { source: '0x132a7a6fd91c8ff551e916afbc99c42aaf40252c', target: '0x7e64858d0f093056afbd6a0f05e2ee45683d6c56', weight: 0.55 },
    { source: '0x132a7a6fd91c8ff551e916afbc99c42aaf40252c', target: '0x4edf9825a1f099fc02df523eef7a1a25f7a7d96d', weight: 0.45 },
    { source: '0x53d77550b5ec2271a81ed1a3c6d58e7a95b4ec31', target: '0x6a3d35d2e8df2c38b4f1fd8043570881140c049e', weight: 0.2 },
  ],
}

/**
 * SYNTHETIC per-token spark series for the quote cards.
 *
 * Deterministic (seeded from the symbol) so cards never jitter between renders,
 * and shaped to end consistent with each token's `change24h` — a card whose
 * line disagrees with its delta pill would be worse than no line at all.
 */
export function mockSeriesFor(symbol: string, change24h: number, points = 28): MockPricePoint[] {
  let seed = 0
  for (let i = 0; i < symbol.length; i += 1) seed = (seed * 31 + symbol.charCodeAt(i)) % 9973
  const rand = (i: number) => {
    const x = Math.sin(seed + i * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }
  const start = 100
  const end = start * (1 + change24h / 100)
  return Array.from({ length: points }, (_, i) => {
    const progress = i / (points - 1)
    // Linear drift toward the true close, plus bounded noise that decays to zero
    // at the final point so the series always lands on `end`.
    const noise = (rand(i) - 0.5) * 1.8 * (1 - progress)
    const wave =
      Math.sin(progress * Math.PI * 2.4 + seed) * 2.6 +
      Math.sin(progress * Math.PI * 5.1 + seed * 0.7) * 1.1
    return {
      t: NOW - (points - 1 - i) * 3_600,
      usd: Number((start + (end - start) * progress + noise + wave).toFixed(3)),
    }
  })
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface MockAlert {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  /** Subject of the alert — a token contract or a wallet. */
  subject: `0x${string}`
  subjectKind: 'token' | 'wallet'
  timestampUnix: number
  unread: boolean
}

/** SYNTHETIC alerts for the dashboard panel. */
export const MOCK_ALERTS: MockAlert[] = [
  {
    id: 'a1',
    severity: 'critical',
    title: 'Large sell from tracked wallet',
    detail: '918,774 DEGEN sold — 62% of position',
    subject: '0x83a25fba15849a59e12729c83e6d29602e7c5e90',
    subjectKind: 'wallet',
    timestampUnix: NOW - 240,
  unread: true,
  },
  {
    id: 'a2',
    severity: 'warning',
    title: 'Holder concentration rising',
    detail: 'Top 10 share of AERO up 4.2pp in 24h',
    subject: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    subjectKind: 'token',
    timestampUnix: NOW - 3_100,
    unread: true,
  },
  {
    id: 'a3',
    severity: 'info',
    title: 'New early buyer cohort',
    detail: '12 fresh wallets bought within 3 blocks',
    subject: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    subjectKind: 'token',
    timestampUnix: NOW - 9_400,
    unread: true,
  },
  {
    id: 'a4',
    severity: 'warning',
    title: 'Liquidity withdrawn',
    detail: '$1.2M removed from the primary pool',
    subject: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    subjectKind: 'token',
    timestampUnix: NOW - 26_800,
    unread: false,
  },
]

export interface MockWatchlistWallet {
  address: `0x${string}`
  label: string
  realisedPnlUsd: number
  lastActiveUnix: number
}

/** SYNTHETIC watchlist — wallets the signed-in user is tracking. */
export const MOCK_WATCHED_WALLETS: MockWatchlistWallet[] = [
  {
    address: '0x4edf9825a1f099fc02df523eef7a1a25f7a7d96d',
    label: 'Smart money · whale',
    realisedPnlUsd: 1_284_402.18,
    lastActiveUnix: NOW - 92,
  },
  {
    address: '0xd6a8cff1a64effb6584e7c292848fae04bd57802',
    label: 'Sniper bot',
    realisedPnlUsd: 218_930.55,
    lastActiveUnix: NOW - 14,
  },
  {
    address: '0x83a25fba15849a59e12729c83e6d29602e7c5e90',
    label: 'Flagged',
    realisedPnlUsd: -91_442.77,
    lastActiveUnix: NOW - 3_600 * 29,
  },
]
