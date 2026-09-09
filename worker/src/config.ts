import 'dotenv/config'
import {
  arbitrum, avalanche, base, baseSepolia, bsc, mainnet,
  optimism, polygon, scroll, sepolia, zksync,
} from 'viem/chains'
import type { Chain } from 'viem'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function num(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export interface ChainMeta {
  chain: Chain
  label: string
  alchemySubdomain: string | null
}

/** Mirrors src/config/chains.ts on the frontend. */
export const CHAINS: Record<number, ChainMeta> = {
  [mainnet.id]:     { chain: mainnet,     label: 'Ethereum',     alchemySubdomain: 'eth-mainnet' },
  [base.id]:        { chain: base,        label: 'Base',         alchemySubdomain: 'base-mainnet' },
  [arbitrum.id]:    { chain: arbitrum,    label: 'Arbitrum',     alchemySubdomain: 'arb-mainnet' },
  [optimism.id]:    { chain: optimism,    label: 'Optimism',     alchemySubdomain: 'opt-mainnet' },
  [polygon.id]:     { chain: polygon,     label: 'Polygon',      alchemySubdomain: 'polygon-mainnet' },
  [bsc.id]:         { chain: bsc,         label: 'BNB Chain',    alchemySubdomain: 'bnb-mainnet' },
  [avalanche.id]:   { chain: avalanche,   label: 'Avalanche',    alchemySubdomain: 'avax-mainnet' },
  [scroll.id]:      { chain: scroll,      label: 'Scroll',       alchemySubdomain: 'scroll-mainnet' },
  [zksync.id]:      { chain: zksync,      label: 'zkSync',       alchemySubdomain: 'zksync-mainnet' },
  [baseSepolia.id]: { chain: baseSepolia, label: 'Base Sepolia', alchemySubdomain: 'base-sepolia' },
  [sepolia.id]:     { chain: sepolia,     label: 'Sepolia',      alchemySubdomain: 'eth-sepolia' },
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  alchemyKey: process.env.ALCHEMY_API_KEY?.trim() ?? '',
  pollIntervalMs: num('POLL_INTERVAL_SECONDS', 5) * 1_000,
  maxLookback: BigInt(num('MAX_BLOCK_LOOKBACK', 400_000)),
  /** Identifies this process in index_jobs.worker_id, for debugging a fleet. */
  workerId: `${process.env.HOSTNAME ?? 'worker'}-${process.pid}`,
}

/** Per-chain override → Alchemy → the chain's public RPC. */
export function rpcUrl(meta: ChainMeta): string | undefined {
  const override = process.env[`RPC_URL_${meta.chain.id}`]?.trim()
  if (override) return override
  if (config.alchemyKey && meta.alchemySubdomain) {
    return `https://${meta.alchemySubdomain}.g.alchemy.com/v2/${config.alchemyKey}`
  }
  return undefined
}
