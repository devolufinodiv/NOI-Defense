import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface MarketRow {
  chain_id: number
  address: string
  name: string
  symbol: string
  verified: boolean
  price_usd: string | null
  change_24h: string | null
  liquidity_usd: string | null
  volume_24h_usd: string | null
  pair_count: number | null
  computed_at: string
  is_honeypot: boolean | null
  sell_tax: string | null
}

export interface MarketToken {
  chainId: number
  address: string
  name: string
  symbol: string
  verified: boolean
  priceUsd: number | null
  change24h: number | null
  liquidityUsd: number | null
  volume24hUsd: number | null
  pairCount: number
  isHoneypot: boolean | null
  sellTax: number | null
  updatedAt: string
}

const toNumber = (value: string | null) => (value === null ? null : Number(value))

/**
 * Tokens the community has actually scanned, freshest first.
 *
 * Reads the scan cache rather than a curated list: what people are checking is
 * the honest definition of what matters on this product, and it needs no
 * separate ingestion pipeline to stay current.
 */
export function useMarketOverview(limit = 12): UseQueryResult<MarketToken[]> {
  return useQuery({
    queryKey: ['market', 'overview', limit],
    queryFn: async () => {
      if (!supabase) throw new Error('Not configured')

      // Rooted at `tokens`, not `token_metrics`: metrics and safety are siblings
      // that both reference tokens but not each other, so PostgREST cannot embed
      // one inside the other. From the shared parent, both embed in one trip.
      //
      // `!inner` on metrics drops tokens whose market lookup failed — a row with
      // no price or liquidity has nothing to say on this table.
      const { data, error } = await supabase
        .from('tokens')
        .select(
          'chain_id, address, name, symbol, verified, indexed_at,' +
            'token_metrics!inner(price_usd, change_24h, liquidity_usd, volume_24h_usd, pair_count, computed_at),' +
            'token_safety(is_honeypot, sell_tax)',
        )
        .order('indexed_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      // supabase-js types an embedded select loosely; cast once at the edge
      // rather than fighting it at every field access below.
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>

      return rows.map((row) => {
        const one = (value: unknown) =>
          (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined

        const metrics = one(row.token_metrics) ?? {}
        const safety = one(row.token_safety)

        return {
          chainId: row.chain_id as number,
          address: row.address as string,
          name: (row.name as string) ?? '',
          symbol: (row.symbol as string) ?? '',
          verified: Boolean(row.verified),
          priceUsd: toNumber((metrics.price_usd as string) ?? null),
          change24h: toNumber((metrics.change_24h as string) ?? null),
          liquidityUsd: toNumber((metrics.liquidity_usd as string) ?? null),
          volume24hUsd: toNumber((metrics.volume_24h_usd as string) ?? null),
          pairCount: (metrics.pair_count as number) ?? 0,
          isHoneypot: (safety?.is_honeypot as boolean | null) ?? null,
          sellTax: toNumber((safety?.sell_tax as string) ?? null),
          updatedAt: (row.indexed_at as string) ?? (metrics.computed_at as string),
        }
      }) as MarketToken[]
    },
    enabled: Boolean(supabase),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
