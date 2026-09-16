/**
 * On-chain reads shared by the scan and the comparison.
 *
 * Everything here answers a question a buyer asks out loud — "how old is this?"
 * and "can the liquidity be pulled?" — from the chain itself, with no indexer
 * in between. Each answer carries its own status, because "we could not check"
 * and "we checked and it is fine" must never render the same way.
 */

export const RPC: Record<number, string[]> = {
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

export async function rpc(
  chainId: number,
  method: string,
  params: unknown[],
): Promise<unknown | null> {
  for (const url of RPC[chainId] ?? []) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      if (!res.ok) continue
      const body = await res.json()
      if (body?.result !== undefined && body?.result !== null) return body.result
    } catch {
      // Try the next endpoint rather than failing the whole section.
    }
  }
  return null
}

export async function ethCall(
  chainId: number,
  to: string,
  data: string,
): Promise<string | null> {
  const out = await rpc(chainId, 'eth_call', [{ to, data }, 'latest'])
  return typeof out === 'string' ? out : null
}

/** `balanceOf(address)` calldata. */
function balanceOfData(holder: string): string {
  return `0x70a08231${holder.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`
}

function toBigInt(hex: string | null): bigint | null {
  if (!hex || hex === '0x') return null
  try {
    return BigInt(hex)
  } catch {
    return null
  }
}

/* --------------------------------------------------------- contract age --- */

export interface ContractAge {
  status: 'ok' | 'not-a-contract' | 'not-configured' | 'chain-unsupported' | 'failed'
  deployedAt: string | null
  deploymentBlock: number | null
  deployedBy: string | null
}

/**
 * When this contract first appeared on chain, and who put it there.
 *
 * A token deployed an hour ago is a completely different proposition from one
 * that has been running for three years, and nothing else in the app says so.
 *
 * This asks the registry for the creation transaction: one request, exact to
 * the block and the second.
 *
 * It deliberately does NOT binary-search `eth_getCode` over the block range,
 * which is the obvious way to do this without a key. That approach was built
 * and measured, and it is quietly wrong: the public endpoints here are not
 * archive nodes, and several answer a historical `eth_getCode` with the code as
 * it stands today rather than as it stood at that block. The search then finds
 * "code present" everywhere below the real deployment and converges on a
 * confident, badly wrong date — Ethereum USDC came back as August 2016 against
 * an actual deployment of August 2018, nearly four million blocks out. A wrong
 * date presented as fact is worse than no date, so without the registry this
 * reports that it could not check.
 */
export async function contractAge(
  chainId: number,
  address: string,
  registryKey?: string,
): Promise<ContractAge> {
  const fail = (status: ContractAge['status']): ContractAge => ({
    status,
    deployedAt: null,
    deploymentBlock: null,
    deployedBy: null,
  })

  if (!RPC[chainId]) return fail('chain-unsupported')
  if (!registryKey) return fail('not-configured')

  const present = await rpc(chainId, 'eth_getCode', [address, 'latest'])
  if (typeof present !== 'string' || present === '0x') return fail('not-a-contract')

  try {
    const url =
      `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract` +
      `&action=getcontractcreation&contractaddresses=${address}&apikey=${registryKey}`
    const res = await fetch(url, { headers: { accept: 'application/json' } })
    if (!res.ok) return fail('failed')

    const body = await res.json()
    if (body?.status !== '1' || !Array.isArray(body.result) || body.result.length === 0) {
      // Includes the paid-tier refusal on chains the free plan does not serve.
      return fail('chain-unsupported')
    }

    const entry = body.result[0] as Record<string, string>
    const seconds = Number(entry?.timestamp)
    if (!Number.isFinite(seconds) || seconds <= 0) return fail('failed')

    const creator = /^0x[0-9a-fA-F]{40}$/.test(entry?.contractCreator ?? '')
      ? entry.contractCreator.toLowerCase()
      : null

    return {
      status: 'ok',
      deployedAt: new Date(seconds * 1000).toISOString(),
      deploymentBlock: Number(entry.blockNumber) || null,
      deployedBy: creator,
    }
  } catch {
    return fail('failed')
  }
}

/* ------------------------------------------------------- liquidity lock --- */

/** Addresses nothing can ever be withdrawn from. */
const BURN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
]

/**
 * Locker contracts we recognise, per chain.
 *
 * This list is the honest limit of the check: liquidity held in a locker that
 * is not listed here reads as unaccounted for, never as unlocked. The UI has to
 * say so — "we did not find a lock" is a statement about our coverage, not
 * about the token.
 *
 * Every address below was confirmed to hold deployed bytecode on its chain
 * before being added. An entry that is wrong can only ever under-report a lock,
 * never invent one, because a balance is read from the pool's own ledger.
 */
const LOCKERS: Record<number, string[]> = {
  1: [
    '0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214', // UNCX
    '0xe2fe530c047f2d85298b07d9333c05737f1435fb', // Team Finance
    '0x17e00383a843a9922bca3b280c0ade9f8ba48449', // UNCX v2
  ],
  56: [
    '0xc765bddb93b0d1c1a88282ba0fa6b2d00e3e0c83', // PinkLock
    '0x7ee058420e5937496f5a2096f04caa7721cf70cc', // UNCX
    '0x0c89c0407775dd89b12918b9c0aa42bf96518820', // Team Finance
  ],
  8453: [
    '0xc4e637d37113192f4f1f060daebd7758de7f4131', // UNCX Base
  ],
}

export interface LiquidityLock {
  status: 'ok' | 'no-pool' | 'not-applicable' | 'chain-unsupported' | 'failed'
  pairAddress: string | null
  venue: string | null
  /** Share of the pool's LP tokens sent somewhere unrecoverable. */
  burnedPercent: number | null
  /** Share held by a locker on our list. */
  lockedPercent: number | null
  /** How many lockers we were able to check on this chain. */
  lockersChecked: number
}

/**
 * Whether the pool behind a token can be drained.
 *
 * A pool's depth is only reassuring if whoever owns it cannot walk away with
 * it. For the usual two-token pools the LP position is itself a token, so this
 * reads its supply and asks how much of it has been burned or handed to a
 * locker.
 *
 * Concentrated-liquidity pools do not work that way — the position is an NFT,
 * not a fungible balance — so those are reported as not applicable rather than
 * being forced through a calculation that would mean nothing.
 */
export async function liquidityLock(
  chainId: number,
  pool: { pairAddress?: string; dexId?: string; labels?: string[] } | null,
): Promise<LiquidityLock> {
  const base: LiquidityLock = {
    status: 'failed',
    pairAddress: null,
    venue: null,
    burnedPercent: null,
    lockedPercent: null,
    lockersChecked: 0,
  }

  if (!RPC[chainId]) return { ...base, status: 'chain-unsupported' }
  if (!pool?.pairAddress) return { ...base, status: 'no-pool' }

  const pair = pool.pairAddress
  const venue = pool.dexId ?? null
  const labels = (pool.labels ?? []).map((l) => String(l).toLowerCase())

  if (labels.some((l) => l.includes('v3') || l.includes('v4') || l.includes('cl'))) {
    return { ...base, status: 'not-applicable', pairAddress: pair, venue }
  }

  const totalSupply = toBigInt(await ethCall(chainId, pair, '0x18160ddd'))
  if (totalSupply === null || totalSupply === 0n) {
    // No fungible LP supply at all: this is not a pool this check understands.
    return { ...base, status: 'not-applicable', pairAddress: pair, venue }
  }

  const burnBalances = await Promise.all(
    BURN_ADDRESSES.map((holder) => ethCall(chainId, pair, balanceOfData(holder))),
  )
  const burned = burnBalances.reduce<bigint>((sum, hex) => sum + (toBigInt(hex) ?? 0n), 0n)

  const lockers = LOCKERS[chainId] ?? []
  const lockerBalances = await Promise.all(
    lockers.map((holder) => ethCall(chainId, pair, balanceOfData(holder))),
  )
  const locked = lockerBalances.reduce<bigint>((sum, hex) => sum + (toBigInt(hex) ?? 0n), 0n)

  // Percentages are computed in integer space and only then divided, so a pool
  // with a uint256 supply cannot round its own answer away.
  const pct = (part: bigint) => Number((part * 10_000n) / totalSupply) / 100

  return {
    status: 'ok',
    pairAddress: pair,
    venue,
    burnedPercent: pct(burned),
    lockedPercent: pct(locked),
    lockersChecked: lockers.length,
  }
}
