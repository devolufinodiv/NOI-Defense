import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, hasSupabase } from '@/config/env'

/**
 * Supabase client, or `null` when the project isn't configured.
 *
 * Null rather than a throwing stub: the app must boot and the whole UI must
 * render with an empty `.env`, so every caller checks for null and shows an
 * honest "not configured" state instead of a broken flow.
 */
export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The OAuth redirect comes back with the session in the URL hash.
        detectSessionInUrl: true,
      },
    })
  : null

export const isAuthConfigured = supabase !== null
