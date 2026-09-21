import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { fetchHistoryCoverage, type HistoryCoverage } from './api'

/** One place to derive every cache key, so invalidation can't drift. */
export const tokenKeys = {
  all: ['token'] as const,
  // Chain is part of the key: the same address is a different contract on a
  // different network, and sharing a cache entry between them would be wrong.
  detail: (chainId: number, address: string) =>
    [...tokenKeys.all, chainId, address.toLowerCase()] as const,
  coverage: (chainId: number, address: string) =>
    [...tokenKeys.detail(chainId, address), 'coverage'] as const,
}

/**
 * How much of this token's history we hold.
 *
 * Cheap enough to poll gently: the answer changes as deliveries land, and a
 * panel that says "nothing yet" should notice when that stops being true.
 */
export function useHistoryCoverage(
  chainId: number,
  address: string,
  enabled = true,
): UseQueryResult<HistoryCoverage> {
  return useQuery({
    queryKey: tokenKeys.coverage(chainId, address),
    queryFn: () => fetchHistoryCoverage(chainId, address),
    enabled: enabled && address.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}
