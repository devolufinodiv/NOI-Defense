import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lifts on hover. Use for cards that navigate somewhere. */
  interactive?: boolean
  /** Coloured rail down the left edge — token identity, never gain/loss. */
  railColor?: string
}

/**
 * Elevated panel.
 *
 * In dark mode this is real glass: a translucent ash gradient over a blurred
 * backdrop, with a top-lit hairline that falls off down the edge. In light mode
 * it collapses to a crisp opaque card — stacked translucency on white reads as
 * muddy, not premium. Both live in the `.glass-panel` rule in index.css.
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
        'glass-panel relative overflow-hidden rounded-xl border border-hairline',
        interactive &&
          'cursor-pointer transition-[transform,border-color,box-shadow] duration-180 hover:-translate-y-0.5 hover:border-hairline-strong hover:shadow-glass-lift',
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
