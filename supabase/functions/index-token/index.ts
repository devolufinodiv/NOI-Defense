import { json, parseTarget, preflight } from '../_shared/http.ts'
import { serviceClient, userClient } from '../_shared/db.ts'

/**
 * POST /index-token  { chainId, address }
 *
 * Enqueues a token for indexing and returns 202 immediately.
 *
 * It does NOT do the work. Walking a contract from its creation block takes
 * minutes and would blow the edge function's wall-clock limit; a worker drains
 * `index_jobs` instead. Returning 202 with the job id keeps that honest rather
 * than pretending the scan finished.
 *
 * Requires a signed-in user: this is the one endpoint that costs real compute,
 * so it must be attributable and rate-limitable.
 */
Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre

  const origin = req.headers.get('origin')
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin)

  let body: { chainId?: unknown; address?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body must be JSON' }, 400, origin)
  }

  const parsed = parseTarget(String(body.chainId ?? ''), String(body.address ?? ''))
  if (!parsed.ok) return json({ error: parsed.error }, 400, origin)
  const { chainId, address } = parsed.value

  const {
    data: { user },
  } = await userClient(req).auth.getUser()
  if (!user) return json({ error: 'Sign in to request indexing' }, 401, origin)

  const db = serviceClient()

  // Register the token first so the UI has something to show while the job runs.
  const { error: tokenError } = await db
    .from('tokens')
    .upsert(
      { chain_id: chainId, address, index_status: 'pending' },
      { onConflict: 'chain_id,address', ignoreDuplicates: true },
    )
  if (tokenError) return json({ error: tokenError.message }, 500, origin)

  const { data: job, error } = await db
    .from('index_jobs')
    .insert({ chain_id: chainId, address, requested_by: user.id })
    .select('id, status, requested_at')
    .single()

  if (error) {
    // The partial unique index rejects a second live job for the same token.
    // That is success from the caller's point of view — it is already queued.
    if (error.code === '23505') {
      const { data: existing } = await db
        .from('index_jobs')
        .select('id, status, requested_at')
        .eq('chain_id', chainId)
        .eq('address', address)
        .in('status', ['pending', 'running'])
        .maybeSingle()
      return json({ job: existing, alreadyQueued: true }, 202, origin)
    }
    return json({ error: error.message }, 500, origin)
  }

  return json({ job, alreadyQueued: false }, 202, origin)
})
