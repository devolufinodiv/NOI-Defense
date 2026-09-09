import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'subtle' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  // The one filled accent. At most one per view.
  primary:
    'bg-accent text-accent-on shadow-nav hover:bg-accent/90 active:bg-accent/80 disabled:bg-accent/40',
  secondary:
    'bg-raised text-primary border border-hairline shadow-card hover:border-hairline-strong hover:bg-raised/70',
  // Tinted chip — the "All" filter register from the reference.
  subtle:
    'bg-accent/12 text-accent-text border border-accent/25 hover:bg-accent/20',
  danger:
    'bg-negative/10 text-negative border border-negative/30 hover:bg-negative/16 hover:border-negative/50',
  ghost: 'bg-transparent text-secondary hover:bg-raised hover:text-primary',
}

const SIZES: Record<Size, string> = {
  // Heights keep the 44px touch target reachable at `lg`; sm/md are for
  // pointer-dense areas and get padded hit areas where they're tappable.
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-sm',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-sm gap-2 rounded-md',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium',
        'transition-colors duration-180',
        'disabled:cursor-not-allowed disabled:opacity-50',
        !props.disabled && 'cursor-pointer',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
})

/** Square icon-only control. Always needs an aria-label from the caller. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }
>(function IconButton({ className, size = 'md', ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-grid shrink-0 cursor-pointer place-items-center rounded-sm',
        'border border-hairline bg-raised/60 text-secondary',
        'transition-colors duration-180 hover:border-hairline-strong hover:bg-raised hover:text-primary',
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
        className,
      )}
      {...props}
    />
  )
})
