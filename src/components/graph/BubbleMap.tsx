import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { useThemeTokens } from '@/design/useThemeTokens'
import { truncateAddress } from '@/lib/format'

/**
 * Wallet relationship bubble map.
 *
 * Library choice: `react-force-graph-2d` (vasturiano) over hand-rolled d3-force.
 *  • It *is* d3-force underneath, so the simulation is identical.
 *  • Canvas rather than SVG, which is what keeps thousands of counterparty
 *    nodes interactive.
 *  • `nodeCanvasObject` hands over the raw 2D context, so we lose no styling
 *    control — every node below is drawn with our own tokens.
 *  • Pan, zoom, hit-testing and drag come for free.
 * The `-2d` entrypoint is deliberate: the umbrella `react-force-graph` package
 * pulls in three.js for its 3D/VR renderers.
 */

export interface BubbleNode {
  id: string
  /** Relative weight — drives radius. */
  weight: number
  tone?: 'neutral' | 'positive' | 'negative' | 'accent'
}

export interface BubbleLink {
  source: string
  target: string
  weight: number
}

export function BubbleMap({
  nodes,
  links,
  height = 320,
}: {
  nodes: BubbleNode[]
  links: BubbleLink[]
  height?: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const { color } = useThemeTokens()

  const toneColors = useMemo(
    () => ({
      neutral: color.textMuted,
      positive: color.positive,
      negative: color.negative,
      accent: color.accentText,
    }),
    [color],
  )

  // ForceGraph2D needs explicit pixel dimensions; track the container instead.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The simulation mutates the objects it is given, so hand it fresh copies.
  const graphData = useMemo(
    () => ({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) }),
    [nodes, links],
  )

  return (
    <div ref={containerRef} style={{ height }} className="w-full overflow-hidden">
      {width > 0 ? (
        <ForceGraph2D
          width={width}
          height={height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          cooldownTicks={80}
          enableNodeDrag
          linkColor={() => color.border}
          linkWidth={(link) => 0.4 + (link as unknown as BubbleLink).weight * 1.6}
          nodeRelSize={1}
          nodeLabel={(node) => truncateAddress((node as BubbleNode).id)}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const typed = node as BubbleNode & { x?: number; y?: number }
            if (typed.x == null || typed.y == null) return

            const radius = 4 + typed.weight * 10
            const stroke = toneColors[typed.tone ?? 'neutral']

            // Halo, hairline ring, dark core — the same visual grammar as the
            // cards: edges and glow, never flat fills.
            ctx.beginPath()
            ctx.arc(typed.x, typed.y, radius, 0, 2 * Math.PI)
            ctx.fillStyle = `${stroke}1f`
            ctx.fill()

            ctx.lineWidth = 1 / globalScale
            ctx.strokeStyle = stroke
            ctx.stroke()

            // Label only once zoomed in enough to be legible.
            if (globalScale > 1.4) {
              ctx.font = `${9 / globalScale}px "JetBrains Mono", monospace`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillStyle = color.textMuted
              ctx.fillText(
                truncateAddress(typed.id, 6, 4),
                typed.x,
                typed.y + radius + 3 / globalScale,
              )
            }
          }}
        />
      ) : null}
    </div>
  )
}
