import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lifts on hover. Use for cards that navigate somewhere. */
  interactive?: boolean
  /** Coloured rail down the left edge — token identity, never gain/loss. */
  railColor?: string
}

/**
 * Elevated panel — the bento tile every surface in the app is built from.
 *
 * Real glass in both modes: a translucent ash gradient over a blurred backdrop,
 * ringed by a lit 1px edge that is bright where the light lands and gone by the
 * bottom. Light mode raises the opacity and softens the shadow, because the
 * same alpha that reads as depth on black reads as dirt on white. The whole
 * treatment lives in `.bento-tile` in index.css.
 *
 * The hairline border stays underneath the lit ring on purpose: it is what
 * draws the tile on a browser without `backdrop-filter`, where the glass
 * collapses to a flat fill and the ring has nothing to sit on.
 */
export function Card({
  className,
  interactive = false,
  railColor,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'bento-tile relative overflow-hidden rounded-xl border border-hairline',
        interactive && 'is-interactive cursor-pointer',
        className,
      )}
      {...props}
    >
      {railColor ? (
        <span
          aria-hidden
          className="absolute left-0 top-6 h-14 w-[3px] rounded-r-full"
          style={{ backgroundColor: railColor, boxShadow: `0 0 18px 0 ${railColor}` }}
        />
      ) : null}
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold tracking-heading text-primary">
          {title}
        </h3>
        {subtitle ? <p className="mt-1 truncate text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

/** Small uppercase eyebrow above a section title. */
export function Eyebrow({
  icon,
  children,
  className,
}: {
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted', className)}>
      {icon}
      <span>{children}</span>
    </div>
  )
}
