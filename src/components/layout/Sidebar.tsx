import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from '@/components/brand/Logo'
import { useUiStore } from '@/store/ui'
import { displayName, useAuth } from '@/store/auth'
import { useIsAdmin } from '@/features/admin/queries'
import { useUnreadAlertCount } from '@/features/watchlist/queries'
import { NAV_GROUPS } from './nav'

/**
 * Greeting block.
 *
 * Follows the signed-in account rather than inventing a user — fabricating a
 * name here would be exactly the kind of fake data this product must not show.
 */
function Greeting() {
  const { user } = useAuth()
  const name = displayName(user)

  return (
    <div className="border-y border-hairline px-5 py-6">
      {user ? (
        <>
          <h2 className="text-display-sm font-semibold text-primary">
            Welcome
            <br />
            back
          </h2>
          <p className="mt-3 truncate text-sm text-secondary">{name}</p>
          <p className="mt-1 text-xs text-muted">Tracking across EVM chains</p>
        </>
      ) : (
        <>
          <h2 className="text-display-sm font-semibold text-primary">
            Start an
            <br />
            investigation
          </h2>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Sign in to save watchlists and alert rules across sessions.
          </p>
        </>
      )}
    </div>
  )
}

/** Desktop rail. Below `md`, navigation moves to <BottomTabBar />. */
export function Sidebar() {
  const { isAdmin } = useIsAdmin()
  const unread = useUnreadAlertCount()
  const pinnedCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const toggle = useUiStore((state) => state.toggleSidebar)
  const [hovered, setHovered] = useState(false)

  /**
   * Collapsed is the pinned state; hovering peeks it open without unpinning.
   * Keyboard users get the same peek via focus-within, so the labels aren't
   * mouse-only.
   */
  const collapsed = pinnedCollapsed && !hovered

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(event) => {
        // Only fold back once focus has actually left the rail.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHovered(false)
        }
      }}
      className={cn(
        'glass hidden shrink-0 flex-col border-r border-hairline md:flex',
        'transition-[width] duration-180',
        collapsed ? 'w-[76px]' : 'w-[268px]',
        // While peeking, float above content instead of shoving the page —
        // a layout shift on hover would make the whole app feel unstable.
        pinnedCollapsed && 'fixed inset-y-0 left-0 z-40',
      )}
    >
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <Logo
          to="/dashboard"
          showWordmark={!collapsed}
          subtitle="Wallet Intelligence"
          className={collapsed ? 'justify-center' : undefined}
        />
        {collapsed ? null : (
          <button
            type="button"
            onClick={() => {
              toggle()
              // Drop the peek immediately, or the rail would stay open under
              // the cursor and the click would look like it did nothing.
              setHovered(false)
            }}
            aria-label={pinnedCollapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
            aria-expanded={!pinnedCollapsed}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full border border-hairline bg-raised/60 text-secondary transition-colors duration-180 hover:border-hairline-strong hover:text-primary"
          >
            <ChevronLeft
              className={cn('h-4 w-4 transition-transform duration-180', pinnedCollapsed && 'rotate-180')}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        )}
      </div>

      {collapsed ? null : <Greeting />}

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
        {NAV_GROUPS.map((group) => {
          // Hiding the link is presentation only — every admin query is gated
          // server-side by is_admin(), so this cannot be bypassed by unhiding it.
          const items = group.items.filter((item) => !item.adminOnly || isAdmin)
          if (items.length === 0) return null
          return (
          <div key={group.label} className="mb-5 last:mb-0">
            {collapsed ? (
              <div className="mx-3 mb-2 h-px bg-hairline" aria-hidden />
            ) : (
              <h3 className="mb-2 px-3 text-xs font-medium text-muted">{group.label}</h3>
            )}
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center rounded-md text-sm transition-colors duration-180',
                        collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
                        isActive
                          ? 'border border-white/[0.08] bg-raised bg-sheen-active text-primary shadow-nav'
                          : 'border border-transparent text-secondary hover:bg-raised/60 hover:text-primary',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          className="h-[18px] w-[18px] shrink-0"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {collapsed ? null : (
                          <>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.tag ? (
                              <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-2xs font-medium text-muted">
                                {item.tag}
                              </span>
                            ) : null}
                            {(item.to === '/alerts' ? unread : item.count) ? (
                              <span className="tabular shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-2xs font-semibold text-accent-text">
                                {item.to === '/alerts' ? unread : item.count}
                              </span>
                            ) : null}
                          </>
                        )}
                        {/* Active marker on the right edge, as in the reference. */}
                        {isActive && !collapsed ? (
                          <span
                            aria-hidden
                            className="absolute right-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-l-full bg-primary"
                          />
                        ) : null}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
          )
        })}
      </nav>


    </aside>
  )
}
