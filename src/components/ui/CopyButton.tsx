import { useCallback, useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Copy-to-clipboard affordance. Sits beside every address and hash. */
export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1_200)
    return () => window.clearTimeout(timer)
  }, [copied])

  const onCopy = useCallback(
    async (event: React.MouseEvent) => {
      // Addresses often sit inside links and clickable rows.
      event.preventDefault()
      event.stopPropagation()
      try {
        await navigator.clipboard.writeText(value)
        setCopied(true)
      } catch {
        setCopied(false)
      }
    },
    [value],
  )

  return (
    <button
      type="button"
      onClick={onCopy}
      title={`${label}: ${value}`}
      aria-label={copied ? 'Copied' : `${label} ${value}`}
      className={cn(
        'inline-grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-xs',
        'text-muted transition-colors duration-180 hover:bg-raised hover:text-primary',
        className,
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-positive" strokeWidth={2.5} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
      )}
    </button>
  )
}
