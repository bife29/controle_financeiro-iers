import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
}

interface AuthState {
  token: string | null
  user: User | null
  login: (token: string, user: User) => void
  logout: () => void
  hasRole: (...roles: string[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      hasRole: (...roles) => {
        const user = get().user
        if (!user) return false
        return roles.includes(user.role)
      },
    }),
    {
      name: 'iers-auth',
    }
  )
)
