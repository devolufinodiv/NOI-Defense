import { useId, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, House, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SignInButton } from '@/components/auth/SignInButton'
import { PointsBadge } from '@/features/points/PointsBadge'
import { isValidAddress, normalizeAddress } from '@/lib/address'
import { useChainStore } from '@/store/chain'
import { NAV_ITEMS } from './nav'
import { MobileNavDrawer } from './MobileNavDrawer'

/** Resolve the current route to a readable trail. */
function useBreadcrumb(): { section: string; page: string } {
  const { pathname } = useLocation()

  if (pathname.startsWith('/token')) return { section: 'Investigate', page: 'Token scan' }
  if (pathname.startsWith('/wallet')) return { section: 'Investigate', page: 'Wallet trace' }
  if (pathname.startsWith('/compare')) return { section: 'Investigate', page: 'Compare' }
  if (pathname.startsWith('/alerts')) return { section: 'Monitor', page: 'Alerts' }
  if (pathname.startsWith('/style-guide')) return { section: 'System', page: 'Style guide' }

  const match = NAV_ITEMS.find((item) => pathname.startsWith(item.to))
  return { section: 'Overview', page: match?.label ?? 'Dashboard' }
}

/**
 * Dashboard quick-jump.
 *
 * Deliberately dashboard-only: the scanner pages carry their own full
 * paste-and-scan control with a network picker, and a second, weaker search box
 * in the chrome above it would be an ambiguous duplicate.
 */
function DashboardSearch() {
  const navigate = useNavigate()
  const chainId = useChainStore((state) => state.chainId)
  const inputId = useId()
  const errorId = `${inputId}-error`
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const query = value.trim()
    if (!isValidAddress(query)) {
      setError('Enter a valid 0x address (40 hex characters).')
      return
    }
    setError(null)
    // The dashboard box doesn't classify — it hands off to the scanner, which
    // owns that decision and can show the ambiguity if the RPC is unreachable.
    navigate(`/token/${normalizeAddress(query)}?chain=${chainId}`)
    setValue('')
  }

  return (
    <form onSubmit={onSubmit} className="relative min-w-0 flex-1 sm:max-w-sm">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        strokeWidth={2}
        aria-hidden
      />
      <input
        id={inputId}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          if (error) setError(null)
        }}
        spellCheck={false}
        autoComplete="off"
        placeholder="Jump to an address…"
        aria-label="Jump to a token or wallet address"
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-10 w-full rounded-md border bg-raised/50 pl-10 pr-3 text-sm text-primary',
          'placeholder:text-muted transition-colors duration-180 focus:outline-none',
          error
            ? 'border-negative focus:border-negative'
            : 'border-hairline focus:border-hairline-strong focus:bg-raised',
        )}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="glass-panel absolute left-0 top-full z-30 mt-1.5 rounded-sm border border-negative/40 px-2.5 py-1.5 text-xs text-negative"
        >
          {error}
        </p>
      ) : null}
    </form>
  )
}

export function TopBar() {
  const { pathname } = useLocation()
  const { section, page } = useBreadcrumb()
  const showSearch = pathname.startsWith('/dashboard')

  return (
    <header
      className={cn(
        'glass sticky top-0 z-30 shrink-0 border-b border-hairline px-4 md:px-6',
        'flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5',
        'sm:h-16 sm:flex-nowrap sm:py-0',
      )}
    >
      {/* Wordmark on mobile only — the sidebar carries it on desktop. */}
      <MobileNavDrawer className="md:hidden" />
      <Logo to="/dashboard" showWordmark={false} className="shrink-0 md:hidden" />

      <nav aria-label="Breadcrumb" className="hidden shrink-0 items-center gap-2 lg:flex">
        <House className="h-[18px] w-[18px] text-muted" strokeWidth={1.75} aria-hidden />
        <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} aria-hidden />
        <span className="text-sm text-muted">{section}</span>
        <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} aria-hidden />
        <span aria-current="page" className="text-sm font-semibold text-primary">
          {page}
        </span>
      </nav>

      <div className="ml-auto flex items-center gap-3 sm:min-w-0 sm:flex-1 sm:justify-end">
        <PointsBadge className="hidden sm:flex" />
        <ThemeToggle />
        <SignInButton className="shrink-0" />
        {showSearch ? (
          <div className="hidden min-w-0 flex-1 sm:order-first sm:block">
            <DashboardSearch />
          </div>
        ) : null}
      </div>

      {/* Full-width search row, phones only, dashboard only. */}
      {showSearch ? (
        <div className="w-full sm:hidden">
          <DashboardSearch />
        </div>
      ) : null}
    </header>
  )
}
