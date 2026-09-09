/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string
  readonly VITE_ALCHEMY_API_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string

  /** Legacy single-chain settings — applied to the default chain only. */
  readonly VITE_RPC_URL?: string
  readonly VITE_EXPLORER_URL?: string

  /**
   * Per-chain overrides: VITE_RPC_URL_1, VITE_RPC_URL_8453,
   * VITE_EXPLORER_URL_42161, … Indexed because the key carries the chain id.
   */
  readonly [key: `VITE_RPC_URL_${number}`]: string | undefined
  readonly [key: `VITE_EXPLORER_URL_${number}`]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
