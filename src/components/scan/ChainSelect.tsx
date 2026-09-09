import { useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { AnchoredPopover } from '@/components/ui/AnchoredPopover'
import { ChainMark } from '@/components/ui/ChainMark'
import { CHAIN_LIST, chainMeta, defaultChainMeta } from '@/config/chains'

/**
 * Network picker, scoped to the scanners.
 *
 * Chain only matters at the moment you point the tool at an address, so this
 * lives inside the scan controls rather than in global chrome — a persistent
 * app-wide switcher would imply the whole product is pinned to one network.
 *
 * The list is portalled (see AnchoredPopover): the scan form is a `.glass-panel`
 * and therefore its own stacking context, so an in-flow dropdown would be
 * painted over by the cards below it no matter how high its z-index.
 */
export function ChainSelect({
  chainId,
  onChange,
  className,
}: {
  chainId: number
  onChange: (chainId: number) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const active = chainMeta(chainId) ?? defaultChainMeta

  const mainnets = CHAIN_LIST.filter((meta) => !meta.testnet)
  const testnets = CHAIN_LIST.filter((meta) => meta.testnet)

  function option(meta: (typeof CHAIN_LIST)[number]) {
    const selected = meta.chain.id === chainId
    return (
      <button
        key={meta.chain.id}
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => {
          onChange(meta.chain.id)
          setOpen(false)
          triggerRef.current?.focus()
        }}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm transition-colors duration-180',
          selected
            ? 'bg-raised text-primary'
            : 'text-secondary hover:bg-raised/60 hover:text-primary',
        )}
      >
        <ChainMark chainId={meta.chain.id} />
        <span className="min-w-0 flex-1 truncate">{meta.label}</span>
        <span className="tabular shrink-0 text-2xs text-muted">{meta.chain.id}</span>
        {selected ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
        ) : null}
      </button>
    )
  }

  return (
    <div className={cn('shrink-0', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Network: ${active.label}. Change network.`}
        className="flex h-9 w-full cursor-pointer items-center gap-1.5 rounded-sm border border-hairline bg-raised/60 px-2 text-xs text-primary transition-colors duration-180 hover:border-hairline-strong sm:w-auto"
      >
        <ChainMark chainId={active.chain.id} size="xs" />
        <span className="flex-1 truncate text-left sm:max-w-[6.5rem] sm:flex-none">
          {active.label}
        </span>
        {active.testnet ? (
          <span className="rounded-full border border-warning/30 bg-warning/10 px-1 text-[10px] font-medium text-warning">
            Test
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-180',
            open && 'rotate-180',
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      <AnchoredPopover
        anchorRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        role="listbox"
        aria-label="Network"
        className="w-52"
      >
        <p className="px-3 py-2 text-2xs uppercase tracking-label text-muted">Mainnet</p>
        {mainnets.map(option)}
        <p className="mt-1 border-t border-hairline px-3 py-2 text-2xs uppercase tracking-label text-muted">
          Testnet
        </p>
        {testnets.map(option)}
      </AnchoredPopover>
    </div>
  )
}
