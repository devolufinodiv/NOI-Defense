import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Brings an element up as it enters the viewport.
 *
 * Reveals once and then stops observing — content that re-hides when you scroll
 * back up reads as a glitch, not as polish. Under `prefers-reduced-motion` the
 * element simply starts visible, because the point of the effect is emphasis
 * and emphasis must not cost anyone their ability to read the page.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setShown(true)
        observer.disconnect()
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }}
      className={cn(
        'transition-[opacity,transform,filter] duration-700 ease-out motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-4 opacity-0 blur-[2px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
