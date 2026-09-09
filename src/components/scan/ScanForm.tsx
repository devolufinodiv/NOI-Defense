import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardPaste, Loader2, ScanLine, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { isValidAddress, normalizeAddress } from '@/lib/address'
import { useAddressKind } from '@/lib/useAddressRouter'
import { useChainStore } from '@/store/chain'
import { track } from '@/lib/analytics'
import { ChainSelect } from './ChainSelect'

export type ScanTarget = 'token' | 'wallet' | 'auto'

const COPY: Record<ScanTarget, { placeholder: string; action: string; label: string }> = {
  token: {
    placeholder: 'Paste a token contract address (0x…)',
    action: 'Scan token',
    label: 'Token contract address',
  },
  wallet: {
    placeholder: 'Paste a wallet address (0x…)',
    action: 'Trace wallet',
    label: 'Wallet address',
  },
  auto: {
    placeholder: 'Paste any contract or wallet address (0x…)',
    action: 'Scan',
    label: 'Contract or wallet address',
  },
}

/**
 * Paste-and-scan input.
 *
 * `target` decides where a valid address goes. On `auto` the address is
 * classified with a `getCode` call first; if the RPC can't be reached we ask
 * rather than guess, since landing on the wrong page reads as a broken product.
 */
export function ScanForm({
  target = 'auto',
  size = 'md',
  autoFocus = false,
  className,
}: {
  target?: ScanTarget
  size?: 'md' | 'lg'
  autoFocus?: boolean
  className?: string
}) {
  const navigate = useNavigate()
  const resolveKind = useAddressKind()
  const chainId = useChainStore((state) => state.chainId)
  const setChainId = useChainStore((state) => state.setChainId)
  const inputId = useId()
  const errorId = `${inputId}-error`

  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ambiguous, setAmbiguous] = useState<`0x${string}` | null>(null)

  const copy = COPY[target]
  const large = size === 'lg'

  function go(kind: 'token' | 'wallet', address: string) {
    void track({ kind: 'search', chainId, subject: address, subjectKind: kind })
    // Chain rides in the query string so a scan link is shareable and resolves
    // to the same network for whoever opens it.
    navigate(`/${kind}/${address}?chain=${chainId}`)
    setValue('')
    setError(null)
    setAmbiguous(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setAmbiguous(null)

    const query = value.trim()
    if (!query) {
      setError('Paste an address to scan.')
      return
    }
    if (!isValidAddress(query)) {
      setError('That is not a valid address. Expected 0x followed by 40 hex characters.')
      return
    }

    // Canonical form everywhere: URL, cache keys, display.
    const address = normalizeAddress(query)

    if (target !== 'auto') {
      go(target, address)
      return
    }

    setBusy(true)
    const kind = await resolveKind(address, chainId)
    setBusy(false)
    if (kind) go(kind, address)
    else setAmbiguous(address)
  }

  /** Clipboard read needs a user gesture and can be denied — fail quietly. */
  async function onPaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setValue(text.trim())
        setError(null)
        setAmbiguous(null)
      }
    } catch {
      setError('Clipboard access was blocked. Paste with ⌘V instead.')
    }
  }

  return (
    <form onSubmit={onSubmit} className={cn('w-full', className)}>
      <div
        className={cn(
          // Wraps on phones so the network picker gets its own row rather than
          // being hidden — chain is not an optional detail when the same
          // address resolves differently on every network.
          'glass-panel flex flex-wrap items-center gap-2 rounded-lg border p-1.5 sm:flex-nowrap',
          error ? 'border-negative/60' : 'border-hairline focus-within:border-hairline-strong',
        )}
      >
        <ScanLine
          className={cn('ml-2 shrink-0 text-muted', large ? 'h-5 w-5' : 'h-4 w-4')}
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
            setAmbiguous(null)
          }}
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={copy.placeholder}
          aria-label={copy.label}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'min-w-0 flex-1 bg-transparent font-mono text-primary placeholder:font-sans placeholder:text-muted focus:outline-none',
            large ? 'h-12 text-sm' : 'h-10 text-xs',
          )}
        />

        <ChainSelect
          chainId={chainId}
          onChange={setChainId}
          className="order-last w-full sm:order-none sm:w-auto"
        />

        <button
          type="button"
          onClick={onPaste}
          aria-label="Paste from clipboard"
          title="Paste from clipboard"
          className="hidden h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-sm text-muted transition-colors duration-180 hover:bg-raised hover:text-primary sm:grid"
        >
          <ClipboardPaste className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>

        <Button type="submit" variant="primary" size={large ? 'lg' : 'md'} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
              Checking…
            </>
          ) : (
            copy.action
          )}
        </Button>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-2 flex items-start gap-2 text-xs text-negative">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {error}
        </p>
      ) : null}

      {ambiguous ? (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-secondary">
          <span>Couldn&rsquo;t reach the RPC to tell a contract from a wallet. Open as:</span>
          <Button type="button" size="sm" variant="secondary" onClick={() => go('token', ambiguous)}>
            Token
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => go('wallet', ambiguous)}>
            Wallet
          </Button>
        </div>
      ) : null}
    </form>
  )
}
