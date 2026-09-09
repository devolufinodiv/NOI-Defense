import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'
import type { IndexResult } from './indexer.js'
import type { TransferRow } from './derive.js'

/**
 * Service-role client. Bypasses row level security, which is exactly why this
 * process must never be exposed to a browser.
 */
export const db = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export interface Job {
  id: string
  chain_id: number
  address: string
  attempts: number
}

export async function claimJob(): Promise<Job | null> {
  const { data, error } = await db.rpc('claim_index_job', { p_worker: config.workerId })
  if (error) throw error
  return (data as Job | null) ?? null
}

export async function heartbeat(jobId: string): Promise<void> {
  await db.rpc('heartbeat_index_job', { p_job_id: jobId })
}

export async function finishJob(jobId: string, error?: string): Promise<void> {
  const { error: rpcError } = await db.rpc('finish_index_job', {
    p_job_id: jobId,
    p_error: error ?? null,
  })
  if (rpcError) throw rpcError
}

export async function reapStalled(): Promise<number> {
  const { data, error } = await db.rpc('reap_stalled_index_jobs', { p_stale_minutes: 10 })
  if (error) throw error
  return (data as number) ?? 0
}

/** Postgres NUMERIC takes a decimal string; JSON has no bigint. */
const s = (value: bigint) => value.toString()

/** Blocks arrive in batches — a single insert of 50k rows will be rejected. */
async function inChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += size) {
    await fn(rows.slice(i, i + size))
  }
}

/**
 * Persist one completed job.
 *
 * Deletes then inserts per token rather than upserting row by row: a re-index
 * must not leave behind holders who have since sold, and "replace this token's
 * derived data" is the actual intent.
 */
export async function persist(
  chainId: number,
  address: string,
  result: IndexResult,
  timestampFor: (block: bigint) => Date,
): Promise<void> {
  const { facts, holders, earlyBuyers, transfers, factors, score } = result

  const { error: tokenError } = await db.from('tokens').upsert(
    {
      chain_id: chainId,
      address,
      symbol: facts.symbol,
      name: facts.name,
      decimals: facts.decimals,
      created_at_block: facts.deployedBlock ? Number(facts.deployedBlock) : null,
      index_status: 'ready',
      indexed_at: new Date().toISOString(),
      index_error: null,
    },
    { onConflict: 'chain_id,address' },
  )
  if (tokenError) throw tokenError

  const totalSupply = holders.reduce((sum, h) => sum + h.balance, 0n)

  const { error: metricsError } = await db.from('token_metrics').upsert(
    {
      chain_id: chainId,
      address,
      holder_count: facts.complete ? holders.length : null,
      total_supply: s(facts.totalSupply > 0n ? facts.totalSupply : totalSupply),
      health_score: score,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'chain_id,address' },
  )
  if (metricsError) throw metricsError

  await db.from('token_health_factors').delete().eq('chain_id', chainId).eq('address', address)
  if (factors.length) {
    const { error } = await db.from('token_health_factors').insert(
      factors.map((f) => ({
        chain_id: chainId,
        address,
        factor_id: f.factorId,
        score: f.score,
        status: f.status,
        detail: f.detail,
      })),
    )
    if (error) throw error
  }

  await db.from('token_holders').delete().eq('chain_id', chainId).eq('address', address)
  // Over a partial window `holders` is net flow, not balances — writing it to a
  // table the UI labels "Holder distribution" would be a lie by column name.
  const top = facts.complete ? holders.slice(0, 10) : []
  if (top.length) {
    const { error } = await db.from('token_holders').insert(
      top.map((h, i) => ({
        chain_id: chainId,
        address,
        holder: h.holder,
        rank: i + 1,
        balance: s(h.balance),
        pct_supply:
          totalSupply > 0n
            ? Number((h.balance * 1_000_000n) / totalSupply) / 10_000
            : 0,
        is_contract: false,
      })),
    )
    if (error) throw error
  }

  await db.from('token_early_buyers').delete().eq('chain_id', chainId).eq('address', address)
  if (earlyBuyers.length) {
    const { error } = await db.from('token_early_buyers').insert(
      earlyBuyers.map((b) => ({
        chain_id: chainId,
        address,
        rank: b.rank,
        wallet: b.wallet,
        tx_hash: b.txHash,
        bought_at: timestampFor(b.blockNumber).toISOString(),
        amount: s(b.amount),
        status: b.status,
        remaining_pct: b.remainingPct,
      })),
    )
    if (error) throw error
  }

  // Only the recent tail is stored: the live feed shows a dozen rows, and
  // keeping every historical transfer would balloon the table for no reader.
  const recent = transfers.slice(-200)
  await db.from('token_trades').delete().eq('chain_id', chainId).eq('address', address)
  await inChunks(recent, 100, async (chunk) => {
    const { error } = await db.from('token_trades').insert(
      chunk.map((t: TransferRow) => ({
        chain_id: chainId,
        address,
        tx_hash: t.txHash,
        log_index: t.logIndex,
        wallet: t.to,
        // Mint-to-holder reads as a buy; send-to-zero as a sell. Anything else
        // is a plain transfer, recorded as a buy from the receiver's side.
        side: t.from === '0x0000000000000000000000000000000000000000' ? 'buy' : 'sell',
        amount: s(t.value),
        block_number: Number(t.blockNumber),
        occurred_at: timestampFor(t.blockNumber).toISOString(),
      })),
    )
    if (error) throw error
  })
}

/** Mark a token failed so the UI can explain itself instead of spinning. */
export async function markTokenFailed(
  chainId: number,
  address: string,
  message: string,
): Promise<void> {
  await db.from('tokens').upsert(
    {
      chain_id: chainId,
      address,
      index_status: 'failed',
      index_error: message.slice(0, 500),
    },
    { onConflict: 'chain_id,address' },
  )
}
