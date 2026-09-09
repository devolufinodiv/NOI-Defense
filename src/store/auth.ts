import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isAuthConfigured } from '@/lib/supabase'
import { track } from '@/lib/analytics'

export interface AuthState {
  user: User | null
  session: Session | null
  /** True until the initial session lookup settles. */
  loading: boolean
  configured: boolean
}

/**
 * Current auth session.
 *
 * Subscribes to Supabase's auth events so a sign-in completed in another tab,
 * or a token refresh, updates this one too.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isAuthConfigured)

  useEffect(() => {
    if (!supabase) return

    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setLoading(false)

      if (event === 'SIGNED_IN' && next?.user) {
        void track({ kind: 'sign_in' })
        // Keep the admin user table honest about who is still around.
        void supabase!
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', next.user.id)
      }
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return {
    user: session?.user ?? null,
    session,
    loading,
    configured: isAuthConfigured,
  }
}

/** Starts the Google OAuth redirect. Throws if auth isn't configured. */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}

/** Best available display name for a signed-in user. */
export function displayName(user: User | null): string {
  if (!user) return ''
  const meta = user.user_metadata ?? {}
  return (meta.full_name as string) || (meta.name as string) || user.email || 'Signed in'
}
