import {
  Bell,
  ShieldCheck,
  Sparkles,
  GitCompareArrows,
  LayoutGrid,
  Palette,
  Radar,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
export interface NavItem {
  /** Rendered only for users with the admin role. */
  adminOnly?: boolean
  to: string
  label: string
  /** Short form for the mobile tab bar. */
  short: string
  icon: LucideIcon
  /** Small trailing chip, e.g. "Beta". */
  tag?: string
  /** Trailing count, e.g. unread alerts. */
  count?: number
  /** Sidebar only — not worth a slot in the four-up mobile tab bar. */
  desktopOnly?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutGrid }],
  },
  {
    label: 'Investigate',
    items: [
      { to: '/token', label: 'Token scan', short: 'Scan', icon: Radar },
      { to: '/wallet', label: 'Wallet trace', short: 'Wallet', icon: Wallet },
      {
        to: '/compare',
        label: 'Compare',
        short: 'Compare',
        icon: GitCompareArrows,
        tag: 'Beta',
      },
    ],
  },
  {
    label: 'Monitor',
    items: [
      { to: '/alerts', label: 'Alerts', short: 'Alerts', icon: Bell, count: 3 },
      { to: '/rewards', label: 'Rewards', short: 'Points', icon: Sparkles },
    ],
  },
  {
    label: 'System',
    items: [
      {
        to: '/admin',
        label: 'Admin',
        short: 'Admin',
        icon: ShieldCheck,
        desktopOnly: true,
        adminOnly: true,
      },
      { to: '/style-guide', label: 'Style guide', short: 'Style', icon: Palette, desktopOnly: true },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items)
