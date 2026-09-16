import { useMemo, useState, type ReactNode } from 'react'
import { Check, Minus, ShieldAlert, TriangleAlert, X } from 'lucide-react'
import { TokenMark } from '@/components/ui/TokenMark'
import { HashRef } from '@/components/ui/Address'
import { DeltaPill } from '@/components/ui/Badge'
import { chainMeta } from '@/config/chains'
import { formatPercent, formatUsd, truncateAddress } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { TokenProfile } from './queries'

/**
 * The comparison grid.
 *
 * Organised the way the decision is actually made, not the way the data
 * arrives: the headline first, then what can be done to you, then what you are
 * buying, and only then how it has been trading. Trading numbers move minute to
 * minute and decide the least, so they sit last.
 *
 * Rows are declared as data rather than written as markup. That is what lets
 * one definition drive three things at once — the cell, whether the tokens
 * actually differ on this row, and which of them leads on it — instead of those
 * three going out of step with each other.
 */

export interface Column {
  key: string
  chainId: number
  address: string
  profile: TokenProfile | undefined
  isLoading: boolean
  error: Error | null
}

/** A cell we could not fill, which is never the same as a cell that is empty. */
function Unknown({ label = 'Not checked' }: { label?: string }) {
  return <span className="text-muted">{label}</span>
}

function ToneValue({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'good' | 'warn' | 'bad' | 'neutral'
}) {
  return (
    <span
      className={cn(
        tone === 'good' && 'text-positive',
        tone === 'warn' && 'text-warning',
        tone === 'bad' && 'text-negative',
        tone === 'neutral' && 'text-secondary',
      )}
    >
      {children}
    </span>
  )
}

/** Yes/no where "yes" is the dangerous answer. */
function RiskFlag({ present }: { present: boolean }) {
  return present ? (
    <span className="inline-flex items-center gap-1.5 text-negative">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-positive">
      <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      No
    </span>
  )
}

/**
 * Compact label for a uint256 amount held as a decimal string.
 *
 * Works on the digits directly rather than going through Number: a supply like
 * PEPE's 420,689,899,645,288 exceeds what a float can hold exactly.
 */
function compactSupply(value: string): string {
  const [whole = '0'] = value.split('.')
  const digits = whole.replace(/^0+(?=\d)/, '')
  const units: Array<[number, string]> = [
    [13, 'T'],
    [10, 'B'],
    [7, 'M'],
    [4, 'K'],
  ]

  for (const [length, suffix] of units) {
    if (digits.length >= length) {
      const head = digits.length - (length - 1)
      const frac = digits.slice(head, head + 2).replace(/0+$/, '')
      return frac ? `${digits.slice(0, head)}.${frac}${suffix}` : `${digits.slice(0, head)}${suffix}`
    }
  }
  return digits
}

const FUNCTION_GAP: Record<string, string> = {
  'not-configured': 'Not set up yet',
  unverified: 'Code not published',
  'chain-unindexed': 'Not available here',
  failed: 'Could not read',
}

function marketGap(status: string): string {
  if (status === 'none') return 'No pools found'
  if (status === 'chain-unsupported') return 'Not available here'
  return 'Could not read'
}

function securityGap(status: string): string {
  if (status === 'chain-unsupported') return 'Not available here'
  return 'Could not read'
}

/* ------------------------------------------------------------- tallies */

/** Dangerous powers, in the order they matter to someone holding the token. */
const RISK_CAPABILITIES = ['mint', 'pause', 'blacklist', 'upgrade'] as const

interface Tally {
  concerns: string[]
  unchecked: number
}

/**
 * What is actually wrong, counted only from what we know.
 *
 * An unchecked item is never a concern and never a clean result — it is counted
 * separately, so a token nobody could verify does not read as one that passed.
 */
function tally(profile: TokenProfile): Tally {
  const concerns: string[] = []
  let unchecked = 0

  const { security, functions, market } = profile

  if (security.status === 'ok') {
    if (security.isHoneypot === true) concerns.push('a test sale failed')
    if (security.sellTax !== null && security.sellTax >= 10) concerns.push('a high sell fee')
  } else {
    unchecked += 1
  }

  if (functions.status === 'ok') {
    if (functions.verified === false) concerns.push('unpublished code')
    if (functions.ownershipRenounced === false) concerns.push('an owner who can change things')
    for (const id of RISK_CAPABILITIES) {
      const cap = functions.capabilities.find((c) => c.id === id)
      if (cap?.present) concerns.push(cap.label.toLowerCase())
    }
  } else {
    unchecked += 1
  }

  if (market.status === 'ok') {
    if (market.liquidityUsd !== null && market.liquidityUsd < 50_000) concerns.push('thin liquidity')
  } else {
    unchecked += 1
  }

  return { concerns, unchecked }
}

/* ---------------------------------------------------------- row model */

type Direction = 'higher' | 'lower'

interface Row {
  id: string
  label: string
  hint?: string
  /**
   * The comparable figure behind the cell. Drives both "do these differ" and
   * "which leads", so a row can never claim a winner its cell does not show.
   */
  value: (profile: TokenProfile) => number | string | null
  render: (profile: TokenProfile, column: Column) => ReactNode
  better?: Direction
}

interface Section {
  id: string
  title: string
  blurb?: string
  rows: Row[]
}

/* ------------------------------------------------------------ renderer */

export function CompareTable({ columns }: { columns: Column[] }) {
  const [onlyDifferences, setOnlyDifferences] = useState(false)

  const sections = useMemo(() => buildSections(columns), [columns])
  const loaded = columns.filter((c) => c.profile).length
  const comparable = columns.length > 1 && loaded > 1

  return (
    <div className="space-y-3">
      {comparable ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-secondary">
            <input
              type="checkbox"
              checked={onlyDifferences}
              onChange={(event) => setOnlyDifferences(event.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-current"
            />
            Only show rows where they differ
          </label>
          <span className="text-xs text-muted">
            A highlighted value leads on that measure — not a recommendation.
          </span>
        </div>
      ) : null}

      <div className="max-h-[70vh] overflow-auto rounded-xl border border-hairline bg-card">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <caption className="sr-only">
            Side-by-side comparison of security, contract powers, supply, liquidity depth and
            trading by timeframe
          </caption>

          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 w-40 border-b border-hairline-strong bg-card px-4 py-3 md:w-52" />
              {columns.map((column) => {
                const symbol = column.profile?.token.symbol || ''
                const chain = chainMeta(column.chainId)
                const price = column.profile?.market.priceUsd ?? null
                const change =
                  column.profile?.market.windows.find((w) => w.window === '24h')?.priceChange ?? null

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className="sticky top-0 z-20 border-b border-hairline-strong bg-card px-4 py-3 text-left align-bottom"
                  >
                    <span className="flex items-center gap-2">
                      <TokenMark
                        symbol={symbol || '?'}
                        size="md"
                        chainId={column.chainId}
                        address={column.address}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-primary">
                          {symbol || truncateAddress(column.address)}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {chain?.label ?? `Chain ${column.chainId}`}
                        </span>
                      </span>
                    </span>
                    {price === null ? null : (
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="tabular text-xs text-secondary">{formatUsd(price)}</span>
                        {change === null ? null : <DeltaPill value={change} showIcon={false} />}
                      </span>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          {sections.map((section) => (
            <SectionBody
              key={section.id}
              section={section}
              columns={columns}
              onlyDifferences={onlyDifferences && comparable}
            />
          ))}

          <TimeframeBody columns={columns} />
        </table>
      </div>
    </div>
  )
}

function SectionBody({
  section,
  columns,
  onlyDifferences,
}: {
  section: Section
  columns: Column[]
  onlyDifferences: boolean
}) {
  const span = columns.length + 1

  const rows = section.rows.filter((row) => {
    if (!onlyDifferences) return true
    const known = columns
      .filter((c) => c.profile)
      .map((c) => row.value(c.profile as TokenProfile))
    if (known.length < 2) return true
    return known.some((v) => v !== known[0])
  })

  if (rows.length === 0) return null

  return (
    <tbody>
      <tr>
        <td colSpan={span} className="bg-raised/40 pb-2 pt-4">
          <span className="sticky left-0 flex flex-wrap items-baseline gap-x-2 px-4">
            <span className="text-2xs font-semibold uppercase tracking-wider text-secondary">
              {section.title}
            </span>
            {section.blurb ? (
              <span className="text-[11px] text-muted">{section.blurb}</span>
            ) : null}
          </span>
        </td>
      </tr>

      {rows.map((row) => {
        const leaders = bestIndexes(row, columns)

        return (
          <tr key={row.id} className="border-t border-hairline align-top">
            <th
              scope="row"
              className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left font-normal"
            >
              <span className="block text-xs text-secondary">{row.label}</span>
              {row.hint ? <span className="block text-[11px] text-muted">{row.hint}</span> : null}
            </th>

            {columns.map((column, index) => (
              <td key={column.key} className="px-4 py-2.5 text-xs">
                {column.isLoading ? (
                  <span className="block h-3 w-16 animate-pulse rounded bg-raised" />
                ) : column.error || !column.profile ? (
                  <Unknown label="Failed to load" />
                ) : leaders.has(index) ? (
                  <span className="inline-flex rounded-md bg-raised px-1.5 py-0.5 ring-1 ring-hairline-strong">
                    {row.render(column.profile, column)}
                    <span className="sr-only"> — leads on this measure</span>
                  </span>
                ) : (
                  row.render(column.profile, column)
                )}
              </td>
            ))}
          </tr>
        )
      })}
    </tbody>
  )
}

/** Which columns lead on a directional row. Ties mark nobody. */
function bestIndexes(row: Row, columns: Column[]): Set<number> {
  const none = new Set<number>()
  if (!row.better || columns.length < 2) return none

  const values = columns.map((c) => {
    const v = c.profile ? row.value(c.profile) : null
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  })

  const known = values.filter((v): v is number => v !== null)
  if (known.length < 2) return none

  const best = row.better === 'higher' ? Math.max(...known) : Math.min(...known)
  // Everything equal means nothing leads; saying otherwise would invent a
  // difference the numbers do not contain.
  if (known.every((v) => v === best)) return none

  const out = new Set<number>()
  values.forEach((v, i) => {
    if (v === best) out.add(i)
  })
  return out
}

/* ------------------------------------------------------- timeframe grid */

const WINDOWS = ['5m', '1h', '6h', '24h'] as const

/**
 * Trading history as the two-dimensional thing it is.
 *
 * This used to be eight separate rows — four for price change, four for volume
 * — which asked the reader to rebuild the grid in their head and made the least
 * decisive section the tallest on the page. One row per token holding a small
 * window-by-measure grid reads in a glance instead.
 */
function TimeframeBody({ columns }: { columns: Column[] }) {
  const span = columns.length + 1

  return (
    <tbody>
      <tr>
        <td colSpan={span} className="bg-raised/40 pb-2 pt-4">
          <span className="sticky left-0 flex flex-wrap items-baseline gap-x-2 px-4">
            <span className="text-2xs font-semibold uppercase tracking-wider text-secondary">
              Trading by timeframe
            </span>
            <span className="text-[11px] text-muted">
              Volume and trades summed across every pool
            </span>
          </span>
        </td>
      </tr>

      <tr className="border-t border-hairline align-top">
        <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-normal">
          <span className="block text-xs text-secondary">Price, volume and trades</span>
          <span className="block text-[11px] text-muted">Over four windows</span>
        </th>

        {columns.map((column) => (
          <td key={column.key} className="px-4 py-3">
            {column.isLoading ? (
              <span className="block h-20 w-full animate-pulse rounded bg-raised" />
            ) : column.error || !column.profile ? (
              <Unknown label="Failed to load" />
            ) : column.profile.market.status !== 'ok' ? (
              <Unknown label={marketGap(column.profile.market.status)} />
            ) : (
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="text-muted">
                    <th scope="col" className="pb-1 pr-3 text-left font-normal">
                      Window
                    </th>
                    <th scope="col" className="pb-1 pr-3 text-right font-normal">
                      Change
                    </th>
                    <th scope="col" className="pb-1 pr-3 text-right font-normal">
                      Volume
                    </th>
                    <th scope="col" className="pb-1 text-right font-normal">
                      Buys / sells
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {WINDOWS.map((name) => {
                    const w = column.profile?.market.windows.find((x) => x.window === name)
                    return (
                      <tr key={name} className="border-t border-hairline/60">
                        <td className="py-1 pr-3 text-secondary">{name}</td>

                        <td className="tabular py-1 pr-3 text-right">
                          {!w || w.priceChange === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <ToneValue tone={w.priceChange >= 0 ? 'good' : 'bad'}>
                              {formatPercent(w.priceChange, { signed: true })}
                            </ToneValue>
                          )}
                        </td>

                        <td className="tabular py-1 pr-3 text-right text-secondary">
                          {!w || w.volumeUsd === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            formatUsd(w.volumeUsd, { compact: true })
                          )}
                        </td>

                        <td className="tabular py-1 text-right">
                          {!w || w.buys === null || w.sells === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <ToneValue tone={w.buys >= w.sells ? 'good' : 'warn'}>
                              {w.buys.toLocaleString('en-US')} / {w.sells.toLocaleString('en-US')}
                            </ToneValue>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </td>
        ))}
      </tr>
    </tbody>
  )
}

/* -------------------------------------------------------- section data */

function buildSections(columns: Column[]): Section[] {
  // Capability rows follow the server's own rule list, so the two cannot drift.
  const capabilityIds = Array.from(
    new Set(columns.flatMap((c) => c.profile?.functions.capabilities.map((x) => x.id) ?? [])),
  )
  const capabilityMeta = (id: string) =>
    columns.map((c) => c.profile?.functions.capabilities.find((x) => x.id === id)).find(Boolean)

  const glance: Section = {
    id: 'glance',
    title: 'At a glance',
    rows: [
      {
        id: 'concerns',
        label: 'Concerns found',
        hint: 'Counted only from checks that ran',
        better: 'lower',
        value: (p) => tally(p).concerns.length,
        render: (p) => {
          const { concerns, unchecked } = tally(p)
          return (
            <span className="flex flex-col gap-0.5">
              {concerns.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 text-positive">
                  <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                  None
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-negative">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  {concerns.length}
                </span>
              )}
              {concerns.length > 0 ? (
                <span className="text-[11px] leading-snug text-muted">{concerns.join(', ')}</span>
              ) : null}
              {unchecked > 0 ? (
                <span className="text-[11px] text-muted">
                  {unchecked} {unchecked === 1 ? 'check' : 'checks'} could not run
                </span>
              ) : null}
            </span>
          )
        },
      },
      {
        id: 'sellable',
        label: 'Can you sell it?',
        hint: 'We simulate a buy and a sale',
        value: (p) => (p.security.status !== 'ok' ? null : String(p.security.isHoneypot)),
        render: (p) => {
          const s = p.security
          if (s.status !== 'ok') return <Unknown label={securityGap(s.status)} />
          if (s.isHoneypot === true) {
            return (
              <span className="inline-flex items-center gap-1.5 text-negative">
                <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                The test sale failed
              </span>
            )
          }
          if (s.isHoneypot === false && s.simulationOk) {
            return (
              <span className="inline-flex items-center gap-1.5 text-positive">
                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                Yes
              </span>
            )
          }
          return <Unknown />
        },
      },
      {
        id: 'depth-glance',
        label: 'Depth to trade against',
        better: 'higher',
        value: (p) => p.market.liquidityUsd,
        render: (p) => {
          const m = p.market
          if (m.status !== 'ok' || m.liquidityUsd === null) {
            return <Unknown label={marketGap(m.status)} />
          }
          const tone = m.liquidityUsd < 10_000 ? 'bad' : m.liquidityUsd < 50_000 ? 'warn' : 'good'
          return (
            <ToneValue tone={tone}>
              <span className="tabular">{formatUsd(m.liquidityUsd, { compact: true })}</span>
            </ToneValue>
          )
        },
      },
    ],
  }

  const security: Section = {
    id: 'security',
    title: 'Security',
    rows: [
      ...(
        [
          ['Sell fee', 'sellTax', 'Charged when you get out'],
          ['Buy fee', 'buyTax', undefined],
          ['Transfer fee', 'transferTax', undefined],
        ] as Array<[string, 'sellTax' | 'buyTax' | 'transferTax', string | undefined]>
      ).map(([label, field, hint]) => ({
        id: field,
        label,
        hint,
        better: 'lower' as Direction,
        value: (p: TokenProfile) => (p.security.status === 'ok' ? p.security[field] : null),
        render: (p: TokenProfile) => {
          const s = p.security
          if (s.status !== 'ok') return <Unknown label={securityGap(s.status)} />
          const v = s[field]
          if (v === null) return <Unknown />
          const tone = v >= 20 ? 'bad' : v >= 10 ? 'warn' : v > 0 ? 'neutral' : 'good'
          return (
            <ToneValue tone={tone}>
              <span className="tabular">{v.toFixed(v % 1 === 0 ? 0 : 1)}%</span>
            </ToneValue>
          )
        },
      })),
      {
        id: 'flags',
        label: 'Other findings',
        value: (p) => (p.security.status === 'ok' ? p.security.flags.join(',') : null),
        render: (p) => {
          const s = p.security
          if (s.status !== 'ok') return <Unknown label={securityGap(s.status)} />
          if (s.flags.length === 0) {
            return (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <Minus className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                None
              </span>
            )
          }
          return (
            <span className="flex flex-wrap gap-1">
              {s.flags.map((flag) => (
                <span key={flag} className="chip text-[11px]">
                  {flag}
                </span>
              ))}
            </span>
          )
        },
      },
    ],
  }

  const powers: Section = {
    id: 'powers',
    title: 'What the contract can do to you',
    blurb: 'Read from the published code',
    rows: [
      {
        id: 'published',
        label: 'Code published',
        hint: 'Can anyone read what it does?',
        value: (p) => (p.functions.verified === null ? null : String(p.functions.verified)),
        render: (p) => {
          const f = p.functions
          if (f.verified === true) return <ToneValue tone="good">Yes</ToneValue>
          if (f.verified === false) return <ToneValue tone="warn">No</ToneValue>
          return <Unknown label={FUNCTION_GAP[f.status] ?? 'Not checked'} />
        },
      },
      {
        id: 'ownership',
        label: 'Ownership',
        hint: 'Who can change the rules?',
        value: (p) =>
          p.functions.ownershipRenounced === null ? null : String(p.functions.ownershipRenounced),
        render: (p, column) => {
          const f = p.functions
          if (f.ownershipRenounced === true) {
            return <ToneValue tone="good">Given up — nobody controls it</ToneValue>
          }
          if (f.ownerAddress) {
            return (
              <span className="flex flex-col gap-0.5">
                <ToneValue tone="warn">One address controls it</ToneValue>
                <HashRef value={f.ownerAddress} chainId={column.chainId} />
              </span>
            )
          }
          return <Unknown label={FUNCTION_GAP[f.status] ?? 'Not checked'} />
        },
      },
      {
        id: 'contract-type',
        label: 'Contract type',
        hint: 'A proxy can be swapped for different code',
        value: (p) => (p.functions.status !== 'ok' ? null : String(p.functions.isProxy)),
        render: (p, column) => {
          const f = p.functions
          if (f.status !== 'ok') return <Unknown label={FUNCTION_GAP[f.status] ?? 'Not checked'} />
          if (!f.isProxy) return <ToneValue tone="good">Direct — the code is fixed</ToneValue>
          return (
            <span className="flex flex-col gap-0.5">
              <ToneValue tone="warn">Proxy — code can be swapped</ToneValue>
              {f.implementation ? (
                <HashRef value={f.implementation} chainId={column.chainId} />
              ) : null}
            </span>
          )
        },
      },
      ...capabilityIds.map((id) => {
        const meta = capabilityMeta(id)
        return {
          id: `cap-${id}`,
          label: meta?.label ?? id,
          hint: meta?.detail,
          value: (p: TokenProfile) => {
            const cap = p.functions.capabilities.find((x) => x.id === id)
            return cap ? String(cap.present) : null
          },
          render: (p: TokenProfile) => {
            const f = p.functions
            const cap = f.capabilities.find((x) => x.id === id)
            if (!cap) return <Unknown label={FUNCTION_GAP[f.status] ?? 'Not checked'} />
            return <RiskFlag present={cap.present} />
          },
        }
      }),
    ],
  }

  const supply: Section = {
    id: 'supply',
    title: 'Supply and liquidity depth',
    rows: [
      {
        id: 'total-supply',
        label: 'Total supply',
        hint: 'Issued on this network',
        value: (p) => p.supply.totalSupply,
        render: (p) => {
          const s = p.supply
          if (s.status !== 'ok' || s.totalSupply === null) {
            return <Unknown label="Could not read" />
          }
          return (
            <span className="tabular text-secondary" title={s.totalSupply}>
              {compactSupply(s.totalSupply)}
            </span>
          )
        },
      },
      {
        id: 'market-cap',
        label: 'Market cap',
        hint: 'Circulating value across every network',
        value: (p) => p.market.marketCapUsd,
        render: (p) =>
          p.market.marketCapUsd === null ? (
            <Unknown />
          ) : (
            <span className="tabular text-secondary">
              {formatUsd(p.market.marketCapUsd, { compact: true })}
            </span>
          ),
      },
      {
        id: 'fdv',
        label: 'Fully diluted value',
        hint: "This network's supply at today's price",
        value: (p) => p.market.fdvUsd,
        render: (p) =>
          p.market.fdvUsd === null ? (
            <Unknown />
          ) : (
            <span className="tabular text-secondary">
              {formatUsd(p.market.fdvUsd, { compact: true })}
            </span>
          ),
      },
      {
        id: 'pools',
        label: 'Pools',
        better: 'higher',
        value: (p) => (p.market.status === 'ok' ? p.market.pairCount : null),
        render: (p) =>
          p.market.status !== 'ok' ? (
            <Unknown label={marketGap(p.market.status)} />
          ) : (
            <span className="tabular text-secondary">{p.market.pairCount}</span>
          ),
      },
      {
        id: 'concentration',
        label: 'Depth concentration',
        hint: 'One pool holding nearly everything is a single point of failure',
        better: 'lower',
        value: (p) => p.market.topPools[0]?.share ?? null,
        render: (p) => {
          const m = p.market
          if (m.status !== 'ok' || m.topPools.length === 0) {
            return <Unknown label={marketGap(m.status)} />
          }
          const top = m.topPools[0]
          if (top.share === null) return <Unknown />
          const pct = top.share * 100
          return (
            <span className="flex flex-col gap-0.5">
              <ToneValue tone={pct >= 90 ? 'warn' : 'neutral'}>
                <span className="tabular">{pct.toFixed(1)}%</span> in the deepest
              </ToneValue>
              <span className="text-[11px] text-muted">
                {top.pair}
                {top.venue ? ` · ${top.venue}` : ''}
              </span>
            </span>
          )
        },
      },
    ],
  }

  return [glance, security, powers, supply]
}
