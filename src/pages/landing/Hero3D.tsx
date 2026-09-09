import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Parallax stage for the hero.
 *
 * Real CSS 3D transforms on a handful of layers rather than a WebGL library:
 * this is decoration, and shipping three.js (~600KB) to float a few panels
 * would cost more than the entire rest of the bundle.
 *
 * Motion is pointer-driven, damped, and rAF-throttled. It is disabled for
 * `prefers-reduced-motion` and on coarse pointers, where there is no hover to
 * drive it and the listener would be pure overhead.
 */
export function Hero3D({
  children,
  className,
}: {
  children: (depth: (z: number) => CSSProperties) => ReactNode
  className?: string
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(pointer: fine)').matches
    setEnabled(!reduced && fine)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const stage = stageRef.current
    if (!stage) return

    let frame = 0
    function onMove(event: PointerEvent) {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const rect = stage!.getBoundingClientRect()
        const px = (event.clientX - rect.left) / rect.width - 0.5
        const py = (event.clientY - rect.top) / rect.height - 0.5
        // Small angles only. Past ~8deg the text on tilted planes goes soft.
        setTilt({ x: -py * 6, y: px * 8 })
      })
    }
    function onLeave() {
      setTilt({ x: 0, y: 0 })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    stage.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled])

  /** Push a layer toward or away from the viewer. */
  const depth = (z: number): CSSProperties => ({
    transform: `translateZ(${z}px)`,
    transformStyle: 'preserve-3d',
  })

  return (
    <div
      ref={stageRef}
      className={cn('[perspective:1500px]', className)}
      style={{ perspectiveOrigin: '50% 42%' }}
    >
      <div
        className="relative [transform-style:preserve-3d] transition-transform duration-500 ease-out"
        style={{ transform: enabled ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` : undefined }}
      >
        {children(depth)}
      </div>
    </div>
  )
}
