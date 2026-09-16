import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chainMeta } from '@/config/chains'
import { runScan } from '@/features/scan/queries'

/**
 * Trusted tokens: an admin-curated list, backed by live evidence.
 *
 * Admins decide what is on it and in what order, and can say why. What they
 * cannot do is override the evidence: every row still carries whether it passes
 * the checks as of its latest scan. The landing page asks only for passing
 * tokens; the directory asks for all of them and marks the ones that fail, so a
 * stale or mistaken entry is visible rather than silently spotlighted.
 */

interface Row {
  chain_id: number
  address: string
  name: string
  symbol: string
  curated: boolean
  note: string | null
  category: string | null
  sort_position: number | null
  passes_checks: boolean
  price_usd: string | number | null
  change_24h: string | number | null
  liquidity_usd: string | number | null
  sell_tax: string | number | null
  is_honeypot: boolean | null
  source_verified: boolean | null
  scan_count: number | string
  checked_at: string | null
}

export interface TrustedToken {
  chainId: number
  address: string
  name: string
  symbol: string
  curated: boolean
  note: string | null
  category: string | null
  position: number | null
  passesChecks: boolean
  priceUsd: number | null
  change24h: number | null
  liquidityUsd: number | null
  sellTax: number | null
  isHoneypot: boolean | null
  sourceVerified: boolean | null
  scanCount: number
  checkedAt: string | null
}

const toNumber = (value: string | number | null): number | null => {
  if (value === null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const keys = {
  all: ['trusted'] as const,
  list: (limit: number, includeFailing: boolean) => ['trusted', limit, includeFailing] as const,
}

export function useTrustedTokens(
  limit = 5,
  includeFailing = false,
): UseQueryResult<TrustedToken[]> {
  return useQuery({
    queryKey: keys.list(limit, includeFailing),
    queryFn: async () => {
      if (!supabase) throw new Error('Not configured')
      const { data, error } = await supabase.rpc('trusted_tokens', {
        p_limit: limit,
        p_include_failing: includeFailing,
      })
      if (error) throw error
      return ((data ?? []) as Row[]).map((row) => ({
        chainId: row.chain_id,
        address: row.address,
        name: row.name ?? '',
        symbol: row.symbol ?? '',
        curated: Boolean(row.curated),
        note: row.note,
        category: row.category,
        position: row.sort_position,
        passesChecks: Boolean(row.passes_checks),
        priceUsd: toNumber(row.price_usd),
        change24h: toNumber(row.change_24h),
        liquidityUsd: toNumber(row.liquidity_usd),
        sellTax: toNumber(row.sell_tax),
        isHoneypot: row.is_honeypot,
        sourceVerified: row.source_verified,
        scanCount: Number(row.scan_count ?? 0),
        checkedAt: row.checked_at,
      }))
    },
    enabled: Boolean(supabase),
    staleTime: 60_000,
  })
}

/* ------------------------------------------------------------ admin */

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** A sentence an admin can act on, carried straight to the form. */
export class TrustedError extends Error {}

/**
 * Row level security does not reject a blocked UPDATE or DELETE — it narrows
 * the statement to the rows the caller may touch, which for a non-admin is
 * none, and the request still succeeds. Without reading back what changed, a
 * refused save closed the form as if it had worked. Every write here asks for
 * its affected rows and treats zero as a failure.
 */
function nothingChanged(): TrustedError {
  return new TrustedError(
    'Nothing was saved. Only an admin can change the trusted list, or this entry may already have been removed.',
  )
}

function explain(error: { code?: string; message: string }): TrustedError {
  if (error.code === '42501') return new TrustedError('Only an admin can change the trusted list.')
  if (error.code === '23514') {
    return new TrustedError('The note can be at most 280 characters and the category 40.')
  }
  return new TrustedError(error.message)
}

const clean = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export interface TrustedInput {
  chainId: number
  address: string
  category?: string
  note?: string
}

/**
 * Add a token by pasting its contract.
 *
 * Scans first, for the same reason pins do: the table has a foreign key to
 * scanned tokens, and scanning is what fills in the name, price and safety
 * figures the row shows. It also means the admin sees the verdict immediately,
 * before deciding to keep the entry.
 */
export function useAddTrusted() {
  const client = useQueryClient()

  return useMutation<{ symbol: string; tier: string }, Error, TrustedInput>({
    mutationFn: async ({ chainId, address, category, note }) => {
      if (!supabase) throw new TrustedError('Supabase is not configured.')

      const trimmed = address.trim()
      if (!ADDRESS.test(trimmed)) {
        throw new TrustedError('That is not a contract address — it should be 0x followed by 40 characters.')
      }
      if (!chainMeta(chainId)) throw new TrustedError('Choose a network first.')
      const lower = trimmed.toLowerCase()

      let scan
      try {
        scan = await runScan(chainId, lower)
      } catch (cause) {
        throw new TrustedError(`We could not scan that address, so it was not added. ${(cause as Error).message}`)
      }

      const { data: last } = await supabase
        .from('trusted_entries')
        .select('sort_position')
        .order('sort_position', { ascending: false })
        .limit(1)
        .maybeSingle()

      const { error } = await supabase.from('trusted_entries').upsert(
        {
          chain_id: chainId,
          address: lower,
          category: clean(category),
          note: clean(note),
          sort_position: ((last?.sort_position as number | undefined) ?? -1) + 1,
          added_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        },
        { onConflict: 'chain_id,address' },
      )
      if (error) throw explain(error)

      return {
        symbol: scan.token.symbol || scan.token.name || 'that token',
        // The scan's own verdict. Whether it is spotlighted is decided by the
        // list's stricter checks, which the row reports separately.
        tier: scan.verdict.tier,
      }
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateTrusted() {
  const client = useQueryClient()

  return useMutation<void, Error, TrustedInput>({
    mutationFn: async ({ chainId, address, category, note }) => {
      if (!supabase) throw new TrustedError('Supabase is not configured.')
      const { data, error } = await supabase
        .from('trusted_entries')
        .update({ category: clean(category), note: clean(note) })
        .eq('chain_id', chainId)
        .eq('address', address.toLowerCase())
        .select('chain_id')
      if (error) throw explain(error)
      if (!data || data.length === 0) throw nothingChanged()
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.all }),
  })
}

/**
 * Move one entry up or down.
 *
 * Renumbers every curated entry rather than swapping two positions: positions
 * written by separate adds can collide or leave gaps, and a swap between two
 * equal numbers changes nothing on screen while looking like it worked.
 */
export function useMoveTrusted() {
  const client = useQueryClient()

  return useMutation<void, Error, { entries: TrustedToken[]; index: number; direction: -1 | 1 }>({
    mutationFn: async ({ entries, index, direction }) => {
      if (!supabase) throw new TrustedError('Supabase is not configured.')
      const target = index + direction
      if (target < 0 || target >= entries.length) return

      const order = [...entries]
      ;[order[index], order[target]] = [order[target], order[index]]

      for (let i = 0; i < order.length; i += 1) {
        const { data, error } = await supabase
          .from('trusted_entries')
          .update({ sort_position: i })
          .eq('chain_id', order[i].chainId)
          .eq('address', order[i].address)
          .select('chain_id')
        if (error) throw explain(error)
        if (!data || data.length === 0) throw nothingChanged()
      }
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.all }),
  })
}

/** Takes a token off the curated list. The token and its scans are untouched. */
export function useRemoveTrusted() {
  const client = useQueryClient()

  return useMutation<void, Error, { chainId: number; address: string }>({
    mutationFn: async ({ chainId, address }) => {
      if (!supabase) throw new TrustedError('Supabase is not configured.')
      const { data, error } = await supabase
        .from('trusted_entries')
        .delete()
        .eq('chain_id', chainId)
        .eq('address', address.toLowerCase())
        .select('chain_id')
      if (error) throw explain(error)
      if (!data || data.length === 0) throw nothingChanged()
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.all }),
  })
}
