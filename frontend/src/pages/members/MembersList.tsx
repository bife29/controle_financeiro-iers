import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Edit2, Eye, UserCheck, UserX } from 'lucide-react'

interface Member {
  id: number
  ficha_num: number | null
  name: string
  cpf: string | null
  cel: string | null
  tel: string | null
  email: string | null
  cidade: string | null
  is_active: boolean
  batizado_aguas: boolean | null
}

export function MembersList() {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['members', search, showInactive],
    queryFn: () =>
      api.get('/api/members/', {
        params: { search: search || undefined, active_only: !showInactive }
      }).then((r) => r.data),
  })

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

      {/* Tabela responsiva */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Ficha</th>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">CPF</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Celular</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Cidade</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">Batizado</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum membro encontrado
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30 transition">
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
