import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import { track } from '@/lib/analytics'

export interface WatchRow {
  id: string
  kind: 'token' | 'wallet'
  chain_id: number
  address: string
  symbol: string | null
  name: string | null
  created_at: string
}

export interface AlertRow {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  chain_id: number
  subject: string
  subject_kind: 'token' | 'wallet'
  rule: string | null
  read_at: string | null
  created_at: string
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export function useWatchlist(): UseQueryResult<WatchRow[]> {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['watchlist', user?.id ?? null],
    queryFn: async () => {
      const { data, error } = await client()
        .from('watchlist')
        .select('id, kind, chain_id, address, symbol, name, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as WatchRow[]
    },
    enabled: Boolean(user) && Boolean(supabase),
  })
}

/** Whether this exact target is already being watched. */
export function useIsWatched(chainId: number, address: string): boolean {
  const { data } = useWatchlist()
  return (data ?? []).some(
    (row) => row.chain_id === chainId && row.address.toLowerCase() === address.toLowerCase(),
  )
}

export function useToggleWatch(chainId: number, address: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const watched = useIsWatched(chainId, address)

  const mutation = useMutation({
    mutationFn: async (meta: { symbol?: string; name?: string; kind?: 'token' | 'wallet' }) => {
      if (!user) throw new Error('Sign in to get alerts')
      const db = client()
      const lower = address.toLowerCase()

      if (watched) {
        const { error } = await db
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('chain_id', chainId)
          .eq('address', lower)
        if (error) throw error
        void track({ kind: 'watchlist_remove', chainId, subject: lower, subjectKind: meta.kind ?? 'token' })
        return false
      }

      const { error } = await db.from('watchlist').insert({
        user_id: user.id,
        kind: meta.kind ?? 'token',
        chain_id: chainId,
        address: lower,
        symbol: meta.symbol ?? null,
        name: meta.name ?? null,
      })
      if (error) throw error
      void track({ kind: 'watchlist_add', chainId, subject: lower, subjectKind: meta.kind ?? 'token' })
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] })
      // Watching earns points, so the badge is now stale.
      queryClient.invalidateQueries({ queryKey: ['points'] })
    },
  })

  return { watched, ...mutation }
}

export function useAlerts(): UseQueryResult<AlertRow[]> {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['alerts', user?.id ?? null],
    queryFn: async () => {
      const { data, error } = await client()
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as AlertRow[]
    },
    enabled: Boolean(user) && Boolean(supabase),
    // The monitor writes these on its own cadence; a slow refetch keeps the
    // page current without polling hard for something that changes rarely.
    refetchInterval: 60_000,
  })
}

export function useUnreadAlertCount(): number {
  const { data } = useAlerts()
  return (data ?? []).filter((a) => a.read_at === null).length
}

export function useMarkAlertsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await client().rpc('mark_alerts_read')
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
