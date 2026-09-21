/**
 * Deep token history — what we actually hold, and nothing more.
 *
 * This file used to be a mock adapter: holder distributions, first buyers and
 * a scored health breakdown, all generated from a hash of the contract
 * address. Deterministic, plausible, and completely invented — which made it
 * indistinguishable from a real answer to the person reading it.
 *
 * It now reports coverage instead. `token_history_coverage` says how much of
 * this token's transfer history has genuinely been ingested and whether the
 * chain is streaming it; the UI renders that. Derived figures come later,
 * because balances computed from a partial history are wrong in a way that
 * still looks entirely reasonable on a chart, and that is the one failure this
 * product cannot afford.
 */
import { supabase } from '@/lib/supabase'

export interface HistoryCoverage {
  /** Transfer logs stored for this token on this chain. */
  transfers: number
  firstBlock: number | null
  lastBlock: number | null
  /** ISO timestamps of the oldest and newest stored transfer. */
  firstSeen: string | null
  lastSeen: string | null
  /** Whether the ingestion filter is watching this token at all. */
  tracked: boolean
}

interface CoverageRow {
  transfers: string | number
  first_block: string | number | null
  last_block: string | number | null
  first_seen: string | null
  last_seen: string | null
  tracked: boolean
}

/** `null` stays `null` — a block we do not have is not block zero. */
const toNumber = (value: string | number | null): number | null => {
  if (value === null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function fetchHistoryCoverage(
  chainId: number,
  address: string,
): Promise<HistoryCoverage> {
  if (!supabase) throw new Error('Deep history is not configured.')

  const { data, error } = await supabase.rpc('token_history_coverage', {
    p_chain_id: chainId,
    p_address: address.toLowerCase(),
  })
  if (error) throw error

  const row = (Array.isArray(data) ? data[0] : data) as CoverageRow | undefined

  return {
    transfers: toNumber(row?.transfers ?? 0) ?? 0,
    firstBlock: toNumber(row?.first_block ?? null),
    lastBlock: toNumber(row?.last_block ?? null),
    firstSeen: row?.first_seen ?? null,
    lastSeen: row?.last_seen ?? null,
    tracked: Boolean(row?.tracked),
  }
}
