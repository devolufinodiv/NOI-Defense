import { useCallback } from 'react'
import { useConfig } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { CHAIN_LIST } from '@/config/chains'

/**
 * Which networks a contract actually exists on.
 *
 * The same address is a different thing on every chain — a token here, nothing
 * at all there — so asking people to pick the network before we look is asking
 * them to answer the question they came to us with. This checks them all at
 * once and lets the answer decide.
 *
 * "We could not reach that network" is kept apart from "there is no contract
 * there". Collapsing the two would quietly drop a chain from the results
 * whenever its RPC hiccuped, and the token would look like it did not exist.
 */

export interface ChainProbe {
  chainId: number
  /** true = bytecode present, false = none, null = we could not check. */
  found: boolean | null
}

export interface ChainDetection {
  /** Chains holding bytecode, in the order networks are listed by traffic. */
  contracts: number[]
  /** Chains we failed to reach, so the caller can say the answer is partial. */
  unreachable: number[]
  probes: ChainProbe[]
}

export function useAddressChains() {
  const config = useConfig()

  return useCallback(
    async (address: `0x${string}`): Promise<ChainDetection> => {
      // Mainnets only: probing testnets would offer someone a Sepolia result
      // for a token they are about to spend real money on.
      const targets = CHAIN_LIST.filter((meta) => !meta.testnet)

      const probes = await Promise.all(
        targets.map(async ({ chain }): Promise<ChainProbe> => {
          const client = getPublicClient(config, { chainId: chain.id })
          if (!client) return { chainId: chain.id, found: null }
          try {
            const bytecode = await client.getCode({ address })
            return { chainId: chain.id, found: bytecode !== undefined && bytecode !== '0x' }
          } catch {
            return { chainId: chain.id, found: null }
          }
        }),
      )

      return {
        contracts: probes.filter((p) => p.found === true).map((p) => p.chainId),
        unreachable: probes.filter((p) => p.found === null).map((p) => p.chainId),
        probes,
      }
    },
    [config],
  )
}

/**
 * Which of the found chains to open.
 *
 * A network the person already chose wins, because they may have picked it
 * deliberately. Otherwise the first by traffic, since CHAIN_LIST is ordered
 * that way and a token deployed at one address on several chains is usually
 * being asked about on the busiest one.
 */
export function preferredChain(found: number[], current: number): number | null {
  if (found.length === 0) return null
  if (found.includes(current)) return current

  const order = CHAIN_LIST.filter((m) => !m.testnet).map((m) => m.chain.id)
  return [...found].sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]
}
