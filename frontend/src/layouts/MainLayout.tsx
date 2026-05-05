import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useState } from 'react'
import {
  LayoutDashboard, DollarSign, Users, Mountain,
  MessageSquare, LogOut, Menu, ShieldCheck, BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['super_admin', 'pastor', 'financeiro', 'secretaria'] },
  { name: 'Financeiro', href: '/financeiro', icon: DollarSign, roles: ['super_admin', 'pastor', 'financeiro'] },
  { name: 'Membros', href: '/membros', icon: Users, roles: ['super_admin', 'pastor', 'financeiro', 'secretaria'] },
  { name: 'Retiros', href: '/retiros', icon: Mountain, roles: ['super_admin', 'pastor', 'secretaria'] },
  { name: 'Feedback', href: '/feedback', icon: MessageSquare, roles: ['super_admin', 'pastor', 'financeiro', 'secretaria'] },
  { name: 'Usuários', href: '/usuarios', icon: ShieldCheck, roles: ['super_admin'] },
  { name: 'Manual', href: '/manual', icon: BookOpen, roles: ['super_admin', 'pastor', 'financeiro', 'secretaria', 'viewer'] },
]

export function MainLayout() {
  const { user, logout, hasRole } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const visibleNav = navigation.filter(
    (item) => item.roles.some((r) => hasRole(r))
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-blue-900 to-blue-800 text-white flex flex-col transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 border-b border-white/10">
          <h1 className="text-xl font-bold">IERS</h1>
          <p className="text-xs text-blue-200 mt-0.5">Sistema Integrado</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {visibleNav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-blue-100 hover:bg-white/10"
                )
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {user?.name?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-blue-200 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button onClick={handleLogout} className="p-1.5 hover:bg-white/10 rounded">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b bg-white">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5">
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="font-bold text-lg">IERS</h2>
          <div className="w-8" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
