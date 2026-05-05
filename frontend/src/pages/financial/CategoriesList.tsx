import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Tag } from 'lucide-react'

interface Category {
  id: number
  name: string
  type: string
  nature: string
  is_active: boolean
}

const TYPE_COLORS: Record<string, string> = {
  Entrada: 'bg-green-100 text-green-800',
  Saída: 'bg-red-100 text-red-800',
}

export function CategoriesList() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Entrada', nature: 'Variável' })
  const [error, setError] = useState('')

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/financial/categories').then((r) => r.data),
  })

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/api/financial/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setShowForm(false)
      setForm({ name: '', type: 'Entrada', nature: 'Variável' })
      setError('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Erro ao criar categoria')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Informe o nome da categoria')
      return
    }
    create.mutate(form)
  }

  const entradas = categories.filter((c) => c.type === 'Entrada')
  const saidas = categories.filter((c) => c.type === 'Saída')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/financeiro" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Categorias</h1>
            <p className="text-sm text-muted-foreground">
              {categories.length} categoria{categories.length !== 1 ? 's' : ''} ativa{categories.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> Nova Categoria
        </button>
      </div>

      {/* Form inline */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <input
                type="text"
                placeholder="Ex: Dízimo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Natureza</label>
              <select
                value={form.nature}
                onChange={(e) => setForm({ ...form, nature: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="Fixa">Fixa</option>
                <option value="Variável">Variável</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={create.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending ? 'Criando...' : 'Criar'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError('') }}
              className="px-4 py-2 border rounded-lg hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Lista por tipo */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhuma categoria cadastrada</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Entradas */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold text-green-700 flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4" /> Entradas ({entradas.length})
            </h3>
            <div className="space-y-2">
              {entradas.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.nature}</span>
                </div>
              ))}
              {entradas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma categoria de entrada</p>
              )}
            </div>
          </div>

          {/* Saídas */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-semibold text-red-700 flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4" /> Saídas ({saidas.length})
            </h3>
            <div className="space-y-2">
              {saidas.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-red-50 rounded-lg">
                  <span className="font-medium text-sm">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.nature}</span>
                </div>
              ))}
              {saidas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma categoria de saída</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
