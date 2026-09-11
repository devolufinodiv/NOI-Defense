import { Link } from 'react-router-dom'
import { Bell, BellOff, CircleAlert, Info, OctagonAlert, Trash2 } from 'lucide-react'
import { PageHeader, SectionHeading } from '@/components/layout/AppShell'
import { Card, Eyebrow } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { TokenMark } from '@/components/ui/TokenMark'
import { ChainMark } from '@/components/ui/ChainMark'
import { formatRelativeTime, truncateAddress } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { isAuthConfigured } from '@/lib/supabase'
import {
  useAlerts,
  useMarkAlertsRead,
  useToggleWatch,
  useWatchlist,
  type AlertRow,
  type WatchRow,
} from '@/features/watchlist/queries'

const SEVERITY = {
  critical: { icon: OctagonAlert, ring: 'border-negative/30 bg-negative/10', text: 'text-negative' },
  warning: { icon: CircleAlert, ring: 'border-warning/30 bg-warning/10', text: 'text-warning' },
  info: { icon: Info, ring: 'border-hairline bg-raised', text: 'text-muted' },
} as const

function AlertItem({ alert }: { alert: AlertRow }) {
  const style = SEVERITY[alert.severity] ?? SEVERITY.info
  const Icon = style.icon

  return (
    <li className={`flex items-start gap-3 px-5 py-4 ${alert.read_at ? '' : 'bg-raised/30'}`}>
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${style.ring}`}>
        <Icon className={`h-4 w-4 ${style.text}`} strokeWidth={2} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-primary">{alert.title}</span>
          {alert.read_at ? null : (
            <span aria-label="Unread" className="h-1.5 w-1.5 rounded-full bg-accent-text" />
          )}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-secondary">{alert.detail}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ChainMark chainId={alert.chain_id} size="xs" />
          <Link
            to={`/${alert.subject_kind}/${alert.subject}?chain=${alert.chain_id}`}
            className="font-mono text-xs text-secondary transition-colors duration-180 hover:text-primary"
          >
            {truncateAddress(alert.subject)}
          </Link>
        </div>
      </div>

      <span className="tabular shrink-0 text-xs text-muted">
        {formatRelativeTime(Math.floor(new Date(alert.created_at).getTime() / 1000))}
      </span>
    </li>
  )
}

function WatchItem({ row }: { row: WatchRow }) {
  const { mutate, isPending } = useToggleWatch(row.chain_id, row.address)

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <TokenMark symbol={row.symbol || row.name || '?'} size="sm" />
      <Link
        to={`/${row.kind}/${row.address}?chain=${row.chain_id}`}
        className="min-w-0 flex-1"
      >
        <span className="block truncate text-sm text-primary">
          {row.name || row.symbol || truncateAddress(row.address)}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <ChainMark chainId={row.chain_id} size="xs" />
          <span className="font-mono text-2xs text-muted">{truncateAddress(row.address)}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={() => mutate({ kind: row.kind })}
        disabled={isPending}
        aria-label="Stop watching"
        title="Stop watching"
        className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-sm text-muted transition-colors duration-180 hover:bg-raised hover:text-negative"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
    </li>
  )
}

export function Alerts() {
  const { user } = useAuth()
  const alerts = useAlerts()
  const watchlist = useWatchlist()
  const markRead = useMarkAlertsRead()

  const unread = (alerts.data ?? []).filter((a) => a.read_at === null).length

  if (!isAuthConfigured || !user) {
    return (
      <>
        <PageHeader
          eyebrow={<span className="chip">Alerts</span>}
          title="Get told when something changes"
          subtitle="Watch any token and we will check it every few minutes."
        />
        <div className="w-full px-4 pb-16 sm:px-6 md:px-8">
          <Card className="mx-auto max-w-xl">
            <div className="flex flex-col items-start gap-4 p-8">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-hairline bg-raised text-muted">
                <BellOff className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h2 className="text-xl font-semibold tracking-heading text-primary">
                Sign in to use alerts
              </h2>
              <p className="text-sm leading-relaxed text-secondary">
                Alerts need an account so we know where to send them. Scanning stays free without
                one.
              </p>
              <Link to="/token">
                <Button variant="primary">Check a token first</Button>
              </Link>
            </div>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">Alerts</span>
            {unread > 0 ? <Badge tone="accent">{unread} new</Badge> : null}
          </div>
        }
        title="What changed"
        subtitle="We check every token you watch a few times an hour, and only speak up when something matters."
        actions={
          unread > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => markRead.mutate()}>
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className="w-full space-y-6 px-4 pb-16 sm:px-6 md:px-8 xl:px-10">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <SectionHeading eyebrow={<Eyebrow>Newest first</Eyebrow>} title="Alerts" />
            <Card className="overflow-hidden">
              {alerts.isLoading ? (
                <SkeletonRows rows={4} />
              ) : (alerts.data?.length ?? 0) === 0 ? (
                <div className="px-5 py-14 text-center">
                  <Bell className="mx-auto h-6 w-6 text-muted" strokeWidth={1.5} aria-hidden />
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
                    Nothing to report. That is the normal state — we only write here when a watched
                    token does something worth knowing about.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {alerts.data?.map((alert) => <AlertItem key={alert.id} alert={alert} />)}
                </ul>
              )}
            </Card>
          </div>

          <div className="min-w-0">
            <SectionHeading eyebrow={<Eyebrow>Being watched</Eyebrow>} title="Your watchlist" />
            <Card className="overflow-hidden">
              {watchlist.isLoading ? (
                <SkeletonRows rows={3} />
              ) : (watchlist.data?.length ?? 0) === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm leading-relaxed text-muted">
                    Nothing watched yet. Scan a token and press{' '}
                    <span className="text-secondary">Alert me if this changes</span>.
                  </p>
                  <Link to="/token" className="mt-4 inline-block">
                    <Button variant="secondary" size="sm">
                      Check a token
                    </Button>
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {watchlist.data?.map((row) => <WatchItem key={row.id} row={row} />)}
                </ul>
              )}
            </Card>

            <p className="mt-3 px-1 text-xs leading-relaxed text-muted">
              We tell you when the pool backing a token shrinks sharply, when the price moves a lot
              either way, or when trading suddenly spikes.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
