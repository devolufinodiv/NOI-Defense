import type { ReactNode } from 'react'
import { Check, Minus, TriangleAlert, X } from 'lucide-react'
import { TokenMark } from '@/components/ui/TokenMark'
import { HashRef } from '@/components/ui/Address'
import { chainMeta } from '@/config/chains'
import { formatPercent, formatUsd, truncateAddress } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { TokenProfile } from './queries'

/**
 * The comparison grid: four sections, one column per token.
 *
 * Rows are the unit of meaning here, so the table is built row-first — every
 * row states one fact about each token, and a token we could not read that fact
 * for prints "Not checked" instead of borrowing a neighbour's blank.
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

/**
 * Compact label for a uint256 amount held as a decimal string.
 *
 * Works on the digits directly rather than going through Number: a supply like
 * PEPE's 420,689,899,645,288 exceeds what a float can hold exactly, and this
 * label sits next to the exact figure in the title attribute.
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
      const intPart = digits.slice(0, head)
      const frac = digits.slice(head, head + 2).replace(/0+$/, '')
      return frac ? `${intPart}.${frac}${suffix}` : `${intPart}${suffix}`
    }
  }
  return digits
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
    <span className="inline-flex items-center gap-1 text-negative">
      <TriangleAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-positive">
      <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
      No
    </span>
  )
}

function SectionRow({
  label,
  hint,
  cells,
  columns,
}: {
  label: string
  hint?: string
  columns: Column[]
  cells: (column: Column) => ReactNode
}) {
  return (
    <tr className="border-t border-hairline align-top">
      <th scope="row" className="sticky left-0 z-10 bg-card py-2.5 pr-4 text-left font-normal">
        <span className="block text-xs text-secondary">{label}</span>
        {hint ? <span className="block text-[11px] text-muted">{hint}</span> : null}
      </th>
      {columns.map((column) => (
        <td key={column.key} className="px-4 py-2.5 text-xs">
          {column.isLoading ? (
            <span className="block h-3 w-16 animate-pulse rounded bg-raised" />
          ) : column.error || !column.profile ? (
            <Unknown label="Failed to load" />
          ) : (
            cells(column)
          )}
        </td>
      ))}
    </tr>
  )
}

function SectionHeadRow({ title, span }: { title: string; span: number }) {
  return (
    <tr>
      <td colSpan={span} className="border-t border-hairline-strong pb-1 pt-6">
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{title}</span>
      </td>
    </tr>
  )
}

const FUNCTION_GAP: Record<string, string> = {
  'not-configured': 'Not set up yet',
  unverified: 'Code not published',
  'chain-unindexed': 'Not available here',
  failed: 'Could not read',
}

export function CompareTable({ columns }: { columns: Column[] }) {
  const span = columns.length + 1

  // The capability rows come from the response so the list stays in step with
  // the server's rules; fall back to a fixed order when nothing loaded yet.
  const capabilityIds = Array.from(
    new Set(
      columns.flatMap((c) => c.profile?.functions.capabilities.map((cap) => cap.id) ?? []),
    ),
  )
  const capabilityLabel = (id: string) =>
    columns
      .map((c) => c.profile?.functions.capabilities.find((cap) => cap.id === id))
      .find(Boolean)

  const windows: Array<'5m' | '1h' | '6h' | '24h'> = ['5m', '1h', '6h', '24h']

  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">
          Side-by-side comparison of contract functions, timeframe stats, tokenomics, liquidity
          depth and security
        </caption>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-44 bg-card px-4 py-4" />
            {columns.map((column) => {
              const chain = chainMeta(column.chainId)
              const symbol = column.profile?.token.symbol || ''
              return (
                <th key={column.key} scope="col" className="px-4 py-4 text-left align-bottom">
                  <span className="flex items-center gap-2">
                    <TokenMark symbol={symbol || '?'} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-primary">
                        {symbol || truncateAddress(column.address)}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {chain?.label ?? `Chain ${column.chainId}`}
                      </span>
                    </span>
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {/* ── Contract functions ─────────────────────────────────────── */}
          <SectionHeadRow title="Contract functions" span={span} />

          <SectionRow
            label="Code published"
            hint="Can anyone read what it does?"
            columns={columns}
            cells={(c) => {
              const f = c.profile!.functions
              if (f.verified === true) return <ToneValue tone="good">Yes</ToneValue>
              if (f.verified === false) return <ToneValue tone="warn">No</ToneValue>
              return <Unknown label={FUNCTION_GAP[f.status] ?? 'Not checked'} />
            }}
          />

          <SectionRow
            label="Ownership"
            hint="Who can change the rules?"
            columns={columns}
            cells={(c) => {
              const f = c.profile!.functions
              if (f.ownershipRenounced === true) {
                return <ToneValue tone="good">Given up — nobody controls it</ToneValue>
              }
              if (f.ownerAddress) {
                return (
                  <span className="flex flex-col gap-0.5">
                    <ToneValue tone="warn">Controlled by one address</ToneValue>
                    <HashRef value={f.ownerAddress} chainId={c.chainId} />
                  </span>
                )
              }
              return <Unknown label={FUNCTION_GAP[f.status] ?? 'Not checked'} />
            }}
          />

          <SectionRow
            label="Contract type"
            hint="A proxy can be swapped for different code later"
            columns={columns}
            cells={(c) => {
              const f = c.profile!.functions
              if (f.status !== 'ok') return <Unknown label={FUNCTION_GAP[f.status] ?? 'Not checked'} />
              if (!f.isProxy) return <ToneValue tone="good">Direct — the code is fixed</ToneValue>
              return (
                <span className="flex flex-col gap-0.5">
                  <ToneValue tone="warn">Proxy — code can be swapped</ToneValue>
                  {f.implementation ? (
                    <HashRef value={f.implementation} chainId={c.chainId} />
                  ) : null}
                </span>
              )
            }}
          />

          <SectionRow
            label="Functions in the contract"
            hint="Counted through the proxy where there is one"
            columns={columns}
            cells={(c) => {
              const count = c.profile!.functions.functionCount
              return count === null ? (
                <Unknown label={FUNCTION_GAP[c.profile!.functions.status] ?? 'Not checked'} />
              ) : (
                <span className="tabular text-secondary">{count}</span>
              )
            }}
          />

          {capabilityIds.map((id) => {
            const meta = capabilityLabel(id)
            return (
              <SectionRow
                key={id}
                label={meta?.label ?? id}
                hint={meta?.detail}
                columns={columns}
                cells={(c) => {
                  const f = c.profile!.functions
                  const cap = f.capabilities.find((x) => x.id === id)
                  if (!cap) return <Unknown label={FUNCTION_GAP[f.status] ?? 'Not checked'} />
                  return <RiskFlag present={cap.present} />
                }}
              />
            )
          })}

          {/* ── Timeframe stats ────────────────────────────────────────── */}
          <SectionHeadRow title="Timeframe stats" span={span} />

          {windows.map((window) => (
            <SectionRow
              key={window}
              label={`${window} price change`}
              columns={columns}
              cells={(c) => {
                const m = c.profile!.market
                if (m.status !== 'ok') return <Unknown label={marketGap(m.status)} />
                const w = m.windows.find((x) => x.window === window)
                if (!w || w.priceChange === null) return <Unknown label="Not reported" />
                return (
                  <ToneValue tone={w.priceChange >= 0 ? 'good' : 'bad'}>
                    <span className="tabular">{formatPercent(w.priceChange, { signed: true })}</span>
                  </ToneValue>
                )
              }}
            />
          ))}

          {windows.map((window) => (
            <SectionRow
              key={`${window}-vol`}
              label={`${window} volume`}
              hint={window === '5m' ? 'Traded value across every pool' : undefined}
              columns={columns}
              cells={(c) => {
                const m = c.profile!.market
                if (m.status !== 'ok') return <Unknown label={marketGap(m.status)} />
                const w = m.windows.find((x) => x.window === window)
                if (!w || w.volumeUsd === null) return <Unknown label="Not reported" />
                return (
                  <span className="tabular text-secondary">
                    {formatUsd(w.volumeUsd, { compact: true })}
                  </span>
                )
              }}
            />
          ))}

          <SectionRow
            label="24h buys / sells"
            hint="More sells than buys means people are leaving"
            columns={columns}
            cells={(c) => {
              const m = c.profile!.market
              if (m.status !== 'ok') return <Unknown label={marketGap(m.status)} />
              const w = m.windows.find((x) => x.window === '24h')
              if (!w || w.buys === null || w.sells === null) return <Unknown />
              return (
                <span className="tabular">
                  <ToneValue tone={w.buys >= w.sells ? 'good' : 'warn'}>
                    {w.buys.toLocaleString('en-US')} / {w.sells.toLocaleString('en-US')}
                  </ToneValue>
                </span>
              )
            }}
          />

          {/* ── Tokenomics and liquidity depth ─────────────────────────── */}
          <SectionHeadRow title="Tokenomics and liquidity depth" span={span} />

          <SectionRow
            label="Total supply"
            hint="Issued on this network"
            columns={columns}
            cells={(c) => {
              const s = c.profile!.supply
              if (s.status !== 'ok' || s.totalSupply === null) {
                return <Unknown label="Could not read" />
              }
              return (
                <span className="tabular text-secondary" title={s.totalSupply}>
                  {compactSupply(s.totalSupply)}
                </span>
              )
            }}
          />

          <SectionRow
            label="Market cap"
            hint="Circulating value across every network"
            columns={columns}
            cells={(c) => {
              const m = c.profile!.market
              if (m.marketCapUsd === null) return <Unknown />
              return (
                <span className="tabular text-secondary">
                  {formatUsd(m.marketCapUsd, { compact: true })}
                </span>
              )
            }}
          />

          <SectionRow
            label="Fully diluted value"
            hint="This network's supply, valued at today's price"
            columns={columns}
            cells={(c) => {
              const m = c.profile!.market
              if (m.fdvUsd === null) return <Unknown />
              return (
                <span className="tabular text-secondary">
                  {formatUsd(m.fdvUsd, { compact: true })}
                </span>
              )
            }}
          />

          <SectionRow
            label="Liquidity depth"
            hint="What you can actually trade against"
            columns={columns}
            cells={(c) => {
              const m = c.profile!.market
              if (m.status !== 'ok' || m.liquidityUsd === null) {
                return <Unknown label={marketGap(m.status)} />
              }
              const tone = m.liquidityUsd < 10_000 ? 'bad' : m.liquidityUsd < 50_000 ? 'warn' : 'good'
              return (
                <ToneValue tone={tone}>
                  <span className="tabular">{formatUsd(m.liquidityUsd, { compact: true })}</span>
                </ToneValue>
              )
            }}
          />

          <SectionRow
            label="Pools"
            columns={columns}
            cells={(c) => {
              const m = c.profile!.market
              if (m.status !== 'ok') return <Unknown label={marketGap(m.status)} />
              return <span className="tabular text-secondary">{m.pairCount}</span>
            }}
          />

          <SectionRow
            label="Depth concentration"
            hint="One pool holding nearly everything is a single point of failure"
            columns={columns}
            cells={(c) => {
              const m = c.profile!.market
              if (m.status !== 'ok' || m.topPools.length === 0) {
                return <Unknown label={marketGap(m.status)} />
              }
              const top = m.topPools[0]
              if (top.share === null) return <Unknown />
              const pct = top.share * 100
              return (
                <span className="flex flex-col gap-0.5">
                  <ToneValue tone={pct >= 90 ? 'warn' : 'neutral'}>
                    <span className="tabular">{pct.toFixed(1)}%</span> in the deepest pool
                  </ToneValue>
                  <span className="text-[11px] text-muted">
                    {top.pair}
                    {top.venue ? ` · ${top.venue}` : ''}
                  </span>
                </span>
              )
            }}
          />

          {/* ── Security ───────────────────────────────────────────────── */}
          <SectionHeadRow title="Security" span={span} />

          <SectionRow
            label="Test sale"
            hint="We simulate buying and selling"
            columns={columns}
            cells={(c) => {
              const s = c.profile!.security
              if (s.status !== 'ok') return <Unknown label={securityGap(s.status)} />
              if (s.isHoneypot === true) {
                return (
                  <span className="inline-flex items-center gap-1 text-negative">
                    <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                    Failed — you may not be able to sell
                  </span>
                )
              }
              if (s.isHoneypot === false && s.simulationOk) {
                return (
                  <span className="inline-flex items-center gap-1 text-positive">
                    <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                    Passed
                  </span>
                )
              }
              return <Unknown />
            }}
          />

          {(
            [
              ['Buy fee', 'buyTax'],
              ['Sell fee', 'sellTax'],
              ['Transfer fee', 'transferTax'],
            ] as Array<[string, 'buyTax' | 'sellTax' | 'transferTax']>
          ).map(([label, field]) => (
            <SectionRow
              key={field}
              label={label}
              columns={columns}
              cells={(c) => {
                const s = c.profile!.security
                if (s.status !== 'ok') return <Unknown label={securityGap(s.status)} />
                const value = s[field]
                if (value === null) return <Unknown />
                const tone = value >= 20 ? 'bad' : value >= 10 ? 'warn' : value > 0 ? 'neutral' : 'good'
                return (
                  <ToneValue tone={tone}>
                    <span className="tabular">{value.toFixed(value % 1 === 0 ? 0 : 1)}%</span>
                  </ToneValue>
                )
              }}
            />
          ))}

          <SectionRow
            label="Other findings"
            columns={columns}
            cells={(c) => {
              const s = c.profile!.security
              if (s.status !== 'ok') return <Unknown label={securityGap(s.status)} />
              if (s.flags.length === 0) {
                return (
                  <span className="inline-flex items-center gap-1 text-muted">
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
            }}
          />
        </tbody>
      </table>
    </div>
  )
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
