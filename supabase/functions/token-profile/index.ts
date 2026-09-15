import { json, parseTarget, preflight } from '../_shared/http.ts'

/**
 * GET /token-profile?chainId=1&address=0x…
 *
 * The four things you actually want side by side when choosing between two
 * tokens: what the contract can do to you, how it has traded over several
 * windows, how the supply and the depth are arranged, and what the safety
 * checks found.
 *
 * This is deliberately separate from /scan. Scan answers "is this safe enough
 * to touch" for one address and is cached hard; this answers "how do these two
 * differ" and reads several extra sources to do it.
 *
 * Every section reports its own status. A section we could not read says so —
 * it never reads as an absence of findings. Upstream provider names never
 * appear in the response.
 */

const RPC: Record<number, string[]> = {
  1: ['https://ethereum-rpc.publicnode.com', 'https://cloudflare-eth.com', 'https://eth.drpc.org'],
  8453: ['https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum-one-rpc.publicnode.com'],
  10: ['https://mainnet.optimism.io', 'https://optimism-rpc.publicnode.com'],
  137: ['https://polygon-rpc.com', 'https://polygon-bor-rpc.publicnode.com'],
  56: ['https://bsc-dataseed.binance.org', 'https://bsc-rpc.publicnode.com'],
  43114: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche-c-chain-rpc.publicnode.com'],
  534352: ['https://rpc.scroll.io'],
  324: ['https://mainnet.era.zksync.io'],
  84532: ['https://sepolia.base.org'],
  11155111: ['https://ethereum-sepolia-rpc.publicnode.com'],
}

const MARKET_SLUG: Record<number, string> = {
  1: 'ethereum', 56: 'bsc', 137: 'polygon', 42161: 'arbitrum',
  10: 'optimism', 43114: 'avalanche', 8453: 'base', 534352: 'scroll', 324: 'zksync',
}

const SIM_CHAINS = new Set([1, 56, 8453])
const UNINDEXED_CHAINS = new Set([534352, 324])

async function timed<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  try {
    return (await Promise.race([promise, timeout])) as T | null
  } catch {
    return null
  }
}

async function rpc(chainId: number, method: string, params: unknown[]): Promise<string | null> {
  for (const url of RPC[chainId] ?? []) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      if (!res.ok) continue
      const body = await res.json()
      if (typeof body?.result === 'string') return body.result
    } catch {
      // Fall through to the next endpoint rather than failing the section.
    }
  }
  return null
}

/** One `eth_call` against a zero-argument selector. */
function ethCall(chainId: number, address: string, selector: string) {
  return rpc(chainId, 'eth_call', [{ to: address, data: selector }, 'latest'])
}

const num = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/* ---------------------------------------------- contract functions --- */

/**
 * What the contract is able to do to a holder.
 *
 * Read from the published ABI rather than guessed from bytecode: the presence
 * of `mint` or `blacklist` is a fact about the interface, and the absence of a
 * published ABI is reported as "we cannot tell", not as "it does none of these".
 */
type FunctionStatus = 'ok' | 'not-configured' | 'unverified' | 'chain-unindexed' | 'failed'

interface Capability {
  id: string
  label: string
  detail: string
  present: boolean
  tone: 'bad' | 'warn' | 'good' | 'neutral'
}

/** Matched against ABI function names, lowercased. */
const CAPABILITY_RULES: Array<{
  id: string
  label: string
  detail: string
  tone: 'bad' | 'warn'
  match: (name: string) => boolean
}> = [
  {
    id: 'mint',
    label: 'Can create new tokens',
    detail: 'The supply can be increased after you buy, diluting what you hold.',
    tone: 'bad',
    match: (n) => n === 'mint' || n.startsWith('mint'),
  },
  {
    id: 'pause',
    label: 'Can freeze transfers',
    detail: 'Trading can be halted, which would stop you selling.',
    tone: 'bad',
    match: (n) => n === 'pause' || n === 'unpause' || n === 'setpaused' || n === 'settradingenabled',
  },
  {
    id: 'blacklist',
    label: 'Can block addresses',
    detail: 'Specific wallets can be stopped from trading, including yours.',
    tone: 'bad',
    match: (n) => n.includes('blacklist') || n.includes('blocklist') || n.includes('denylist'),
  },
  {
    id: 'fees',
    label: 'Can change fees',
    detail: 'The buy or sell fee can be raised after you buy.',
    tone: 'warn',
    match: (n) =>
      (n.includes('fee') || n.includes('tax')) &&
      (n.startsWith('set') || n.startsWith('update') || n.startsWith('change')),
  },
  {
    id: 'limits',
    label: 'Can change trade limits',
    detail: 'Maximum transaction or wallet size can be changed.',
    tone: 'warn',
    match: (n) => n.includes('maxtx') || n.includes('maxwallet') || n.includes('maxamount'),
  },
  {
    id: 'upgrade',
    label: 'Code can be replaced',
    detail: 'This is an upgradeable contract — its behaviour can change entirely.',
    tone: 'bad',
    match: (n) => n === 'upgradeto' || n === 'upgradetoandcall' || n === 'setimplementation',
  },
]

interface FunctionsSection {
  status: FunctionStatus
  verified: boolean | null
  functionCount: number | null
  capabilities: Capability[]
  ownerAddress: string | null
  ownershipRenounced: boolean | null
  isProxy: boolean | null
  implementation: string | null
}

/** One registry lookup, or null if it did not come back usable. */
async function registryEntry(
  chainId: number,
  address: string,
  key: string,
): Promise<Record<string, string> | null> {
  const url =
    `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract` +
    `&action=getsourcecode&address=${address}&apikey=${key}`
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return null
    const body = await res.json()
    if (body?.status !== '1' || !Array.isArray(body.result) || body.result.length === 0) return null
    return body.result[0] as Record<string, string>
  } catch {
    return null
  }
}

function functionNames(abiText: string | undefined): string[] {
  try {
    const parsed = JSON.parse(abiText ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item: Record<string, unknown>) => item?.type === 'function')
      .map((item: Record<string, unknown>) => String(item?.name ?? '').toLowerCase())
  } catch {
    return []
  }
}

async function fetchFunctions(chainId: number, address: string): Promise<FunctionsSection> {
  const empty = (status: FunctionStatus): FunctionsSection => ({
    status,
    verified: null,
    functionCount: null,
    capabilities: [],
    ownerAddress: null,
    ownershipRenounced: null,
    isProxy: null,
    implementation: null,
  })

  const key = Deno.env.get('CONTRACT_REGISTRY_KEY')?.trim()
  if (!key) return empty('not-configured')
  if (UNINDEXED_CHAINS.has(chainId)) return empty('chain-unindexed')

  const entry = await registryEntry(chainId, address, key)
  if (!entry) return empty('failed')

  const verified = typeof entry.SourceCode === 'string' && entry.SourceCode.length > 0
  if (!verified) return { ...empty('unverified'), verified: false }

  /*
   * A proxy's own ABI is a handful of plumbing functions; everything that can
   * be done to a holder lives in the implementation behind it. Reading only the
   * proxy reported Ethereum USDC as unable to mint, pause or blacklist, when
   * its implementation does all three — a false all-clear on the three facts
   * that matter most here. Both ABIs are read and merged.
   */
  const isProxy = entry.Proxy === '1'
  const implementation = /^0x[0-9a-fA-F]{40}$/.test(entry.Implementation ?? '')
    ? entry.Implementation.toLowerCase()
    : null

  const names = new Set(functionNames(entry.ABI))
  if (isProxy && implementation) {
    const implEntry = await registryEntry(chainId, implementation, key)
    for (const name of functionNames(implEntry?.ABI)) names.add(name)
  }

  const all = [...names]
  const capabilities: Capability[] = CAPABILITY_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    detail: rule.detail,
    present: all.some(rule.match),
    tone: rule.tone,
  }))

  // Ownership: an owner that is the zero address has been renounced, which is
  // the difference between "someone can flip these switches" and "nobody can".
  // The call goes to the proxy, which forwards it, so this works either way.
  let ownerAddress: string | null = null
  let ownershipRenounced: boolean | null = null
  if (names.has('owner')) {
    const raw = await ethCall(chainId, address, '0x8da5cb5b')
    if (raw && raw.length >= 66) {
      const addr = `0x${raw.slice(-40)}`
      ownerAddress = addr
      ownershipRenounced = /^0x0{40}$/.test(addr)
    }
  } else {
    // No owner() in the interface at all: there is no owner to renounce.
    ownershipRenounced = true
  }

  return {
    status: 'ok',
    verified: true,
    functionCount: all.length,
    capabilities,
    ownerAddress,
    ownershipRenounced,
    isProxy,
    implementation,
  }
}

/* --------------------------------- timeframes, tokenomics, liquidity --- */

interface TimeWindow {
  window: '5m' | '1h' | '6h' | '24h'
  priceChange: number | null
  volumeUsd: number | null
  buys: number | null
  sells: number | null
}

interface Pool {
  venue: string | null
  pair: string
  liquidityUsd: number | null
  share: number | null
}

interface MarketSection {
  status: 'ok' | 'none' | 'chain-unsupported' | 'failed'
  name: string | null
  symbol: string | null
  priceUsd: number | null
  fdvUsd: number | null
  marketCapUsd: number | null
  liquidityUsd: number | null
  pairCount: number
  topPools: Pool[]
  windows: TimeWindow[]
}

const NO_MARKET = (status: MarketSection['status']): MarketSection => ({
  status,
  name: null,
  symbol: null,
  priceUsd: null,
  fdvUsd: null,
  marketCapUsd: null,
  liquidityUsd: null,
  pairCount: 0,
  topPools: [],
  windows: [],
})

async function fetchMarket(chainId: number, address: string): Promise<MarketSection> {
  const slug = MARKET_SLUG[chainId]
  if (!slug) return NO_MARKET('chain-unsupported')

  let pairs: Array<Record<string, unknown>> = []
  try {
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/${slug}/${address}`, {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return NO_MARKET('failed')
    const body = await res.json()
    pairs = Array.isArray(body) ? body : Array.isArray(body?.pairs) ? body.pairs : []
  } catch {
    return NO_MARKET('failed')
  }

  const ours = address.toLowerCase()
  const sideAddr = (p: Record<string, unknown>, key: string) =>
    ((p?.[key] as Record<string, string> | undefined)?.address ?? '').toLowerCase()

  const asBase = pairs.filter((p) => sideAddr(p, 'baseToken') === ours)
  const holding = [...asBase, ...pairs.filter((p) => sideAddr(p, 'quoteToken') === ours)]
  if (holding.length === 0) return NO_MARKET('none')

  const liqOf = (p: Record<string, unknown>) =>
    num((p?.liquidity as Record<string, number>)?.usd) ?? 0

  const deepestOf = (list: Array<Record<string, unknown>>) =>
    list.reduce((best, p) => (liqOf(p) > liqOf(best) ? p : best), list[0])

  // Price, FDV, market cap and the per-window figures are all base-token
  // numbers, so they may only be read from a pair where this token is the base.
  const priced = asBase.length > 0 ? deepestOf(asBase) : null
  const self = priced
    ? (priced.baseToken as Record<string, string> | undefined)
    : ((deepestOf(holding).quoteToken ?? deepestOf(holding).baseToken) as
        | Record<string, string>
        | undefined)

  const totalLiquidity = holding.reduce((sum, p) => sum + liqOf(p), 0)

  const topPools: Pool[] = [...holding]
    .sort((a, b) => liqOf(b) - liqOf(a))
    .slice(0, 4)
    .map((p) => {
      const base = (p.baseToken as Record<string, string> | undefined)?.symbol ?? '?'
      const quote = (p.quoteToken as Record<string, string> | undefined)?.symbol ?? '?'
      const liquidityUsd = num((p?.liquidity as Record<string, number>)?.usd)
      return {
        venue: typeof p.dexId === 'string' ? p.dexId : null,
        pair: `${base}/${quote}`,
        liquidityUsd,
        share: totalLiquidity > 0 && liquidityUsd !== null ? liquidityUsd / totalLiquidity : null,
      }
    })

  // Volume and trade counts are summed across every pool holding the token;
  // price change is a rate, so it comes from the deepest priced pool instead.
  const sumWindow = (group: string, field: string) =>
    holding.reduce(
      (sum, p) => sum + (num((p?.[group] as Record<string, number>)?.[field]) ?? 0),
      0,
    )
  const sumTxns = (field: string, side: 'buys' | 'sells') =>
    holding.reduce((sum, p) => {
      const txns = (p?.txns as Record<string, Record<string, number>> | undefined)?.[field]
      return sum + (num(txns?.[side]) ?? 0)
    }, 0)

  const windows: TimeWindow[] = (
    [
      ['5m', 'm5'],
      ['1h', 'h1'],
      ['6h', 'h6'],
      ['24h', 'h24'],
    ] as Array<[TimeWindow['window'], string]>
  ).map(([label, field]) => ({
    window: label,
    priceChange: priced
      ? num((priced.priceChange as Record<string, number>)?.[field])
      : null,
    volumeUsd: sumWindow('volume', field),
    buys: sumTxns(field, 'buys'),
    sells: sumTxns(field, 'sells'),
  }))

  return {
    status: 'ok',
    name: self?.name ?? null,
    symbol: self?.symbol ?? null,
    priceUsd: priced ? num(priced.priceUsd) : null,
    fdvUsd: priced ? num(priced.fdv) : null,
    marketCapUsd: priced ? num(priced.marketCap) : null,
    liquidityUsd: totalLiquidity,
    pairCount: holding.length,
    topPools,
    windows,
  }
}

/* ------------------------------------------------------------ supply --- */

/**
 * Total supply, read from the chain and kept exact.
 *
 * The value is a uint256 and stays a BigInt the whole way: formatting divides
 * integers and assembles a string, so a supply beyond 2^53 is still reported
 * digit for digit rather than rounded into scientific notation by a float.
 */
function formatUnits(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString()
  const base = 10n ** BigInt(decimals)
  const whole = raw / base
  const fraction = raw % base
  if (fraction === 0n) return whole.toString()
  const padded = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${whole.toString()}.${padded}`
}

interface SupplySection {
  status: 'ok' | 'failed'
  totalSupply: string | null
  decimals: number | null
}

async function fetchSupply(chainId: number, address: string): Promise<SupplySection> {
  const [supplyHex, decimalsHex] = await Promise.all([
    ethCall(chainId, address, '0x18160ddd'), // totalSupply()
    ethCall(chainId, address, '0x313ce567'), // decimals()
  ])

  if (!supplyHex || supplyHex === '0x') return { status: 'failed', totalSupply: null, decimals: null }

  try {
    const raw = BigInt(supplyHex)
    const decimals = decimalsHex && decimalsHex !== '0x' ? Number(BigInt(decimalsHex)) : 18
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
      return { status: 'failed', totalSupply: null, decimals: null }
    }
    return { status: 'ok', totalSupply: formatUnits(raw, decimals), decimals }
  } catch {
    return { status: 'failed', totalSupply: null, decimals: null }
  }
}

/* ---------------------------------------------------------- security --- */

interface SecuritySection {
  status: 'ok' | 'chain-unsupported' | 'failed'
  isHoneypot: boolean | null
  buyTax: number | null
  sellTax: number | null
  transferTax: number | null
  simulationOk: boolean
  flags: string[]
}

async function fetchSecurity(chainId: number, address: string): Promise<SecuritySection> {
  const empty = (status: SecuritySection['status']): SecuritySection => ({
    status,
    isHoneypot: null,
    buyTax: null,
    sellTax: null,
    transferTax: null,
    simulationOk: false,
    flags: [],
  })

  if (!SIM_CHAINS.has(chainId)) return empty('chain-unsupported')

  try {
    const res = await fetch(
      `https://api.honeypot.is/v2/IsHoneypot?address=${address}&chainID=${chainId}`,
      { headers: { accept: 'application/json' } },
    )
    if (!res.ok) return empty('failed')
    const body = await res.json()
    const sim = body?.simulationResult ?? {}
    return {
      status: 'ok',
      isHoneypot:
        typeof body?.honeypotResult?.isHoneypot === 'boolean'
          ? body.honeypotResult.isHoneypot
          : null,
      buyTax: num(sim.buyTax),
      sellTax: num(sim.sellTax),
      transferTax: num(sim.transferTax),
      simulationOk: body?.simulationSuccess === true,
      flags: Array.isArray(body?.flags) ? body.flags.map(String).slice(0, 12) : [],
    }
  } catch {
    return empty('failed')
  }
}

/* ------------------------------------------------------------- serve --- */

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const origin = req.headers.get('origin')
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405, origin)

  const url = new URL(req.url)
  const parsed = parseTarget(url.searchParams.get('chainId'), url.searchParams.get('address'))
  if (!parsed.ok) return json({ error: parsed.error }, 400, origin)

  const { chainId, address } = parsed.value

  const [functions, market, supply, security] = await Promise.all([
    timed(fetchFunctions(chainId, address), 9_000),
    timed(fetchMarket(chainId, address), 12_000),
    timed(fetchSupply(chainId, address), 8_000),
    timed(fetchSecurity(chainId, address), 8_000),
  ])

  // A timeout is not a finding. Each section falls back to its own "failed"
  // shape so the client renders "we could not read this" rather than a blank
  // that looks like a clean result.
  return json(
    {
      token: {
        chainId,
        address,
        name: market?.name ?? null,
        symbol: market?.symbol ?? null,
        decimals: supply?.decimals ?? null,
      },
      functions: functions ?? {
        status: 'failed',
        verified: null,
        functionCount: null,
        capabilities: [],
        ownerAddress: null,
        ownershipRenounced: null,
        isProxy: null,
        implementation: null,
      },
      market: market ?? NO_MARKET('failed'),
      supply: supply ?? { status: 'failed', totalSupply: null, decimals: null },
      security: security ?? {
        status: 'failed',
        isHoneypot: null,
        buyTax: null,
        sellTax: null,
        transferTax: null,
        simulationOk: false,
        flags: [],
      },
    },
    200,
    origin,
  )
})
