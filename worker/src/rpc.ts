import { createPublicClient, http, type PublicClient } from 'viem'
import { CHAINS, rpcUrl, type ChainMeta } from './config.js'

const clients = new Map<number, PublicClient>()

export function chainMeta(chainId: number): ChainMeta {
  const meta = CHAINS[chainId]
  if (!meta) throw new Error(`Unsupported chain: ${chainId}`)
  return meta
}

export function clientFor(chainId: number): PublicClient {
  const cached = clients.get(chainId)
  if (cached) return cached

  const meta = chainMeta(chainId)
  const client = createPublicClient({
    chain: meta.chain,
    transport: http(rpcUrl(meta), {
      // Log queries are the expensive part; give them room and let viem retry
      // the transient 429s that public RPCs hand out freely.
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 800,
    }),
  }) as PublicClient

  clients.set(chainId, client)
  return client
}

/** Sleep helper used for backoff. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
