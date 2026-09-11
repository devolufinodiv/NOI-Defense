import { Sparkles, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton'
import { HashRef } from '@/components/ui/Address'
import { formatRelativeTime } from '@/lib/format'
import { useAuth } from '@/store/auth'
import { isAuthConfigured } from '@/lib/supabase'
import { useLeaderboard, useMyPoints } from '@/features/points/queries'

/** Plain-English label per award kind, so the history reads as sentences. */
const KIND_LABEL: Record<string, string> = {
  sign_in: 'Came back',
  token_scan: 'Checked a token',
  wallet_trace: 'Looked up a wallet',
  index_request: 'Ran a deep analysis',
  watchlist_add: 'Saved something to watch',
  search: 'Searched an address',
}

const EARN_WAYS = [
  { points: 25, label: 'Open the app each day', note: 'Once a day' },
  { points: 10, label: 'Check a token you haven’t checked today', note: 'Up to 15 a day' },
  { points: 10, label: 'Look up a wallet', note: 'Up to 15 a day' },
  { points: 20, label: 'Run a deep analysis on a token', note: 'Up to 5 a day' },
  { points: 15, label: 'Save something to your watchlist', note: 'Up to 10 a day' },
  { points: 2, label: 'Search an address', note: 'Up to 20 a day' },
]

export function Rewards() {
  const { user } = useAuth()
  const points = useMyPoints()
  const leaderboard = useLeaderboard(Boolean(user))

  if (!isAuthConfigured || !user) {
    return (
      <>
        <PageHeader
          eyebrow={<span className="chip">Rewards</span>}
          title="Earn points as you go"
          subtitle="Every check you run adds to your score. Sign in to start collecting."
        />
        <div className="w-full px-4 pb-16 sm:px-6 md:px-8">
          <Card className="mx-auto max-w-xl">
            <CardBody className="space-y-4">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-warning/30 bg-warning/10 text-warning">
                <Sparkles className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h2 className="text-xl font-semibold tracking-heading text-primary">
                Sign in to collect points
              </h2>
              <p className="text-sm leading-relaxed text-secondary">
                You can use every check without an account. Signing in just means your points,
                watchlist and history follow you between devices — and new accounts start with 100.
              </p>
              <ul className="space-y-2 border-t border-hairline pt-4">
                {EARN_WAYS.map((way) => (
                  <li key={way.label} className="flex items-center gap-3 text-sm">
                    <span className="tabular w-10 shrink-0 font-semibold text-warning">
                      +{way.points}
                    </span>
                    <span className="text-secondary">{way.label}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={<span className="chip">Rewards</span>}
        title="Your points"
        subtitle="You earn these for doing your own research. That is the whole idea."
      />

      <div className="w-full space-y-6 px-4 pb-16 sm:px-6 md:px-8 xl:px-10">
        <section className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardBody>
              <div className="text-xs text-muted">Total points</div>
              {points.isLoading ? (
                <Skeleton className="mt-2 h-9 w-24" />
              ) : (
                <div className="tabular mt-1 text-3xl font-semibold tracking-tightest text-primary">
                  {(points.data?.total ?? 0).toLocaleString('en-US')}
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-muted">Earned today</div>
              {points.isLoading ? (
                <Skeleton className="mt-2 h-9 w-16" />
              ) : (
                <div className="tabular mt-1 text-3xl font-semibold tracking-tightest text-positive">
                  +{(points.data?.today ?? 0).toLocaleString('en-US')}
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-xs text-muted">Your position</div>
              {points.isLoading ? (
                <Skeleton className="mt-2 h-9 w-20" />
              ) : (
                <div className="tabular mt-1 text-3xl font-semibold tracking-tightest text-primary">
                  #{points.data?.rank ?? '—'}
                  <span className="ml-1 text-base font-normal text-muted">
                    of {points.data?.of ?? 0}
                  </span>
                </div>
              )}
            </CardBody>
          </Card>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader title="Recent points" subtitle="Your last few awards" />
            {points.isLoading ? (
              <SkeletonRows rows={5} />
            ) : (points.data?.recent.length ?? 0) === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted">
                Nothing yet — run your first check and it will show up here.
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {points.data?.recent.map((award, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-3">
                    <span className="tabular w-10 shrink-0 text-sm font-semibold text-positive">
                      +{award.points}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-primary">
                        {KIND_LABEL[award.kind] ?? award.kind}
                      </span>
                      {award.subject && award.chainId ? (
                        <HashRef value={award.subject} chainId={award.chainId} hideExplorer />
                      ) : null}
                    </span>
                    <span className="tabular shrink-0 text-xs text-muted">
                      {formatRelativeTime(Math.floor(new Date(award.at).getTime() / 1000))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Top researchers"
              subtitle="Most points earned"
              action={<Trophy className="h-4 w-4 text-warning" strokeWidth={1.75} aria-hidden />}
            />
            {leaderboard.isLoading ? (
              <SkeletonRows rows={5} />
            ) : (leaderboard.data?.length ?? 0) === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted">
                Nobody on the board yet. Be first.
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {leaderboard.data?.map((row) => (
                  <li
                    key={row.rank}
                    className={`flex items-center gap-3 px-5 py-3 ${row.is_you ? 'bg-raised/50' : ''}`}
                  >
                    <span className="tabular w-6 shrink-0 text-sm text-muted">{row.rank}</span>
                    {row.avatar_url ? (
                      <img src={row.avatar_url} alt="" className="h-7 w-7 shrink-0 rounded-full" />
                    ) : (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised text-2xs font-semibold text-secondary">
                        {row.display_name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-primary">
                      {row.display_name}
                      {row.is_you ? <Badge tone="accent" className="ml-2">You</Badge> : null}
                    </span>
                    <span className="tabular shrink-0 text-sm font-semibold text-primary">
                      {row.points.toLocaleString('en-US')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="How to earn" subtitle="Daily limits stop anyone farming the board" />
          <CardBody className="pt-4">
            <ul className="grid gap-3 sm:grid-cols-2">
              {EARN_WAYS.map((way) => (
                <li key={way.label} className="flex items-start gap-3">
                  <span className="tabular w-10 shrink-0 text-sm font-semibold text-warning">
                    +{way.points}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-primary">{way.label}</span>
                    <span className="block text-xs text-muted">{way.note}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-hairline pt-4">
              <Link to="/token">
                <Button variant="primary">Check a token</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
