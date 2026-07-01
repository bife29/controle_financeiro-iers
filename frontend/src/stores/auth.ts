import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Permissões granulares por módulo — espelhamento do backend
 * (`backend/app/modules/auth/schemas.py :: DEFAULT_PERMISSIONS`).
 *
 * Servem como *fallback* para sessões antigas que ainda não têm o campo
 * `permissions` populado no `user` persistido no localStorage.
 * A fonte de verdade continua sendo o backend (que devolve `user.permissions`
 * em `POST /api/auth/login` e `GET /api/auth/me`).
 *
 * Regra: quando o backend evoluir esta tabela, atualizar aqui também.
 */
const DEFAULT_PERMISSIONS: Record<string, Record<string, string[]>> = {
  super_admin: {
    dashboard: ['view'],
    financeiro: ['view', 'create', 'edit', 'delete'],
    membros: ['view', 'create', 'edit', 'delete'],
    retiros: ['view', 'create', 'edit', 'delete'],
    secretaria: ['view', 'create', 'edit', 'delete'],
    patrimonio: ['view', 'create', 'edit', 'delete'],
    compras: ['view', 'create', 'edit', 'delete', 'approve'],
    feedback: ['view', 'create', 'edit', 'delete'],
    usuarios: ['view', 'create', 'edit', 'delete'],
  },
  pastor: {
    dashboard: ['view'],
    financeiro: ['view', 'create'],
    membros: ['view'],
    retiros: ['view'],
    secretaria: ['view', 'create', 'edit', 'delete'],
    patrimonio: ['view', 'create', 'edit', 'delete'],
    compras: ['view', 'approve'],
    feedback: ['view', 'create'],
    usuarios: [],
  },
  financeiro: {
    dashboard: ['view'],
    financeiro: ['view', 'create', 'edit', 'delete'],
    membros: ['view', 'create'],
    retiros: ['view'],
    secretaria: ['view'],
    patrimonio: ['view', 'create', 'edit'],
    compras: ['view', 'create', 'edit'],
    feedback: ['view', 'create'],
    usuarios: [],
  },
  secretaria: {
    dashboard: ['view'],
    financeiro: [],
    membros: ['view', 'create', 'edit', 'delete'],
    retiros: ['view', 'create', 'edit'],
    secretaria: ['view', 'create', 'edit', 'delete'],
    patrimonio: ['view', 'create', 'edit'],
    compras: ['view', 'create'],
    feedback: ['view', 'create'],
    usuarios: [],
  },
  viewer: {
    dashboard: ['view'],
    financeiro: ['view'],
    membros: ['view'],
    retiros: ['view'],
    secretaria: ['view'],
    patrimonio: ['view'],
    compras: ['view'],
    feedback: ['view'],
    usuarios: [],
  },
}

interface User {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  permissions?: Record<string, string[]> | null
}

interface AuthState {
  token: string | null
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
  updateUser: (user: User) => void
  hasRole: (...roles: string[]) => boolean
  /**
   * Retorna true se o usuário logado tem a `action` no `module`.
   *
   * Ordem de verificação (mesma do backend em `require_permission`):
   * 1. `super_admin` sempre pode.
   * 2. Se `user.permissions[module]` contém `action`, autoriza.
   * 3. Cai no default do papel (`DEFAULT_PERMISSIONS[role][module]`).
   * 4. Caso contrário, false.
   */
  hasPermission: (module: string, action: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      updateUser: (user) => set({ user }),
      hasRole: (...roles) => {
        const user = get().user
        if (!user) return false
        return roles.includes(user.role)
      },
      hasPermission: (module, action) => {
        const user = get().user
        if (!user) return false
        if (user.role === 'super_admin') return true
        const custom = user.permissions?.[module]
        if (custom && custom.includes(action)) return true
        const defaults = DEFAULT_PERMISSIONS[user.role]?.[module] || []
        return defaults.includes(action)
      },
    }),
    {
      name: 'iers-auth',
    }
  )
)
