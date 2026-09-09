/**
 * Pure derivation logic.
 *
 * Deliberately free of config, network and database imports so it can be
 * imported and tested on its own — the earlier coupling meant a unit test of
 * plain arithmetic needed a full Supabase environment to load.
 */

export const ZERO = '0x0000000000000000000000000000000000000000' as const

export interface TokenFacts {
  symbol: string
  name: string
  decimals: number
  totalSupply: bigint
  deployedBlock: bigint | null
  /** True when the whole history was walked, false when the lookback capped it. */
  complete: boolean
}

export interface HolderRow {
  holder: string
  balance: bigint
}

export interface TransferRow {
  from: string
  to: string
  value: bigint
  blockNumber: bigint
  txHash: string
  logIndex: number
}

export interface EarlyBuyer {
  rank: number
  wallet: string
  txHash: string
  blockNumber: bigint
  amount: bigint
  status: 'holding' | 'partial' | 'sold'
  remainingPct: number
}

export interface HealthFactor {
  factorId: string
  score: number
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

/**
 * Net balance change per address across the supplied transfers.
 *
 * This equals a true balance ONLY when every transfer since deployment was
 * seen. Over a partial window it is net flow — an address that held a million
 * tokens throughout and moved none of them does not appear at all, and one that
 * received then forwarded shows near zero. Callers must check `complete` before
 * treating the output as balances; `computeHealth` and `persist` both do.
 */
export function deriveHolders(transfers: TransferRow[]): HolderRow[] {
  const balances = new Map<string, bigint>()

  for (const t of transfers) {
    if (t.from !== ZERO) balances.set(t.from, (balances.get(t.from) ?? 0n) - t.value)
    if (t.to !== ZERO) balances.set(t.to, (balances.get(t.to) ?? 0n) + t.value)
  }

  return [...balances.entries()]
    .filter(([, balance]) => balance > 0n)
    .map(([holder, balance]) => ({ holder, balance }))
    .sort((a, b) => (a.balance < b.balance ? 1 : a.balance > b.balance ? -1 : 0))
}

/**
 * First distinct receivers after deployment, and what they did with it.
 *
 * Status compares each buyer's current balance against everything they ever
 * received: still holding all of it, some of it, or none.
 */
export function deriveEarlyBuyers(
  transfers: TransferRow[],
  holders: HolderRow[],
  limit = 25,
): EarlyBuyer[] {
  const balanceOf = new Map(holders.map((h) => [h.holder, h.balance]))
  const received = new Map<string, bigint>()
  for (const t of transfers) {
    if (t.to === ZERO) continue
    received.set(t.to, (received.get(t.to) ?? 0n) + t.value)
  }

  const seen = new Set<string>()
  const out: EarlyBuyer[] = []

  // Transfers arrive in block order from the chunked scan, so the first time an
  // address appears as a recipient is its entry.
  for (const t of transfers) {
    if (out.length >= limit) break
    if (t.to === ZERO || seen.has(t.to)) continue
    seen.add(t.to)

    const total = received.get(t.to) ?? 0n
    const current = balanceOf.get(t.to) ?? 0n
    // Integer percentage: no float ever touches a token amount.
    const pct = total > 0n ? Number((current * 100n) / total) : 0
    const clamped = Math.max(0, Math.min(100, pct))

    out.push({
      rank: out.length + 1,
      wallet: t.to,
      txHash: t.txHash,
      blockNumber: t.blockNumber,
      amount: t.value,
      status: clamped >= 99 ? 'holding' : clamped <= 1 ? 'sold' : 'partial',
      remainingPct: clamped,
    })
  }

  return out
}

/**
 * Health factors derived strictly from what was measured.
 *
 * Every factor is computed from on-chain facts this job actually observed.
 * Nothing is invented: where the data is incomplete the factor is omitted and
 * data-coverage says why, rather than publishing a confident wrong answer.
 */
export function computeHealth(
  facts: TokenFacts,
  holders: HolderRow[],
  transfers: TransferRow[],
  latestBlock: bigint,
  lookback: bigint,
): { factors: HealthFactor[]; score: number } {
  const factors: HealthFactor[] = []

  // Concentration and holder count are only meaningful over full history. Over
  // a partial window `holders` is net flow, not balances, so a "top 10 hold X%"
  // figure from it would be a confident wrong answer — the worst kind for a
  // tool people use to decide whether to buy.
  if (facts.complete) {
    const supply = holders.reduce((sum, h) => sum + h.balance, 0n)
    const top10 = holders.slice(0, 10).reduce((sum, h) => sum + h.balance, 0n)
    const top10Pct = supply > 0n ? Number((top10 * 10_000n) / supply) / 100 : 0
    factors.push({
      factorId: 'holder-concentration',
      score: Math.max(0, Math.min(100, Math.round(100 - top10Pct))),
      status: top10Pct > 70 ? 'fail' : top10Pct > 45 ? 'warn' : 'pass',
      detail: `Top 10 hold ${top10Pct.toFixed(1)}% of circulating supply`,
    })

    const count = holders.length
    factors.push({
      factorId: 'holder-count',
      score: Math.max(0, Math.min(100, Math.round(Math.log10(Math.max(count, 1)) * 25))),
      status: count < 50 ? 'fail' : count < 500 ? 'warn' : 'pass',
      detail: `${count.toLocaleString('en-US')} addresses with a non-zero balance`,
    })
  }

  const ageBlocks = facts.deployedBlock === null ? 0n : latestBlock - facts.deployedBlock
  factors.push({
    factorId: 'age',
    score: Math.max(0, Math.min(100, Number(ageBlocks / 1_000n))),
    status: ageBlocks < 50_000n ? 'warn' : 'pass',
    detail:
      facts.deployedBlock === null
        ? 'Deployment block not found'
        : `${ageBlocks.toLocaleString('en-US')} blocks since deployment`,
  })

  // Mint activity after launch dilutes existing holders.
  const mints = transfers.filter((t) => t.from === ZERO).length
  factors.push({
    factorId: 'supply-mints',
    score: mints <= 1 ? 100 : mints < 20 ? 60 : 25,
    status: mints <= 1 ? 'pass' : mints < 20 ? 'warn' : 'fail',
    detail: mints <= 1 ? 'Single mint at deployment' : `${mints} mint events observed`,
  })

  const burns = transfers.filter((t) => t.to === ZERO).length
  factors.push({
    factorId: 'supply-burns',
    score: burns > 0 ? 80 : 60,
    status: 'pass',
    detail: burns > 0 ? `${burns} burn events observed` : 'No burns observed',
  })

  factors.push({
    factorId: 'activity',
    score: Math.max(0, Math.min(100, Math.round(Math.log10(Math.max(transfers.length, 1)) * 22))),
    status: transfers.length < 100 ? 'warn' : 'pass',
    detail: `${transfers.length.toLocaleString('en-US')} transfers in the scanned range`,
  })

  // Honesty about coverage, scored neutrally so it cannot inflate the headline.
  factors.push({
    factorId: 'data-coverage',
    score: facts.complete ? 100 : 50,
    status: facts.complete ? 'pass' : 'warn',
    detail: facts.complete
      ? 'Full history since deployment'
      : `Partial history — last ${lookback.toLocaleString('en-US')} blocks only. ` +
        'Holder distribution and concentration are unavailable.',
  })

  const score = Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length)
  return { factors, score }
}
