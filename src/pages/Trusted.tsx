import { useMemo, useState } from 'react'
import { Info, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardBody, Eyebrow } from '@/components/ui/Card'
import { ChainMark } from '@/components/ui/ChainMark'
import { chainMeta } from '@/config/chains'
import { cn } from '@/lib/cn'
import { useIsAdmin } from '@/features/admin/queries'
import { useTrustedTokens } from '@/features/trusted/queries'
import { TrustedRow } from '@/features/trusted/TrustedRow'
import { TrustedManager } from '@/features/trusted/TrustedManager'

/**
 * The trusted tokens directory.
 *
 * Everything on the curated list plus everything that passes the checks on its
 * own, filterable by name, network and category. Curated tokens that fail their
 * latest scan stay visible here with a warning instead of disappearing — hiding
 * them would make a stale entry impossible to notice.
 */
export function Trusted() {
  const { isAdmin } = useIsAdmin()
  const list = useTrustedTokens(200, true)

  const [query, setQuery] = useState('')
  const [chain, setChain] = useState<number | 'all'>('all')
  const [category, setCategory] = useState<string | 'all'>('all')
  const [passingOnly, setPassingOnly] = useState(false)

  const tokens = list.data ?? []

  const chains = useMemo(
    () => Array.from(new Set(tokens.map((t) => t.chainId))).sort((a, b) => a - b),
    [tokens],
  )
  const categories = useMemo(
    () => Array.from(new Set(tokens.map((t) => t.category).filter(Boolean))).sort() as string[],
    [tokens],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tokens.filter((t) => {
      if (chain !== 'all' && t.chainId !== chain) return false
      if (category !== 'all' && t.category !== category) return false
      if (passingOnly && !t.passesChecks) return false
      if (!q) return true
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
      )
    })
  }, [tokens, query, chain, category, passingOnly])

  const failing = tokens.filter((t) => !t.passesChecks).length

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Directory</Eyebrow>}
        title="Trusted tokens"
        subtitle="Tokens our team has chosen, and tokens that pass every check on their own. Each line shows what its latest scan found."
      />

      <div className="space-y-5 px-4 pb-12 pt-6 md:px-8">
        <div className="space-y-3">
          <label className="glass-panel flex max-w-xl items-center gap-2 rounded-lg border border-hairline px-3 focus-within:border-hairline-strong">
            <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, symbol or address"
              aria-label="Search trusted tokens"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-primary placeholder:text-muted focus:outline-none"
            />
          </label>

          {chains.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by network">
              <FilterChip active={chain === 'all'} onClick={() => setChain('all')}>
                All networks
              </FilterChip>
              {chains.map((id) => (
                <FilterChip key={id} active={chain === id} onClick={() => setChain(id)}>
                  <ChainMark chainId={id} size="xs" />
                  {chainMeta(id)?.label ?? id}
                </FilterChip>
              ))}
            </div>
          ) : null}

          {categories.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
              <FilterChip active={category === 'all'} onClick={() => setCategory('all')}>
                All categories
              </FilterChip>
              {categories.map((c) => (
                <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c}
                </FilterChip>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-muted">
              {list.isLoading
                ? 'Loading…'
                : `${visible.length} of ${tokens.length} ${tokens.length === 1 ? 'token' : 'tokens'}`}
            </span>
            {failing > 0 ? (
              <label className="flex cursor-pointer items-center gap-2 text-secondary">
                <input
                  type="checkbox"
                  checked={passingOnly}
                  onChange={(e) => setPassingOnly(e.target.checked)}
                  className="h-3.5 w-3.5 cursor-pointer accent-current"
                />
                Hide {failing} that fail their latest scan
              </label>
            ) : null}
          </div>
        </div>

        {list.isError ? (
          <Card>
            <CardBody className="text-sm text-negative">
              We could not load the list just now. {(list.error as Error).message}
            </CardBody>
          </Card>
        ) : list.isLoading ? (
          <ul className="glass-panel divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-[62px] animate-pulse bg-raised/30" />
            ))}
          </ul>
        ) : visible.length === 0 ? (
          <Card>
            <CardBody className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
              <p className="text-sm text-secondary">
                {tokens.length === 0
                  ? 'Nothing is on the list yet.'
                  : 'No tokens match those filters.'}
              </p>
            </CardBody>
          </Card>
        ) : (
          <ul className="glass-panel divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
            {visible.map((token) => (
              <TrustedRow key={`${token.chainId}:${token.address}`} token={token} showNote />
            ))}
          </ul>
        )}

        <p className="text-xs leading-relaxed text-muted">
          A token that fails its latest scan is marked and kept off the front page, even if our team
          chose it. These are automated checks, not financial advice.
        </p>

        {isAdmin ? <TrustedManager entries={tokens} /> : null}
      </div>
    </>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition-colors duration-180',
        active
          ? 'border-hairline-strong bg-raised text-primary'
          : 'border-hairline text-secondary hover:border-hairline-strong hover:text-primary',
      )}
    >
      {children}
    </button>
  )
}
