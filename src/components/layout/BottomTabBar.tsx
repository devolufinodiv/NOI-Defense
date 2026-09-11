import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useUnreadAlertCount } from '@/features/watchlist/queries'
import { NAV_ITEMS } from './nav'

/**
 * Mobile navigation. Safe-area padding keeps it clear of the home indicator,
 * which also matters once this is wrapped with Capacitor.
 */
export function BottomTabBar() {
  const unread = useUnreadAlertCount()
  const items = NAV_ITEMS.filter((item) => !item.desktopOnly).slice(0, 5)

  return (
    <nav
      aria-label="Primary"
      className="glass sticky bottom-0 z-30 border-t border-hairline md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                cn(
                  // 56px tall clears the 44px minimum touch target with margin.
                  'relative flex h-14 flex-col items-center justify-center gap-1 transition-colors duration-180',
                  isActive ? 'text-primary' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-4 top-0 h-[2px] rounded-b-full bg-accent"
                    />
                  ) : null}
                  <span className="relative">
                    <item.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    {(item.to === '/alerts' ? unread : item.count) ? (
                      <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-on">
                        {item.to === '/alerts' ? unread : item.count}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[11px] font-medium">{item.short}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
