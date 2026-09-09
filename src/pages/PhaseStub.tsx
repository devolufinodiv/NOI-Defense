import type { ReactNode } from 'react'
import { Hammer } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

/**
 * Honest placeholder for routes that exist but have no data layer yet. States
 * what will live here rather than faking a populated screen.
 */
export function PhaseStub({
  phase,
  summary,
  children,
}: {
  phase: string
  summary: string
  children?: ReactNode
}) {
  return (
    <Card className="mx-4 my-6 sm:mx-6 md:mx-8 xl:mx-10">
      <div className="flex flex-col items-start gap-4 p-8">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-hairline bg-raised text-muted">
          <Hammer className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <Badge tone="accent">Not built yet · {phase}</Badge>
        <p className="max-w-prose text-sm leading-relaxed text-secondary">{summary}</p>
        {children}
      </div>
    </Card>
  )
}
