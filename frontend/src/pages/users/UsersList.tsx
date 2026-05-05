import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Trash2, Key, Shield, UserCheck, UserX, Search } from 'lucide-react'

interface User {
  id: number
  name: string
  email: string
  role: string
  is_active: boolean
  permissions: Record<string, string[]> | null
  created_at: string | null
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  pastor: 'Pastor',
  financeiro: 'Financeiro',
  secretaria: 'Secretaria',
  viewer: 'Visualizador',
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  pastor: 'bg-blue-100 text-blue-800',
  financeiro: 'bg-green-100 text-green-800',
  secretaria: 'bg-amber-100 text-amber-800',
  viewer: 'bg-gray-100 text-gray-800',
}

export function UsersList() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [resetPasswordModal, setResetPasswordModal] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null)

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/api/auth/users').then((r) => r.data),
  })

  const toggleActive = useMutation({
    mutationFn: (user: User) =>
      api.put(`/api/auth/users/${user.id}`, { is_active: !user.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const deleteUser = useMutation({
    mutationFn: (userId: number) => api.delete(`/api/auth/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setDeleteConfirm(null)
    },
  })

  const resetPassword = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      api.put(`/api/auth/users/${userId}/password`, { new_password: password }),
    onSuccess: () => {
      setResetPasswordModal(null)
      setNewPassword('')
    },
  })

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (ROLE_LABELS[u.role] || u.role).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie usuários, papéis e permissões de acesso ao sistema
          </p>
        </div>
        <Link
          to="/usuarios/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome, email ou papel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Papel</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Módulos</th>
                  <th className="text-right px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'}`}>
                        <Shield className="w-3 h-3" />
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive.mutate(user)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                          user.is_active
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                        title={user.is_active ? 'Clique para desativar' : 'Clique para ativar'}
                      >
                        {user.is_active ? (
                          <>
                            <UserCheck className="w-3 h-3" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <UserX className="w-3 h-3" />
                            Inativo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-muted-foreground">
                        {user.permissions
                          ? Object.entries(user.permissions).filter(([, actions]) => actions.length > 0).length
                          : '—'}
                        {' módulos'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/usuarios/${user.id}/editar`}
                          className="p-2 hover:bg-muted rounded-lg transition"
                          title="Editar usuário e permissões"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setResetPasswordModal(user)}
                          className="p-2 hover:bg-muted rounded-lg transition"
                          title="Redefinir senha"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(user)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"
                          title="Excluir usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {resetPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1">Redefinir Senha</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Definir nova senha para <strong>{resetPasswordModal.name}</strong>
            </p>
            <input
              type="password"
              placeholder="Nova senha (mín. 6 caracteres)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setResetPasswordModal(null); setNewPassword('') }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => resetPassword.mutate({ userId: resetPasswordModal.id, password: newPassword })}
                disabled={newPassword.length < 6}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                Redefinir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-1 text-red-600">Excluir Usuário</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Tem certeza que deseja excluir <strong>{deleteConfirm.name}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteUser.mutate(deleteConfirm.id)}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
