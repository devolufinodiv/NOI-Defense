import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { isValidAddress } from '@/lib/address'
import { track } from '@/lib/analytics'
import { useChainStore } from '@/store/chain'
import { PageHeader } from '@/components/layout/AppShell'
import { HashRef } from '@/components/ui/Address'
import { Badge } from '@/components/ui/Badge'
import { Eyebrow } from '@/components/ui/Card'
import { ScanForm } from '@/components/scan/ScanForm'
import { PhaseStub } from './PhaseStub'

export function WalletDetail() {
  const { address = '' } = useParams()
  const [searchParams] = useSearchParams()
  const storeChainId = useChainStore((state) => state.chainId)
  const valid = isValidAddress(address)

  const parsedChain = Number.parseInt(searchParams.get('chain') ?? '', 10)
  const chainId = Number.isFinite(parsedChain) ? parsedChain : storeChainId

  useEffect(() => {
    if (!valid) return
    void track({ kind: 'wallet_trace', chainId, subject: address, subjectKind: 'wallet' })
  }, [valid, chainId, address])

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Wallet trace</Eyebrow>}
        title="Address"
        subtitle={
          valid ? (
            <HashRef value={address} kind="address" />
          ) : (
            <Badge tone="negative">Invalid address</Badge>
          )
        }
      />
      <div className="w-full px-4 sm:px-6 md:px-8 xl:px-10">
        <ScanForm target="wallet" />
      </div>
      <PhaseStub
        phase="Phase 3"
        summary="Realised and unrealised P&L, win rate, holdings, trade history, applied
        tags, and the relationship bubble map of counterparties for this address."
      />
    </>
  )
}
