/**
 * Shared HTTP helpers for edge functions.
 *
 * CORS is explicit rather than `*`: these functions are called from the browser
 * with an Authorization header, and a wildcard origin cannot be combined with
 * credentials. ALLOWED_ORIGINS is a comma-separated env var.
 */
const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

export function corsHeaders(origin: string | null): Record<string, string> {
  // With no allowlist configured, fall back to `*`. That is fine for anon reads
  // and is the only sane default for local development.
  const allowOrigin = allowed.length === 0 ? '*' : origin && allowed.includes(origin) ? origin : ''

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) })
}

/** Chains the API will accept. Mirrors src/config/chains.ts on the client. */
export const SUPPORTED_CHAIN_IDS = new Set([
  1, 8453, 42161, 10, 137, 56, 43114, 534352, 324, 84532, 11155111,
])

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

export interface Target {
  chainId: number
  address: string
}

/**
 * Validate and normalise a (chainId, address) pair.
 *
 * Addresses are lowercased rather than checksummed: the database stores them
 * lowercase, and rejecting a valid address because its casing is off would make
 * the API fail on anything pasted out of a log.
 */
export function parseTarget(
  chainIdRaw: string | null,
  addressRaw: string | null,
): { ok: true; value: Target } | { ok: false; error: string } {
  const chainId = Number.parseInt(chainIdRaw ?? '', 10)
  if (!Number.isFinite(chainId)) return { ok: false, error: 'chainId is required' }
  if (!SUPPORTED_CHAIN_IDS.has(chainId)) {
    return { ok: false, error: `Unsupported chain: ${chainId}` }
  }
  if (!addressRaw || !ADDRESS.test(addressRaw)) {
    return { ok: false, error: 'address must be 0x followed by 40 hex characters' }
  }
  return { ok: true, value: { chainId, address: addressRaw.toLowerCase() } }
}
