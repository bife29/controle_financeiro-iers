import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Edit2, Eye, UserCheck, UserX, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'

interface Member {
  id: number
  ficha_num: number | null
  name: string
  cpf: string | null
  cel: string | null
  tel: string | null
  email: string | null
  cidade: string | null
  foto_perfil: string | null
  is_active: boolean
  batizado_aguas: boolean | null
}

export function MembersList() {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)
  const queryClient = useQueryClient()
  const { hasRole } = useAuthStore()
  const canDelete = hasRole('super_admin', 'pastor')

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['members', search, showInactive],
    queryFn: () =>
      api.get('/api/members/', {
        params: { search: search || undefined, active_only: !showInactive }
      }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/members/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      setShowDeleteConfirm(null)
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => api.post('/api/members/bulk-delete', { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
      setSelected(new Set())
      setShowBulkConfirm(false)
    },
  })

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === members.length) setSelected(new Set())
    else setSelected(new Set(members.map((m) => m.id)))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Secretaria — Membros</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cadastro completo de membros da igreja
          </p>
        </div>
        <Link
          to="/membros/novo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          Novo Membro
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou celular..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300"
          />
          Mostrar inativos
        </label>
      </div>

      {/* Barra de ações em massa */}
      {canDelete && selected.size > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-red-700">
            {selected.size} membro(s) selecionado(s)
          </span>
          <button
            onClick={() => setShowBulkConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Desativar Selecionados
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-red-600 hover:underline"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Modal confirmação bulk delete */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-bold text-lg">Confirmar Desativação</h3>
            <p className="text-sm text-muted-foreground">
              Deseja desativar {selected.size} membro(s)? Esta ação pode ser revertida reativando os membros individualmente.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => bulkDeleteMutation.mutate(Array.from(selected))}
                disabled={bulkDeleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {bulkDeleteMutation.isPending ? 'Desativando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação delete individual */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-bold text-lg">Confirmar Desativação</h3>
            <p className="text-sm text-muted-foreground">
              Deseja desativar este membro? Esta ação pode ser revertida.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(showDeleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Desativando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela responsiva */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                {canDelete && (
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={members.length > 0 && selected.size === members.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 font-medium w-14">Foto</th>
                <th className="text-left px-4 py-3 font-medium">Ficha</th>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">CPF</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Celular</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Cidade</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Batizado</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={canDelete ? 10 : 9} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={canDelete ? 10 : 9} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum membro encontrado
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30 transition">
                    {canDelete && (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(member.id)}
                          onChange={() => toggleSelect(member.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {member.foto_perfil ? (
                        <img
                          src={member.foto_perfil}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      #{member.ficha_num || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">{member.name}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {member.cpf || '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {member.cel || member.tel || '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {member.cidade || '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-center">
                      {member.batizado_aguas ? (
                        <span className="text-green-600 text-xs font-medium">Sim</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Não</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {member.is_active ? (
                        <UserCheck className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <UserX className="w-4 h-4 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          to={`/membros/${member.id}`}
                          className="p-1.5 hover:bg-muted rounded transition"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/membros/${member.id}/editar`}
                          className="p-1.5 hover:bg-muted rounded transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        {canDelete && member.is_active && (
                          <button
                            onClick={() => setShowDeleteConfirm(member.id)}
                            className="p-1.5 hover:bg-red-50 rounded transition text-red-500"
                            title="Desativar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
