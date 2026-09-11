import { json, parseTarget, preflight } from '../_shared/http.ts'
import { serviceClient, userClient } from '../_shared/db.ts'

/**
 * GET /wallet-trace?chainId=1&address=0x…
 *
 * On-chain profile of an address.
 *
 * Two tiers, deliberately:
 *  • Base tier works on EVERY supported chain, straight from a node — balance,
 *    outgoing transaction count, and whether the address is a wallet or a
 *    contract. No indexer, no API key, no gaps.
 *  • Rich tier adds history, counterparties and token movements, and is only
 *    available where the registry covers the chain. Absent coverage is reported
 *    as "not available here", never as "this wallet has no activity".
 *
 * Upstream provider names never appear in the response.
 */

/**
 * Public endpoints, tried in order. A single public RPC is a single point of
 * failure — the first choice here was returning 525 during testing, which took
 * the whole Ethereum trace down with it.
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

const NATIVE: Record<number, string> = {
  1: 'ETH', 8453: 'ETH', 42161: 'ETH', 10: 'ETH', 137: 'POL',
  56: 'BNB', 43114: 'AVAX', 534352: 'ETH', 324: 'ETH',
  84532: 'ETH', 11155111: 'ETH',
}

/**
 * Chains the contract registry serves account history for on a free plan,
 * verified against the live API rather than inferred from its docs. Base,
 * Optimism, BNB and Avalanche answer only on a paid tier; Scroll and zkSync
 * aren't covered at all. Everything else is skipped rather than silently
 * returning empty.
 */
const REGISTRY_CHAINS = new Set([1, 42161, 137, 84532, 11155111])

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
      // Try the next endpoint rather than failing the whole trace.
    }
  }
  return null
}

/** Wei hex -> a display number. Native balances are far inside float range. */
function fromWei(hex: string | null, decimals = 18): number | null {
  if (!hex) return null
  try {
    const wei = BigInt(hex)
    // Integer-divide to 6 decimal places first, so the float only ever carries
    // a small, already-rounded number rather than a 60-bit mantissa of wei.
    const scaled = (wei * 1_000_000n) / 10n ** BigInt(decimals)
    return Number(scaled) / 1_000_000
  } catch {
    return null
  }
}

interface Registry {
  firstSeen: number | null
  lastSeen: number | null
  txCount: number
  counterparties: Array<{ address: string; count: number; label: string }>
  tokens: Array<{ symbol: string; name: string; address: string; transfers: number }>
  truncated: boolean
}

export type HistoryStatus = 'ok' | 'chain-unsupported' | 'not-configured' | 'failed'

/**
 * Returns why history is missing, not just that it is.
 *
 * The two causes need different words: "we don't cover this network" is a
 * permanent property of the chain, "no key configured" is a setup gap on our
 * side. Collapsing them produced UI copy that contradicted itself.
 */
async function fetchHistory(
  chainId: number,
  address: string,
): Promise<{ status: HistoryStatus; data: Registry | null }> {
  const key = Deno.env.get('CONTRACT_REGISTRY_KEY')?.trim()
  if (!key) return { status: 'not-configured', data: null }
  if (!REGISTRY_CHAINS.has(chainId)) return { status: 'chain-unsupported', data: null }

  const base = `https://api.etherscan.io/v2/api?chainid=${chainId}&apikey=${key}`

  const [txRes, tokenRes] = await Promise.all([
    fetch(
      `${base}&module=account&action=txlist&address=${address}` +
        `&startblock=0&endblock=99999999&page=1&offset=200&sort=desc`,
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(
      `${base}&module=account&action=tokentx&address=${address}` +
        `&startblock=0&endblock=99999999&page=1&offset=200&sort=desc`,
    ).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ])

  // An address with no history comes back as `result: []`; a refused or errored
  // call comes back with `result` as a string. Only an array is an answer, so
  // anything else is "we could not check" — never "we checked and found nothing".
  const txOk = Array.isArray(txRes?.result)
  const transferOk = Array.isArray(tokenRes?.result)
  if (!txOk && !transferOk) return { status: 'failed', data: null }

  const txs = txOk ? txRes.result : []
  const transfers = transferOk ? tokenRes.result : []

  if (txs.length === 0 && transfers.length === 0) {
    // A real, empty answer: the address exists but has never transacted.
    return {
      status: 'ok',
      data: { firstSeen: null, lastSeen: null, txCount: 0, counterparties: [], tokens: [], truncated: false },
    }
  }

  const stamps = txs.map((t: Record<string, string>) => Number(t.timeStamp)).filter(Number.isFinite)

  // Who this address actually deals with, by frequency.
  const seen = new Map<string, number>()
  const me = address.toLowerCase()
  for (const t of txs as Array<Record<string, string>>) {
    for (const side of [t.from, t.to]) {
      const other = (side ?? '').toLowerCase()
      if (!other || other === me) continue
      seen.set(other, (seen.get(other) ?? 0) + 1)
    }
  }

  const tokens = new Map<string, { symbol: string; name: string; transfers: number }>()
  for (const t of transfers as Array<Record<string, string>>) {
    const contract = (t.contractAddress ?? '').toLowerCase()
    if (!contract) continue
    const entry = tokens.get(contract) ?? {
      symbol: t.tokenSymbol ?? '',
      name: t.tokenName ?? '',
      transfers: 0,
    }
    entry.transfers += 1
    tokens.set(contract, entry)
  }

  return {
    status: 'ok',
    data: {
    firstSeen: stamps.length ? Math.min(...stamps) : null,
    lastSeen: stamps.length ? Math.max(...stamps) : null,
    txCount: txs.length,
    counterparties: [...seen.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([addr, count]) => ({ address: addr, count, label: '' })),
    tokens: [...tokens.entries()]
      .sort((a, b) => b[1].transfers - a[1].transfers)
      .slice(0, 12)
      .map(([addr, t]) => ({ address: addr, ...t })),
    // The page cap is 200; hitting it means there is more we did not read.
    truncated: txs.length >= 200 || transfers.length >= 200,
    },
  }
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

  const [balanceHex, nonceHex, code, history] = await Promise.all([
    rpc(chainId, 'eth_getBalance', [address, 'latest']),
    rpc(chainId, 'eth_getTransactionCount', [address, 'latest']),
    rpc(chainId, 'eth_getCode', [address, 'latest']),
    fetchHistory(chainId, address),
  ])

  const reachedNode = balanceHex !== null

  /**
   * EIP-7702 lets an ordinary wallet delegate to a smart-account
   * implementation, which puts a 23-byte `0xef0100…` pointer at the address.
   * That address still belongs to a person. Reading "has code" as "is a
   * contract" told real users their own wallet was a smart contract.
   */
  const hasCode = code !== null && code !== '0x'
  const isDelegated = (code ?? '').toLowerCase().startsWith('0xef0100')
  const accountType: 'wallet' | 'smart-wallet' | 'contract' = !hasCode
    ? 'wallet'
    : isDelegated
      ? 'smart-wallet'
      : 'contract'
  const isContract = accountType === 'contract'

  // A wallet with an outgoing nonce of zero has never sent anything itself,
  // which is worth saying plainly rather than leaving as a bare number.
  const outgoing = nonceHex ? Number(BigInt(nonceHex)) : null

  const summary = !reachedNode
    ? 'We could not reach this network right now, so nothing below is confirmed.'
    : accountType === 'contract'
      ? 'This address is a smart contract, not a personal wallet. Anything held here belongs to the program running at this address.'
      : accountType === 'smart-wallet'
        ? 'This is a personal wallet using smart-account features. It belongs to someone, not to a program.'
        : outgoing === 0
          ? 'This wallet has never sent a transaction on this network. It may be brand new, or funded and left untouched.'
          : 'This is a regular wallet. The figures below come straight from the blockchain.'

  const payload = {
    address: { chainId, address, isContract, accountType, nativeSymbol: NATIVE[chainId] ?? 'ETH' },
    onchain: {
      reachedNode,
      balance: fromWei(balanceHex),
      outgoingTransactions: outgoing,
    },
    // `null` means we have no coverage on this chain — not that the wallet is
    // empty. The client renders the two differently.
    history: history.data,
    historyStatus: history.status,
    historyAvailable: history.status === 'ok',
    summary,
  }

  const auth = req.headers.get('Authorization')
  if (auth) {
    const { data } = await userClient(req).auth.getUser()
    if (data.user) {
      await serviceClient().from('activity_events').insert({
        user_id: data.user.id,
        kind: 'wallet_trace',
        chain_id: chainId,
        subject: address,
        subject_kind: 'wallet',
      })
    }
  }

  return json(payload, 200, origin)
})
