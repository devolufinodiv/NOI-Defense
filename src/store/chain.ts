import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { chainMeta, defaultChainMeta, isSupportedChain, type ChainMeta } from '@/config/chains'

interface ChainState {
  chainId: number
  setChainId: (chainId: number) => void
}

/**
 * The network the user is currently investigating.
 *
 * Separate from any wallet's connected chain: this is a read/analysis target,
 * and the product signs in with Google rather than a wallet.
 */
export const useChainStore = create<ChainState>()(
  persist(
    (set) => ({
      chainId: defaultChainMeta.chain.id,
      setChainId: (chainId) => {
        if (isSupportedChain(chainId)) set({ chainId })
      },
    }),
    {
      name: 'noi.chain',
      // A persisted id can outlive support for that chain; fall back rather
      // than booting into a network nothing can resolve.
      merge: (persisted, current) => {
        const next = { ...current, ...(persisted as Partial<ChainState>) }
        if (!isSupportedChain(next.chainId)) next.chainId = defaultChainMeta.chain.id
        return next
      },
    },
  ),
)

/** Full metadata for the active chain. */
export function useActiveChain(): ChainMeta {
  const chainId = useChainStore((state) => state.chainId)
  return chainMeta(chainId) ?? defaultChainMeta
}
