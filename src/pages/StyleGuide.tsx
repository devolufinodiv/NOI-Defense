import type { ReactNode } from 'react'
import { PageHeader, SectionHeading } from '@/components/layout/AppShell'
import { Card, CardBody, CardHeader, Eyebrow } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Badge, DeltaPill, MockBadge } from '@/components/ui/Badge'
import { Skeleton, SkeletonRows, SkeletonText } from '@/components/ui/Skeleton'
import { Stat, Quote } from '@/components/ui/Stat'
import { LiveDot, RingDot } from '@/components/ui/LiveDot'
import { HashRef } from '@/components/ui/Address'
import { TokenMark } from '@/components/ui/TokenMark'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { CoinCard } from '@/components/market/CoinCard'
import { BubbleMap } from '@/components/graph/BubbleMap'
import { tokenBrand } from '@/design/tokens'
import { useThemeTokens } from '@/design/useThemeTokens'
import { Copy, Settings2 } from 'lucide-react'
import {
  formatPercent,
  formatRelativeTime,
  formatTokenAmount,
  formatUsd,
  splitQuote,
  toneOf,
} from '@/lib/format'
import { MOCK_GRAPH, MOCK_TOKENS, MOCK_WALLETS, mockSeriesFor, type MockWallet } from '@/mock'
import { missingEnvKeys } from '@/config/env'
import { CHAIN_LIST, defaultChainMeta, rpcSource } from '@/config/chains'

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="scroll-mt-24">
      <SectionHeading eyebrow={note ? <Eyebrow>{note}</Eyebrow> : undefined} title={title} />
      {children}
    </section>
  )
}

/** Swatches read the *resolved* palette, so this page documents whichever
 *  mode you are actually looking at. */
function swatches(c: ReturnType<typeof useThemeTokens>['color']) {
  return [
    { name: 'bg-base', hex: c.base, note: 'Page ground' },
    { name: 'bg-surface', hex: c.surface, note: 'Sidebar, top bar' },
    { name: 'bg-card', hex: c.card, note: 'Cards, panels' },
    { name: 'bg-raised', hex: c.raised, note: 'Hover, inputs, chips' },
    { name: 'border-hairline', hex: c.border, note: 'Separators' },
    { name: 'accent', hex: c.accent, note: 'Primary action' },
    { name: 'accent-text', hex: c.accentText, note: 'Accent as text' },
    { name: 'positive', hex: c.positive, note: 'Gain only' },
    { name: 'negative', hex: c.negative, note: 'Loss only' },
    { name: 'warning', hex: c.warning, note: 'Caution only' },
    { name: 'text-primary', hex: c.textPrimary, note: 'Body' },
    { name: 'text-muted', hex: c.textMuted, note: 'Tertiary · 4.7:1 min' },
  ]
}

const walletColumns: Array<Column<MockWallet>> = [
  {
    key: 'address',
    header: 'Wallet',
    render: (wallet) => <HashRef value={wallet.address} to={`/wallet/${wallet.address}`} />,
  },
  {
    key: 'tags',
    header: 'Tags',
    hideOnMobile: true,
    render: (wallet) => (
      <div className="flex flex-wrap gap-1.5">
        {wallet.tags.map((tag) => (
          <Badge key={tag} tone={tag === 'flagged' ? 'negative' : 'neutral'}>
            {tag}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    key: 'balance',
    header: 'Balance',
    align: 'right',
    sortValue: (wallet) => wallet.balanceRaw,
    render: (wallet) => (
      <span className="tabular font-medium text-primary">
        {formatTokenAmount(wallet.balanceRaw, wallet.balanceDecimals)}{' '}
        <span className="font-normal text-muted">ETH</span>
      </span>
    ),
  },
  {
    key: 'pnl',
    header: 'Realised P&L',
    align: 'right',
    sortValue: (wallet) => wallet.realisedPnlUsd,
    render: (wallet) => {
      const tone = toneOf(wallet.realisedPnlUsd)
      return (
        <span
          className={`tabular font-medium ${tone === 'positive' ? 'text-positive' : 'text-negative'}`}
        >
          {wallet.realisedPnlUsd > 0 ? '+' : ''}
          {formatUsd(wallet.realisedPnlUsd, { compact: true })}
        </span>
      )
    },
  },
  {
    key: 'winrate',
    header: 'Win rate',
    align: 'right',
    hideOnMobile: true,
    sortValue: (wallet) => wallet.winRate,
    render: (wallet) => (
      <span className="tabular text-secondary">{formatPercent(wallet.winRate)}</span>
    ),
  },
  {
    key: 'seen',
    header: 'Last seen',
    align: 'right',
    hideOnMobile: true,
    sortValue: (wallet) => wallet.lastActiveUnix,
    render: (wallet) => (
      <span className="tabular text-secondary">{formatRelativeTime(wallet.lastActiveUnix)}</span>
    ),
  },
]

export function StyleGuide() {
  const missing = missingEnvKeys()
  const { color, mode } = useThemeTokens()
  const SWATCHES = swatches(color)
  const demoQuote = splitQuote(109_687.64)
  const token = MOCK_TOKENS[0]

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>System</Eyebrow>}
        title="Style guide"
        subtitle={`The component and token reference for NOI Defense. Showing the ${mode} palette — every surface pairing in both modes is verified at 4.5:1 or better.`}
        actions={<MockBadge />}
      />

      <div className="space-y-12 px-4 pb-16 pt-4 md:px-8">
        <Section title="Colour" note="Green, red and amber are semantic — never decorative">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SWATCHES.map((swatch) => (
              <Card key={swatch.name}>
                <div className="h-16 border-b border-hairline" style={{ backgroundColor: swatch.hex }} />
                <div className="p-3">
                  <div className="truncate text-xs font-medium text-primary">{swatch.name}</div>
                  <div className="tabular mt-0.5 font-mono text-2xs uppercase text-muted">
                    {swatch.hex}
                  </div>
                  <div className="mt-1.5 text-2xs text-muted">{swatch.note}</div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Token identity" note="Brand colour is identity only, never gain/loss">
          <Card>
            <CardBody className="flex flex-wrap items-center gap-5">
              {Object.keys(tokenBrand)
                .filter((key) => key !== 'DEFAULT')
                .map((symbol) => (
                  <div key={symbol} className="flex items-center gap-2.5">
                    <TokenMark symbol={symbol} />
                    <span className="text-sm text-secondary">{symbol}</span>
                  </div>
                ))}
            </CardBody>
          </Card>
        </Section>

        <Section title="Typography" note="Inter throughout · JetBrains Mono for hex only">
          <Card>
            <CardBody className="space-y-6">
              <div>
                <div className="text-xs text-muted">Display · 52px · tracking -0.035em</div>
                <p className="mt-2 text-display font-semibold tracking-tightest text-primary">
                  Live wallet intelligence
                </p>
              </div>
              <div>
                <div className="text-xs text-muted">Quote · 34px · tabular, muted decimals</div>
                <div className="mt-2">
                  <Quote whole={demoQuote.whole} fraction={demoQuote.fraction} />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">Body · 14px · leading-relaxed</div>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-secondary">
                  Body copy runs at a generous line height so long-form findings stay readable
                  against the tight display headings above it.
                </p>
              </div>
              <div>
                <div className="text-xs text-muted">Tabular figures — columns must align</div>
                <p className="tabular mt-2 text-sm text-primary">1,204,551.00 · 0.00612 · 41.82%</p>
                <p className="tabular text-sm text-primary">1,111,111.11 · 0.99999 · 11.11%</p>
              </div>
            </CardBody>
          </Card>
        </Section>

        <Section title="Buttons" note="One filled accent per view">
          <Card>
            <CardBody className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Run scan</Button>
              <Button variant="secondary">Add to watchlist</Button>
              <Button variant="subtle">All</Button>
              <Button variant="danger">Flag wallet</Button>
              <Button variant="ghost">Dismiss</Button>
              <Button variant="primary" size="sm">
                Small
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <IconButton aria-label="Copy value">
                <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />
              </IconButton>
              <IconButton aria-label="Open settings">
                <Settings2 className="h-4 w-4" strokeWidth={2} aria-hidden />
              </IconButton>
            </CardBody>
          </Card>
        </Section>

        <Section title="Quote cards" note="Brand rail · delta pill carries arrow, sign and colour">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {MOCK_TOKENS.slice(0, 3).map((t) => (
              <CoinCard
                key={t.address}
                symbol={t.symbol}
                name={t.name}
                pair={`${t.symbol}/USD`}
                priceUsd={t.priceUsd}
                change24h={t.change24h}
                series={mockSeriesFor(t.symbol, t.change24h)}
                to={`/token/${t.address}`}
              />
            ))}
          </div>
        </Section>

        <Section title="Status & metrics">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader title="Metrics" subtitle="Tabular, no reflow on tick" />
              <CardBody className="grid grid-cols-2 gap-6 pt-4">
                <Stat label="Holders" value="412,883" />
                <Stat label="Events" value="6" flash />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Loss state" subtitle="Red is reserved for this" />
              <CardBody className="grid grid-cols-2 gap-6 pt-4">
                <Stat
                  label="Realised P&L"
                  value={formatUsd(-91_442.77, { compact: true })}
                  tone="negative"
                />
                <Stat label="Win rate" value="22.80%" tone="negative" />
              </CardBody>
            </Card>
            <Card interactive>
              <CardHeader title="Interactive" subtitle="Hover to lift" action={<LiveDot />} />
              <CardBody className="flex flex-wrap items-center gap-2 pt-4">
                <DeltaPill value={1.09} />
                <DeltaPill value={-2.01} />
                <Badge tone="accent">smart-money</Badge>
                <Badge>sniper</Badge>
                <Badge tone="warning">caution</Badge>
                <Badge tone="negative">flagged</Badge>
                <span className="flex items-center gap-2">
                  <RingDot />
                  <span className="text-xs text-muted">2 min ago</span>
                </span>
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section title="On-chain identifiers" note="Always mono, truncated, copy + explorer">
          <Card>
            <CardBody className="space-y-4">
              {[
                { label: 'Address', value: MOCK_WALLETS[0].address, kind: 'address' as const },
                { label: 'Token', value: token.address, kind: 'token' as const },
                {
                  label: 'Tx hash',
                  value: '0x8d8eb1146cedb4da9bb68f9f7ab5144b991ab269ecf1bf02827984bd38e8de42',
                  kind: 'tx' as const,
                },
              ].map((row) => (
                <div key={row.label} className="flex flex-wrap items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-muted">{row.label}</span>
                  <HashRef value={row.value} kind={row.kind} />
                </div>
              ))}
              <p className="border-t border-hairline pt-4 text-xs leading-relaxed text-muted">
                Prices are set in Inter with tabular figures, but hex stays monospace — truncated
                addresses must read as code and be eyeball-matchable character by character.
              </p>
            </CardBody>
          </Card>
        </Section>

        <Section title="Amount formatting" note="bigint in, string out — no float touches a token amount">
          <Card>
            <CardBody className="space-y-3 text-xs">
              <div className="flex items-baseline justify-between gap-2 text-2xs uppercase tracking-label text-muted">
                <span>Case</span>
                <span className="hidden sm:inline">Raw base units</span>
                <span>Exact</span>
                <span>Compact</span>
              </div>
              {[
                { raw: 4_182_940_113_772_004_881n, d: 18, label: '18 decimals' },
                { raw: 918_774_002_004_118_990_442_118n, d: 18, label: 'Large supply' },
                { raw: 4_182_004_119n, d: 6, label: 'USDC (6 dp)' },
                { raw: 1n, d: 18, label: '1 wei (dust)' },
                { raw: 0n, d: 18, label: 'Zero' },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline pb-3 last:border-0 last:pb-0"
                >
                  <span className="text-secondary">{row.label}</span>
                  <span className="tabular hidden font-mono text-muted sm:inline">
                    {row.raw.toString()}
                  </span>
                  <span className="tabular font-medium text-primary">
                    {formatTokenAmount(row.raw, row.d)}
                  </span>
                  <span className="tabular text-accent-text">
                    {formatTokenAmount(row.raw, row.d, { compact: true })}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        </Section>

        <Section title="Data table" note="Sortable headers announce aria-sort · scrolls, never wraps">
          <Card className="overflow-hidden">
            <DataTable
              columns={walletColumns}
              rows={MOCK_WALLETS}
              rowKey={(wallet) => wallet.address}
            />
          </Card>
        </Section>

        <Section title="Bubble map" note="react-force-graph-2d · canvas, drawn with our own tokens">
          <Card>
            <CardHeader title="Counterparty graph" subtitle="Drag and zoom · labels appear when zoomed" />
            <CardBody className="p-2">
              <BubbleMap nodes={MOCK_GRAPH.nodes} links={MOCK_GRAPH.links} />
            </CardBody>
          </Card>
        </Section>

        <Section title="Loading">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Blocks" />
              <CardBody className="space-y-3 pt-4">
                <Skeleton className="h-9 w-full" />
                <SkeletonText width="w-2/3" />
                <SkeletonText width="w-1/2" />
                <div className="flex gap-3">
                  <Skeleton className="h-20 flex-1 rounded-lg" />
                  <Skeleton className="h-20 flex-1 rounded-lg" />
                </div>
              </CardBody>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader title="Table rows" className="pb-4" />
              <SkeletonRows rows={4} />
            </Card>
          </div>
        </Section>

        <Section title="Environment" note="Reads .env.local — nothing is hardcoded">
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-secondary">Supported chains</span>
                <span className="tabular text-sm font-medium text-primary">
                  {CHAIN_LIST.length} · default {defaultChainMeta.label}
                </span>
              </div>
              {missing.length === 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-secondary">Keys</span>
                  <Badge tone="positive">All configured</Badge>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-secondary">Not configured</span>
                    <Badge tone="warning">{missing.length} missing</Badge>
                  </div>
                  <ul className="space-y-1.5 border-t border-hairline pt-3">
                    {missing.map((key) => (
                      <li key={key} className="font-mono text-xs text-muted">
                        {key}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs leading-relaxed text-muted">
                    Copy <span className="font-mono text-secondary">.env.example</span> to{' '}
                    <span className="font-mono text-secondary">.env.local</span> and fill these in.
                    The app runs without them; live data does not.
                  </p>
                </>
              )}

              {/* Which RPC each chain actually resolves to. Without this the
                  override chain is invisible until something silently reads the
                  wrong network. */}
              <div className="border-t border-hairline pt-3">
                <h4 className="text-2xs uppercase tracking-label text-muted">RPC per chain</h4>
                <ul className="mt-2 space-y-1">
                  {CHAIN_LIST.map((meta) => {
                    const source = rpcSource(meta)
                    return (
                      <li
                        key={meta.chain.id}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="text-secondary">
                          {meta.label}{' '}
                          <span className="tabular font-mono text-muted">{meta.chain.id}</span>
                        </span>
                        <Badge
                          tone={
                            source === 'override'
                              ? 'positive'
                              : source === 'alchemy'
                                ? 'accent'
                                : 'neutral'
                          }
                        >
                          {source === 'public' ? 'public RPC' : source}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </CardBody>
          </Card>
        </Section>
      </div>
    </>
  )
}
