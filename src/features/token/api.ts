/**
 * Deep token history.
 *
 * Every figure here is derived from stored transfer logs, and the database
 * refuses to derive any of them until a token's whole history has been walked.
 * That refusal is deliberate: a balance computed from a partial record is not
 * an approximate balance, it is a wrong one, and it looks exactly as
 * authoritative as a right one.
 *
 * This file used to be a mock adapter that generated all of it from a hash of
 * the contract address. Nothing survives from that.
 */
import { supabase } from '@/lib/supabase'
import { env, hasSupabase } from '@/config/env'
import type { EarlyBuyer, Holder, HoldStatus } from './types'

export interface HistoryCoverage {
  /** Transfer logs stored for this token on this chain. */
  transfers: number
  firstBlock: number | null
  lastBlock: number | null
  /** ISO timestamps of the oldest and newest stored transfer. */
  firstSeen: string | null
  lastSeen: string | null
  /** Whether the live stream is watching this token at all. */
  tracked: boolean
  /** 'none' | 'pending' | 'running' | 'complete' | 'failed' */
  status: string
  pages: number
  /** The whole history has been walked. Only this licenses a derived figure. */
  complete: boolean
  /** Addresses holding any of it — null until the history is complete. */
  holders: number | null
  error: string | null
}

interface CoverageRow {
  transfers: string | number
  first_block: string | number | null
  last_block: string | number | null
  first_seen: string | null
  last_seen: string | null
  tracked: boolean
  status: string
  pages: number
  complete: boolean
  holders: string | number | null
  error: string | null
}

/** `null` stays `null` — a block we do not have is not block zero. */
const toNumber = (value: string | number | null): number | null => {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Decimal strings, never floats: a uint256 does not survive a Number. */
const toBigInt = (value: string | number | null): bigint => {
  if (value === null || value === undefined) return 0n
  try {
    return BigInt(String(value).split('.')[0])
  } catch {
    return 0n
  }
}

function requireClient() {
  if (!supabase) throw new Error('Deep history is not configured.')
  return supabase
}

export async function fetchHistoryCoverage(
  chainId: number,
  address: string,
): Promise<HistoryCoverage> {
  const { data, error } = await requireClient().rpc('token_history_coverage', {
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
    status: row?.status ?? 'none',
    pages: Number(row?.pages ?? 0),
    complete: Boolean(row?.complete),
    holders: toNumber(row?.holders ?? null),
    error: row?.error ?? null,
  }
}

interface HolderRow {
  rank: number
  address: string
  balance: string | number
  percent: string | number | null
}

/**
 * Largest holders. Empty when the history is incomplete — the database
 * enforces that, so a caller cannot get a partial answer by asking twice.
 *
 * `isContract` is left null here. Whether an address holds bytecode is a
 * question for the chain, not for transfer history, and the panel probes it
 * separately rather than assuming.
 */
export async function fetchHolders(
  chainId: number,
  address: string,
  decimals: number,
  limit = 10,
): Promise<Holder[]> {
  const { data, error } = await requireClient().rpc('token_holders', {
    p_chain_id: chainId,
    p_address: address.toLowerCase(),
    p_limit: limit,
  })
  if (error) throw error

  return ((data ?? []) as HolderRow[]).map((row) => ({
    rank: row.rank,
    address: row.address as `0x${string}`,
    balanceRaw: toBigInt(row.balance),
    decimals,
    percentOfSupply: toNumber(row.percent) ?? 0,
    isContract: null,
  }))
}

interface BuyerRow {
  rank: number
  address: string
  tx_hash: string
  bought_at: string | null
  amount: string | number
  peak: string | number
  current: string | number
}

/**
 * Whether a position was sold, measured against the most that address ever
 * held rather than against its first buy. Someone who bought again before
 * selling would otherwise read as still holding.
 */
function statusOf(peak: bigint, current: bigint): HoldStatus {
  if (current <= 0n) return 'sold'
  if (current >= peak) return 'holding'
  return 'partial'
}

export async function fetchEarlyBuyers(
  chainId: number,
  address: string,
  decimals: number,
  limit = 25,
): Promise<EarlyBuyer[]> {
  const { data, error } = await requireClient().rpc('token_early_buyers', {
    p_chain_id: chainId,
    p_address: address.toLowerCase(),
    p_limit: limit,
  })
  if (error) throw error

  return ((data ?? []) as BuyerRow[]).map((row) => {
    const peak = toBigInt(row.peak)
    const current = toBigInt(row.current)
    const ms = row.bought_at ? Date.parse(row.bought_at) : Number.NaN

    return {
      rank: row.rank,
      address: row.address as `0x${string}`,
      txHash: row.tx_hash as `0x${string}`,
      boughtAtUnix: Number.isFinite(ms) ? Math.floor(ms / 1000) : null,
      amountRaw: toBigInt(row.amount),
      peakRaw: peak,
      currentRaw: current,
      decimals,
      status: statusOf(peak, current),
      // Basis points then divided, so the percentage never passes through a
      // float wide enough to lose the difference between 0% and 0.4%.
      remainingPercent: peak > 0n ? Number((current * 10_000n) / peak) / 100 : 0,
    }
  })
}

export interface BackfillProgress {
  status: string
  done: boolean
  pages: number
  received?: number
  inserted?: number
}

/**
 * Ask the server to walk the rest of the history.
 *
 * Returns after one slice of work, not after the whole walk: an edge function
 * has a wall clock and a long history will not fit inside it. `done` is false
 * until the provider says there are no more pages, and the caller is expected
 * to call again.
 */
export async function requestBackfill(
  chainId: number,
  address: string,
): Promise<BackfillProgress> {
  if (!hasSupabase) throw new Error('Deep history is not configured.')

  const token = (await supabase?.auth.getSession())?.data.session?.access_token
  if (!token) throw new Error('Sign in to read a token’s full history.')

  const res = await fetch(`${env.supabaseUrl}/functions/v1/token-backfill`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ chainId, address: address.toLowerCase() }),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Could not read the history (${res.status})`)

  return {
    status: String(body?.status ?? 'running'),
    done: Boolean(body?.done),
    pages: Number(body?.pages ?? 0),
    received: body?.received,
    inserted: body?.inserted,
  }
}
