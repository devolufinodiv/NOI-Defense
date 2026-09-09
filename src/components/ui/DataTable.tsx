import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ChevronsUpDown, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface Column<T> {
  key: string
  header: ReactNode
  align?: 'left' | 'right'
  /** Hide below `md` — keeps dense tables usable on phones. */
  hideOnMobile?: boolean
  width?: string
  /**
   * Provide to make the column sortable. Return a comparable primitive —
   * `bigint` included, so token amounts can be ordered without being funnelled
   * through a float that collapses wei-level differences.
   */
  sortValue?: (row: T) => string | number | bigint
  render: (row: T, index: number) => ReactNode
}

export interface DataTableProps<T> {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  className?: string
}

/**
 * Dense table for data-heavy screens.
 *
 * Scrolls horizontally inside its own container rather than wrapping cells — a
 * wrapped address or amount is unreadable, and the row is the unit of meaning.
 * The page itself never scrolls sideways as a result.
 *
 * Sorting is real, not a decorative caret, and announces state via aria-sort.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty = 'No results',
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const syncEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    // 1px tolerance: fractional layout widths never land exactly on zero.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }, [])

  // Recheck on mount and on resize — a table that fits at one width overflows
  // at another, and the fade must not linger once everything is visible.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    syncEdges()
    const observer = new ResizeObserver(syncEdges)
    observer.observe(el)
    return () => observer.disconnect()
  }, [syncEdges, rows])

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sortValue) return rows
    const factor = sort.dir === 'asc' ? 1 : -1
    // Copy first: Array.prototype.sort mutates, and `rows` is caller-owned.
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a)
      const bv = column.sortValue!(b)
      if (av === bv) return 0
      return (av < bv ? -1 : 1) * factor
    })
  }, [rows, columns, sort])

  function toggle(key: string) {
    setSort((current) =>
      current?.key === key
        ? current.dir === 'asc'
          ? { key, dir: 'desc' }
          : null
        : { key, dir: 'asc' },
    )
  }

  if (rows.length === 0) {
    return <div className="px-5 py-12 text-center text-sm text-muted">{empty}</div>
  }

  return (
    <div className={cn('relative', className)}>
      <div ref={scrollRef} onScroll={syncEdges} className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-hairline bg-raised/40">
              {columns.map((column) => {
                const active = sort?.key === column.key
                const SortIcon = !active
                  ? ChevronsUpDown
                  : sort.dir === 'asc'
                    ? ChevronUp
                    : ChevronDown

                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      column.sortValue
                        ? active
                          ? sort.dir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                    className={cn(
                      'whitespace-nowrap px-3 py-3 text-xs font-medium text-muted md:px-5',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      column.hideOnMobile && 'hidden md:table-cell',
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggle(column.key)}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-1.5 rounded-xs py-1',
                          'transition-colors duration-180 hover:text-primary',
                          active && 'text-primary',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {column.header}
                        <SortIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-hairline">
            {sorted.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'transition-colors duration-180',
                  onRowClick && 'cursor-pointer hover:bg-raised/60',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'whitespace-nowrap px-3 py-3.5 align-middle md:px-5',
                      column.align === 'right' ? 'text-right' : 'text-left',
                      column.hideOnMobile && 'hidden md:table-cell',
                    )}
                  >
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fade cues that the row continues past the edge. Without one, a table
          scrolling inside its own container just looks truncated. */}
      {atStart ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface-card to-transparent"
        />
      )}
      {atEnd ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-card to-transparent"
        />
      )}
    </div>
  )
}
