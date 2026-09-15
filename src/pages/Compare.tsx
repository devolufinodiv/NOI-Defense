import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardPaste, Info, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { Card, CardBody, Eyebrow } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ChainSelect } from '@/components/scan/ChainSelect'
import { defaultChainMeta } from '@/config/chains'
import { cn } from '@/lib/cn'
import { CompareTable, type Column } from '@/features/compare/CompareTable'
import {
  decodeTargets,
  encodeTarget,
  MAX_TARGETS,
  useTokenProfiles,
  type CompareTarget,
} from '@/features/compare/queries'

const ADDRESS = /^0x[0-9a-fA-F]{40}$/

/**
 * Compare two or three tokens across the things that actually differ between
 * them: what the contract can do, how it has traded over several windows, how
 * supply and depth are arranged, and what the safety checks found.
 *
 * The selection lives in the URL so a comparison can be sent to someone else.
 */
export function Compare() {
  const [params, setParams] = useSearchParams()
  const targets = decodeTargets(params.getAll('t'))

  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState(defaultChainMeta.chain.id)
  const [error, setError] = useState<string | null>(null)

  const results = useTokenProfiles(targets)

  const columns: Column[] = targets.map((target, index) => ({
    key: encodeTarget(target),
    chainId: target.chainId,
    address: target.address,
    profile: results[index]?.data,
    isLoading: results[index]?.isLoading ?? false,
    error: (results[index]?.error as Error | null) ?? null,
  }))

  function setTargets(next: CompareTarget[]) {
    const search = new URLSearchParams()
    for (const target of next) search.append('t', encodeTarget(target))
    setParams(search, { replace: false })
  }

  function add(event: FormEvent) {
    event.preventDefault()
    const trimmed = address.trim()

    if (!ADDRESS.test(trimmed)) {
      setError('That does not look like a contract address — it should be 0x followed by 40 characters.')
      return
    }
    if (targets.length >= MAX_TARGETS) {
      setError(`Three at a time is the limit — remove one first.`)
      return
    }
    const next = { chainId, address: trimmed.toLowerCase() }
    if (targets.some((t) => t.chainId === next.chainId && t.address === next.address)) {
      setError('That token is already in the comparison.')
      return
    }

    setError(null)
    setAddress('')
    setTargets([...targets, next])
  }

  async function paste() {
    try {
      setAddress((await navigator.clipboard.readText()).trim())
      setError(null)
    } catch {
      // Clipboard access can be blocked; the field still accepts ⌘V directly.
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Investigate</Eyebrow>}
        title="Compare"
        subtitle="Up to three tokens, side by side, on the things that decide between them."
      />

      <div className="space-y-6 px-4 pb-12 pt-6 md:px-8">
        <form onSubmit={add} className="space-y-2">
          <div
            className={cn(
              'glass-panel flex max-w-3xl flex-wrap items-center gap-2 rounded-lg border p-1.5 sm:flex-nowrap',
              error ? 'border-negative/60' : 'border-hairline focus-within:border-hairline-strong',
            )}
          >
            <input
              value={address}
              onChange={(event) => {
                setAddress(event.target.value)
                setError(null)
              }}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              placeholder="Paste a token contract address"
              aria-label="Token contract address to compare"
              aria-invalid={error !== null}
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

            <Button type="submit" variant="primary" size="md" disabled={targets.length >= MAX_TARGETS}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              Add
            </Button>
          </div>

          {error ? (
            <p className="text-xs text-negative" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        {targets.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {columns.map((column) => (
              <span
                key={column.key}
                className="chip gap-2 pr-1 text-xs"
              >
                {column.profile?.token.symbol || `${column.address.slice(0, 6)}…${column.address.slice(-4)}`}
                <button
                  type="button"
                  onClick={() =>
                    setTargets(
                      targets.filter(
                        (t) => !(t.chainId === column.chainId && t.address === column.address),
                      ),
                    )
                  }
                  aria-label={`Remove ${column.address} from the comparison`}
                  className="grid h-5 w-5 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-180 hover:bg-raised hover:text-primary"
                >
                  <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {targets.length === 0 ? (
          <Card>
            <CardBody className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
              <div className="space-y-1">
                <p className="text-sm text-secondary">
                  Add a token to start. Every figure comes from a live read — the contract's own
                  interface, its trading across four time windows, its supply and pool depth, and a
                  simulated buy and sale.
                </p>
                <p className="text-xs text-muted">
                  Up to three at a time. The comparison lives in the address bar, so you can send it
                  to someone.
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <CompareTable columns={columns} />
        )}
      </div>
    </>
  )
}
