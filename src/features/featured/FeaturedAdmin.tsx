import { useState, type FormEvent } from 'react'
import { CheckCircle2, ClipboardPaste, Pin, TriangleAlert, X } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HashRef } from '@/components/ui/Address'
import { ChainSelect } from '@/components/scan/ChainSelect'
import { chainMeta, defaultChainMeta } from '@/config/chains'
import { cn } from '@/lib/cn'
import {
  useFeaturedPins,
  usePinToken,
  useUnpinToken,
  type PinResult,
} from './queries'

/**
 * Admin control for the featured list.
 *
 * Paste a contract, pick its network, done. The pin runs a scan first, so the
 * card that appears on the dashboard is backed by the same figures as any other
 * scan — there is no way to feature an address we know nothing about.
 *
 * Pins occupy the front of the list in the order they were added; whatever is
 * most scanned fills the rest. Removing every pin is a valid state, and returns
 * the section to pure measurement.
 */
export function FeaturedAdmin() {
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState(defaultChainMeta.chain.id)
  const [done, setDone] = useState<PinResult | null>(null)

  const pins = useFeaturedPins(true)
  const pin = usePinToken()
  const unpin = useUnpinToken()

  function submit(event: FormEvent) {
    event.preventDefault()
    setDone(null)
    pin.mutate(
      { chainId, address },
      {
        onSuccess: (result) => {
          setDone(result)
          setAddress('')
        },
      },
    )
  }

  async function paste() {
    try {
      setAddress((await navigator.clipboard.readText()).trim())
    } catch {
      // Clipboard access can be blocked; the field still accepts ⌘V directly.
    }
  }

  return (
    <Card>
      <CardHeader
        title="Featured tokens"
        subtitle="Pinned first, then whatever is scanned most"
      />
      <CardBody className="space-y-4 pt-4">
        <form onSubmit={submit} className="space-y-2">
          <div
            className={cn(
              'glass-panel flex flex-wrap items-center gap-2 rounded-lg border p-1.5 sm:flex-nowrap',
              pin.isError ? 'border-negative/60' : 'border-hairline focus-within:border-hairline-strong',
            )}
          >
            <input
              value={address}
              onChange={(event) => {
                setAddress(event.target.value)
                setDone(null)
                pin.reset()
              }}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              placeholder="Paste a contract address"
              aria-label="Contract address to feature"
              aria-invalid={pin.isError}
              className="ml-2 h-10 min-w-0 flex-1 bg-transparent font-mono text-xs text-primary placeholder:font-sans placeholder:text-muted focus:outline-none"
            />

            <ChainSelect
              chainId={chainId}
              onChange={setChainId}
              className="order-last w-full sm:order-none sm:w-auto"
            />

            <button
              type="button"
              onClick={paste}
              aria-label="Paste from clipboard"
              title="Paste from clipboard"
              className="hidden h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-sm text-muted transition-colors duration-180 hover:bg-raised hover:text-primary sm:grid"
            >
              <ClipboardPaste className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>

            <Button type="submit" variant="primary" size="md" disabled={pin.isPending}>
              {pin.isPending ? 'Scanning…' : 'Feature'}
            </Button>
          </div>

          <p className="text-xs text-muted">
            The address is scanned before it is pinned, which is what fills in its name, price and
            safety figures.
          </p>

          {pin.isError ? (
            <p className="flex items-start gap-2 text-xs text-negative" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {pin.error.message}
            </p>
          ) : null}

          {done ? (
            <p className="flex items-start gap-2 text-xs text-positive" role="status">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Featured {done.symbol || done.name || 'that contract'} — scan verdict:{' '}
              {done.tier}.
            </p>
          ) : null}
        </form>

        <div className="border-t border-hairline pt-4">
          {pins.isLoading ? (
            <p className="text-xs text-muted">Loading pins…</p>
          ) : !pins.data || pins.data.length === 0 ? (
            <p className="text-xs text-muted">
              Nothing pinned. The section is showing the most scanned tokens on their own.
            </p>
          ) : (
            <ul className="space-y-2">
              {pins.data.map((row) => (
                <li
                  key={`${row.chain_id}:${row.address}`}
                  className="flex items-center gap-3 text-xs"
                >
                  <Pin className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                  <HashRef value={row.address} chainId={row.chain_id} kind="token" />
                  <span className="truncate text-muted">
                    {chainMeta(row.chain_id)?.label ?? `Chain ${row.chain_id}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => unpin.mutate({ chainId: row.chain_id, address: row.address })}
                    disabled={unpin.isPending}
                    aria-label={`Remove ${row.address} from featured`}
                    className="ml-auto grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-sm text-muted transition-colors duration-180 hover:bg-raised hover:text-primary"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {unpin.isError ? (
            <p className="mt-2 text-xs text-negative" role="alert">
              {unpin.error.message}
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  )
}
