import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  fetchEarlyBuyers,
  fetchHealthFactors,
  fetchHolders,
  fetchRecentTrades,
  fetchTokenOverview,
  requestIndexing,
} from './api'
import {
  TokenNotIndexedError,
  type EarlyBuyer,
  type HealthFactor,
  type Holder,
  type TokenOverview,
  type TokenTrade,
} from './types'

/** One place to derive every cache key, so invalidation can't drift. */
export const tokenKeys = {
  all: ['token'] as const,
  // Chain is part of the key: the same address is a different contract on a
  // different network, and sharing a cache entry between them would be wrong.
  detail: (chainId: number, address: string) =>
    [...tokenKeys.all, chainId, address.toLowerCase()] as const,
  overview: (chainId: number, address: string) =>
    [...tokenKeys.detail(chainId, address), 'overview'] as const,
  factors: (chainId: number, address: string) =>
    [...tokenKeys.detail(chainId, address), 'factors'] as const,
  holders: (chainId: number, address: string) =>
    [...tokenKeys.detail(chainId, address), 'holders'] as const,
  earlyBuyers: (chainId: number, address: string) =>
    [...tokenKeys.detail(chainId, address), 'early-buyers'] as const,
  trades: (chainId: number, address: string) =>
    [...tokenKeys.detail(chainId, address), 'trades'] as const,
}

/**
 * A missing token is a terminal answer, not a transient failure — retrying it
 * just delays the empty state the user needs to act on.
 */
function retryUnlessMissing(failureCount: number, error: Error): boolean {
  if (error instanceof TokenNotIndexedError) return false
  return failureCount < 2
}

export function useTokenOverview(
  chainId: number,
  address: string,
  enabled = true,
): UseQueryResult<TokenOverview> {
  return useQuery({
    queryKey: tokenKeys.overview(chainId, address),
    queryFn: () => fetchTokenOverview(chainId, address),
    enabled: enabled && address.length > 0,
    retry: retryUnlessMissing,
  })
}

export function useHealthFactors(
  chainId: number,
  address: string,
  enabled = true,
): UseQueryResult<HealthFactor[]> {
  return useQuery({
    queryKey: tokenKeys.factors(chainId, address),
    queryFn: () => fetchHealthFactors(chainId, address),
    enabled: enabled && address.length > 0,
    retry: retryUnlessMissing,
  })
}

export function useHolders(
  chainId: number,
  address: string,
  enabled = true,
): UseQueryResult<Holder[]> {
  return useQuery({
    queryKey: tokenKeys.holders(chainId, address),
    queryFn: () => fetchHolders(chainId, address),
    enabled: enabled && address.length > 0,
    retry: retryUnlessMissing,
  })
}

export function useEarlyBuyers(
  chainId: number,
  address: string,
  enabled = true,
): UseQueryResult<EarlyBuyer[]> {
  return useQuery({
    queryKey: tokenKeys.earlyBuyers(chainId, address),
    queryFn: () => fetchEarlyBuyers(chainId, address),
    enabled: enabled && address.length > 0,
    retry: retryUnlessMissing,
  })
}

/** Live trade feed. Polled rather than socketed — websockets are a later phase. */
export function useRecentTrades(
  chainId: number,
  address: string,
  enabled = true,
): UseQueryResult<TokenTrade[]> {
  return useQuery({
    queryKey: tokenKeys.trades(chainId, address),
    queryFn: () => fetchRecentTrades(chainId, address),
    enabled: enabled && address.length > 0,
    refetchInterval: 15_000,
    // Don't burn RPC quota polling a tab nobody is looking at...
    refetchIntervalInBackground: false,
    // ...but refetch the moment they come back, overriding the app-wide
    // default. Otherwise a feed labelled "Live" can sit up to 15s stale at the
    // exact moment the user returns to read it.
    refetchOnWindowFocus: true,
    // The feed is inherently live; a stale window would defeat the interval.
    staleTime: 0,
    retry: retryUnlessMissing,
  })
}

/** Triggers indexing, then refetches everything for this token. */
export function useRequestIndexing(chainId: number, address: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => requestIndexing(chainId, address),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tokenKeys.detail(chainId, address) })
    },
  })
}
