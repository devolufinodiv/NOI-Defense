import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeMode } from '@/design/tokens'

export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'noi.theme'

interface ThemeState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

/**
 * Persisted under the same key the inline boot script in index.html reads, so a
 * reload paints the right theme before React mounts. Change one, change both.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => {
        applyTheme(preference)
        set({ preference })
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.preference)
      },
    },
  ),
)

/** Writes `data-theme` on <html>. Absent means "follow the OS". */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement
  if (preference === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', preference)
}

const query = () => window.matchMedia('(prefers-color-scheme: dark)')

function subscribeToSystem(onChange: () => void): () => void {
  const mq = query()
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/**
 * The mode actually on screen.
 *
 * Subscribed rather than read once: with preference "system" the OS can flip
 * underneath us, and chart/canvas colours are computed in JS — they would keep
 * painting the old palette without this.
 */
export function useResolvedTheme(): ThemeMode {
  const preference = useThemeStore((state) => state.preference)
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystem,
    () => query().matches,
    () => true, // SSR/no-matchMedia fallback: assume dark, the product's default
  )
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}
