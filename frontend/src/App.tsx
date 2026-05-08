import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { LoginPage } from '@/pages/Login'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardPage } from '@/pages/Dashboard'
import { FinancialPage } from '@/pages/financial'
import { MembersPage } from '@/pages/members'
import { SecretariaPage } from '@/pages/secretaria'
import { RetreatsPage } from '@/pages/retreats'
import { PatrimonyPage } from '@/pages/patrimony'
import { FeedbackPage } from '@/pages/Feedback'
import { UsersPage } from '@/pages/users'
import { ManualPage } from '@/pages/Manual'
import { ReportsPage } from '@/pages/Reports'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="financeiro/*" element={<FinancialPage />} />
        <Route path="membros/*" element={<MembersPage />} />
        <Route path="secretaria/*" element={<SecretariaPage />} />
        <Route path="retiros/*" element={<RetreatsPage />} />
        <Route path="patrimonio/*" element={<PatrimonyPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="usuarios/*" element={<UsersPage />} />
        <Route path="manual" element={<ManualPage />} />
      </Route>
    </Routes>
  )
}
