import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface ItemDraft {
  id?: number
  description: string
  quantity: number
  unit?: string
  estimated_price?: number | ''
  notes?: string
}

interface Project { id: number; name: string }
interface Category { id: number; name: string; type?: string }

export function RequestForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '', supplier: '', notes: '',
    project_id: '' as string, category_id: '' as string,
  })
  const [items, setItems] = useState<ItemDraft[]>([])

  const { data: existing } = useQuery({
    queryKey: ['shopping-request', id],
    queryFn: () => api.get(`/api/shopping/requests/${id}`).then((r) => r.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title || '',
        supplier: existing.supplier || '',
        notes: existing.notes || '',
        project_id: existing.project_id ? String(existing.project_id) : '',
        category_id: existing.category_id ? String(existing.category_id) : '',
      })
      setItems((existing.items || []).map((it: any) => ({
        id: it.id,
        description: it.description, quantity: it.quantity,
        unit: it.unit ?? '', estimated_price: it.estimated_price ?? '',
        notes: it.notes ?? '',
      })))
    }
  }, [existing])

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['financial-projects'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
  })
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['financial-categories'],
    queryFn: () => api.get('/api/financial/categories').then((r) => r.data),
  })
  const expenseCategories = categories.filter((c) => !c.type || c.type === 'Saída' || c.type === 'Ambos')

  const addRow = () => setItems([...items, { description: '', quantity: 1, unit: '', estimated_price: '' }])
  const removeRow = (idx: number) => setItems(items.filter((_, i) => i !== idx))
  const updateRow = (idx: number, patch: Partial<ItemDraft>) =>
    setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const submitMut = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        supplier: form.supplier || null,
        notes: form.notes || null,
        project_id: form.project_id ? Number(form.project_id) : null,
        category_id: form.category_id ? Number(form.category_id) : null,
        items: items.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          unit: it.unit || null,
          estimated_price: it.estimated_price !== '' ? Number(it.estimated_price) : null,
          notes: it.notes || null,
        })),
      }
      return isEdit
        ? api.put(`/api/shopping/requests/${id}`, payload)
        : api.post('/api/shopping/requests', payload)
    },
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['shopping-requests'] })
      qc.invalidateQueries({ queryKey: ['shopping-request', id] })
      navigate(`/compras/pedidos/${isEdit ? id : resp.data.id}`)
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao salvar pedido')),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) { setError('Título é obrigatório'); return }
    if (items.length === 0) { setError('Adicione ao menos um item'); return }
    if (items.some((it) => !it.description.trim())) { setError('Todos os itens precisam de descrição'); return }
    submitMut.mutate()
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-4xl">
      <div>
        <Link to="/compras/pedidos" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar para pedidos
        </Link>
        <h1 className="text-2xl font-bold mt-2">{isEdit ? 'Editar pedido' : 'Novo pedido de compra'}</h1>
      </div>

      <div className="bg-white border rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Título *</label>
          <input
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            placeholder="Ex.: Compra mensal de cozinha"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Fornecedor</label>
          <input
            value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
            placeholder="Nome do fornecedor (opcional)"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Projeto Financeiro</label>
          <select
            value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white"
          >
            <option value="">— Nenhum —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Categoria (Saída)</label>
          <select
            value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white"
          >
            <option value="">— Nenhuma —</option>
            {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Observações</label>
          <textarea
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
          />
        </div>
      </div>

      {/* Itens */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Itens ({items.length})</h2>
          <button type="button" onClick={addRow} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg flex items-center gap-1">
            <Plus className="w-3 h-3" /> Adicionar item
          </button>
        </div>
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item ainda. Clique em "Adicionar item".</p>
        )}
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start border-b pb-2">
              <input
                value={it.description}
                onChange={(e) => updateRow(idx, { description: e.target.value })}
                placeholder="Descrição *"
                className="md:col-span-5 border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="number" step="0.01" min="0.01"
                value={it.quantity}
                onChange={(e) => updateRow(idx, { quantity: Number(e.target.value) })}
                placeholder="Qtd"
                className="md:col-span-2 border rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={it.unit ?? ''}
                onChange={(e) => updateRow(idx, { unit: e.target.value })}
                placeholder="Un"
                className="md:col-span-1 border rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="number" step="0.01" min="0"
                value={it.estimated_price as number | ''}
                onChange={(e) => updateRow(idx, { estimated_price: e.target.value === '' ? '' : Number(e.target.value) })}
                placeholder="Estimado"
                className="md:col-span-3 border rounded-lg px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => removeRow(idx)} className="md:col-span-1 px-2 py-2 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitMut.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitMut.isPending ? 'Salvando...' : 'Salvar pedido'}
        </button>
        <Link to="/compras/pedidos" className="px-4 py-2 border rounded-lg text-sm">Cancelar</Link>
      </div>
    </form>
  )
}
