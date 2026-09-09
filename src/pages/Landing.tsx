import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Bell,
  GitCompareArrows,
  Radar,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { ScanForm } from '@/components/scan/ScanForm'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SignInButton } from '@/components/auth/SignInButton'
import { DeltaPill } from '@/components/ui/Badge'
import { TokenMark } from '@/components/ui/TokenMark'
import { Sparkline } from '@/components/charts/Sparkline'
import { HealthGauge } from '@/features/token/components/HealthGauge'
import { Hero3D } from './landing/Hero3D'
import { ChromeStar, ChromeSpark } from './landing/ChromeStar'
import { HeroExamples } from './landing/HeroExamples'
import { MOCK_TOKENS, mockSeriesFor } from '@/mock'
import { splitQuote } from '@/lib/format'

const CAPABILITIES = [
  {
    icon: ShieldCheck,
    title: 'Token health score',
    body: 'One number from seven weighted checks — holder concentration, liquidity depth, LP lock, owner privileges, transfer tax, source verification and contract age. Every factor is shown, so you can disagree with the score.',
  },
  {
    icon: Users,
    title: 'Early buyer discovery',
    body: 'The first wallets in from the creation block, what they paid, and whether they are still holding, partially out, or gone. The exit pattern usually says more than the chart.',
  },
  {
    icon: Wallet,
    title: 'Wallet tracing',
    body: 'Realised P&L, win rate and holdings for any address, plus a force-directed map of who it actually trades with. Tag wallets and follow them across tokens.',
  },
  {
    icon: GitCompareArrows,
    title: 'Cohort overlap',
    body: 'Compare two tokens and see which addresses hold both, who bought early in one and late in the other, and how much of each holder set is shared.',
  },
  {
    icon: Bell,
    title: 'Transaction alerts',
    body: 'Rules that fire on transfers, swaps and approvals from watched addresses — large sells, liquidity pulls, concentration spikes — delivered to your feed.',
  },
  {
    icon: Radar,
    title: 'Every EVM chain',
    body: 'Ethereum, Base, Arbitrum, Optimism, Polygon, BNB Chain, Avalanche, Scroll and zkSync. Pick the network at scan time — the same tooling, wherever the contract lives.',
  },
]

const STEPS = [
  { n: '01', title: 'Paste an address', body: 'Any token contract or wallet. We work out which it is.' },
  { n: '02', title: 'Read the breakdown', body: 'Score, holders, early buyers, live flow — with the reasoning shown.' },
  { n: '03', title: 'Track what matters', body: 'Add it to a watchlist and set alerts so you hear about the next move.' },
]

/** Floating quote card used as a 3D hero prop. */
function FloatingQuote({ index, className }: { index: number; className?: string }) {
  const token = MOCK_TOKENS[index]
  const quote = splitQuote(token.priceUsd)
  return (
    <div
      className={`glass-panel w-60 rounded-xl border border-hairline p-4 shadow-glass-lift ${className ?? ''}`}
    >
      <div className="flex items-center gap-2.5">
        <TokenMark symbol={token.symbol} size="sm" />
        <span className="text-sm font-medium text-primary">{token.symbol}</span>
        <DeltaPill value={token.change24h} showIcon={false} className="ml-auto" />
      </div>
      <div className="tabular mt-3 text-xl font-semibold text-primary">
        <span className="text-secondary">$</span>
        {quote.whole}
        {quote.fraction ? <span className="text-muted">.{quote.fraction}</span> : null}
      </div>
      <div className="mt-2 -mx-1">
        <Sparkline
          data={mockSeriesFor(token.symbol, token.change24h)}
          tone={token.change24h >= 0 ? 'positive' : 'negative'}
          height={48}
        />
      </div>
    </div>
  )
}

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Ambient layers, fixed behind everything. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 bg-ash-deep opacity-0 dark:opacity-100" />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[15] bg-grid-fine bg-grid-fine opacity-40 [mask-image:radial-gradient(70%_55%_at_50%_0%,#000,transparent)]"
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-glow-corner" />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="glass sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-8">
          <Logo to="/" />

          <nav className="ml-8 hidden items-center gap-6 lg:flex" aria-label="Landing">
            <a href="#what" className="text-sm text-secondary transition-colors duration-180 hover:text-primary">
              What it does
            </a>
            <a href="#how" className="text-sm text-secondary transition-colors duration-180 hover:text-primary">
              How it works
            </a>
            <Link to="/style-guide" className="text-sm text-secondary transition-colors duration-180 hover:text-primary">
              Design system
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <Link to="/dashboard" className="hidden sm:block">
              <span className="text-sm text-secondary transition-colors duration-180 hover:text-primary">
                Open app
              </span>
            </Link>
            <SignInButton />
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 md:px-8 md:pt-24">
        <Hero3D>
          {(depth) => (
            <div className="relative">
              {/* Ornament sits deepest in the scene, so parallax moves it least
                  and it never competes with the headline for attention. */}
              <div
                aria-hidden
                style={depth(-60)}
                className="pointer-events-none absolute -right-24 -top-28 hidden opacity-70 lg:block xl:-right-10"
              >
                <ChromeStar className="h-[26rem] w-[26rem] xl:h-[32rem] xl:w-[32rem]" />
              </div>
              <div
                aria-hidden
                style={depth(30)}
                className="pointer-events-none absolute right-[26rem] top-4 hidden xl:block"
              >
                <ChromeSpark className="h-10 w-10 opacity-80" />
              </div>

              <div style={depth(40)} className="relative z-10 max-w-3xl">
                <span className="chip mb-6">
                  Wallet &amp; token intelligence · every EVM chain
                </span>

                <h1 className="chrome-text text-display-sm font-semibold tracking-tightest md:text-display">
                  Follow the money.
                  <br />
                  Before it moves you.
                </h1>

                <p className="mt-6 max-w-xl text-base leading-relaxed text-secondary">
                  Paste any contract or wallet on any EVM chain. Get a health score with its
                  reasoning shown, the first buyers and who is still holding, and live trade
                  flow — while there is still time to act on it.
                </p>

                <div className="mt-9 max-w-2xl">
                  <ScanForm target="auto" size="lg" />
                  <HeroExamples />
                </div>
                <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
                  {[
                    { value: '11', label: 'EVM networks' },
                    { value: '7', label: 'health checks per scan' },
                    { value: '15s', label: 'live trade refresh' },
                  ].map((stat) => (
                    <div key={stat.label}>
                      <dt className="sr-only">{stat.label}</dt>
                      <dd>
                        <span className="tabular block text-2xl font-semibold tracking-tightest text-primary">
                          {stat.value}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">{stat.label}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Floating props. Hidden below xl: at narrower widths they would
                  collide with the copy, and a cramped 3D scene reads as a bug. */}
              <div
                aria-hidden
                style={depth(110)}
                className="pointer-events-none absolute -right-4 top-0 hidden xl:block"
              >
                <FloatingQuote index={0} className="rotate-[-4deg]" />
              </div>
              <div
                aria-hidden
                style={depth(180)}
                className="pointer-events-none absolute right-24 top-56 hidden xl:block"
              >
                <FloatingQuote index={2} className="rotate-[5deg]" />
              </div>
              <div
                aria-hidden
                style={depth(70)}
                className="pointer-events-none absolute -right-16 top-[19rem] hidden xl:block"
              >
                <div className="glass-panel grid place-items-center rounded-xl border border-hairline p-5 shadow-glass-lift">
                  <HealthGauge score={MOCK_TOKENS[0].healthScore} size={150} />
                </div>
              </div>
            </div>
          )}
        </Hero3D>
      </section>

      {/* ── Capabilities ────────────────────────────────────────────────── */}
      <section id="what" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:px-8">
        <span className="chip">What it does</span>
        <h2 className="chrome-text mt-2 max-w-2xl text-3xl font-semibold tracking-tightest md:text-4xl">
          Six things worth knowing before you buy
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((item) => (
            <article
              key={item.title}
              className="glass-panel rounded-xl border border-hairline p-6"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full border border-hairline bg-raised text-secondary">
                <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-heading text-primary">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:px-8">
        <span className="chip">How it works</span>
        <h2 className="chrome-text mt-2 text-3xl font-semibold tracking-tightest md:text-4xl">
          Three steps, no setup
        </h2>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="glass-panel rounded-xl border border-hairline p-6">
              <span className="tabular text-2xs font-semibold tracking-label text-muted">
                {step.n}
              </span>
              <h3 className="mt-3 text-lg font-semibold tracking-heading text-primary">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-24 md:px-8">
        <div className="glass-panel rounded-2xl border border-hairline p-8 text-center md:p-14">
          <h2 className="chrome-text mx-auto max-w-2xl text-3xl font-semibold tracking-tightest md:text-4xl">
            Do your own research, with better instruments
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-secondary">
            Scanning is free and needs no account. Sign in when you want watchlists and alerts
            to follow you between sessions.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/token">
              <span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-accent-on transition-colors duration-180 hover:bg-accent/90">
                Scan a contract
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
            </Link>
            <Link to="/dashboard">
              <span className="inline-flex h-11 cursor-pointer items-center rounded-md border border-hairline bg-raised px-5 text-sm font-medium text-primary transition-colors duration-180 hover:border-hairline-strong">
                Open the dashboard
              </span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 text-xs text-muted md:px-8">
          <span>NOI Defense</span>
          <span>·</span>
          <span>Every EVM chain</span>
          <Link
            to="/style-guide"
            className="-my-2 ml-auto inline-block py-2 transition-colors duration-180 hover:text-primary"
          >
            Design system
          </Link>
          <span className="text-muted">
            Figures shown are synthetic while the indexer is being built.
          </span>
        </div>
      </footer>
    </div>
  )
}
