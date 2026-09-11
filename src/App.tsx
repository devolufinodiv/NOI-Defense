import { Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Dashboard } from '@/pages/Dashboard'
import { Admin } from '@/pages/Admin'
import { Rewards } from '@/pages/Rewards'
import { Landing } from '@/pages/Landing'
import { ScanEntry } from '@/pages/ScanEntry'
import { TokenDetail } from '@/pages/TokenDetail'
import { WalletDetail } from '@/pages/WalletDetail'
import { Compare } from '@/pages/Compare'
import { Alerts } from '@/pages/Alerts'
import { StyleGuide } from '@/pages/StyleGuide'
import { NotFound } from '@/pages/NotFound'

export function App() {
  return (
    <Routes>
      {/* The landing page is the public face and carries no app chrome. */}
      <Route path="/" element={<Landing />} />

      {/* Everything else lives inside the shell. */}
      <Route
        path="*"
        element={
          <AppShell>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/token" element={<ScanEntry kind="token" />} />
              <Route path="/token/:address" element={<TokenDetail />} />
              <Route path="/wallet" element={<ScanEntry kind="wallet" />} />
              <Route path="/wallet/:address" element={<WalletDetail />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/style-guide" element={<StyleGuide />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  )
}
