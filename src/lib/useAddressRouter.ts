import { useCallback } from 'react'
import { useConfig } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'

export type AddressKind = 'token' | 'wallet'

/**
 * Decides whether an address is a contract or an EOA.
 *
 * One `getCode` round trip: non-empty bytecode means contract. Worth the call,
 * because guessing wrong sends the user to a page that structurally cannot show
 * them anything. Returns `null` when the RPC is unreachable so callers can ask
 * instead of assuming.
 */
export function useAddressKind() {
  const config = useConfig()

  return useCallback(
    async (address: `0x${string}`, chainId: number): Promise<AddressKind | null> => {
      // Resolved per call: the same address is a contract on one chain and an
      // empty EOA on another, so the client must match the chain being scanned.
      const client = getPublicClient(config, { chainId })
      if (!client) return null
      try {
        const bytecode = await client.getCode({ address })
        return bytecode !== undefined && bytecode !== '0x' ? 'token' : 'wallet'
      } catch {
        return null
      }
    },
    [config],
  )
}
