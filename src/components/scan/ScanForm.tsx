import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardPaste, Loader2, ScanLine, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { extractAddress, isValidAddress, normalizeAddress } from '@/lib/address'
import { useAddressKind } from '@/lib/useAddressRouter'
import { preferredChain, useAddressChains } from '@/lib/useAddressChains'
import { useChainStore } from '@/store/chain'
import { chainMeta } from '@/config/chains'
import { track } from '@/lib/analytics'

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
  const detectChains = useAddressChains()
  const chainId = useChainStore((state) => state.chainId)
  const inputId = useId()
  const errorId = `${inputId}-error`

  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ambiguous, setAmbiguous] = useState<`0x${string}` | null>(null)
  /** What the network probe found, shown while the scan is being set up. */
  const [detected, setDetected] = useState<string | null>(null)

  /** Pending auto-scan, and the address it already fired for. */
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedFor = useRef<string | null>(null)

  const copy = COPY[target]
  const large = size === 'lg'

  function go(kind: 'token' | 'wallet', address: string, on = chainId, also: number[] = []) {
    void track({ kind: 'search', chainId: on, subject: address, subjectKind: kind })
    // Chain rides in the query string so a scan link is shareable and resolves
    // to the same network for whoever opens it. `also` carries the other
    // networks the same contract lives on, so the report can offer them rather
    // than making someone come back and guess again.
    const extra = also.length > 0 ? `&also=${also.join(',')}` : ''
    navigate(`/${kind}/${address}?chain=${on}${extra}`)
    setValue('')
    setError(null)
    setAmbiguous(null)
    setDetected(null)
  }

  /**
   * Runs the scan. Shared by the button and by the automatic trigger below, so
   * a pasted address and a clicked one can never behave differently.
   */
  const run = useCallback(
    async (query: string) => {
      setError(null)
      setAmbiguous(null)

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
      setDetected('Checking networks…')

      /*
       * Find the networks the contract is actually on, instead of asking first.
       * A wallet has no code anywhere, which is itself the answer: fall back to
       * the selected network, since a wallet's balance is per-network and there
       * is nothing to detect.
       */
      const { contracts, unreachable } = await detectChains(address)
      const chosen = preferredChain(contracts, chainId)

      if (chosen !== null) {
        const others = contracts.filter((id) => id !== chosen)
        setDetected(`Found on ${chainMeta(chosen)?.label ?? chosen}`)
        setBusy(false)
        go('token', address, chosen, others)
        return
      }

      // No bytecode anywhere we could reach. If some networks did not answer we
      // cannot call it a wallet, so ask rather than assert.
      if (unreachable.length > 0 && contracts.length === 0) {
        const kind = await resolveKind(address, chainId)
        setBusy(false)
        setDetected(null)
        if (kind) go(kind, address)
        else setAmbiguous(address)
        return
      }

      setBusy(false)
      setDetected(null)
      go('wallet', address)
    },
    // `go` closes over navigate/chainId only, both stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, chainId, resolveKind],
  )

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    // A submit while the debounce is pending should win immediately.
    if (autoTimer.current) clearTimeout(autoTimer.current)
    void run(value.trim())
  }

  /**
   * Scans as soon as the box holds a valid address, without waiting for a
   * click.
   *
   * Debounced rather than immediate: typing an address character by character
   * passes through several shorter strings, and the last one is the only one
   * worth acting on. `startedFor` makes the scan fire once per address — the
   * effect re-runs whenever anything in the form changes, and without it a
   * failed classification would retry in a loop.
   */
  useEffect(() => {
    const query = value.trim()

    if (busy || ambiguous || !isValidAddress(query)) return
    const address = normalizeAddress(query)
    if (startedFor.current === address) return

    autoTimer.current = setTimeout(() => {
      startedFor.current = address
      void run(query)
    }, 320)

    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current)
    }
  }, [value, busy, ambiguous, run])

  /**
   * Pasting into the field.
   *
   * People paste explorer links and whole lines of text far more often than a
   * bare address, so the address is lifted out of whatever arrives. Anything
   * without exactly one address is left alone for the normal validation to
   * report.
   */
  function onInputPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text')
    const found = extractAddress(text)
    if (!found) return

    event.preventDefault()
    setValue(found)
    setError(null)
    setAmbiguous(null)
  }

  /** Clipboard read needs a user gesture and can be denied — fail quietly. */
  async function onPasteButton() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setValue(extractAddress(text) ?? text.trim())
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
          // Wraps on phones so a long address and the button never collide.
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
          onPaste={onInputPaste}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
            setAmbiguous(null)
            // Editing means this is a new attempt; let it scan again.
            startedFor.current = null
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


        <button
          type="button"
          onClick={onPasteButton}
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

      {detected && !error ? (
        <p className="mt-2 px-1 text-xs text-muted" role="status">
          {detected}
        </p>
      ) : null}

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
