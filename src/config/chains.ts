/**
 * EVM chain registry.
 *
 * The product is chain-agnostic: every supported network is an entry here, and
 * nothing above this file hardcodes one. Adding a chain means adding an entry
 * (plus an Alchemy subdomain if it has one) — no changes in components, hooks
 * or routes.
 */
import {
  arbitrum,
  avalanche,
  base,
  baseSepolia,
  bsc,
  mainnet,
  optimism,
  polygon,
  scroll,
  sepolia,
  zksync,
} from 'wagmi/chains'
import type { Chain } from 'viem'
import { env } from './env'

export interface ChainMeta {
  chain: Chain
  /** Short label for dense UI (chips, table cells, switcher). */
  label: string
  /** Native currency ticker, for amount suffixes. */
  nativeSymbol: string
  /** Explorer origin, no trailing slash. */
  explorerUrl: string
  /** Alchemy subdomain, or null where Alchemy has no endpoint. */
  alchemySubdomain: string | null
  /** Surfaced in the UI so testnet data is never mistaken for mainnet. */
  testnet: boolean
}

/** Ordered for the switcher: highest-traffic networks first. */
export const CHAIN_LIST: ChainMeta[] = [
  {
    chain: base,
    label: 'Base',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://basescan.org',
    alchemySubdomain: 'base-mainnet',
    testnet: false,
  },
  {
    chain: mainnet,
    label: 'Ethereum',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://etherscan.io',
    alchemySubdomain: 'eth-mainnet',
    testnet: false,
  },
  {
    chain: arbitrum,
    label: 'Arbitrum',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://arbiscan.io',
    alchemySubdomain: 'arb-mainnet',
    testnet: false,
  },
  {
    chain: optimism,
    label: 'Optimism',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://optimistic.etherscan.io',
    alchemySubdomain: 'opt-mainnet',
    testnet: false,
  },
  {
    chain: polygon,
    label: 'Polygon',
    nativeSymbol: 'POL',
    explorerUrl: 'https://polygonscan.com',
    alchemySubdomain: 'polygon-mainnet',
    testnet: false,
  },
  {
    chain: bsc,
    label: 'BNB Chain',
    nativeSymbol: 'BNB',
    explorerUrl: 'https://bscscan.com',
    alchemySubdomain: 'bnb-mainnet',
    testnet: false,
  },
  {
    chain: avalanche,
    label: 'Avalanche',
    nativeSymbol: 'AVAX',
    explorerUrl: 'https://snowtrace.io',
    alchemySubdomain: 'avax-mainnet',
    testnet: false,
  },
  {
    chain: scroll,
    label: 'Scroll',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://scrollscan.com',
    alchemySubdomain: 'scroll-mainnet',
    testnet: false,
  },
  {
    chain: zksync,
    label: 'zkSync',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://explorer.zksync.io',
    alchemySubdomain: 'zksync-mainnet',
    testnet: false,
  },
  {
    chain: baseSepolia,
    label: 'Base Sepolia',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://sepolia.basescan.org',
    alchemySubdomain: 'base-sepolia',
    testnet: true,
  },
  {
    chain: sepolia,
    label: 'Sepolia',
    nativeSymbol: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io',
    alchemySubdomain: 'eth-sepolia',
    testnet: true,
  },
]

export const CHAINS: Record<number, ChainMeta> = Object.fromEntries(
  CHAIN_LIST.map((meta) => [meta.chain.id, meta]),
)

/** Chains wagmi is configured for. Non-empty tuple is required by wagmi's types. */
export const SUPPORTED_CHAINS = CHAIN_LIST.map((meta) => meta.chain) as unknown as readonly [
  Chain,
  ...Chain[],
]

/** The chain a fresh session starts on. VITE_CHAIN_ID overrides it. */
export const defaultChainMeta: ChainMeta = CHAINS[env.chainId] ?? CHAINS[base.id]

export function chainMeta(chainId: number): ChainMeta | undefined {
  return CHAINS[chainId]
}

export function isSupportedChain(chainId: number): boolean {
  return chainId in CHAINS
}

/**
 * Explorer origin for a chain.
 *
 * Order: per-chain override → legacy single override (default chain only) →
 * the registry. The legacy setting is deliberately not applied to every network,
 * because one explorer origin cannot serve links for nine chains.
 */
export function explorerBase(chainId: number): string {
  const override = env.explorerUrlByChain[chainId]
  if (override) return override
  if (env.defaultChainExplorerUrl && chainId === defaultChainMeta.chain.id) {
    return env.defaultChainExplorerUrl
  }
  return chainMeta(chainId)?.explorerUrl ?? defaultChainMeta.explorerUrl
}

export function explorerAddressUrl(address: string, chainId: number): string {
  return `${explorerBase(chainId)}/address/${address}`
}

export function explorerTxUrl(hash: string, chainId: number): string {
  return `${explorerBase(chainId)}/tx/${hash}`
}

export function explorerTokenUrl(address: string, chainId: number): string {
  return `${explorerBase(chainId)}/token/${address}`
}

/**
 * Resolved RPC endpoint for a chain.
 *
 * Order:
 *  1. `VITE_RPC_URL_<chainId>` — per-chain, always wins.
 *  2. `VITE_RPC_URL` — legacy single setting, default chain ONLY. Applying it
 *     to every network would quietly serve one chain's data under another
 *     chain's name, which is worse than having no override at all.
 *  3. Alchemy, for any network with an endpoint.
 *  4. `undefined` — viem falls back to the chain's public RPC.
 */
export function rpcUrl(meta: ChainMeta): string | undefined {
  const override = env.rpcUrlByChain[meta.chain.id]
  if (override) return override

  if (env.defaultChainRpcUrl && meta.chain.id === defaultChainMeta.chain.id) {
    return env.defaultChainRpcUrl
  }

  if (env.alchemyApiKey && meta.alchemySubdomain) {
    return `https://${meta.alchemySubdomain}.g.alchemy.com/v2/${env.alchemyApiKey}`
  }

  return undefined
}

/** Which RPC source a chain will actually use. Surfaced in the style guide. */
export function rpcSource(meta: ChainMeta): 'override' | 'alchemy' | 'public' {
  if (env.rpcUrlByChain[meta.chain.id]) return 'override'
  if (env.defaultChainRpcUrl && meta.chain.id === defaultChainMeta.chain.id) return 'override'
  if (env.alchemyApiKey && meta.alchemySubdomain) return 'alchemy'
  return 'public'
}
