import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Pin } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { chainMeta } from '@/config/chains'
import { TokenMark } from '@/components/ui/TokenMark'
import { DeltaPill } from '@/components/ui/Badge'
import { formatUsd } from '@/lib/format'

/**
 * The hero's trusted list.
 *
 * A list, not a grid of cards: the point is to be scanned down in a second and
 * clicked, not admired. Each row is a link straight into that token's report.
 *
 * "Trusted" is a claim the product has to back, so membership is earned in SQL
 * (see the trusted_tokens function) by evidence we actually recorded — a sale
 * simulated successfully, a known and small sell fee, real depth. The evidence
 * travels with the row and is shown, so nobody has to take the word on faith.
 */

interface TrustedRow {
  chain_id: number
  address: string
  name: string
  symbol: string
  pinned: boolean
  price_usd: string | number | null
  change_24h: string | number | null
  liquidity_usd: string | number | null
  sell_tax: string | number | null
  source_verified: boolean | null
  scan_count: number
  checked_at: string | null
}

export interface TrustedToken {
  chainId: number
  address: string
  name: string
  symbol: string
  pinned: boolean
  priceUsd: number | null
  change24h: number | null
  liquidityUsd: number | null
  sellTax: number | null
  sourceVerified: boolean | null
  scanCount: number
}

const toNumber = (value: string | number | null): number | null => {
  if (value === null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function useTrustedTokens(limit = 5): UseQueryResult<TrustedToken[]> {
  return useQuery({
    queryKey: ['featured', 'trusted', limit],
    queryFn: async () => {
      if (!supabase) throw new Error('Not configured')
      const { data, error } = await supabase.rpc('trusted_tokens', { p_limit: limit })
      if (error) throw error
      return ((data ?? []) as TrustedRow[]).map((row) => ({
        chainId: row.chain_id,
        address: row.address,
        name: row.name ?? '',
        symbol: row.symbol ?? '',
        pinned: Boolean(row.pinned),
        priceUsd: toNumber(row.price_usd),
        change24h: toNumber(row.change_24h),
        liquidityUsd: toNumber(row.liquidity_usd),
        sellTax: toNumber(row.sell_tax),
        sourceVerified: row.source_verified,
        scanCount: Number(row.scan_count ?? 0),
      }))
    },
    enabled: Boolean(supabase),
    staleTime: 60_000,
  })
}

export function TrustedList({ limit = 5 }: { limit?: number }) {
  const trusted = useTrustedTokens(limit)

  // Nothing has cleared the bar yet — say nothing rather than show an empty
  // frame under a heading that promises a list.
  if (!trusted.isLoading && (!trusted.data || trusted.data.length === 0)) return null

  return (
    <section className="mx-auto mt-16 w-full max-w-2xl text-left">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-heading text-primary">Trusted tokens</h2>
        <Link
          to="/token"
          className="text-xs text-muted transition-colors duration-180 hover:text-primary"
        >
          Check another
        </Link>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-muted">
        These cleared every check we run: a test sale went through, the sell fee is small, and
        there is real depth behind them. Not investment advice.
      </p>

      <ul className="glass-panel mt-4 divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
        {trusted.isLoading
          ? [0, 1, 2, 3, 4].slice(0, limit).map((i) => (
              <li key={i} className="h-[62px] animate-pulse bg-raised/30" />
            ))
          : trusted.data?.map((token, index) => (
              <TrustedRowItem key={`${token.chainId}:${token.address}`} token={token} rank={index + 1} />
            ))}
      </ul>
    </section>
  )
}

function TrustedRowItem({ token, rank }: { token: TrustedToken; rank: number }) {
  const chain = chainMeta(token.chainId)

  return (
    <li>
      <Link
        to={`/token/${token.address}?chain=${token.chainId}`}
        className="group flex items-center gap-3 px-4 py-3 transition-colors duration-180 hover:bg-raised/60"
      >
        <span className="tabular w-4 shrink-0 text-xs text-muted">{rank}</span>

        <TokenMark symbol={token.symbol} size="md" />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-primary">{token.symbol}</span>
            {token.pinned ? (
              <Pin className="h-3 w-3 shrink-0 text-muted" strokeWidth={2} aria-label="Pinned by an admin" />
            ) : null}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Check className="h-3 w-3 shrink-0 text-positive" strokeWidth={2.5} aria-hidden />
            <span className="truncate">
              {token.sellTax === 0
                ? 'Sells with no fee'
                : token.sellTax === null
                  ? 'Sale tested'
                  : `Sells at a ${token.sellTax.toFixed(1)}% fee`}
              {chain ? ` · ${chain.label}` : null}
            </span>
          </span>
        </span>

        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-xs text-muted">Depth</span>
          <span className="tabular block text-xs text-secondary">
            {token.liquidityUsd === null ? '—' : formatUsd(token.liquidityUsd, { compact: true })}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="tabular block text-sm text-primary">
            {token.priceUsd === null ? '—' : formatUsd(token.priceUsd)}
          </span>
          {token.change24h === null ? null : (
            <DeltaPill value={token.change24h} showIcon={false} className="mt-0.5" />
          )}
        </span>

        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-muted transition-colors duration-180 group-hover:text-primary"
          strokeWidth={2}
          aria-hidden
        />
      </Link>
    </li>
  )
}
