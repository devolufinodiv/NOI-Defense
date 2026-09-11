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

const CAPABILITIES = [
  {
    icon: ShieldCheck,
    title: 'Can you actually sell it?',
    body: 'Some tokens let you buy but quietly block you from selling. We run a test purchase and a test sale before you risk anything, and tell you plainly if the sale fails.',
  },
  {
    icon: Wallet,
    title: 'What will it cost you?',
    body: 'Many tokens take a cut of every trade. We show the exact fee to buy and to sell, so a 30% exit fee is not a surprise you discover on the way out.',
  },
  {
    icon: Users,
    title: 'Who owns most of it?',
    body: 'If a handful of wallets hold nearly all the supply, any one of them can crash the price. We show the biggest holders and which wallets look connected.',
  },
  {
    icon: Radar,
    title: 'Is there enough to trade against?',
    body: 'A token can look valuable and still be impossible to exit. We measure how much real money backs it, and warn you when the pool is too thin to sell into.',
  },
  {
    icon: Bell,
    title: 'Tell me if something changes',
    body: 'Save anything you are watching and get told when a large holder sells, liquidity is pulled, or ownership suddenly concentrates.',
  },
  {
    icon: GitCompareArrows,
    title: 'Nine networks, one habit',
    body: 'Ethereum, Base, BNB Chain, Arbitrum, Optimism, Polygon, Avalanche, Scroll and zkSync. Same checks, same plain answer, wherever the token lives.',
  },
]

const STEPS = [
  { n: '01', title: 'Paste the address', body: 'Copy it from the project’s own site. Never from a message someone sent you.' },
  { n: '02', title: 'Read the verdict', body: 'One plain answer at the top, with the reasons underneath in normal English.' },
  { n: '03', title: 'Decide with your eyes open', body: 'Keep watching it if you like, and earn points while you learn the habit.' },
]

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

      {/* ── Hero ────────────────────────────────────────────────────────────
          One idea, one input, one line of reassurance.

          The previous version stacked a 3D parallax stage, a rotating chrome
          star, three floating price cards, a stat row and an example rail. Each
          was fine alone; together they competed with the one thing a visitor
          needs to do, which is paste an address. Everything that did not serve
          that is gone. What remains: the promise, the box, and permission to
          try it without signing up. */}
      <section className="relative mx-auto max-w-3xl px-4 pb-20 pt-20 text-center md:pt-28">
        <span className="chip mx-auto">Free · no account needed</span>

        <h1 className="chrome-text mt-7 text-display-sm font-semibold tracking-tightest md:text-display">
          Check before
          <br />
          you buy.
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-secondary md:text-lg">
          Paste any token address and we will tell you, in plain English, whether it looks safe —
          and exactly what we found.
        </p>

        <div className="mx-auto mt-10 max-w-2xl text-left">
          <ScanForm target="auto" size="lg" />
        </div>

        <p className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-muted">
          Works on Ethereum, Base, BNB Chain and six more networks. Takes about three seconds.
        </p>
      </section>

      {/* ── Capabilities ────────────────────────────────────────────────── */}
      <section id="what" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:px-8">
        <span className="chip">What we check</span>
        <h2 className="chrome-text mt-2 max-w-2xl text-3xl font-semibold tracking-tightest md:text-4xl">
          What we check for you
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
            Two minutes now beats a bad surprise later
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-secondary">
            Every check is free and needs no account. Sign in only if you want your watchlist,
            alerts and points to follow you between devices.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/token">
              <span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-accent-on transition-colors duration-180 hover:bg-accent/90">
                Check a token
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
            Automated checks, not financial advice. Always risk only what you can afford to lose.
          </span>
        </div>
      </footer>
    </div>
  )
}
