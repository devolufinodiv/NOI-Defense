import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/brand/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useIsAdmin } from '@/features/admin/queries'
import { useUnreadAlertCount } from '@/features/watchlist/queries'
import { NAV_GROUPS } from './nav'

export interface DrawerLink {
  href: string
  label: string
}

/**
 * The phone-sized sidebar: a button that slides the full navigation in from the
 * left, and puts it away again.
 *
 * It exists because the bottom tab bar only has room for four destinations, so
 * everything else — trusted tokens, admin, the style guide — was simply
 * unreachable on a phone.
 *
 * Portalled to the body, not rendered in place. Both headers that host the
 * trigger use `backdrop-filter` for their glass finish, and an element with a
 * backdrop filter becomes the containing block for fixed-position descendants —
 * so an in-place drawer would have been clipped to the header's own height.
 *
 * Behaves as a modal while open: the page underneath stops scrolling, Escape
 * and the backdrop both close it, focus moves inside and returns to the trigger
 * afterwards, and navigating anywhere closes it.
 */
export function MobileNavDrawer({
  className,
  extraLinks,
  extraLabel = 'On this page',
}: {
  className?: string
  /** Page-local anchors shown above the app navigation, e.g. on the landing page. */
  extraLinks?: DrawerLink[]
  extraLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const { isAdmin } = useIsAdmin()
  const unread = useUnreadAlertCount()

  // Any navigation closes it.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first link so keyboard and screen-reader users land inside.
    const first = panel.current?.querySelector<HTMLElement>('a, button')
    first?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      // Keep Tab cycling inside the panel while it is open.
      if (event.key === 'Tab' && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>('a, button')
        if (focusable.length === 0) return
        const firstEl = focusable[0]
        const lastEl = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault()
          lastEl.focus()
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
      trigger.current?.focus()
    }
  }, [open])

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        className={cn(
          'grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full border border-hairline bg-raised/60 text-secondary transition-colors duration-180 hover:border-hairline-strong hover:text-primary',
          className,
        )}
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </button>

      {createPortal(
        <div
          className={cn(
            'fixed inset-0 z-[80]',
            // Visibility, not just opacity: a closed panel's links must leave
            // the tab order. It lags only on the way out, so the slide still
            // plays before the panel goes inert. On the way in it must switch
            // instantly — at the start of a transition the value is still
            // `hidden`, and the browser refuses to focus a hidden element, which
            // silently left keyboard users outside the menu they just opened.
            open
              ? 'pointer-events-auto visible'
              : 'pointer-events-none invisible transition-[visibility] duration-300 motion-reduce:transition-none',
          )}
        >
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            className={cn(
              'absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none',
              open ? 'opacity-100' : 'opacity-0',
            )}
          />

          {/* Panel */}
          <div
            ref={panel}
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            // Any link closes it — including one to the page already open,
            // which changes no route and so would otherwise leave it covering
            // the page.
            onClickCapture={(event) => {
              if ((event.target as HTMLElement).closest('a')) setOpen(false)
            }}
            className={cn(
              'absolute inset-y-0 left-0 flex w-[min(84vw,320px)] flex-col border-r border-hairline bg-surface shadow-2xl',
              'transition-transform duration-300 ease-out motion-reduce:transition-none',
              open ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-4">
              <Logo to="/" subtitle="Wallet Intelligence" />
              {/* The theme switch is here on phones, where the header has no room. */}
              <ThemeToggle className="ml-auto" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-hairline bg-raised/60 text-secondary transition-colors duration-180 hover:text-primary"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Mobile">
              {extraLinks && extraLinks.length > 0 ? (
                <Group label={extraLabel}>
                  {extraLinks.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center rounded-md border border-transparent px-3 py-2.5 text-sm text-secondary transition-colors duration-180 hover:bg-raised/60 hover:text-primary"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </Group>
              ) : null}

              {NAV_GROUPS.map((group) => {
                // Presentation only — every admin read is gated server-side.
                const items = group.items.filter((item) => !item.adminOnly || isAdmin)
                if (items.length === 0) return null
                return (
                  <Group key={group.label} label={group.label}>
                    {items.map((item) => {
                      const count = item.to === '/alerts' ? unread : item.count
                      return (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              cn(
                                'flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors duration-180',
                                isActive
                                  ? 'border-white/[0.08] bg-raised text-primary'
                                  : 'border-transparent text-secondary hover:bg-raised/60 hover:text-primary',
                              )
                            }
                          >
                            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.tag ? (
                              <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-2xs font-medium text-muted">
                                {item.tag}
                              </span>
                            ) : null}
                            {count ? (
                              <span className="tabular shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-2xs font-semibold text-accent-text">
                                {count}
                              </span>
                            ) : null}
                          </NavLink>
                        </li>
                      )
                    })}
                  </Group>
                )
              })}
            </nav>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="mb-2 px-3 text-xs font-medium text-muted">{label}</h3>
      <ul className="space-y-1">{children}</ul>
    </div>
  )
}
