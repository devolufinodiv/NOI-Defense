import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Recorded readings for one token.
 *
 * These are observations, not a feed: a row exists only where a scan actually
 * read upstream, so the spacing between points follows how often people looked
 * rather than the clock. Anything drawing this has to say so, and has to
 * decline to draw at all when there are too few points to mean anything — two
 * readings joined by a line look exactly like a trend and are not one.
 */

export interface Reading {
  at: number
  priceUsd: number | null
  liquidityUsd: number | null
  volume24hUsd: number | null
}

interface SeriesRow {
  recorded_at: string
  price_usd: string | number | null
  liquidity_usd: string | number | null
  volume_24h_usd: string | number | null
}

const toNumber = (value: string | number | null): number | null => {
  if (value === null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Below this, a line would imply a shape the data does not support. */
export const MIN_POINTS_FOR_A_LINE = 4

export function useTokenSeries(
  chainId: number | undefined,
  address: string | undefined,
  hours = 168,
): UseQueryResult<Reading[]> {
  return useQuery({
    queryKey: ['history', chainId, address?.toLowerCase(), hours],
    queryFn: async () => {
      if (!supabase) throw new Error('Not configured')
      const { data, error } = await supabase.rpc('token_metric_series', {
        p_chain_id: chainId,
        p_address: address,
        p_hours: hours,
      })
      if (error) throw error
      return ((data ?? []) as SeriesRow[]).map((row) => ({
        at: new Date(row.recorded_at).getTime(),
        priceUsd: toNumber(row.price_usd),
        liquidityUsd: toNumber(row.liquidity_usd),
        volume24hUsd: toNumber(row.volume_24h_usd),
      }))
    },
    enabled: Boolean(supabase) && chainId !== undefined && Boolean(address),
    staleTime: 60_000,
  })
}
