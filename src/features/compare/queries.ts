import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { env, hasSupabase } from '@/config/env'
import { supabase } from '@/lib/supabase'

/**
 * Side-by-side token profiles.
 *
 * Each section of the response carries its own status, and the UI is expected
 * to render those statuses rather than flatten them: "we could not read the
 * contract" and "the contract does none of these things" look identical if you
 * only check for an empty list, and they mean opposite things to a buyer.
 */

export interface Capability {
  id: string
  label: string
  detail: string
  present: boolean
  tone: 'bad' | 'warn' | 'good' | 'neutral'
}

export interface ProfileFunctions {
  status: 'ok' | 'not-configured' | 'unverified' | 'chain-unindexed' | 'failed'
  verified: boolean | null
  functionCount: number | null
  capabilities: Capability[]
  ownerAddress: string | null
  ownershipRenounced: boolean | null
  isProxy: boolean | null
  implementation: string | null
}

export interface ProfileWindow {
  window: '5m' | '1h' | '6h' | '24h'
  priceChange: number | null
  volumeUsd: number | null
  buys: number | null
  sells: number | null
}

export interface ProfilePool {
  venue: string | null
  pair: string
  liquidityUsd: number | null
  share: number | null
}

export interface ProfileMarket {
  status: 'ok' | 'none' | 'chain-unsupported' | 'failed'
  name: string | null
  symbol: string | null
  priceUsd: number | null
  fdvUsd: number | null
  marketCapUsd: number | null
  liquidityUsd: number | null
  pairCount: number
  topPools: ProfilePool[]
  windows: ProfileWindow[]
}

export interface ProfileSupply {
  status: 'ok' | 'failed'
  /** Decimal string, not a number: a uint256 supply overflows a float. */
  totalSupply: string | null
  decimals: number | null
}

export interface ProfileSecurity {
  status: 'ok' | 'chain-unsupported' | 'failed'
  isHoneypot: boolean | null
  buyTax: number | null
  sellTax: number | null
  transferTax: number | null
  simulationOk: boolean
  flags: string[]
}

export interface TokenProfile {
  token: {
    chainId: number
    address: string
    name: string | null
    symbol: string | null
    decimals: number | null
  }
  functions: ProfileFunctions
  market: ProfileMarket
  supply: ProfileSupply
  security: ProfileSecurity
}

export interface CompareTarget {
  chainId: number
  address: string
}

async function fetchProfile({ chainId, address }: CompareTarget): Promise<TokenProfile> {
  if (!hasSupabase) throw new Error('Comparison is not configured yet.')

  const token = (await supabase?.auth.getSession())?.data.session?.access_token

  const res = await fetch(
    `${env.supabaseUrl}/functions/v1/token-profile?chainId=${chainId}&address=${address}`,
    {
      headers: {
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${token ?? env.supabaseAnonKey}`,
      },
    },
  )

  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Could not load that token (${res.status})`)
  return body as TokenProfile
}

/** One query per column, so a slow or failing token never blanks the others. */
export function useTokenProfiles(
  targets: CompareTarget[],
): Array<UseQueryResult<TokenProfile>> {
  return useQueries({
    queries: targets.map((target) => ({
      queryKey: ['compare', target.chainId, target.address.toLowerCase()],
      queryFn: () => fetchProfile(target),
      staleTime: 120_000,
      retry: 1,
    })),
  })
}

/* ------------------------------------------------------ url encoding */

/** `1:0xabc…` — compact enough to keep a comparison shareable as a link. */
export function encodeTarget(target: CompareTarget): string {
  return `${target.chainId}:${target.address.toLowerCase()}`
}

export function decodeTargets(values: string[]): CompareTarget[] {
  const seen = new Set<string>()
  const out: CompareTarget[] = []

  for (const value of values) {
    const [chainRaw, address] = value.split(':')
    const chainId = Number.parseInt(chainRaw ?? '', 10)
    if (!Number.isFinite(chainId)) continue
    if (!/^0x[0-9a-fA-F]{40}$/.test(address ?? '')) continue

    const key = `${chainId}:${address.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ chainId, address: address.toLowerCase() })
  }

  return out.slice(0, MAX_TARGETS)
}

export const MAX_TARGETS = 3
