import { createConfig, http } from 'wagmi'
import type { Transport } from 'viem'
import { CHAIN_LIST, SUPPORTED_CHAINS, rpcUrl } from './chains'

/**
 * Read-only multi-chain client.
 *
 * The product signs in with Google, not a wallet, so there are no connectors —
 * wagmi is here purely for typed chain reads (`getCode` in the scan box, and
 * the lookups Phase 1 will add). Every supported network gets a transport so
 * switching chains needs no reconfiguration.
 */
const transports: Record<number, Transport> = Object.fromEntries(
  CHAIN_LIST.map((meta) => [meta.chain.id, http(rpcUrl(meta))]),
)

export const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  transports,
  ssr: false,
})
