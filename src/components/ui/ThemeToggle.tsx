import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useThemeStore, type ThemePreference } from '@/store/theme'

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/**
 * Three-state theme control.
 *
 * "System" is a distinct choice, not the absence of one — a two-way toggle
 * silently strands anyone whose OS switches at sunset.
 *
 * The segmented form is a radiogroup so the current selection is announced.
 * Below `sm` there is no room for three targets that still clear 32px, so the
 * compact form cycles through the same three states and announces the next one
 * in its label — the setting must stay reachable on a phone.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const preference = useThemeStore((state) => state.preference)
  const setPreference = useThemeStore((state) => state.setPreference)

  const index = OPTIONS.findIndex((o) => o.value === preference)
  const current = OPTIONS[index === -1 ? 2 : index]
  const next = OPTIONS[(index + 1) % OPTIONS.length]
  const CurrentIcon = current.icon

  return (
    <>
      {/* Compact cycle — phones only. */}
      <button
        type="button"
        onClick={() => setPreference(next.value)}
        aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
        title={`Theme: ${current.label}`}
        className={cn(
          'grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-md border border-hairline',
          'bg-raised/50 text-secondary transition-colors duration-180',
          'hover:border-hairline-strong hover:text-primary sm:hidden',
        )}
      >
        <CurrentIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>

      {/* Segmented — everywhere else. */}
      <div
        role="radiogroup"
        aria-label="Colour theme"
        className={cn(
          'hidden items-center gap-0.5 rounded-md border border-hairline bg-raised/50 p-0.5 sm:inline-flex',
          className,
        )}
      >
        {OPTIONS.map((option) => {
          const active = preference === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              title={`${option.label} theme`}
              onClick={() => setPreference(option.value)}
              className={cn(
                'grid h-8 w-8 cursor-pointer place-items-center rounded-sm transition-colors duration-180',
                active ? 'bg-card text-primary shadow-card' : 'text-muted hover:text-primary',
              )}
            >
              <option.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          )
        })}
      </div>
    </>
  )
}
