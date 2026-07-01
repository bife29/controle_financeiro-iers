import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import { LoginPage } from '@/pages/Login'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardPage } from '@/pages/Dashboard'
import { FinancialPage } from '@/pages/financial'
import { MembersPage } from '@/pages/members'
import { SecretariaPage } from '@/pages/secretaria'
import { RetreatsPage } from '@/pages/retreats'
import { PatrimonyPage } from '@/pages/patrimony'
import { ShoppingPage } from '@/pages/shopping'
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
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  // Hidrata `permissions` para sessões antigas persistidas antes da SPEC-001.
  // Se o token existe mas o user não tem o campo permissions, busca /me.
  useEffect(() => {
    if (!token || !user) return
    if (user.permissions != null) return
    api.get('/api/auth/me')
      .then((r) => updateUser(r.data))
      .catch(() => {
        // Se /me falhar, o interceptor do api.ts já cuida de logout em 401.
      })
  }, [token, user, updateUser])

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
        <Route path="compras/*" element={<ShoppingPage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="usuarios/*" element={<UsersPage />} />
        <Route path="manual" element={<ManualPage />} />
      </Route>
    </Routes>
  )
}
