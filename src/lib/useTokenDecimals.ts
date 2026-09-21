import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useConfig } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { erc20Abi } from 'viem'

/**
 * A token's decimals, read from the contract.
 *
 * Needed before any stored amount can be shown: the database holds base units,
 * and the number of decimals is the only thing that turns those into a figure
 * a person recognises. Assuming the usual 18 would render a 6-decimal token's
 * balance a trillion times too small, which is not a rounding error — it is a
 * different number that looks just as plausible.
 *
 * Returns null when the contract does not answer, and the caller is expected
 * to show nothing rather than guess.
 */
export function useTokenDecimals(
  chainId: number,
  address: string,
  enabled = true,
): UseQueryResult<number | null> {
  const config = useConfig()

  return useQuery({
    queryKey: ['token-decimals', chainId, address.toLowerCase()],
    queryFn: async () => {
      const client = getPublicClient(config, { chainId })
      if (!client) return null
      try {
        const value = await client.readContract({
          address: address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'decimals',
        })
        const n = Number(value)
        // A decimals() that answers with nonsense is not an answer.
        return Number.isInteger(n) && n >= 0 && n <= 36 ? n : null
      } catch {
        return null
      }
    },
    enabled: enabled && address.length > 0,
    // Immutable in every ERC-20 worth reading, but a refused RPC deserves
    // another chance before the page is reloaded.
    staleTime: 10 * 60_000,
  })
}
