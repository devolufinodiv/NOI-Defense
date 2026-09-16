import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chainMeta } from '@/config/chains'
import { runScan } from '@/features/scan/queries'
import type { ScanResult } from '@/features/scan/types'

/**
 * Featured token scans.
 *
 * Ranked by how often each token has actually been scanned on the app, with
 * admin pins taking the front of the list. Nothing here is curated by hand or
 * filled in from a fixture: every figure was recorded by a real scan, and a
 * figure we do not have stays `null` rather than becoming a zero.
 */

export interface FeaturedRow {
  chain_id: number
  address: string
  name: string
  symbol: string
  verified: boolean
  pinned: boolean
  scan_count: number
  last_scanned_at: string | null
  price_usd: string | number | null
  change_24h: string | number | null
  liquidity_usd: string | number | null
  volume_24h_usd: string | number | null
  pair_count: number | null
  is_honeypot: boolean | null
  sell_tax: string | number | null
  source_verified: boolean | null
  checked_at: string | null
}

export interface FeaturedToken {
  chainId: number
  address: string
  name: string
  symbol: string
  verified: boolean
  pinned: boolean
  scanCount: number
  lastScannedAt: string | null
  priceUsd: number | null
  change24h: number | null
  liquidityUsd: number | null
  volume24hUsd: number | null
  pairCount: number | null
  isHoneypot: boolean | null
  sellTax: number | null
  sourceVerified: boolean | null
  checkedAt: string | null
}

/** `null` stays `null`. A missing price is not a price of zero. */
const toNumber = (value: string | number | null): number | null => {
  if (value === null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalise(row: FeaturedRow): FeaturedToken {
  return {
    chainId: row.chain_id,
    address: row.address,
    name: row.name ?? '',
    symbol: row.symbol ?? '',
    verified: Boolean(row.verified),
    pinned: Boolean(row.pinned),
    scanCount: Number(row.scan_count ?? 0),
    lastScannedAt: row.last_scanned_at,
    priceUsd: toNumber(row.price_usd),
    change24h: toNumber(row.change_24h),
    liquidityUsd: toNumber(row.liquidity_usd),
    volume24hUsd: toNumber(row.volume_24h_usd),
    pairCount: row.pair_count ?? null,
    isHoneypot: row.is_honeypot,
    sellTax: toNumber(row.sell_tax),
    sourceVerified: row.source_verified,
    checkedAt: row.checked_at,
  }
}

export function useFeaturedTokens(limit = 6): UseQueryResult<FeaturedToken[]> {
  return useQuery({
    queryKey: ['featured', 'tokens', limit],
    queryFn: async () => {
      if (!supabase) throw new Error('Not configured')
      const { data, error } = await supabase.rpc('featured_token_scans', { p_limit: limit })
      if (error) throw error
      return ((data ?? []) as FeaturedRow[]).map(normalise)
    },
    enabled: Boolean(supabase),
    staleTime: 30_000,
    refetchInterval: 120_000,
  })
}

/* ------------------------------------------------------------------ admin */

export interface PinnedRow {
  chain_id: number
  address: string
  position: number
  note: string | null
  created_at: string
}

/** The admin's pins alone, in their own order — not the resolved public list. */
export function useFeaturedPins(enabled: boolean): UseQueryResult<PinnedRow[]> {
  return useQuery({
    queryKey: ['featured', 'pins'],
    queryFn: async () => {
      if (!supabase) throw new Error('Not configured')
      const { data, error } = await supabase
        .from('featured_tokens')
        .select('chain_id, address, position, note, created_at')
        .order('position', { ascending: true })
      if (error) throw error
      return (data ?? []) as PinnedRow[]
    },
    enabled: enabled && Boolean(supabase),
    staleTime: 15_000,
  })
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

export interface PinInput {
  chainId: number
  address: string
  note?: string
}

/**
 * What went wrong, in words an admin can act on. Thrown rather than returned so
 * the mutation's error state carries the sentence straight to the form.
 */
export class PinError extends Error {}

export interface PinResult {
  chainId: number
  address: string
  name: string
  symbol: string
  tier: string
}

/**
 * Pin a token by pasting its contract address.
 *
 * Scans it first, on purpose. `featured_tokens` has a foreign key to `tokens`,
 * so an address that has never been scanned cannot be pinned at all — scanning
 * is what fills in the name, price and safety figures the card renders, which
 * is how a pin is stopped from producing an empty tile.
 */
export function usePinToken() {
  const client = useQueryClient()

  return useMutation<PinResult, Error, PinInput>({
    mutationFn: async ({ chainId, address, note }) => {
      if (!supabase) throw new PinError('Supabase is not configured.')

      const trimmed = address.trim()
      if (!ADDRESS.test(trimmed)) {
        throw new PinError(
          'That does not look like a contract address — it should be 0x followed by 40 characters.',
        )
      }
      if (!chainMeta(chainId)) throw new PinError('Choose a network first.')

      const lower = trimmed.toLowerCase()

      let scan: ScanResult
      try {
        scan = await runScan(chainId, lower)
      } catch (cause) {
        throw new PinError(
          `We could not scan that address, so it was not pinned. ${(cause as Error).message}`,
        )
      }

      // New pins go to the end, so the order an admin adds them in is the order
      // they appear. Single-admin use, so a read-then-write is good enough.
      const { data: last } = await supabase
        .from('featured_tokens')
        .select('position')
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { error } = await supabase.from('featured_tokens').upsert(
        {
          chain_id: chainId,
          address: lower,
          position: ((last?.position as number | undefined) ?? -1) + 1,
          note: note?.trim() || null,
          added_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        },
        { onConflict: 'chain_id,address' },
      )

      if (error) {
        throw new PinError(
          error.code === '42501'
            ? 'Only an admin can change the featured list.'
            : error.message,
        )
      }

      return {
        chainId,
        address: lower,
        name: scan.token.name,
        symbol: scan.token.symbol,
        tier: scan.verdict.tier,
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['featured'] })
    },
  })
}

/** Remove a pin. The token itself and its scan history are untouched. */
export function useUnpinToken() {
  const client = useQueryClient()

  return useMutation<void, Error, { chainId: number; address: string }>({
    mutationFn: async ({ chainId, address }) => {
      if (!supabase) throw new PinError('Supabase is not configured.')
      // A delete blocked by row level security matches no rows and still
      // succeeds, so read back what was removed rather than trusting silence.
      const { data, error } = await supabase
        .from('featured_tokens')
        .delete()
        .eq('chain_id', chainId)
        .eq('address', address.toLowerCase())
        .select('chain_id')
      if (error) throw new PinError(error.message)
      if (!data || data.length === 0) {
        throw new PinError('Nothing was removed. Only an admin can change the featured list.')
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['featured'] })
    },
  })
}
