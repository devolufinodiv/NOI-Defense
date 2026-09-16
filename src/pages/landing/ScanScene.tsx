import { useEffect, useRef } from 'react'

/**
 * The hero's moving backdrop: a network being swept by a scan.
 *
 * Drawn rather than filmed. A video would be a megabyte of download for
 * something that has to sit behind live text in two themes, and a stock loop of
 * abstract "technology" says nothing about this product. This says the true
 * thing — addresses, the links between them, and a sweep that lights each one
 * as it passes over.
 *
 * Three rules it has to keep:
 *  - Colour comes from the theme, read from the CSS variables and re-read when
 *    the theme changes, so it never fights the palette it sits in.
 *  - `prefers-reduced-motion` gets one still frame, not a slower animation.
 *  - It stops entirely when the tab is hidden or the element is off-screen.
 *    A landing page must not burn a phone battery to decorate itself.
 */

interface Node {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** 0–1, how recently the sweep passed over this node. */
  lit: number
}

const NODE_TARGET_AREA = 26_000 // one node per this many CSS pixels
const LINK_DISTANCE = 132
const SWEEP_SECONDS = 7

function readPalette() {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => {
    const raw = style.getPropertyValue(name).trim()
    return raw ? raw.split(/[\s,]+/).slice(0, 3).join(', ') : fallback
  }
  return {
    node: v('--c-chrome-2', '140, 140, 151'),
    linkRgb: v('--c-border-strong', '51, 51, 58'),
    litRgb: v('--c-chrome-0', '255, 255, 255'),
  }
}

export function ScanScene({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let palette = readPalette()
    let width = 0
    let height = 0
    let nodes: Node[] = []
    let frame = 0
    let running = true
    let start = performance.now()

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.max(18, Math.min(90, Math.round((width * height) / NODE_TARGET_AREA)))
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: 0.9 + Math.random() * 1.7,
        lit: 0,
      }))
    }

    function draw(now: number) {
      const elapsed = (now - start) / 1000
      ctx!.clearRect(0, 0, width, height)

      // The sweep is a ring expanding from just above the centre, which is
      // where the headline sits — it reads as the page itself being scanned.
      const cx = width * 0.5
      const cy = height * 0.42
      const maxRadius = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy))
      const sweep = reduced ? maxRadius * 0.55 : ((elapsed % SWEEP_SECONDS) / SWEEP_SECONDS) * maxRadius

      for (const n of nodes) {
        if (!reduced) {
          n.x += n.vx
          n.y += n.vy
          if (n.x < -20) n.x = width + 20
          if (n.x > width + 20) n.x = -20
          if (n.y < -20) n.y = height + 20
          if (n.y > height + 20) n.y = -20
        }

        const distance = Math.abs(Math.hypot(n.x - cx, n.y - cy) - sweep)
        if (distance < 46) n.lit = Math.max(n.lit, 1 - distance / 46)
        else n.lit *= reduced ? 1 : 0.972
      }

      // Links first, so nodes sit on top of them.
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i]
          const b = nodes[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d > LINK_DISTANCE) continue

          const proximity = 1 - d / LINK_DISTANCE
          const glow = Math.max(a.lit, b.lit)
          ctx!.strokeStyle = `rgba(${glow > 0.05 ? palette.litRgb : palette.linkRgb}, ${
            proximity * (0.16 + glow * 0.5)
          })`
          ctx!.lineWidth = 0.7
          ctx!.beginPath()
          ctx!.moveTo(a.x, a.y)
          ctx!.lineTo(b.x, b.y)
          ctx!.stroke()
        }
      }

      for (const n of nodes) {
        ctx!.fillStyle = `rgba(${n.lit > 0.05 ? palette.litRgb : palette.node}, ${0.3 + n.lit * 0.7})`
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, n.r + n.lit * 1.6, 0, Math.PI * 2)
        ctx!.fill()

        if (n.lit > 0.25) {
          ctx!.fillStyle = `rgba(${palette.litRgb}, ${n.lit * 0.1})`
          ctx!.beginPath()
          ctx!.arc(n.x, n.y, (n.r + 2) * 3.4 * n.lit, 0, Math.PI * 2)
          ctx!.fill()
        }
      }

      if (running && !reduced) frame = requestAnimationFrame(draw)
    }

    resize()
    frame = requestAnimationFrame(draw)

    const onResize = () => {
      resize()
      if (reduced) requestAnimationFrame(draw)
    }
    window.addEventListener('resize', onResize)

    // Stop when the tab is hidden: an invisible canvas has no business holding
    // a frame loop open.
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(frame)
      } else if (!reduced) {
        running = true
        start = performance.now()
        frame = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Same when it scrolls out of view.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !document.hidden && !reduced) {
          if (!running) {
            running = true
            start = performance.now()
            frame = requestAnimationFrame(draw)
          }
        } else {
          running = false
          cancelAnimationFrame(frame)
        }
      },
      { threshold: 0 },
    )
    observer.observe(canvas)

    // The palette swaps under us when the theme toggles.
    const themeWatcher = new MutationObserver(() => {
      palette = readPalette()
      if (reduced) requestAnimationFrame(draw)
    })
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    })

    return () => {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      observer.disconnect()
      themeWatcher.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden className={className} />
}
