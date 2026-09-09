import { useRef, useState } from 'react'
import { LogOut, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnchoredPopover } from '@/components/ui/AnchoredPopover'
import { displayName, signInWithGoogle, signOut, useAuth } from '@/store/auth'
import { GoogleIcon } from './GoogleIcon'

/**
 * Google sign-in / account control.
 *
 * When Supabase isn't configured the button still renders but explains what is
 * missing rather than silently doing nothing — a dead "Sign in" button is worse
 * than no button, and unconfigured is the project's current state.
 */
export function SignInButton({ className }: { className?: string }) {
  const { user, loading, configured } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  async function onSignIn() {
    setError(null)
    if (!configured) {
      setError('Google sign-in needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.')
      return
    }
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start sign-in.')
      setBusy(false)
    }
  }

  if (loading) return <Skeleton className={cn('h-10 w-28 rounded-md', className)} />

  if (user) {
    const name = displayName(user)
    const avatar = (user.user_metadata?.avatar_url as string | undefined) ?? null

    return (
      <div className={cn('relative', className)}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-hairline bg-raised/50 pl-1.5 pr-3 transition-colors duration-180 hover:border-hairline-strong"
        >
          {avatar ? (
            <img src={avatar} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-2xs font-semibold text-accent-on">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="hidden max-w-[9rem] truncate text-sm text-primary sm:inline">{name}</span>
        </button>

        <AnchoredPopover
          anchorRef={triggerRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          align="end"
          role="menu"
          className="w-56"
        >
          <div className="border-b border-hairline px-3 py-2">
              <p className="truncate text-sm font-medium text-primary">{name}</p>
            {user.email ? <p className="truncate text-xs text-muted">{user.email}</p> : null}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              void signOut()
            }}
            className="mt-1 flex w-full cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm text-secondary transition-colors duration-180 hover:bg-raised hover:text-primary"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Sign out
          </button>
        </AnchoredPopover>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Button variant="primary" onClick={onSignIn} disabled={busy}>
        <GoogleIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{busy ? 'Redirecting…' : 'Sign in with Google'}</span>
        <span className="sm:hidden">{busy ? '…' : 'Sign in'}</span>
      </Button>

      {error ? (
        <p
          role="alert"
          className="glass-panel absolute right-0 top-full z-40 mt-2 flex w-72 items-start gap-2 rounded-md border border-warning/30 px-3 py-2.5 text-xs leading-relaxed text-secondary"
        >
          <TriangleAlert
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning"
            strokeWidth={2}
            aria-hidden
          />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
