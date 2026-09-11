import { db } from './store.js'
import { evaluate, type Observation } from './rules.js'

/**
 * Watchlist monitor.
 *
 * Polls the market feed for every token somebody is watching, diffs each result
 * against the previous snapshot, and raises an alert when something moves
 * enough to matter. Runs inside the same process as the index worker: both are
 * long-lived loops against the same database, and splitting them would double
 * the deploy surface for no benefit.
 *
 * De-duplication lives in the database (`record_watch_observation`), not here,
 * so a restarted or duplicated worker cannot re-notify people about something
 * they were already told.
 */

/** Market-data slug per chain. Mirrors the scan function. */
const MARKET_SLUG: Record<number, string> = {
  1: 'ethereum', 56: 'bsc', 137: 'polygon', 42161: 'arbitrum',
  10: 'optimism', 43114: 'avalanche', 8453: 'base', 534352: 'scroll', 324: 'zksync',
}

export interface WatchTarget {
  chain_id: number
  address: string
  watchers: number
  last_price: string | null
  last_liquidity: string | null
  last_volume: string | null
  captured_at: string | null
}

/** Batch market lookup. The feed accepts up to 30 addresses per call. */
async function fetchBatch(
  chainId: number,
  addresses: string[],
): Promise<Map<string, Observation>> {
  const out = new Map<string, Observation>()
  const slug = MARKET_SLUG[chainId]
  if (!slug) return out

  for (let i = 0; i < addresses.length; i += 30) {
    const chunk = addresses.slice(i, i + 30)
    const res = await fetch(
      `https://api.dexscreener.com/tokens/v1/${slug}/${chunk.join(',')}`,
      { headers: { accept: 'application/json' } },
    )
    if (!res.ok) continue

    const pairs = await res.json()
    if (!Array.isArray(pairs)) continue

    // Accumulate across every pool holding each address, on either side —
    // the same rule the scan endpoint uses, so the numbers agree.
    for (const pair of pairs) {
      const liq = Number(pair?.liquidity?.usd ?? 0)
      const vol = Number(pair?.volume?.h24 ?? 0)
      const price = Number(pair?.priceUsd)

      for (const [key, isBase] of [
        [String(pair?.baseToken?.address ?? '').toLowerCase(), true],
        [String(pair?.quoteToken?.address ?? '').toLowerCase(), false],
      ] as Array<[string, boolean]>) {
        if (!chunk.includes(key)) continue
        const prev = out.get(key) ?? { priceUsd: null, liquidityUsd: 0, volume24hUsd: 0 }
        out.set(key, {
          // Price is a base-token figure; never take it from the quote side.
          priceUsd: isBase && Number.isFinite(price) ? price : prev.priceUsd,
          liquidityUsd: prev.liquidityUsd + (Number.isFinite(liq) ? liq : 0),
          volume24hUsd: prev.volume24hUsd + (Number.isFinite(vol) ? vol : 0),
        })
      }
    }
  }

  return out
}

/** One monitoring pass. Returns how many alerts were raised. */
export async function runMonitorPass(
  log: (message: string, extra?: Record<string, unknown>) => void,
): Promise<number> {
  const { data, error } = await db.rpc('watch_targets')
  if (error) throw error

  const targets = (data ?? []) as WatchTarget[]
  if (targets.length === 0) return 0

  // Group by chain: the batch endpoint is chain-scoped.
  const byChain = new Map<number, WatchTarget[]>()
  for (const t of targets) {
    const list = byChain.get(t.chain_id) ?? []
    list.push(t)
    byChain.set(t.chain_id, list)
  }

  let raised = 0

  for (const [chainId, list] of byChain) {
    const observations = await fetchBatch(chainId, list.map((t) => t.address))

    for (const target of list) {
      const current = observations.get(target.address)
      // No data this pass is not an event — it is a gap. Leave the snapshot
      // alone so the next real reading diffs against a true previous value.
      if (!current) continue

      const previous: Observation | null = target.captured_at
        ? {
            priceUsd: target.last_price === null ? null : Number(target.last_price),
            liquidityUsd: Number(target.last_liquidity ?? 0),
            volume24hUsd: Number(target.last_volume ?? 0),
          }
        : null

      const rule = evaluate(previous, current)

      const { data: notified, error: writeError } = await db.rpc('record_watch_observation', {
        p_chain_id: chainId,
        p_address: target.address,
        p_price: current.priceUsd,
        p_liquidity: current.liquidityUsd,
        p_volume: current.volume24hUsd,
        p_rule: rule?.rule ?? null,
        p_severity: rule?.severity ?? 'info',
        p_title: rule?.title ?? null,
        p_detail: rule?.detail ?? null,
      })

      if (writeError) {
        log('monitor.write_failed', { address: target.address, error: writeError.message })
        continue
      }

      if (rule && typeof notified === 'number' && notified > 0) {
        raised += notified
        log('monitor.alert', {
          chain: chainId,
          address: target.address,
          rule: rule.rule,
          notified,
        })
      }
    }
  }

  return raised
}
