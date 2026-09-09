import { PageHeader } from '@/components/layout/AppShell'
import { Eyebrow } from '@/components/ui/Card'
import { PhaseStub } from './PhaseStub'

export function Compare() {
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Investigate</Eyebrow>}
        title="Compare"
        subtitle="Venn-diagram overlap between holder sets and trader cohorts."
      />
      <PhaseStub
        phase="Phase 4"
        summary="Select two or more tokens or wallet cohorts to see the intersection: which
        addresses hold both, which bought early in one and late in the other, and how much
        of each set overlaps."
      />
    </>
  )
}
