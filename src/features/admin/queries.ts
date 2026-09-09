import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'

export interface AdminOverview {
  users_total: number
  users_new_7d: number
  active_users_24h: number
  anon_sessions_24h: number
  events_24h: number
  scans_24h: number
  tokens_indexed: number
  jobs_pending: number
  jobs_running: number
  jobs_failed_24h: number
}

export interface TopSubject {
  chain_id: number
  subject: string
  symbol: string
  name: string
  scans: number
  unique_users: number
  last_seen: string
}

export interface DailyPoint {
  day: string
  events: number
  scans: number
  users: number
}

export interface ActivityRow {
  id: number
  kind: string
  actor: string
  is_anonymous: boolean
  chain_id: number | null
  subject: string | null
  subject_kind: 'token' | 'wallet' | null
  path: string | null
  created_at: string
}

export interface AdminUser {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  role: 'user' | 'admin'
  created_at: string
  last_seen_at: string | null
  events: number
  scans: number
  watchlist: number
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

/**
 * Whether the signed-in user is an admin.
 *
 * Asks the database rather than trusting anything client-side: the same
 * `is_admin()` predicate gates every admin RPC on the server, so this only
 * decides whether to *render* the section. Flipping it locally still yields a
 * 42501 from every query behind it.
 */
export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth()

  const query = useQuery({
    queryKey: ['admin', 'is-admin', user?.id ?? null],
    queryFn: async () => {
      const { data, error } = await requireClient().rpc('is_admin')
      if (error) throw error
      return Boolean(data)
    },
    enabled: Boolean(user) && Boolean(supabase),
    staleTime: 5 * 60_000,
  })

  return {
    isAdmin: query.data === true,
    loading: authLoading || (Boolean(user) && query.isLoading),
  }
}

// Slow refresh: this is a monitoring view, and hammering the database to watch
// counters tick would be its own problem.
const ADMIN_REFRESH = 30_000

export function useAdminOverview(enabled: boolean): UseQueryResult<AdminOverview> {
  return useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => {
      const { data, error } = await requireClient().rpc('admin_overview')
      if (error) throw error
      return data as AdminOverview
    },
    enabled,
    refetchInterval: ADMIN_REFRESH,
  })
}

export function useTopSubjects(
  kind: 'token' | 'wallet',
  days: number,
  enabled: boolean,
): UseQueryResult<TopSubject[]> {
  return useQuery({
    queryKey: ['admin', 'top', kind, days],
    queryFn: async () => {
      const { data, error } = await requireClient().rpc('admin_top_subjects', {
        p_kind: kind,
        p_days: days,
        p_limit: 10,
      })
      if (error) throw error
      return (data ?? []) as TopSubject[]
    },
    enabled,
    refetchInterval: ADMIN_REFRESH,
  })
}

export function useActivityDaily(days: number, enabled: boolean): UseQueryResult<DailyPoint[]> {
  return useQuery({
    queryKey: ['admin', 'daily', days],
    queryFn: async () => {
      const { data, error } = await requireClient().rpc('admin_activity_daily', { p_days: days })
      if (error) throw error
      return (data ?? []) as DailyPoint[]
    },
    enabled,
    refetchInterval: ADMIN_REFRESH,
  })
}

export function useRecentActivity(enabled: boolean): UseQueryResult<ActivityRow[]> {
  return useQuery({
    queryKey: ['admin', 'recent'],
    queryFn: async () => {
      const { data, error } = await requireClient().rpc('admin_recent_activity', { p_limit: 40 })
      if (error) throw error
      return (data ?? []) as ActivityRow[]
    },
    enabled,
    refetchInterval: 15_000,
  })
}

export function useAdminUsers(enabled: boolean): UseQueryResult<AdminUser[]> {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error } = await requireClient().rpc('admin_users', { p_limit: 50 })
      if (error) throw error
      return (data ?? []) as AdminUser[]
    },
    enabled,
    refetchInterval: ADMIN_REFRESH,
  })
}
