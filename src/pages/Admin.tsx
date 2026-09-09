import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  CircleSlash,
  Coins,
  Database,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { PageHeader, SectionHeading } from '@/components/layout/AppShell'
import { Card, CardBody, CardHeader, Eyebrow } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { HashRef } from '@/components/ui/Address'
import { TokenMark } from '@/components/ui/TokenMark'
import { ChainMark } from '@/components/ui/ChainMark'
import { LiveDot } from '@/components/ui/LiveDot'
import { PriceChart } from '@/components/charts/PriceChart'
import { formatRelativeTime, truncateAddress } from '@/lib/format'
import { chainMeta } from '@/config/chains'
import { isAuthConfigured } from '@/lib/supabase'
import { useAuth } from '@/store/auth'
import {
  useActivityDaily,
  useAdminOverview,
  useAdminUsers,
  useIsAdmin,
  useRecentActivity,
  useTopSubjects,
  type ActivityRow,
  type AdminUser,
  type TopSubject,
} from '@/features/admin/queries'

const KIND_LABEL: Record<string, string> = {
  sign_in: 'Signed in',
  page_view: 'Page view',
  search: 'Search',
  token_scan: 'Token scan',
  wallet_trace: 'Wallet trace',
  index_request: 'Index request',
  watchlist_add: 'Watchlist add',
  watchlist_remove: 'Watchlist remove',
}

function Metric({
  label,
  value,
  sub,
  icon,
  tone,
  loading,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  tone?: 'positive' | 'negative' | 'warning'
  loading: boolean
}) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-hairline bg-raised text-muted">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted">{label}</div>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <div
              className={`tabular mt-1 text-2xl font-semibold tracking-tightest ${
                tone === 'negative'
                  ? 'text-negative'
                  : tone === 'warning'
                    ? 'text-warning'
                    : tone === 'positive'
                      ? 'text-positive'
                      : 'text-primary'
              }`}
            >
              {typeof value === 'number' ? value.toLocaleString('en-US') : value}
            </div>
          )}
          {sub ? <div className="mt-0.5 text-2xs text-muted">{sub}</div> : null}
        </div>
      </CardBody>
    </Card>
  )
}

function topColumns(kind: 'token' | 'wallet'): Array<Column<TopSubject>> {
  return [
    {
      key: 'rank',
      header: '#',
      width: '52px',
      render: (_row, index) => <span className="tabular text-xs text-muted">{index + 1}</span>,
    },
    {
      key: 'subject',
      header: kind === 'token' ? 'Token' : 'Wallet',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          {kind === 'token' ? (
            <TokenMark symbol={row.symbol || '??'} size="sm" />
          ) : (
            <ChainMark chainId={row.chain_id} />
          )}
          <Link
            to={`/${kind}/${row.subject}?chain=${row.chain_id}`}
            className="-my-2 min-w-0 py-2"
          >
            <span className="block truncate text-sm text-primary">
              {row.symbol || truncateAddress(row.subject)}
            </span>
            {row.name ? (
              <span className="block truncate text-2xs text-muted">{row.name}</span>
            ) : null}
          </Link>
        </div>
      ),
    },
    {
      key: 'chain',
      header: 'Chain',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-secondary">{chainMeta(row.chain_id)?.label ?? row.chain_id}</span>
      ),
    },
    {
      key: 'scans',
      header: 'Scans',
      align: 'right',
      sortValue: (row) => row.scans,
      render: (row) => (
        <span className="tabular text-sm font-medium text-primary">{row.scans}</span>
      ),
    },
    {
      key: 'people',
      header: 'People',
      align: 'right',
      hideOnMobile: true,
      sortValue: (row) => row.unique_users,
      render: (row) => <span className="tabular text-sm text-secondary">{row.unique_users}</span>,
    },
    {
      key: 'last',
      header: 'Last',
      align: 'right',
      hideOnMobile: true,
      sortValue: (row) => row.last_seen,
      render: (row) => (
        <span className="tabular text-xs text-muted">
          {formatRelativeTime(Math.floor(new Date(row.last_seen).getTime() / 1000))}
        </span>
      ),
    },
  ]
}

const userColumns: Array<Column<AdminUser>> = [
  {
    key: 'user',
    header: 'User',
    render: (row) => (
      <div className="flex min-w-0 items-center gap-2.5">
        {row.avatar_url ? (
          <img src={row.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full" />
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised text-2xs font-semibold text-secondary">
            {(row.full_name ?? row.email ?? '?').slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm text-primary">{row.full_name ?? '—'}</div>
          <div className="truncate text-2xs text-muted">{row.email ?? '—'}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Role',
    render: (row) => (
      <Badge tone={row.role === 'admin' ? 'accent' : 'neutral'}>{row.role}</Badge>
    ),
  },
  {
    key: 'scans',
    header: 'Scans',
    align: 'right',
    sortValue: (row) => row.scans,
    render: (row) => <span className="tabular text-sm text-primary">{row.scans}</span>,
  },
  {
    key: 'events',
    header: 'Events',
    align: 'right',
    hideOnMobile: true,
    sortValue: (row) => row.events,
    render: (row) => <span className="tabular text-sm text-secondary">{row.events}</span>,
  },
  {
    key: 'watchlist',
    header: 'Watching',
    align: 'right',
    hideOnMobile: true,
    sortValue: (row) => row.watchlist,
    render: (row) => <span className="tabular text-sm text-secondary">{row.watchlist}</span>,
  },
  {
    key: 'joined',
    header: 'Joined',
    align: 'right',
    hideOnMobile: true,
    sortValue: (row) => row.created_at,
    render: (row) => (
      <span className="tabular text-xs text-muted">
        {formatRelativeTime(Math.floor(new Date(row.created_at).getTime() / 1000))}
      </span>
    ),
  },
]

function ActivityFeed({ rows, loading }: { rows?: ActivityRow[]; loading: boolean }) {
  if (loading || !rows) return <SkeletonRows rows={6} />
  if (rows.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-muted">No activity recorded yet.</div>
  }

  return (
    <ul className="divide-y divide-hairline">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3 px-5 py-3">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-primary">{KIND_LABEL[row.kind] ?? row.kind}</span>
              <span className="text-xs text-muted">
                {row.is_anonymous ? 'Anonymous' : row.actor}
              </span>
            </span>
            {row.subject ? (
              <span className="mt-1 flex items-center gap-2">
                {row.chain_id ? <ChainMark chainId={row.chain_id} size="xs" /> : null}
                <HashRef
                  value={row.subject}
                  kind={row.subject_kind === 'wallet' ? 'address' : 'token'}
                  chainId={row.chain_id ?? undefined}
                  hideExplorer
                />
              </span>
            ) : row.path ? (
              <span className="mt-0.5 block truncate font-mono text-2xs text-muted">{row.path}</span>
            ) : null}
          </span>
          <span className="tabular shrink-0 text-xs text-muted">
            {formatRelativeTime(Math.floor(new Date(row.created_at).getTime() / 1000))}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Denied({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <>
      <PageHeader eyebrow={<Eyebrow>Admin</Eyebrow>} title="Admin" />
      <div className="w-full px-4 pb-16 sm:px-6 md:px-8">
        <Card className="mx-auto max-w-xl">
          <div className="flex flex-col items-start gap-4 p-8">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-hairline bg-raised text-muted">
              <CircleSlash className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="text-xl font-semibold tracking-heading text-primary">{title}</h2>
            <div className="text-sm leading-relaxed text-secondary">{body}</div>
          </div>
        </Card>
      </div>
    </>
  )
}

export function Admin() {
  const { user } = useAuth()
  const { isAdmin, loading } = useIsAdmin()
  const [days, setDays] = useState(7)

  const overview = useAdminOverview(isAdmin)
  const topTokens = useTopSubjects('token', days, isAdmin)
  const topWallets = useTopSubjects('wallet', days, isAdmin)
  const daily = useActivityDaily(14, isAdmin)
  const recent = useRecentActivity(isAdmin)
  const users = useAdminUsers(isAdmin)

  if (!isAuthConfigured) {
    return (
      <Denied
        title="Supabase is not configured"
        body="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to use the admin dashboard."
      />
    )
  }
  if (!user) {
    return <Denied title="Sign in required" body="Sign in with Google to continue." />
  }
  if (loading) {
    return (
      <>
        <PageHeader eyebrow={<Eyebrow>Admin</Eyebrow>} title="Admin" />
        <div className="w-full px-4 pb-16 sm:px-6 md:px-8">
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </>
    )
  }
  if (!isAdmin) {
    return (
      <Denied
        title="Admin only"
        body={
          <>
            This account does not have the admin role. Ask an existing admin to grant it — the
            server rejects these queries regardless of what the interface shows.
          </>
        }
      />
    )
  }

  // The activity chart reuses the price chart, which takes unix seconds.
  const series = (daily.data ?? []).map((point) => ({
    t: Math.floor(new Date(point.day).getTime() / 1000),
    usd: point.events,
  }))

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">
              <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
              Admin
            </span>
            <span className="chip">
              <LiveDot />
              Refreshing every 30s
            </span>
          </div>
        }
        title="Operations"
        subtitle="Users, scans and indexing health across every chain."
      />

      <div className="w-full space-y-8 px-4 pb-16 sm:px-6 md:px-8 xl:px-10">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Total users"
            value={overview.data?.users_total ?? 0}
            sub={`${overview.data?.users_new_7d ?? 0} new this week`}
            icon={<Users className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
            loading={overview.isLoading}
          />
          <Metric
            label="Active (24h)"
            value={overview.data?.active_users_24h ?? 0}
            sub={`+ ${overview.data?.anon_sessions_24h ?? 0} anonymous sessions`}
            icon={<Activity className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
            loading={overview.isLoading}
          />
          <Metric
            label="Scans (24h)"
            value={overview.data?.scans_24h ?? 0}
            sub={`${overview.data?.events_24h ?? 0} events total`}
            icon={<Coins className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
            loading={overview.isLoading}
          />
          <Metric
            label="Indexing queue"
            value={`${overview.data?.jobs_pending ?? 0} / ${overview.data?.jobs_running ?? 0}`}
            sub={`${overview.data?.tokens_indexed ?? 0} tokens ready · ${overview.data?.jobs_failed_24h ?? 0} failed 24h`}
            icon={<Database className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
            tone={(overview.data?.jobs_failed_24h ?? 0) > 0 ? 'negative' : undefined}
            loading={overview.isLoading}
          />
        </section>

        <section>
          <SectionHeading eyebrow={<Eyebrow>Last 14 days</Eyebrow>} title="Activity" />
          <Card>
            <CardBody className="pl-1 pr-3">
              {daily.isLoading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : series.length ? (
                <PriceChart data={series} tone="neutral" />
              ) : (
                <div className="grid h-[220px] place-items-center text-sm text-muted">
                  No activity in this window.
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        <section>
          <SectionHeading
            eyebrow={<Eyebrow>What people are looking at</Eyebrow>}
            title="Most searched"
            actions={
              <div className="flex gap-1.5">
                {[1, 7, 30].map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={days === option ? 'subtle' : 'ghost'}
                    onClick={() => setDays(option)}
                  >
                    {option}d
                  </Button>
                ))}
              </div>
            }
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader title="Tokens" subtitle="Ranked by scans, deduplicated by person" />
              {topTokens.isLoading ? (
                <SkeletonRows rows={5} />
              ) : (
                <DataTable
                  columns={topColumns('token')}
                  rows={topTokens.data ?? []}
                  rowKey={(row) => `${row.chain_id}-${row.subject}`}
                  empty="No token scans in this window."
                />
              )}
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Wallets" subtitle="Ranked by traces" />
              {topWallets.isLoading ? (
                <SkeletonRows rows={5} />
              ) : (
                <DataTable
                  columns={topColumns('wallet')}
                  rows={topWallets.data ?? []}
                  rowKey={(row) => `${row.chain_id}-${row.subject}`}
                  empty="No wallet traces in this window."
                />
              )}
            </Card>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-5">
          <div className="min-w-0 2xl:col-span-3">
            <SectionHeading eyebrow={<Eyebrow>Everyone</Eyebrow>} title="Users" />
            <Card className="overflow-hidden">
              {users.isLoading ? (
                <SkeletonRows rows={6} />
              ) : (
                <DataTable
                  columns={userColumns}
                  rows={users.data ?? []}
                  rowKey={(row) => row.id}
                  empty="No users yet."
                />
              )}
            </Card>
          </div>

          <div className="min-w-0 2xl:col-span-2">
            <SectionHeading
              eyebrow={
                <Eyebrow
                  icon={<Wallet className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
                >
                  Live
                </Eyebrow>
              }
              title="Recent activity"
            />
            <Card className="overflow-hidden">
              <ActivityFeed rows={recent.data} loading={recent.isLoading} />
            </Card>
          </div>
        </section>
      </div>
    </>
  )
}
