import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { env, hasSupabase } from '@/config/env'
import { supabase } from '@/lib/supabase'
import type { ScanResult } from './types'

export const scanKeys = {
  all: ['scan'] as const,
  one: (chainId: number, address: string) =>
    [...scanKeys.all, chainId, address.toLowerCase()] as const,
}

/**
 * Runs a scan.
 *
 * Sends the caller's access token when there is one, so the scan is attributed
 * and earns points. Signed-out visitors still get the full result — that is the
 * promise the landing page makes, and gating it would break the first thing a
 * newcomer tries.
 */
export async function runScan(chainId: number, address: string): Promise<ScanResult> {
  if (!hasSupabase) {
    throw new Error('Scanning is not configured yet. Add the project URL and key to .env.local.')
  }

  const token = (await supabase?.auth.getSession())?.data.session?.access_token

  const res = await fetch(
    `${env.supabaseUrl}/functions/v1/scan?chainId=${chainId}&address=${address}`,
    {
      headers: {
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${token ?? env.supabaseAnonKey}`,
      },
    },
  )

  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? `Scan failed (${res.status})`)
  return body as ScanResult
}

export function useScan(
  chainId: number,
  address: string,
  enabled = true,
): UseQueryResult<ScanResult> {
  return useQuery({
    queryKey: scanKeys.one(chainId, address),
    queryFn: () => runScan(chainId, address),
    enabled: enabled && address.length > 0,
    // The endpoint caches upstream for 3 minutes; matching it here avoids a
    // round trip that would return an identical payload.
    staleTime: 180_000,
    retry: 1,
  })
}
