import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'

import { DashboardPage } from '@/pages/DashboardPage'
import { GasReadingsPage } from '@/pages/GasReadingsPage'
import { GasUploadPage } from '@/pages/GasUploadPage'
import { ChargesPage } from '@/pages/ChargesPage'
import { UploadsPage } from '@/pages/UploadsPage'
import { AnalysisPage } from '@/pages/AnalysisPage'
import { ChargeDetailPage } from '@/pages/ChargeDetailPage'
import { MonthlyReportPage } from '@/pages/MonthlyReportPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { RematchPage } from '@/pages/RematchPage'

function AppRoutes() {
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="gas-readings" element={<GasReadingsPage />} />
        <Route path="gas-upload" element={<GasUploadPage />} />
        <Route path="charges" element={<ChargesPage />} />
        <Route path="charges/:id" element={<ChargeDetailPage />} />
        <Route path="uploads" element={<UploadsPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
        <Route path="monthly-report" element={<MonthlyReportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="rematch" element={<RematchPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
