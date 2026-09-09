import { PageHeader } from '@/components/layout/AppShell'
import { Eyebrow } from '@/components/ui/Card'
import { PhaseStub } from './PhaseStub'

export function Alerts() {
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Monitor</Eyebrow>}
        title="Alerts"
        subtitle="Transaction triggers on watched wallets and contracts."
      />
      <PhaseStub
        phase="Phase 5"
        summary="Rules that fire on transfers, swaps and approvals from watched addresses,
        with delivery to the in-app feed and push. Requires the Supabase tables and the
        indexer webhook from the data phase."
      />
    </>
  )
}
