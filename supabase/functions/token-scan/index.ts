import { json, parseTarget, preflight } from '../_shared/http.ts'
import { userClient } from '../_shared/db.ts'

/**
 * GET /token-scan?chainId=8453&address=0x…&section=overview|factors|holders|buyers|trades
 *
 * Returns the scanner payload for one token. `section` narrows the response so
 * the live trade feed — polled every 15s — doesn't re-fetch holders and early
 * buyers it already has.
 *
 * A token the indexer has never seen returns 404 with `code: not_indexed`, which
 * the client turns into the "Index this token" call to action. That is a
 * terminal answer, not a transient failure, so the client must not retry it.
 */
Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const origin = req.headers.get('origin')
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, origin)

  const url = new URL(req.url)
  const parsed = parseTarget(url.searchParams.get('chainId'), url.searchParams.get('address'))
  if (!parsed.ok) return json({ error: parsed.error }, 400, origin)

  const { chainId, address } = parsed.value
  const section = url.searchParams.get('section') ?? 'all'
  const db = userClient(req)

  const { data: token, error } = await db
    .from('tokens')
    .select('*, token_metrics(*)')
    .eq('chain_id', chainId)
    .eq('address', address)
    .maybeSingle()

  if (error) return json({ error: error.message }, 500, origin)
  if (!token || token.index_status === 'pending') {
    return json(
      { code: 'not_indexed', chainId, address, status: token?.index_status ?? null },
      404,
      origin,
    )
  }

  // Trades are polled on their own interval; serve them alone when asked.
  if (section === 'trades') {
    const { data, error: tradesError } = await db
      .from('token_trades')
      .select('tx_hash, wallet, side, amount, value_usd, occurred_at')
      .eq('chain_id', chainId)
      .eq('address', address)
      .order('occurred_at', { ascending: false })
      .limit(12)
    if (tradesError) return json({ error: tradesError.message }, 500, origin)
    return json({ trades: data }, 200, origin)
  }

  const wants = (name: string) => section === 'all' || section === name

  // Issued together rather than awaited in sequence: they are independent, and
  // serialising them would stack four round trips into the response time.
  const [factors, holders, buyers, trades] = await Promise.all([
    wants('factors')
      ? db.from('token_health_factors').select('*').eq('chain_id', chainId).eq('address', address)
      : Promise.resolve({ data: null, error: null }),
    wants('holders')
      ? db
          .from('token_holders')
          .select('*')
          .eq('chain_id', chainId)
          .eq('address', address)
          .order('rank')
          .limit(10)
      : Promise.resolve({ data: null, error: null }),
    wants('buyers')
      ? db
          .from('token_early_buyers')
          .select('*')
          .eq('chain_id', chainId)
          .eq('address', address)
          .order('rank')
          .limit(25)
      : Promise.resolve({ data: null, error: null }),
    section === 'all'
      ? db
          .from('token_trades')
          .select('tx_hash, wallet, side, amount, value_usd, occurred_at')
          .eq('chain_id', chainId)
          .eq('address', address)
          .order('occurred_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: null, error: null }),
  ])

  const failure = [factors, holders, buyers, trades].find((r) => r.error)
  if (failure?.error) return json({ error: failure.error.message }, 500, origin)

  return json(
    {
      token,
      factors: factors.data,
      holders: holders.data,
      earlyBuyers: buyers.data,
      trades: trades.data,
    },
    200,
    // Numbers arrive as strings from NUMERIC columns — that is deliberate, and
    // the client parses them into BigInt rather than through a float.
    origin,
  )
})
