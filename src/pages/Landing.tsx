import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { ScanForm } from '@/components/scan/ScanForm'
import { TrustedList } from '@/features/featured/TrustedList'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SignInButton } from '@/components/auth/SignInButton'
import { ScanScene } from './landing/ScanScene'
import { Reveal } from './landing/Reveal'
import { cn } from '@/lib/cn'

/**
 * The landing page.
 *
 * Built as a sequence rather than a stack of boxes: one full-height opening
 * that does the only job that matters — get an address into the box — then a
 * held statement, then the checks revealed one line at a time as you come down
 * the page, then proof, then the way in.
 *
 * The six capability cards became six rows. A card is a container you have to
 * look past; a row with a hairline under it is just the sentence, and six
 * sentences in a column read faster than six boxes in a grid.
 */

const CHECKS = [
  {
    label: 'Can you sell it',
    body: 'Some tokens let you buy and quietly block you from selling. We run a test purchase and a test sale before you risk anything, and say plainly if the sale fails.',
  },
  {
    label: 'What it costs you',
    body: 'Many tokens take a cut of every trade. We show the exact fee to buy and to sell, so a 30% exit fee is not something you discover on the way out.',
  },
  {
    label: 'What the code can do',
    body: 'We read the contract’s own published interface and tell you whether anyone can mint more, freeze transfers, block your wallet, or swap the code for something else.',
  },
  {
    label: 'Whether you can get out',
    body: 'A token can look valuable and still be impossible to exit. We measure how much real money backs it, and warn you when the pool is too thin to sell into.',
  },
  {
    label: 'Who holds the power',
    body: 'If one address still owns the contract, the rules can change after you buy. We show whether that control was given up, and who holds it if not.',
  },
  {
    label: 'When something changes',
    body: 'Save anything you are watching and get told when liquidity is pulled, a large holder sells, or ownership suddenly concentrates.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Paste the address',
    body: 'Copy it from the project’s own site. Never from a message someone sent you.',
  },
  {
    n: '02',
    title: 'Read the verdict',
    body: 'One plain answer at the top, with the reasons underneath in normal English.',
  },
  {
    n: '03',
    title: 'Decide with your eyes open',
    body: 'Keep watching it if you like, and earn points while you learn the habit.',
  },
]

const NETWORKS = [
  'Ethereum',
  'Base',
  'BNB Chain',
  'Arbitrum',
  'Optimism',
  'Polygon',
  'Avalanche',
  'Scroll',
  'zkSync',
]

export function Landing() {
  const [scrolled, setScrolled] = useState(false)

  // The nav is invisible over the opening frame and resolves into glass once
  // you leave it, so nothing competes with the hero on first sight.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-base">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header
        className={cn(
          'sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300',
          scrolled ? 'glass border-b border-hairline' : 'border-b border-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-8">
          <Logo to="/" />

          <nav className="ml-8 hidden items-center gap-6 lg:flex" aria-label="Landing">
            <a
              href="#what"
              className="text-sm text-secondary transition-colors duration-180 hover:text-primary"
            >
              What it does
            </a>
            <a
              href="#how"
              className="text-sm text-secondary transition-colors duration-180 hover:text-primary"
            >
              How it works
            </a>
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
      <section className="relative -mt-16 flex min-h-[94svh] flex-col justify-center overflow-hidden pb-16 pt-28">
        <ScanScene className="pointer-events-none absolute inset-0 h-full w-full" />

        {/* Scrim: holds contrast over the moving field and hands off to the
            page below, so the section ends without a visible seam. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_65%_at_50%_38%,transparent,rgb(var(--c-base)/0.82)_70%,rgb(var(--c-base))_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-base"
        />

        <div className="relative mx-auto w-full max-w-3xl px-4 text-center">
          <Reveal>
            <span className="chip mx-auto">Free · no account needed</span>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mt-7 text-[clamp(2.75rem,9vw,5.25rem)] font-light leading-[0.95] tracking-tightest text-primary">
              Check before
              <br />
              <span className="chrome-text font-semibold">you buy.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-secondary md:text-lg">
              Paste any token or wallet address. We read it live off the chain and tell you, in
              plain English, what we found — and what we could not check.
            </p>
          </Reveal>

          <Reveal delay={230} className="mx-auto mt-10 max-w-2xl text-left">
            <ScanForm target="auto" size="lg" />
          </Reveal>

          <Reveal delay={300}>
            <p className="mx-auto mt-5 text-xs text-muted">Takes about three seconds.</p>
          </Reveal>
        </div>

        {/* Networks, as a quiet strip at the foot of the frame. */}
        <div className="relative mx-auto mt-16 w-full max-w-5xl px-4">
          <Reveal delay={360}>
            <div className="border-t border-hairline pt-5">
              <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {NETWORKS.map((network) => (
                  <li key={network} className="text-2xs uppercase tracking-label text-muted">
                    {network}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Statement ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-24 md:px-8 md:py-32">
        <Reveal>
          <p className="text-[clamp(1.6rem,4.2vw,2.75rem)] font-light leading-[1.18] tracking-tight">
            <span className="text-primary">Most people lose money</span>
            <span className="text-muted">
              {' '}
              not because they picked the wrong token, but because nobody told them what the
              contract was allowed to do to them.
            </span>
          </p>
        </Reveal>
      </section>

      {/* ── Checks ──────────────────────────────────────────────────────── */}
      <section id="what" className="mx-auto max-w-5xl scroll-mt-24 px-4 pb-24 md:px-8">
        <Reveal>
          <span className="text-2xs uppercase tracking-label text-muted">What we check</span>
        </Reveal>

        <dl className="mt-10 border-t border-hairline">
          {CHECKS.map((check, index) => (
            <Reveal key={check.label} delay={index * 60}>
              <div className="grid gap-2 border-b border-hairline py-6 md:grid-cols-[minmax(0,14rem)_1fr] md:gap-10 md:py-7">
                <dt className="text-base font-medium tracking-heading text-primary md:text-lg">
                  {check.label}
                </dt>
                <dd className="text-sm leading-relaxed text-secondary md:text-base">
                  {check.body}
                </dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </section>

      {/* ── Proof ───────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-5xl px-4 pb-24 md:px-8">
        <Reveal>
          <TrustedList limit={5} />
        </Reveal>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-5xl scroll-mt-24 px-4 pb-24 md:px-8">
        <Reveal>
          <span className="text-2xs uppercase tracking-label text-muted">How it works</span>
        </Reveal>

        <ol className="mt-10 border-t border-hairline">
          {STEPS.map((step, index) => (
            <Reveal key={step.n} delay={index * 80}>
              <li className="grid gap-2 border-b border-hairline py-6 md:grid-cols-[4rem_minmax(0,14rem)_1fr] md:gap-8 md:py-7">
                <span className="tabular text-2xs font-semibold tracking-label text-muted">
                  {step.n}
                </span>
                <span className="text-base font-medium tracking-heading text-primary md:text-lg">
                  {step.title}
                </span>
                <span className="text-sm leading-relaxed text-secondary md:text-base">
                  {step.body}
                </span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ── Close ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-hairline">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_140%_at_50%_120%,rgb(var(--c-glow)/0.16),transparent)]"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-24 text-center md:px-8 md:py-32">
          <Reveal>
            <h2 className="text-[clamp(1.9rem,5vw,3.25rem)] font-light leading-[1.05] tracking-tightest text-primary">
              Two minutes now beats
              <br />
              <span className="chrome-text font-semibold">a bad surprise later.</span>
            </h2>
          </Reveal>

          <Reveal delay={90}>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-secondary">
              Every check is free and needs no account. Sign in only if you want your watchlist,
              alerts and points to follow you between devices.
            </p>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/token">
                <span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md bg-accent px-5 text-sm font-medium text-accent-on transition-colors duration-180 hover:bg-accent/90">
                  Check a token
                  <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
              </Link>
              <Link to="/dashboard">
                <span className="glass inline-flex h-11 cursor-pointer items-center rounded-md border border-hairline px-5 text-sm font-medium text-primary transition-colors duration-180 hover:border-hairline-strong">
                  Open the dashboard
                </span>
              </Link>
            </div>
          </Reveal>
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
          <span>
            Automated checks, not financial advice. Always risk only what you can afford to lose.
          </span>
        </div>
      </footer>
    </div>
  )
}
