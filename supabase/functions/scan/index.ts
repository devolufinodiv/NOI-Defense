import { json, parseTarget, preflight } from '../_shared/http.ts'
import { serviceClient, userClient } from '../_shared/db.ts'

/**
 * GET /scan?chainId=8453&address=0x…
 *
 * The live scan. Queries several third-party sources in parallel, normalises
 * them into one verdict, caches the result, and returns it.
 *
 * IMPORTANT: upstream provider names never appear in this response. Field names
 * and messages are generic on purpose — the product is the analysis, not a
 * directory of whose API we called. Keep it that way when adding sources.
 *
 * Every source is optional. One being down, rate-limited or unsupported on a
 * chain degrades that section to "unknown" rather than failing the scan — and
 * unknown is rendered as unknown, never as "safe".
 */

const CACHE_TTL_SECONDS = 180

/** Market-data slug per chain. Absent = market lookup unavailable there. */
const MARKET_SLUG: Record<number, string> = {
  1: 'ethereum', 56: 'bsc', 137: 'polygon', 42161: 'arbitrum',
  10: 'optimism', 43114: 'avalanche', 8453: 'base', 534352: 'scroll', 324: 'zksync',
}

/** Chains where sell-simulation is available. */
const SIM_CHAINS = new Set([1, 56, 8453])

async function timed<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  // A slow upstream must not hold the whole scan hostage.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  try {
    return (await Promise.race([promise, timeout])) as T | null
  } catch {
    return null
  }
}

interface MarketData {
  priceUsd: number | null
  change24h: number | null
  liquidityUsd: number | null
  volume24hUsd: number | null
  fdvUsd: number | null
  pairCount: number
  primaryVenue: string | null
  name: string | null
  symbol: string | null
}

/**
 * `'none'` means we checked and there genuinely are no pools. `null` (from a
 * throw or a timeout) means we could not check. Collapsing the two would let
 * a slow upstream be reported as "this token is not tradable", which is a
 * confident claim we have not earned.
 */
/** Normalises raw pair records into the fields we care about. */
function summarise(pairs: Array<Record<string, unknown>>, ours: string): MarketData | 'none' {
  const side = (p: Record<string, unknown>, key: string) =>
    ((p?.[key] as Record<string, string> | undefined)?.address ?? '').toLowerCase()

  const asBase = pairs.filter((p) => side(p, 'baseToken') === ours)
  const asQuote = pairs.filter((p) => side(p, 'quoteToken') === ours)

  // Every pool holding the token backs it, whichever side it sits on. Counting
  // one side only reported Ethereum USDT as having $1.8k of depth, because it
  // is the base token in three obscure pools and the quote token in thousands
  // of real ones.
  const holding = [...asBase, ...asQuote]
  if (holding.length === 0) return 'none'

  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const deepestOf = (list: Array<Record<string, unknown>>) =>
    list.reduce((best, p) => {
      const x = Number((p?.liquidity as Record<string, number>)?.usd ?? 0)
      const y = Number((best?.liquidity as Record<string, number>)?.usd ?? 0)
      return x > y ? p : best
    }, list[0])

  // Price, change and FDV are BASE-token figures, so they may only be read from
  // a pair where our token is the base. Identity falls back to the quote side
  // for assets that are never quoted directly.
  const priced = asBase.length > 0 ? deepestOf(asBase) : null
  const named = priced ?? deepestOf(asQuote)
  const self = (priced ? named.baseToken : named.quoteToken) as
    | Record<string, string>
    | undefined
  const primary = deepestOf(holding)

  return {
    priceUsd: priced ? num(priced.priceUsd) : null,
    change24h: priced ? num((priced.priceChange as Record<string, number>)?.h24) : null,
    fdvUsd: priced ? num(priced.fdv) : null,
    liquidityUsd: holding.reduce(
      (sum, p) => sum + (num((p?.liquidity as Record<string, number>)?.usd) ?? 0),
      0,
    ),
    volume24hUsd: holding.reduce(
      (sum, p) => sum + (num((p?.volume as Record<string, number>)?.h24) ?? 0),
      0,
    ),
    pairCount: holding.length,
    primaryVenue: typeof primary.dexId === 'string' ? primary.dexId : null,
    name: self?.name ?? null,
    symbol: self?.symbol ?? null,
  }
}

/**
 * `'none'` means we checked and there genuinely are no pools. `null` (a throw
 * or a timeout) means we could not check. Collapsing the two would let a slow
 * upstream be reported as "this token is not tradable".
 *
 * The chain-scoped endpoint is tried first. The global one returns pairs across
 * every network and truncates the list, so filtering it down to one chain threw
 * most pools away: Ethereum USDC came back with a single pair and USDT with
 * none at all. That under-reported liquidity for every token, not only the ones
 * that vanished entirely.
 */
async function fetchMarket(chainId: number, address: string): Promise<MarketData | 'none' | null> {
  const slug = MARKET_SLUG[chainId]
  if (!slug) return null

  const ours = address.toLowerCase()

  const scoped = await fetch(`https://api.dexscreener.com/token-pairs/v1/${slug}/${address}`, {
    headers: { accept: 'application/json' },
  })

  if (scoped.ok) {
    const body = await scoped.json()
    // This endpoint answers with a bare array of pairs, already chain-scoped.
    const pairs = Array.isArray(body) ? body : Array.isArray(body?.pairs) ? body.pairs : []
    if (pairs.length > 0) return summarise(pairs, ours)
    // An empty array is a real answer, but fall through once in case the token
    // is only listed under the older index.
  }

  const global = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
    headers: { accept: 'application/json' },
  })
  if (!global.ok) return null

  const body = await global.json()
  const all = Array.isArray(body?.pairs) ? body.pairs : []
  return summarise(
    all.filter((p: Record<string, unknown>) => p?.chainId === slug),
    ours,
  )
}

interface SafetyData {
  isHoneypot: boolean | null
  buyTax: number | null
  sellTax: number | null
  transferTax: number | null
  simulationOk: boolean
  flags: string[]
  contractName: string | null
}

async function fetchSafety(chainId: number, address: string): Promise<SafetyData | null> {
  if (!SIM_CHAINS.has(chainId)) return null

  const res = await fetch(
    `https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${chainId}`,
    { headers: { accept: 'application/json' } },
  )
  if (!res.ok) return null

  const body = await res.json()
  const sim = body?.simulationResult ?? {}
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  return {
    isHoneypot: typeof body?.honeypotResult?.isHoneypot === 'boolean'
      ? body.honeypotResult.isHoneypot
      : null,
    buyTax: num(sim.buyTax),
    sellTax: num(sim.sellTax),
    transferTax: num(sim.transferTax),
    simulationOk: body?.simulationSuccess === true,
    flags: Array.isArray(body?.flags) ? body.flags.map(String).slice(0, 12) : [],
    contractName: body?.token?.name ?? null,
  }
}

interface SourceData {
  verified: boolean
  contractName: string | null
}

async function fetchSource(chainId: number, address: string): Promise<SourceData | null> {
  const key = Deno.env.get('CONTRACT_REGISTRY_KEY')?.trim()
  // No key configured: source verification is simply unknown, and the verdict
  // treats unknown as unknown rather than assuming either way.
  if (!key) return null

  const url =
    `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract` +
    `&action=getsourcecode&address=${address}&apikey=${key}`
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) return null

  const body = await res.json()
  if (body?.status !== '1' || !Array.isArray(body.result) || body.result.length === 0) return null

  const entry = body.result[0]
  return {
    // An unverified contract returns an empty SourceCode field.
    verified: typeof entry?.SourceCode === 'string' && entry.SourceCode.length > 0,
    contractName: entry?.ContractName || null,
  }
}

type Tier = 'safe' | 'caution' | 'risk' | 'unknown'

interface Verdict {
  tier: Tier
  headline: string
  summary: string
  reasons: Array<{ tone: 'good' | 'warn' | 'bad' | 'neutral'; text: string }>
}

/**
 * Turns the raw signals into something a first-time buyer can act on.
 *
 * Written as plain sentences, not jargon: "you may not be able to sell this"
 * beats "honeypot: true" for the person who most needs the warning. Ordered so
 * the worst finding is the headline.
 */
function buildVerdict(
  market: MarketData | null,
  safety: SafetyData | null,
  source: SourceData | null,
  marketChecked: boolean,
): Verdict {
  const reasons: Verdict['reasons'] = []
  let worst: Tier = 'safe'
  const escalate = (t: Tier) => {
    const order: Tier[] = ['safe', 'caution', 'risk']
    if (order.indexOf(t) > order.indexOf(worst as Tier)) worst = t
  }

  if (safety?.isHoneypot === true) {
    escalate('risk')
    reasons.push({ tone: 'bad', text: 'A test sale failed. You may not be able to sell this token after buying it.' })
  } else if (safety?.isHoneypot === false && safety.simulationOk) {
    reasons.push({ tone: 'good', text: 'A test buy and sale both went through.' })
  }

  const sell = safety?.sellTax
  if (sell !== null && sell !== undefined) {
    if (sell >= 20) {
      escalate('risk')
      reasons.push({ tone: 'bad', text: `Selling costs a ${sell.toFixed(0)}% fee — most of a small position would disappear.` })
    } else if (sell >= 10) {
      escalate('caution')
      reasons.push({ tone: 'warn', text: `Selling costs a ${sell.toFixed(0)}% fee, which is high.` })
    } else if (sell > 0) {
      reasons.push({ tone: 'neutral', text: `Selling costs a ${sell.toFixed(1)}% fee.` })
    } else {
      reasons.push({ tone: 'good', text: 'No fee charged when you sell.' })
    }
  }

  const liq = market?.liquidityUsd ?? null
  if (liq === null) {
    escalate('caution')
    reasons.push({ tone: 'warn', text: 'No trading pools found. This token may not be tradable yet.' })
  } else if (liq < 10_000) {
    escalate('risk')
    reasons.push({ tone: 'bad', text: `Only about $${Math.round(liq).toLocaleString('en-US')} is available to trade against. Even a small sale would move the price sharply.` })
  } else if (liq < 50_000) {
    escalate('caution')
    reasons.push({ tone: 'warn', text: `About $${Math.round(liq).toLocaleString('en-US')} is available to trade against, which is thin.` })
  } else {
    reasons.push({ tone: 'good', text: `About $${Math.round(liq).toLocaleString('en-US')} is available to trade against.` })
  }

  if (source?.verified === true) {
    reasons.push({ tone: 'good', text: 'The code behind this token is published and readable.' })
  } else if (source?.verified === false) {
    escalate('caution')
    reasons.push({ tone: 'warn', text: 'The code behind this token has not been published, so nobody can check what it does.' })
  }

  const noSignals = safety === null && market === null
  if (noSignals) {
    return {
      tier: 'unknown',
      headline: 'Not enough information',
      summary: 'We could not find trading activity or run safety checks for this address on this network. That is not a verdict either way — treat it as unproven.',
      reasons,
    }
  }

  const copy: Record<Exclude<Tier, 'unknown'>, { headline: string; summary: string }> = {
    safe: {
      headline: 'No major red flags',
      summary: 'Our checks did not find the usual warning signs. That is not a recommendation — it only means nothing obvious is wrong.',
    },
    caution: {
      headline: 'Worth a closer look',
      summary: 'Some checks came back less than ideal. Read the points below before putting money in.',
    },
    risk: {
      headline: 'High risk',
      summary: 'At least one serious problem showed up. People commonly lose money on tokens that look like this.',
    },
  }

  return { tier: worst, ...copy[worst as Exclude<Tier, 'unknown'>], reasons }
}

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const origin = req.headers.get('origin')
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, origin)

  const url = new URL(req.url)
  const parsed = parseTarget(url.searchParams.get('chainId'), url.searchParams.get('address'))
  if (!parsed.ok) return json({ error: parsed.error }, 400, origin)

  const { chainId, address } = parsed.value
  const db = serviceClient()

  // Serve a warm cache rather than re-billing every upstream for each visitor.
  if (url.searchParams.get('refresh') !== '1') {
    const { data: cached } = await db
      .from('token_safety')
      .select('checked_at')
      .eq('chain_id', chainId)
      .eq('address', address)
      .maybeSingle()

    if (cached?.checked_at) {
      const age = (Date.now() - new Date(cached.checked_at).getTime()) / 1000
      if (age < CACHE_TTL_SECONDS) {
        const fresh = await readCached(db, chainId, address)
        if (fresh) return json({ ...fresh, cached: true }, 200, origin)
      }
    }
  }

  // All three in parallel with individual timeouts — the scan takes as long as
  // the slowest source, not the sum of them.
  const [market, safety, source] = await Promise.all([
    timed(fetchMarket(chainId, address), 12_000),
    timed(fetchSafety(chainId, address), 7_000),
    timed(fetchSource(chainId, address), 7_000),
  ])

  // `market` is the raw union; narrow it before anything downstream uses it.
  const marketChecked = market !== null
  const marketData: MarketData | null = market === 'none' || market === null ? null : market

  const verdict = buildVerdict(marketData, safety, source, marketChecked)
  const name = marketData?.name ?? safety?.contractName ?? source?.contractName ?? ''
  const symbol = marketData?.symbol ?? ''

  await db.from('tokens').upsert(
    {
      chain_id: chainId,
      address,
      name: name.slice(0, 128),
      symbol: symbol.slice(0, 32),
      verified: source?.verified ?? false,
      index_status: 'ready',
      indexed_at: new Date().toISOString(),
    },
    { onConflict: 'chain_id,address' },
  )

  if (marketData) {
    await db.from('token_metrics').upsert(
      {
        chain_id: chainId,
        address,
        price_usd: marketData.priceUsd,
        change_24h: marketData.change24h,
        liquidity_usd: marketData.liquidityUsd,
        volume_24h_usd: marketData.volume24hUsd,
        fdv_usd: marketData.fdvUsd,
        pair_count: marketData.pairCount,
        primary_dex: marketData.primaryVenue,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'chain_id,address' },
    )
  }

  await db.from('token_safety').upsert(
    {
      chain_id: chainId,
      address,
      is_honeypot: safety?.isHoneypot ?? null,
      buy_tax: safety?.buyTax ?? null,
      sell_tax: safety?.sellTax ?? null,
      transfer_tax: safety?.transferTax ?? null,
      simulation_ok: safety?.simulationOk ?? false,
      source_verified: source?.verified ?? null,
      contract_name: name.slice(0, 128) || null,
      flags: safety?.flags ?? [],
      checked_at: new Date().toISOString(),
    },
    { onConflict: 'chain_id,address' },
  )

  // Attribute the scan to the caller when signed in, which is what drives both
  // analytics and points. Anonymous scans still work; they just earn nothing.
  const auth = req.headers.get('Authorization')
  if (auth) {
    const { data } = await userClient(req).auth.getUser()
    if (data.user) {
      await db.from('activity_events').insert({
        user_id: data.user.id,
        kind: 'token_scan',
        chain_id: chainId,
        subject: address,
        subject_kind: 'token',
      })
    }
  }

  return json(
    {
      token: { chainId, address, name, symbol, verified: source?.verified ?? null },
      market: marketData,
      safety,
      verdict,
      cached: false,
    },
    200,
    origin,
  )
})

async function readCached(db: ReturnType<typeof serviceClient>, chainId: number, address: string) {
  const [{ data: token }, { data: metrics }, { data: safetyRow }] = await Promise.all([
    db.from('tokens').select('name, symbol, verified').eq('chain_id', chainId).eq('address', address).maybeSingle(),
    db.from('token_metrics').select('*').eq('chain_id', chainId).eq('address', address).maybeSingle(),
    db.from('token_safety').select('*').eq('chain_id', chainId).eq('address', address).maybeSingle(),
  ])
  if (!token) return null

  const market: MarketData | null = metrics
    ? {
        priceUsd: metrics.price_usd === null ? null : Number(metrics.price_usd),
        change24h: metrics.change_24h === null ? null : Number(metrics.change_24h),
        liquidityUsd: metrics.liquidity_usd === null ? null : Number(metrics.liquidity_usd),
        volume24hUsd: metrics.volume_24h_usd === null ? null : Number(metrics.volume_24h_usd),
        fdvUsd: metrics.fdv_usd === null ? null : Number(metrics.fdv_usd),
        pairCount: metrics.pair_count ?? 0,
        primaryVenue: metrics.primary_dex ?? null,
        name: token.name, symbol: token.symbol,
      }
    : null

  const safety: SafetyData | null = safetyRow
    ? {
        isHoneypot: safetyRow.is_honeypot,
        buyTax: safetyRow.buy_tax === null ? null : Number(safetyRow.buy_tax),
        sellTax: safetyRow.sell_tax === null ? null : Number(safetyRow.sell_tax),
        transferTax: safetyRow.transfer_tax === null ? null : Number(safetyRow.transfer_tax),
        simulationOk: safetyRow.simulation_ok,
        flags: Array.isArray(safetyRow.flags) ? safetyRow.flags : [],
        contractName: safetyRow.contract_name,
      }
    : null

  const source = safetyRow?.source_verified === null || safetyRow?.source_verified === undefined
    ? null
    : { verified: safetyRow.source_verified, contractName: safetyRow.contract_name }

  return {
    token: { chainId, address, name: token.name, symbol: token.symbol, verified: token.verified },
    market,
    safety,
    verdict: buildVerdict(market, safety, source, true),
  }
}
