import { useId, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Plain-English definitions for the jargon this product cannot avoid.
 *
 * Kept in one place so the same term never gets two explanations, and written
 * for someone who has never bought a token before.
 */
export const GLOSSARY: Record<string, { term: string; plain: string }> = {
  liquidity: {
    term: 'Liquidity',
    plain:
      'How much money is sitting in the pool you would trade against. If it is small, selling even a modest amount crashes the price — and you get far less than the screen says.',
  },
  honeypot: {
    term: 'Honeypot',
    plain:
      'A token you can buy but cannot sell. The code blocks your sale, so the money is gone the moment you buy in.',
  },
  sellTax: {
    term: 'Sell fee',
    plain:
      'A cut the token takes automatically when you sell. A 10% fee means you keep 90 cents of every dollar. Some tokens set this very high on purpose.',
  },
  buyTax: {
    term: 'Buy fee',
    plain: 'A cut the token takes automatically when you buy. It comes straight off what you receive.',
  },
  verified: {
    term: 'Published code',
    plain:
      'The token’s code has been made public so anyone can read what it actually does. Unpublished code is not automatically a scam, but nobody can check it.',
  },
  holders: {
    term: 'Holders',
    plain: 'The wallets that own this token. Few holders, or a few wallets owning most of it, is a warning sign.',
  },
  concentration: {
    term: 'Concentration',
    plain:
      'How much of the supply the biggest wallets control. If ten wallets hold most of it, any one of them can crash the price by selling.',
  },
  contract: {
    term: 'Contract address',
    plain:
      'The token’s unique ID on the blockchain — like an account number. Always check you have the right one; scammers copy names, not addresses.',
  },
  marketCap: {
    term: 'Market value',
    plain: 'Roughly what every coin in existence would be worth at today’s price. It is an estimate, not cash in a bank.',
  },
  volume: {
    term: '24h trading',
    plain: 'How much was bought and sold in the last day. Almost none usually means nobody is interested.',
  },
  bubblemap: {
    term: 'Holder map',
    plain:
      'A picture of who owns the token and which wallets are connected. Clusters of linked wallets often mean one person is pretending to be many.',
  },
}

/**
 * A "?" that reveals a plain-English definition.
 *
 * Click rather than hover: hover-only tooltips are unreachable on touch, and
 * this is precisely the audience that needs the explanation most.
 */
export function Explain({ topic, className }: { topic: keyof typeof GLOSSARY; className?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const entry = GLOSSARY[topic]
  if (!entry) return null

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What does ${entry.term} mean?`}
        className="inline-grid h-4 w-4 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-180 hover:text-primary"
      >
        <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <span
          id={id}
          role="note"
          className="glass-panel absolute left-1/2 top-full z-40 mt-2 w-64 -translate-x-1/2 rounded-md border border-hairline p-3 text-xs leading-relaxed text-secondary shadow-glass-lift"
        >
          <strong className="mb-1 block text-primary">{entry.term}</strong>
          {entry.plain}
        </span>
      ) : null}
    </span>
  )
}

/** Label + inline explainer, for stat captions and table headers. */
export function TermLabel({
  topic,
  children,
  className,
}: {
  topic: keyof typeof GLOSSARY
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {children}
      <Explain topic={topic} />
    </span>
  )
}
