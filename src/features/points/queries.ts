import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/store/auth'

export interface PointsAward {
  kind: string
  points: number
  reason: string
  subject: string | null
  chainId: number | null
  at: string
}

export interface MyPoints {
  total: number
  rank: number
  of: number
  today: number
  recent: PointsAward[]
}

export interface LeaderboardRow {
  rank: number
  display_name: string
  avatar_url: string | null
  points: number
  is_you: boolean
}

export function useMyPoints(): UseQueryResult<MyPoints> {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['points', 'me', user?.id ?? null],
    queryFn: async () => {
      if (!supabase) throw new Error('Not configured')
      const { data, error } = await supabase.rpc('my_points')
      if (error) throw error
      return data as MyPoints
    },
    enabled: Boolean(user) && Boolean(supabase),
    // Points are awarded by a database trigger after an action, so the value
    // here is always a beat behind the click. A short window keeps the badge
    // feeling live without polling.
    staleTime: 10_000,
  })
}

export function useLeaderboard(enabled = true): UseQueryResult<LeaderboardRow[]> {
  return useQuery({
    queryKey: ['points', 'leaderboard'],
    queryFn: async () => {
      if (!supabase) throw new Error('Not configured')
      const { data, error } = await supabase.rpc('points_leaderboard', { p_limit: 10 })
      if (error) throw error
      return (data ?? []) as LeaderboardRow[]
    },
    enabled: enabled && Boolean(supabase),
    staleTime: 60_000,
  })
}
