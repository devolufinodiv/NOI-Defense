/**
 * Typed access to build-time environment.
 *
 * Nothing here throws at import time: the app must still boot (and the style
 * guide must still render) with an empty .env, so callers check the `has*`
 * flags and degrade to an explicit "not configured" state instead of failing
 * silently.
 */

const raw = import.meta.env

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback
}

function trimSlash(value: string): string {
  return value.replace(/\/$/, '')
}

const chainId = Number.parseInt(str(raw.VITE_CHAIN_ID, '8453'), 10)

/**
 * Per-chain overrides, keyed by chain id: `VITE_RPC_URL_1`,
 * `VITE_RPC_URL_8453`, `VITE_EXPLORER_URL_42161`, and so on.
 *
 * Collected by scanning the env object rather than reading named keys, so
 * adding a network needs no change here. Vite inlines the whole `import.meta.env`
 * object, so iterating it is safe in a production build — unlike guessing at
 * `import.meta.env[someDynamicName]` for a key that was never referenced.
 */
function collectByChainId(prefix: string, transform: (value: string) => string) {
  const pattern = new RegExp(`^${prefix}_(\\d+)$`)
  const out: Record<number, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const match = pattern.exec(key)
    if (!match) continue
    const parsed = str(value)
    if (parsed) out[Number(match[1])] = transform(parsed)
  }
  return out
}

export const env = {
  /** The chain a fresh session starts on. */
  chainId: Number.isFinite(chainId) ? chainId : 8453,

  /** Works for every network that has an Alchemy endpoint — see chains.ts. */
  alchemyApiKey: str(raw.VITE_ALCHEMY_API_KEY),

  /** `VITE_RPC_URL_<chainId>` → that chain's RPC. Highest priority. */
  rpcUrlByChain: collectByChainId('VITE_RPC_URL', (v) => v),
  /**
   * Legacy single-RPC setting. Applies ONLY to the default chain — pointing
   * every network at one endpoint would silently return another chain's data.
   */
  defaultChainRpcUrl: str(raw.VITE_RPC_URL),

  /** `VITE_EXPLORER_URL_<chainId>` → that chain's explorer. */
  explorerUrlByChain: collectByChainId('VITE_EXPLORER_URL', trimSlash),
  /** Legacy single-explorer setting. Applies ONLY to the default chain. */
  defaultChainExplorerUrl: trimSlash(str(raw.VITE_EXPLORER_URL)),

  supabaseUrl: str(raw.VITE_SUPABASE_URL),
  supabaseAnonKey: str(raw.VITE_SUPABASE_ANON_KEY),
  isDev: raw.DEV,
} as const

export const hasAlchemy = env.alchemyApiKey !== ''
export const hasSupabase = env.supabaseUrl !== '' && env.supabaseAnonKey !== ''

/** True when at least one usable RPC source is configured for reads. */
export const hasRpc =
  hasAlchemy ||
  env.defaultChainRpcUrl !== '' ||
  Object.keys(env.rpcUrlByChain).length > 0

/** Names of env vars that are absent but will be needed for real data. */
export function missingEnvKeys(): string[] {
  const missing: string[] = []
  if (!hasRpc) missing.push('VITE_ALCHEMY_API_KEY (or VITE_RPC_URL_<chainId>)')
  if (!hasSupabase) missing.push('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY')
  return missing
}
