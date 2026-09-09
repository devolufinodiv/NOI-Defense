import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * The hero ornament: a four-point chrome star, the brand mark at display scale.
 *
 * Pure SVG with layered gradients rather than an image, so it stays crisp at
 * any size, re-tints with the theme (the stops read the chrome CSS variables),
 * and costs nothing to download. The slow spin and shimmer are decorative and
 * are dropped under `prefers-reduced-motion` by the global rule in index.css.
 */
export function ChromeStar({ className }: { className?: string }) {
  const id = useId()
  const body = `${id}-body`
  const core = `${id}-core`
  const halo = `${id}-halo`

  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden focusable="false">
      <defs>
        <radialGradient id={halo}>
          <stop offset="0%" stopColor="rgb(var(--c-chrome-1))" stopOpacity="0.28" />
          <stop offset="55%" stopColor="rgb(var(--c-chrome-2))" stopOpacity="0.08" />
          <stop offset="100%" stopColor="rgb(var(--c-chrome-3))" stopOpacity="0" />
        </radialGradient>

        {/* Off-axis so one pair of arms catches light and the other falls into
            shadow — an evenly lit star reads flat rather than metallic. */}
        <linearGradient id={body} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="rgb(var(--c-chrome-0))" />
          <stop offset="30%" stopColor="rgb(var(--c-chrome-1))" />
          <stop offset="52%" stopColor="rgb(var(--c-chrome-3))" />
          <stop offset="70%" stopColor="rgb(var(--c-chrome-1))" />
          <stop offset="100%" stopColor="rgb(var(--c-chrome-2))" />
        </linearGradient>

        <linearGradient id={core} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--c-chrome-0))" />
          <stop offset="100%" stopColor="rgb(var(--c-chrome-2))" />
        </linearGradient>
      </defs>

      <circle cx="200" cy="200" r="190" fill={`url(#${halo})`} />

      <g className="origin-center animate-[spin_48s_linear_infinite]">
        <path
          fill={`url(#${body})`}
          d="M200 18c5 63 20 106 48 134s71 43 134 48c-63 5-106 20-134 48s-43 71-48 134c-5-63-20-106-48-134s-71-43-134-48c63-5 106-20 134-48s43-71 48-134Z"
        />
        {/* Secondary star, smaller and counter-rotated, for depth. */}
        <path
          fill={`url(#${core})`}
          opacity="0.55"
          transform="rotate(45 200 200) scale(0.42) translate(276 276)"
          d="M200 18c5 63 20 106 48 134s71 43 134 48c-63 5-106 20-134 48s-43 71-48 134c-5-63-20-106-48-134s-71-43-134-48c63-5 106-20 134-48s43-71 48-134Z"
        />
      </g>
    </svg>
  )
}

/** Small companion sparkle, used to break the symmetry of the main star. */
export function ChromeSpark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 100 100" className={cn('animate-pulse-dot', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--c-chrome-0))" />
          <stop offset="100%" stopColor="rgb(var(--c-chrome-2))" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M50 4c1.3 16 5 27 12 34s18 10.7 34 12c-16 1.3-27 5-34 12s-10.7 18-12 34c-1.3-16-5-27-12-34S20 51.3 4 50c16-1.3 27-5 34-12s10.7-18 12-34Z"
      />
    </svg>
  )
}
