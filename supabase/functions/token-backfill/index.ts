import { json, parseTarget, preflight } from '../_shared/http.ts'
import { serviceClient, userClient } from '../_shared/db.ts'

/**
 * POST /token-backfill  { chainId, address }
 *
 * Walks a token's entire transfer history and stores it, so holder balances
 * and first buyers can be derived rather than guessed.
 *
 * The webhook only carries transfers from the moment a token starts being
 * watched. Everything before that has to be fetched, and it is fetched through
 * the asset-transfer index rather than by replaying logs: a log range walk is
 * capped at ten blocks on the free tier, which for an old token is tens of
 * thousands of requests.
 *
 * Resumable on purpose. An edge function has a wall clock, and a token with a
 * long history will not finish inside one; each call walks as many pages as it
 * can, stores the cursor, and returns `done: false`. The caller keeps going.
 * Nothing is marked complete until the provider says there are no more pages —
 * never on a timeout, never because enough looked like enough.
 */

/** Alchemy's subdomain per chain. Absent means we cannot walk that chain. */
const NETWORK: Record<number, string> = {
  1: 'eth-mainnet',
  8453: 'base-mainnet',
  42161: 'arb-mainnet',
  10: 'opt-mainnet',
  56: 'bnb-mainnet',
  324: 'zksync-mainnet',
  137: 'polygon-mainnet',
  43114: 'avax-mainnet',
  534352: 'scroll-mainnet',
}

/**
 * Leave room to store the last page and answer before the platform kills us.
 * A call that is cut off mid-write loses a page and pays for it again.
 */
const BUDGET_MS = 20_000
const PAGE_SIZE = '0x3e8' // 1000, the maximum the endpoint accepts.

interface Transfer {
  uniqueId?: string
  hash?: string
  blockNum?: string
  from?: string
  to?: string
  rawContract?: { value?: string | null; address?: string | null }
  metadata?: { blockTimestamp?: string }
}

interface Event {
  txHash: string
  logIndex: number
  blockNumber: number
  blockTime: string | null
  token: string
  from: string
  to: string
  value: string
}

async function alchemy(
  network: string,
  key: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const res = await fetch(`https://${network}.g.alchemy.com/v2/${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

  if (res.status === 403) {
    throw new Error('This network is not enabled on the data provider account.')
  }
  if (!res.ok) throw new Error(`Provider returned ${res.status}`)

  const body = await res.json()
  if (body?.error) throw new Error(String(body.error.message ?? 'Provider error'))
  return body?.result
}

/**
 * One page of transfers, decoded.
 *
 * `rawContract.value` is the hex uint256. The sibling `value` field is a
 * JavaScript number and has already lost precision by the time we see it —
 * reading that instead would put rounded balances in front of people who are
 * about to act on them.
 */
function decode(transfers: Transfer[], token: string): { events: Event[]; skipped: number } {
  const events: Event[] = []
  let skipped = 0

  for (const t of transfers) {
    // "0x<hash>:log:174" — the log index is not returned any other way, and it
    // is half of the primary key that makes redelivery a no-op.
    const index = Number(t.uniqueId?.split(':log:')[1])
    const raw = t.rawContract?.value
    const contract = (t.rawContract?.address ?? token).toLowerCase()

    if (
      !t.hash || !t.from || !t.to || !raw ||
      !Number.isFinite(index) ||
      // A different contract in a filtered response would mean the filter did
      // not apply. Storing it would attribute one token's flows to another.
      contract !== token
    ) {
      skipped += 1
      continue
    }

    let value: string
    try {
      value = BigInt(raw).toString()
    } catch {
      skipped += 1
      continue
    }

    events.push({
      txHash: t.hash.toLowerCase(),
      logIndex: index,
      blockNumber: Number.parseInt(t.blockNum ?? '', 16),
      blockTime: t.metadata?.blockTimestamp ?? null,
      token,
      from: t.from.toLowerCase(),
      to: t.to.toLowerCase(),
      value,
    })
  }

  return { events, skipped }
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const origin = req.headers.get('origin')
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin)

  let body: { chainId?: unknown; address?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body must be JSON' }, 400, origin)
  }

  const parsed = parseTarget(String(body.chainId ?? ''), String(body.address ?? ''))
  if (!parsed.ok) return json({ error: parsed.error }, 400, origin)
  const { chainId, address } = parsed.value

  // Attributable: this is the one read that spends provider credits per call.
  const { data: { user } } = await userClient(req).auth.getUser()
  if (!user) return json({ error: 'Sign in to read a token’s full history' }, 401, origin)

  const key = Deno.env.get('ALCHEMY_API_KEY')?.trim()
  if (!key) {
    return json(
      { error: 'Full history is not configured yet.', status: 'not-configured' },
      503,
      origin,
    )
  }

  const network = NETWORK[chainId]
  if (!network) {
    return json(
      { error: 'We cannot read full history on this network.', status: 'chain-unsupported' },
      400,
      origin,
    )
  }

  const db = serviceClient()
  const started = Date.now()

  try {
    // Fix the far end before walking. Anything after this block belongs to the
    // live stream, which is why a token has to be watched before it is walked:
    // otherwise there is a gap between the two that nothing ever fills.
    const headHex = await alchemy(network, key, 'eth_blockNumber', [])
    const head = Number.parseInt(String(headHex), 16)
    if (!Number.isFinite(head)) throw new Error('Could not read the chain head')

    const { data: claimed, error: claimError } = await db.rpc('start_token_backfill', {
      p_chain_id: chainId,
      p_address: address,
      p_to_block: head,
      p_user: user.id,
    })
    if (claimError) throw new Error(claimError.message)

    const row = (Array.isArray(claimed) ? claimed[0] : claimed) as
      | { status?: string; page_key?: string | null; pages?: number; transfers?: number }
      | null

    if (row?.status === 'complete') {
      return json({ status: 'complete', done: true, pages: row.pages ?? 0 }, 200, origin)
    }

    let pageKey: string | null = row?.page_key ?? null
    let pagesThisCall = 0
    let received = 0
    let inserted = 0
    let skipped = 0
    let done = false

    while (Date.now() - started < BUDGET_MS) {
      const params: Record<string, unknown> = {
        fromBlock: '0x0',
        toBlock: `0x${head.toString(16)}`,
        contractAddresses: [address],
        category: ['erc20'],
        withMetadata: true,
        // A zero-value transfer is still a transfer, and excluding them would
        // silently drop approvals-shaped activity that matters for clustering.
        excludeZeroValue: false,
        maxCount: PAGE_SIZE,
        order: 'asc',
      }
      if (pageKey) params.pageKey = pageKey

      const result = (await alchemy(network, key, 'alchemy_getAssetTransfers', [params])) as {
        transfers?: Transfer[]
        pageKey?: string
      }

      const page = decode(result?.transfers ?? [], address)
      const next = result?.pageKey ?? null
      done = !next

      const { data: stored, error: storeError } = await db.rpc('record_backfill_page', {
        p_chain_id: chainId,
        p_address: address,
        p_events: page.events,
        p_page_key: next,
        p_done: done,
      })
      if (storeError) throw new Error(storeError.message)

      const counts = (Array.isArray(stored) ? stored[0] : stored) as
        | { received?: number; inserted?: number }
        | null

      received += counts?.received ?? page.events.length
      inserted += counts?.inserted ?? 0
      skipped += page.skipped
      pagesThisCall += 1
      pageKey = next

      if (done) break
    }

    return json(
      {
        status: done ? 'complete' : 'running',
        done,
        toBlock: head,
        pages: (row?.pages ?? 0) + pagesThisCall,
        pagesThisCall,
        received,
        inserted,
        skipped,
      },
      200,
      origin,
    )
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Backfill failed'
    // Record it so the panel stops saying a walk is in progress. Losing this
    // write is how a token ends up stuck on "running" forever.
    await db.rpc('fail_token_backfill', {
      p_chain_id: chainId,
      p_address: address,
      p_error: message,
    })
    return json({ error: message, status: 'failed' }, 502, origin)
  }
})
