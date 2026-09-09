import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

type Align = 'start' | 'end'

interface Position {
  top: number
  left: number
  /** Space available to the popover, so long lists can scroll instead of clipping. */
  maxHeight: number
}

/**
 * Dropdown rendered into a portal on `document.body`.
 *
 * This is not premature abstraction — it is the only reliable fix for the class
 * of bug where a menu is painted over by later siblings. Our `.glass-panel`
 * surfaces set `isolation: isolate` (required so their `z-index: -1` edge-ring
 * stays behind the panel and not behind the page), and that creates a stacking
 * context. Any absolutely-positioned child is then trapped inside it, so no
 * z-index can lift it above a sibling card that comes later in the DOM.
 *
 * Escaping to the body sidesteps every ancestor stacking context, transform and
 * `overflow: hidden` at once. The cost is that position must be computed and
 * kept in sync, which is what the rest of this file does.
 */
export function AnchoredPopover({
  anchorRef,
  open,
  onClose,
  align = 'end',
  gap = 8,
  className,
  children,
  ...aria
}: {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  /** Which edge of the anchor the popover lines up with. */
  align?: Align
  gap?: number
  className?: string
  children: ReactNode
  role?: string
  'aria-label'?: string
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)

  const reposition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return

    const rect = anchor.getBoundingClientRect()
    const popover = popoverRef.current
    const width = popover?.offsetWidth ?? 0
    const height = popover?.offsetHeight ?? 0
    const margin = 8

    const spaceBelow = window.innerHeight - rect.bottom - gap - margin
    const spaceAbove = rect.top - gap - margin
    // Flip up only when below genuinely can't hold it and above is roomier.
    const flip = spaceBelow < Math.min(height, 200) && spaceAbove > spaceBelow

    let left = align === 'end' ? rect.right - width : rect.left
    // Never let it hang off either edge of the viewport.
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))

    setPosition({
      top: flip ? Math.max(margin, rect.top - gap - height) : rect.bottom + gap,
      left,
      maxHeight: Math.max(140, flip ? spaceAbove : spaceBelow),
    })
  }, [anchorRef, align, gap])

  // Measure before paint so the popover never flashes at the wrong spot.
  useLayoutEffect(() => {
    if (open) reposition()
  }, [open, reposition])

  useEffect(() => {
    if (!open) return

    // `capture: true` catches scrolls on any ancestor, not just the window —
    // the anchor often lives inside its own scrolling container.
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
        // Send focus back where it came from, or the user is stranded.
        anchorRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, reposition, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div
      ref={popoverRef}
      {...aria}
      style={{
        position: 'fixed',
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        maxHeight: position?.maxHeight,
        // Above every in-page layer. The portal is a direct child of <body>,
        // so this competes only with other portals.
        zIndex: 60,
        // Hidden until measured, so it can't flash in the corner on open.
        visibility: position ? 'visible' : 'hidden',
      }}
      className={cn(
        'glass-panel overflow-y-auto rounded-md border border-hairline p-1 shadow-glass-lift',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  )
}
