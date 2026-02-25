import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ChapterReportsPage } from './pages/ChapterReportsPage'
import { EntryViewPage } from './pages/EntryViewPage'
import { GiftSubscriptionsPage } from './pages/GiftSubscriptionsPage'
import { HomePage } from './pages/HomePage'
import { IdeasVaultPage } from './pages/IdeasVaultPage'
import { InsightsPage } from './pages/InsightsPage'
import { LoginPage } from './pages/LoginPage'
import { MemoirPrintPage } from './pages/MemoirPrintPage'
import { MoodDashboardPage } from './pages/MoodDashboardPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { PaywallPage } from './pages/PaywallPage'
import { SettingsPage } from './pages/SettingsPage'
import { SignupPage } from './pages/SignupPage'
import { TimelinePage } from './pages/TimelinePage'

function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/paywall" element={<PaywallPage />} />
      <Route path="/" element={<ProtectedLayout><HomePage /></ProtectedLayout>} />
      <Route path="/entries/:id" element={<ProtectedLayout><EntryViewPage /></ProtectedLayout>} />
      <Route path="/timeline" element={<ProtectedLayout><TimelinePage /></ProtectedLayout>} />
      <Route path="/mood" element={<ProtectedLayout><MoodDashboardPage /></ProtectedLayout>} />
      <Route path="/ideas" element={<ProtectedLayout><IdeasVaultPage /></ProtectedLayout>} />
      <Route path="/insights" element={<ProtectedLayout><InsightsPage /></ProtectedLayout>} />
      <Route path="/chapters" element={<ProtectedLayout><ChapterReportsPage /></ProtectedLayout>} />
      <Route path="/gifts" element={<ProtectedLayout><GiftSubscriptionsPage /></ProtectedLayout>} />
      <Route path="/memoir-print" element={<ProtectedLayout><MemoirPrintPage /></ProtectedLayout>} />
      <Route path="/settings" element={<ProtectedLayout><SettingsPage /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to="/onboarding" replace />} />
    </Routes>
  )
}
