import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Edit2, Search, ArrowLeft, ArrowUpCircle, ArrowDownCircle, CheckSquare, Square, Download } from 'lucide-react'

interface Transaction {
  id: number
  date: string
  type: string
  value: number
  description: string | null
  payment_method: string | null
  category_id: number | null
  member_id: number | null
  project_id: number
  status: string
  imported_from: string | null
  created_at: string | null
}

interface Project {
  id: number
  name: string
}

export function TransactionsList() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<Transaction | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false)

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
  })

  const buildParams = () => {
    const params: Record<string, string> = {}
    if (filterType) params.type = filterType
    if (filterProject) params.project_id = filterProject
    return params
  }

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions', filterType, filterProject],
    queryFn: () => api.get('/api/financial/transactions', { params: buildParams() }).then((r) => r.data),
  })

  const deleteTransaction = useMutation({
    mutationFn: (id: number) => api.delete(`/api/financial/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setDeleteConfirm(null)
    },
  })

  const batchDelete = useMutation({
    mutationFn: (ids: number[]) => api.delete('/api/financial/transactions/batch', { data: { ids } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setSelected(new Set())
      setBatchDeleteConfirm(false)
    },
  })

  const filtered = transactions.filter(
    (t) =>
      (!search ||
        (t.description || '').toLowerCase().includes(search.toLowerCase()) ||
        t.value.toString().includes(search)) &&
      (!filterStatus || t.status === filterStatus)
  )

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((t) => t.id)))
    }
  }

  const handleExport = async (format: 'json' | 'csv') => {
    const response = await api.get(`/api/financial/export?format=${format}`, { responseType: 'blob' })
    const blob = new Blob([response.data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup_financeiro.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  const projectName = (id: number) => projects.find((p) => p.id === id)?.name || `#${id}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/financeiro" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Transações</h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} lançamento{filtered.length !== 1 ? 's' : ''}
              {selected.size > 0 && ` • ${selected.size} selecionado${selected.size !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => setBatchDeleteConfirm(true)}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              <Trash2 className="w-4 h-4" /> Excluir ({selected.size})
            </button>
          )}
          <div className="relative group">
            <button className="inline-flex items-center gap-2 border px-4 py-2 rounded-lg hover:bg-muted transition">
              <Download className="w-4 h-4" /> Backup
            </button>
            <div className="absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg hidden group-hover:block z-10">
              <button onClick={() => handleExport('json')} className="block w-full text-left px-4 py-2 hover:bg-muted text-sm">
                Exportar JSON
              </button>
              <button onClick={() => handleExport('csv')} className="block w-full text-left px-4 py-2 hover:bg-muted text-sm">
                Exportar CSV
              </button>
            </div>
          </div>
          <Link
            to="/financeiro/transacoes/nova"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> Nova Transação
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por descrição ou valor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="">Todos os tipos</option>
          <option value="Entrada">Entrada</option>
          <option value="Saída">Saída</option>
        </select>
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="">Todos os projetos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
        >
          <option value="">Todos os status</option>
          <option value="Previsto">Previsto</option>
          <option value="Confirmado">Confirmado</option>
          <option value="Conciliado">Conciliado</option>
        </select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma transação encontrada
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-3 w-10">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                      {selected.size === filtered.length && filtered.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Descrição</th>
                  <th className="text-left px-4 py-3 font-medium">Projeto</th>
                  <th className="text-right px-4 py-3 font-medium">Valor</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className={`border-b last:border-0 hover:bg-muted/30 ${selected.has(t.id) ? 'bg-primary/5' : ''}`}>
                    <td className="px-3 py-3">
                      <button onClick={() => toggleSelect(t.id)} className="text-muted-foreground hover:text-foreground">
                        {selected.has(t.id) ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">{fmtDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.type === 'Entrada'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {t.type === 'Entrada' ? (
                          <ArrowUpCircle className="w-3 h-3" />
                        ) : (
                          <ArrowDownCircle className="w-3 h-3" />
                        )}
                        {t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">
                      {t.description || '—'}
                      {t.imported_from && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t.imported_from})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{projectName(t.project_id)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      t.type === 'Entrada' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {t.type === 'Saída' ? '- ' : ''}{fmt(t.value)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === 'Conciliado'
                          ? 'bg-green-100 text-green-800'
                          : t.status === 'Confirmado'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <Link
                          to={`/financeiro/transacoes/${t.id}/editar`}
                          className="p-1.5 text-muted-foreground hover:text-blue-600 rounded"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm(t)}
                          className="p-1.5 text-muted-foreground hover:text-red-600 rounded"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg">Excluir Transação</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Tem certeza que deseja excluir a transação "{deleteConfirm.description || 'Sem descrição'}" de {fmt(deleteConfirm.value)}?
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteTransaction.mutate(deleteConfirm.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de exclusão em massa */}
      {batchDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg text-red-600">Exclusão em Massa</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Tem certeza que deseja excluir <strong>{selected.size}</strong> transação{selected.size !== 1 ? 'ões' : ''}?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setBatchDeleteConfirm(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={() => batchDelete.mutate([...selected])}
                disabled={batchDelete.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {batchDelete.isPending ? 'Excluindo...' : `Excluir ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
