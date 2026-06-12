import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Layout } from '@/components/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { GasReadingsPage } from '@/pages/GasReadingsPage'
import { GasUploadPage } from '@/pages/GasUploadPage'
import { ChargesPage } from '@/pages/ChargesPage'
import { UploadsPage } from '@/pages/UploadsPage'
import { AnalysisPage } from '@/pages/AnalysisPage'
import { UsersPage } from '@/pages/UsersPage'
import { ChargeDetailPage } from '@/pages/ChargeDetailPage'
import { MonthlyReportPage } from '@/pages/MonthlyReportPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { RematchPage } from '@/pages/RematchPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
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
        <Route path="users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
