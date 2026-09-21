import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  fetchEarlyBuyers,
  fetchHistoryCoverage,
  fetchHolders,
  requestBackfill,
  type BackfillProgress,
  type HistoryCoverage,
} from './api'
import type { EarlyBuyer, Holder } from './types'

/** One place to derive every cache key, so invalidation can't drift. */
export const tokenKeys = {
  all: ['token'] as const,
  // Chain is part of the key: the same address is a different contract on a
  // different network, and sharing a cache entry between them would be wrong.
  detail: (chainId: number, address: string) =>
    [...tokenKeys.all, chainId, address.toLowerCase()] as const,
  coverage: (chainId: number, address: string) =>
    [...tokenKeys.detail(chainId, address), 'coverage'] as const,
  holders: (chainId: number, address: string) =>
    [...tokenKeys.detail(chainId, address), 'holders'] as const,
  earlyBuyers: (chainId: number, address: string) =>
    [...tokenKeys.detail(chainId, address), 'early-buyers'] as const,
}

/**
 * How much of this token's history we hold, and how the walk is going.
 *
 * Polled while a walk is running so progress is visible, and left alone once
 * it finishes — a complete history does not become less complete.
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
    staleTime: 15_000,
    refetchInterval: (query) => (query.state.data?.complete ? false : 30_000),
    refetchIntervalInBackground: false,
  })
}

export function useHolders(
  chainId: number,
  address: string,
  decimals: number,
  enabled = true,
): UseQueryResult<Holder[]> {
  return useQuery({
    queryKey: [...tokenKeys.holders(chainId, address), decimals],
    queryFn: () => fetchHolders(chainId, address, decimals),
    enabled: enabled && address.length > 0,
    staleTime: 60_000,
  })
}

export function useEarlyBuyers(
  chainId: number,
  address: string,
  decimals: number,
  enabled = true,
): UseQueryResult<EarlyBuyer[]> {
  return useQuery({
    queryKey: [...tokenKeys.earlyBuyers(chainId, address), decimals],
    queryFn: () => fetchEarlyBuyers(chainId, address, decimals),
    enabled: enabled && address.length > 0,
    staleTime: 60_000,
  })
}

/**
 * Walk the history, one slice per call, until the server says it is done.
 *
 * The loop lives here rather than in the component so a re-render cannot
 * restart it, and it is bounded: a token whose walk will not finish is a bug
 * to surface, not something to keep paying for in a loop nobody is watching.
 */
const MAX_SLICES = 40

export function useBackfill(chainId: number, address: string) {
  const client = useQueryClient()

  return useMutation<BackfillProgress, Error, void>({
    mutationFn: async () => {
      let last: BackfillProgress = { status: 'running', done: false, pages: 0 }

      for (let slice = 0; slice < MAX_SLICES; slice += 1) {
        last = await requestBackfill(chainId, address)
        // Show progress between slices rather than after the whole walk.
        void client.invalidateQueries({ queryKey: tokenKeys.coverage(chainId, address) })
        if (last.done) return last
      }

      throw new Error(
        'This token has more history than we can read in one go. What we stored is kept, and picking it up again continues from there.',
      )
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: tokenKeys.detail(chainId, address) })
    },
  })
}
