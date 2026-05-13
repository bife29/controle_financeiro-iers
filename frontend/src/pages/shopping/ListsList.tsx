import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { Plus, Archive, ArchiveRestore, Trash2, ListChecks, Eye } from 'lucide-react'

interface ShoppingList {
  id: number
  name: string
  description?: string | null
  is_archived: boolean
  items_count: number
  pending_count: number
  created_at?: string | null
}

export function ListsList() {
  const qc = useQueryClient()
  const [showArchived, setShowArchived] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: lists = [], isLoading } = useQuery<ShoppingList[]>({
    queryKey: ['shopping-lists', showArchived],
    queryFn: () =>
      api.get('/api/shopping/lists', { params: { archived: showArchived ? true : undefined } })
        .then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: () => api.post('/api/shopping/lists', { name: name.trim(), description: description || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-lists'] })
      setShowNew(false); setName(''); setDescription(''); setError(null)
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao criar lista')),
  })

  const archiveMut = useMutation({
    mutationFn: ({ id, archive }: { id: number; archive: boolean }) =>
      api.put(`/api/shopping/lists/${id}`, { is_archived: archive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-lists'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/shopping/lists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-lists'] }),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Listas de Compras</h1>
          <p className="text-sm text-muted-foreground">{lists.length} lista(s)</p>
        </div>
        <div className="flex gap-2">
          <label className="text-sm flex items-center gap-2 px-3 py-2 border rounded-lg bg-white">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Arquivadas
          </label>
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nova lista
          </button>
        </div>
      </div>

      {showNew && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold">Nova lista</h2>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Nome (ex.: Cozinha, Limpeza)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            rows={2}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={!name.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >Salvar</button>
            <button
              onClick={() => { setShowNew(false); setError(null) }}
              className="px-4 py-2 border rounded-lg text-sm"
            >Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : lists.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-sm text-muted-foreground">
          <ListChecks className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Nenhuma lista {showArchived ? 'arquivada' : 'ativa'} ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {lists.map((l) => (
            <div key={l.id} className="bg-white border rounded-xl p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <Link to={`${l.id}`} className="font-semibold hover:underline">{l.name}</Link>
                  {l.description && <p className="text-xs text-muted-foreground mt-1">{l.description}</p>}
                </div>
                {l.is_archived && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Arquivada</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-3">
                {l.items_count} item(ns) • {l.pending_count} pendente(s)
              </div>
              <div className="flex gap-2 mt-3">
                <Link to={`${l.id}`} className="flex-1 text-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100 flex items-center justify-center gap-1">
                  <Eye className="w-3 h-3" /> Abrir
                </Link>
                <button
                  onClick={() => archiveMut.mutate({ id: l.id, archive: !l.is_archived })}
                  title={l.is_archived ? 'Desarquivar' : 'Arquivar'}
                  className="px-3 py-1.5 border rounded text-xs hover:bg-gray-50"
                >
                  {l.is_archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir lista "${l.name}"? Os itens também serão removidos.`)) {
                      deleteMut.mutate(l.id)
                    }
                  }}
                  title="Excluir"
                  className="px-3 py-1.5 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
