import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useConfig } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'

/**
 * Which of these addresses hold bytecode.
 *
 * Transfer history cannot tell a pool from a person — both just receive and
 * send — so this asks the chain directly. It matters because the top of a
 * holder list is usually a liquidity pool, and presenting one as a wallet
 * invites people to read a pool's balance as somebody's position.
 *
 * "We could not reach the network" stays null rather than collapsing into
 * false, which would turn an unreachable RPC into a confident "this is a
 * person's wallet".
 */
export type ContractMap = Record<string, boolean | null>

export function useContractProbe(
  chainId: number,
  addresses: string[],
  enabled = true,
): UseQueryResult<ContractMap> {
  const config = useConfig()
  const key = [...addresses].map((a) => a.toLowerCase()).sort().join(',')

  return useQuery({
    queryKey: ['contract-probe', chainId, key],
    queryFn: async () => {
      const client = getPublicClient(config, { chainId })
      const out: ContractMap = {}

      await Promise.all(
        addresses.map(async (address) => {
          const lower = address.toLowerCase()
          if (!client) {
            out[lower] = null
            return
          }
          try {
            const bytecode = await client.getCode({ address: address as `0x${string}` })
            out[lower] = bytecode !== undefined && bytecode !== '0x'
          } catch {
            out[lower] = null
          }
        }),
      )

      return out
    },
    enabled: enabled && addresses.length > 0,
    // Bytecode at an address effectively never changes, but a public RPC that
    // refused once should get another chance before the page is reloaded.
    staleTime: 10 * 60_000,
  })
}
