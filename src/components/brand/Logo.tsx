import { useId } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

/**
 * The brand mark: a four-point chrome star.
 *
 * Drawn as a single path with a metal gradient rather than an icon-font glyph,
 * so it carries the same brushed finish as the display headings and scales
 * cleanly from a 28px rail to the hero ornament. The gradient id is per-instance
 * (`useId`) because multiple marks render on the same page and duplicate SVG
 * ids silently cross-wire their fills.
 */
export function LogoMark({ className }: { className?: string }) {
  const gradientId = useId()

  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--c-chrome-0))" />
          <stop offset="45%" stopColor="rgb(var(--c-chrome-1))" />
          <stop offset="72%" stopColor="rgb(var(--c-chrome-2))" />
          <stop offset="100%" stopColor="rgb(var(--c-chrome-1))" />
        </linearGradient>
      </defs>
      {/* Concave-sided star: each arm is pulled toward the centre by a
          quadratic control point, which is what gives it the sharp
          four-point sparkle rather than a blunt diamond. */}
      <path
        fill={`url(#${gradientId})`}
        d="M16 1.5c.4 5.1 1.6 8.6 3.9 11 2.3 2.3 5.8 3.5 10.9 3.9v.2c-5.1.4-8.6 1.6-10.9 3.9-2.3 2.3-3.5 5.8-3.9 11h-.2c-.4-5.1-1.6-8.6-3.9-11C9.6 18.2 6.1 17 1 16.6v-.2c5.1-.4 8.6-1.6 10.9-3.9C14.2 10.2 15.4 6.7 15.8 1.5Z"
      />
    </svg>
  )
}

/**
 * Full lockup. One component for every surface — landing nav, sidebar, mobile
 * top bar — so the mark can never drift between the marketing site and the app.
 */
export function Logo({
  to = '/',
  showWordmark = true,
  subtitle,
  className,
}: {
  to?: string | null
  showWordmark?: boolean
  subtitle?: string
  className?: string
}) {
  const content = (
    <>
      <span
        aria-hidden
        className="glass-panel grid h-9 w-9 shrink-0 place-items-center rounded-md border border-hairline"
      >
        <LogoMark className="h-[18px] w-[18px]" />
      </span>
      {showWordmark ? (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold tracking-heading text-primary">
            NOI Defense
          </span>
          {subtitle ? (
            <span className="block truncate text-xs text-muted">{subtitle}</span>
          ) : null}
        </span>
      ) : null}
    </>
  )

  const classes = cn('flex items-center gap-2.5', className)

  if (to === null) return <span className={classes}>{content}</span>

  return (
    <Link to={to} className={classes} aria-label="NOI Defense home">
      {content}
    </Link>
  )
}
