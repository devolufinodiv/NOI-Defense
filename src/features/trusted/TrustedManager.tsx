import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ChainSelect } from '@/components/scan/ChainSelect'
import { TokenMark } from '@/components/ui/TokenMark'
import { defaultChainMeta, chainMeta } from '@/config/chains'
import { cn } from '@/lib/cn'
import {
  useAddTrusted,
  useMoveTrusted,
  useRemoveTrusted,
  useUpdateTrusted,
  type TrustedToken,
} from './queries'

const field =
  'h-10 w-full rounded-md border border-hairline bg-raised/40 px-3 text-sm text-primary placeholder:text-muted focus:border-hairline-strong focus:outline-none'

/**
 * Admin control for the trusted list: add by pasting a contract, write a note,
 * file under a category, reorder, remove.
 *
 * Every server write is also gated by row level security, so this panel being
 * visible is presentation only.
 */
export function TrustedManager({ entries }: { entries: TrustedToken[] }) {
  const curated = entries.filter((e) => e.curated)
  const add = useAddTrusted()
  const move = useMoveTrusted()
  const remove = useRemoveTrusted()

  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState(defaultChainMeta.chain.id)
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  const categories = Array.from(new Set(curated.map((e) => e.category).filter(Boolean))) as string[]

  function submit(event: FormEvent) {
    event.preventDefault()
    setDone(null)
    add.mutate(
      { chainId, address, category, note },
      {
        onSuccess: (result) => {
          setDone(`Added ${result.symbol}. Its latest scan verdict is "${result.tier}".`)
          setAddress('')
          setNote('')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader
        title="Manage the list"
        subtitle="Visible to admins only. Tokens are scanned before they are added."
      />
      <CardBody className="space-y-6 pt-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                add.reset()
                setDone(null)
              }}
              placeholder="Paste a contract address"
              aria-label="Contract address"
              spellCheck={false}
              autoComplete="off"
              className={cn(field, 'font-mono text-xs')}
            />
            <ChainSelect chainId={chainId} onChange={setChainId} />
          </div>
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (optional)"
              aria-label="Category"
              maxLength={40}
              list="trusted-categories"
              className={field}
            />
            <datalist id="trusted-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why it is on the list (optional, shown publicly)"
              aria-label="Note"
              maxLength={280}
              className={field}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" size="md" disabled={add.isPending || !address.trim()}>
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              {add.isPending ? 'Scanning…' : 'Add to list'}
            </Button>
            {add.isError ? (
              <p className="text-xs text-negative" role="alert">
                {add.error.message}
              </p>
            ) : null}
            {done ? (
              <p className="text-xs text-positive" role="status">
                {done}
              </p>
            ) : null}
          </div>
        </form>

        <div className="border-t border-hairline pt-4">
          {curated.length === 0 ? (
            <p className="text-xs text-muted">
              Nothing curated yet. The list is showing only tokens that pass the checks on their own.
            </p>
          ) : (
            <ul className="space-y-2">
              {curated.map((entry, index) => {
                const key = `${entry.chainId}:${entry.address}`
                return (
                  <li key={key} className="rounded-lg border border-hairline">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <span className="tabular w-4 text-xs text-muted">{index + 1}</span>
                      <TokenMark symbol={entry.symbol || '?'} size="sm" chainId={entry.chainId} address={entry.address} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm text-primary">
                          <span className="truncate">{entry.symbol || entry.name}</span>
                          {entry.passesChecks ? null : (
                            <TriangleAlert
                              className="h-3.5 w-3.5 shrink-0 text-warning"
                              strokeWidth={2}
                              aria-label="Fails its latest scan; not shown on the landing page"
                            />
                          )}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {chainMeta(entry.chainId)?.label}
                          {entry.category ? ` · ${entry.category}` : ''}
                        </span>
                      </span>

                      <IconAction
                        label={`Move ${entry.symbol} up`}
                        disabled={index === 0 || move.isPending}
                        onClick={() => move.mutate({ entries: curated, index, direction: -1 })}
                      >
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </IconAction>
                      <IconAction
                        label={`Move ${entry.symbol} down`}
                        disabled={index === curated.length - 1 || move.isPending}
                        onClick={() => move.mutate({ entries: curated, index, direction: 1 })}
                      >
                        <ArrowDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </IconAction>
                      <IconAction
                        label={`Edit ${entry.symbol}`}
                        onClick={() => setEditing(editing === key ? null : key)}
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </IconAction>
                      <IconAction
                        label={`Remove ${entry.symbol} from the list`}
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove ${entry.symbol || 'this token'} from the trusted list?`)) {
                            remove.mutate({ chainId: entry.chainId, address: entry.address })
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </IconAction>
                    </div>

                    {editing === key ? (
                      <EditEntry entry={entry} categories={categories} onClose={() => setEditing(null)} />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}

          {move.isError || remove.isError ? (
            <p className="mt-2 text-xs text-negative" role="alert">
              {(move.error ?? remove.error)?.message}
            </p>
          ) : null}
        </div>
      </CardBody>
    </Card>
  )
}

function EditEntry({
  entry,
  categories,
  onClose,
}: {
  entry: TrustedToken
  categories: string[]
  onClose: () => void
}) {
  const update = useUpdateTrusted()
  const [category, setCategory] = useState(entry.category ?? '')
  const [note, setNote] = useState(entry.note ?? '')

  function save(event: FormEvent) {
    event.preventDefault()
    update.mutate(
      { chainId: entry.chainId, address: entry.address, category, note },
      { onSuccess: onClose },
    )
  }

  return (
    <form onSubmit={save} className="space-y-2 border-t border-hairline px-3 py-3">
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
          aria-label="Category"
          maxLength={40}
          list="trusted-categories-edit"
          className={field}
        />
        <datalist id="trusted-categories-edit">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why it is on the list"
          aria-label="Note"
          maxLength={280}
          className={field}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={update.isPending}>
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Cancel
        </Button>
        {update.isError ? (
          <span className="text-xs text-negative" role="alert">
            {update.error.message}
          </span>
        ) : null}
      </div>
    </form>
  )
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition-colors duration-180 hover:bg-raised hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}
