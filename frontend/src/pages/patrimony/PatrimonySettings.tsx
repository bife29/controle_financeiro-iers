import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { Plus, Trash2, Edit2, X } from 'lucide-react'

interface Item { id: number; name: string; is_active: boolean }

export function PatrimonySettings() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações de Patrimônio</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie categorias e locais usados nos cadastros de bens.
        </p>
      </div>

      <CrudPanel
        title="Categorias de bens"
        endpoint="/api/patrimony/categories"
        queryKey="asset-categories"
        placeholder="Ex: Equipamento de som"
      />

      <CrudPanel
        title="Locais / Ambientes"
        endpoint="/api/patrimony/locations"
        queryKey="asset-locations"
        placeholder="Ex: Altar"
      />
    </div>
  )
}

function CrudPanel({
  title, endpoint, queryKey, placeholder,
}: { title: string; endpoint: string; queryKey: string; placeholder: string }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Item | null>(null)
  const [error, setError] = useState('')

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: [queryKey, 'all'],
    queryFn: () => api.get(endpoint, { params: { active_only: false } }).then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: () => api.post(endpoint, { name: name.trim() }),
    onSuccess: () => {
      setName(''); setError('')
      qc.invalidateQueries({ queryKey: [queryKey] })
      qc.invalidateQueries({ queryKey: [queryKey, 'all'] })
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao criar')),
  })

  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: number; name?: string; is_active?: boolean }) =>
      api.put(`${endpoint}/${id}`, patch),
    onSuccess: () => {
      setEditing(null); setError('')
      qc.invalidateQueries({ queryKey: [queryKey] })
      qc.invalidateQueries({ queryKey: [queryKey, 'all'] })
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao atualizar')),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey] })
      qc.invalidateQueries({ queryKey: [queryKey, 'all'] })
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao excluir')),
  })

  return (
    <section className="bg-white border rounded-xl p-5 space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{items.length} item(ns)</span>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate() }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={create.isPending || !name.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </form>

      {error && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-2">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nada cadastrado.</p>
      ) : (
        <ul className="divide-y">
          {items.map((it) => (
            <li key={it.id} className="py-2 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${it.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className={`flex-1 text-sm ${!it.is_active ? 'line-through text-muted-foreground' : ''}`}>
                {it.name}
              </span>
              <button
                onClick={() => setEditing(it)}
                className="p-1.5 hover:bg-gray-100 rounded"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => update.mutate({ id: it.id, is_active: !it.is_active })}
                className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
              >
                {it.is_active ? 'Inativar' : 'Reativar'}
              </button>
              <button
                onClick={() => { if (confirm('Excluir definitivamente?')) remove.mutate(it.id) }}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(newName) => update.mutate({ id: editing.id, name: newName })}
          loading={update.isPending}
        />
      )}
    </section>
  )
}

function EditModal({
  item, onClose, onSave, loading,
}: { item: Item; onClose: () => void; onSave: (n: string) => void; loading?: boolean }) {
  const [val, setVal] = useState(item.name)
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-5 max-w-sm w-full space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Editar nome</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => onSave(val.trim())}
            disabled={loading || !val.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
