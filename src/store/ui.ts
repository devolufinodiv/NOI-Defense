import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UiState {
  /** Desktop sidebar rail vs. full labels. Mobile uses the bottom tab bar instead. */
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: 'noi.ui' },
  ),
)
