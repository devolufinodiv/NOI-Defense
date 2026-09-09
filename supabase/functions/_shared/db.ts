import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Client bound to the *caller's* JWT.
 *
 * Requests run as the signed-in user so row level security applies — the
 * function never needs to re-implement "can this user see this row".
 */
export function userClient(req: Request): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  )
}

/**
 * Service-role client. Bypasses RLS — use only for writes the indexer owns,
 * never to read data on a user's behalf.
 */
export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}
