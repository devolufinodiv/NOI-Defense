import { Link } from 'react-router-dom'
import { Radar, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { chainMeta } from '@/config/chains'
import { useChainStore } from '@/store/chain'
import { Card } from '@/components/ui/Card'
import { TokenMark } from '@/components/ui/TokenMark'
import { ScanForm } from '@/components/scan/ScanForm'
import { HashRef } from '@/components/ui/Address'
import { MOCK_TOKENS, MOCK_WALLETS } from '@/mock'
import { truncateAddress } from '@/lib/format'

interface EntryCopy {
  eyebrow: string
  title: string
  subtitle: string
  checks: string[]
}

const COPY: Record<'token' | 'wallet', EntryCopy> = {
  token: {
    eyebrow: 'Token scan',
    title: 'Scan a contract',
    subtitle:
      'Paste any token contract to get a health score, holder distribution, the first buyers from the creation block, and live trade flow.',
    checks: [
      'Holder concentration and top-10 supply share',
      'Liquidity depth and LP lock status',
      'Owner privileges, transfer tax, source verification',
      'Early buyers and who is still holding',
    ],
  },
  wallet: {
    eyebrow: 'Wallet trace',
    title: 'Trace a wallet',
    subtitle:
      'Paste any address to see realised P&L, win rate, holdings, and the counterparty graph of who it trades with.',
    checks: [
      'Realised and unrealised P&L',
      'Win rate and trade history',
      'Current holdings across tracked tokens',
      'Counterparty relationship map',
    ],
  },
}

/**
 * Landing step for the scanner routes.
 *
 * `/token` and `/wallet` ask for an address rather than auto-loading a sample —
 * dropping someone into a pre-scanned token they never asked for makes the tool
 * feel like a demo instead of an instrument.
 */
export function ScanEntry({ kind }: { kind: 'token' | 'wallet' }) {
  const copy = COPY[kind]
  const Icon = kind === 'token' ? Radar : Wallet
  const chainId = useChainStore((state) => state.chainId)
  const network = chainMeta(chainId)

  return (
    <>
      <PageHeader
        eyebrow={
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{copy.eyebrow}</span>
            {network ? <span className="chip">{network.label}</span> : null}
          </div>
        }
        title={copy.title}
        subtitle={copy.subtitle}
      />

      <div className="w-full px-4 pb-16 sm:px-6 md:px-8 xl:px-10">
        <div className="w-full">
          <ScanForm target={kind} size="lg" autoFocus />

          <Card className="mt-8 w-full">
            <div className="flex items-start gap-4 p-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline bg-raised text-secondary">
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-primary">What you get</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {copy.checks.map((check) => (
                    <li key={check} className="flex items-start gap-2.5 text-sm text-secondary">
                      <span
                        aria-hidden
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted"
                      />
                      {check}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <section className="mt-8">
            <h2 className="text-xs font-medium text-muted">
              {kind === 'token' ? 'Or start from a known contract' : 'Or start from a tracked wallet'}
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {kind === 'token'
                ? MOCK_TOKENS.slice(0, 4).map((token) => (
                    <li key={token.address}>
                      <Link
                        to={`/token/${token.address}`}
                        className="glass-panel flex items-center gap-3 rounded-md border border-hairline p-3 transition-colors duration-180 hover:border-hairline-strong"
                      >
                        <TokenMark symbol={token.symbol} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-primary">
                            {token.name}
                          </span>
                          <span className="block truncate font-mono text-2xs text-muted">
                            {truncateAddress(token.address)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))
                : MOCK_WALLETS.slice(0, 4).map((wallet) => (
                    <li
                      key={wallet.address}
                      className="glass-panel flex items-center gap-3 rounded-md border border-hairline p-3"
                    >
                      <HashRef
                        value={wallet.address}
                        to={`/wallet/${wallet.address}`}
                        hideExplorer
                      />
                      <span className="ml-auto shrink-0 text-2xs text-muted">
                        {wallet.tags[0]}
                      </span>
                    </li>
                  ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
