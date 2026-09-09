import { supabase } from '@/lib/supabase'

export type ActivityKind =
  | 'sign_in'
  | 'page_view'
  | 'search'
  | 'token_scan'
  | 'wallet_trace'
  | 'index_request'
  | 'watchlist_add'
  | 'watchlist_remove'

export interface TrackPayload {
  kind: ActivityKind
  chainId?: number
  subject?: string
  subjectKind?: 'token' | 'wallet'
  path?: string
  metadata?: Record<string, unknown>
}

const ANON_KEY = 'noi.anon_id'

/**
 * Stable per-browser id for signed-out visitors.
 *
 * Lets the admin view count unique anonymous sessions without attaching a name
 * to them. Deliberately random and local-only — it is never sent anywhere but
 * this app's own database, and it carries no personal data.
 */
function anonId(): string | null {
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch {
    // Private mode or blocked storage: the event still records, just without
    // session grouping. Better than dropping it.
    return null
  }
}

/** Cheap de-duplication for the page_view spam React Router can produce. */
let lastSignature = ''
let lastAt = 0

/**
 * Record one user interaction.
 *
 * Fire-and-forget by design: analytics must never block, slow, or break a user
 * action. Every failure path is swallowed — a dropped metric is an acceptable
 * loss, a broken scan is not.
 */
export async function track(payload: TrackPayload): Promise<void> {
  if (!supabase) return

  const signature = `${payload.kind}:${payload.chainId ?? ''}:${payload.subject ?? ''}:${payload.path ?? ''}`
  const now = Date.now()
  // Same event twice inside a second is a re-render, not a second intent.
  if (signature === lastSignature && now - lastAt < 1_000) return
  lastSignature = signature
  lastAt = now

  try {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id ?? null

    await supabase.from('activity_events').insert({
      user_id: userId,
      // Only tag anonymous rows; a signed-in user is already identified.
      anon_id: userId ? null : anonId(),
      kind: payload.kind,
      chain_id: payload.chainId ?? null,
      subject: payload.subject ? payload.subject.toLowerCase() : null,
      subject_kind: payload.subjectKind ?? null,
      path: payload.path ?? window.location.pathname,
      metadata: payload.metadata ?? {},
    })
  } catch {
    // Intentionally silent — see the doc comment above.
  }
}
