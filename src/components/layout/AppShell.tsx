import type { ReactNode } from 'react'
import { useUiStore } from '@/store/ui'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { BottomTabBar } from './BottomTabBar'

/**
 * Application chrome: persistent sidebar (desktop) / bottom tabs (mobile), a
 * sticky top bar, and a scrolling content column lit by a single ambient
 * source pinned to the viewport.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pinnedCollapsed = useUiStore((state) => state.sidebarCollapsed)

  return (
    <div className="relative flex min-h-screen isolate">
      {/* Two fixed layers, both behind everything: a deep ash wash that keeps
          large empty areas from reading as flat black, and one neutral bloom
          off the top-left that acts as the room's light source. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 bg-ash-deep opacity-0 dark:opacity-100" />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-glow-corner" />
      <Sidebar />
      {/* Placeholder gutter: while the rail is pinned collapsed it is
          position:fixed so hovering can float it over content, which takes it
          out of flow. This keeps the column where it belongs. */}
      {pinnedCollapsed ? <div aria-hidden className="hidden w-[76px] shrink-0 md:block" /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-w-0 flex-1">{children}</main>
        <BottomTabBar />
      </div>
    </div>
  )
}

/**
 * Page statement block. The oversized display heading is what gives each screen
 * a point of view instead of opening straight into widgets.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`px-4 pb-2 pt-8 md:px-8 md:pt-10 ${className ?? ''}`}>
      {eyebrow ? <div className="mb-4">{eyebrow}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {/* Chrome is reserved for the page title. Section headings below stay
              solid, so the metal treatment marks hierarchy instead of becoming
              wallpaper. */}
          <h1 className="chrome-text text-display-sm font-semibold tracking-tightest md:text-display">
            {title}
          </h1>
          {subtitle ? (
            <div className="mt-3 max-w-prose text-sm leading-relaxed text-secondary">
              {subtitle}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

/** Section heading with a small eyebrow, used between dashboard blocks. */
export function SectionHeading({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1.5">{eyebrow}</div> : null}
        <h2 className="text-xl font-semibold tracking-heading text-primary md:text-2xl">{title}</h2>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
