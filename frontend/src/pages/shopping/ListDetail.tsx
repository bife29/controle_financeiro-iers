import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { ArrowLeft, Plus, Trash2, Check, X, FileText } from 'lucide-react'

interface Item {
  id: number
  list_id: number
  description: string
  quantity: number
  unit?: string | null
  estimated_price?: number | null
  notes?: string | null
  is_purchased: boolean
}

interface ListDetail {
  id: number
  name: string
  description?: string | null
  is_archived: boolean
  items: Item[]
}

export function ListDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [newItem, setNewItem] = useState({ description: '', quantity: 1, unit: '', estimated_price: '' })
  const [generating, setGenerating] = useState(false)
  const [genTitle, setGenTitle] = useState('')

  const { data, isLoading } = useQuery<ListDetail>({
    queryKey: ['shopping-list', id],
    queryFn: () => api.get(`/api/shopping/lists/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const addItemMut = useMutation({
    mutationFn: () => api.post(`/api/shopping/lists/${id}/items`, {
      description: newItem.description.trim(),
      quantity: Number(newItem.quantity) || 1,
      unit: newItem.unit || null,
      estimated_price: newItem.estimated_price !== '' ? Number(newItem.estimated_price) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list', id] })
      setNewItem({ description: '', quantity: 1, unit: '', estimated_price: '' })
      setError(null)
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao adicionar item')),
  })

  const togglePurchasedMut = useMutation({
    mutationFn: ({ itemId, val }: { itemId: number; val: boolean }) =>
      api.put(`/api/shopping/lists/${id}/items/${itemId}`, { is_purchased: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', id] }),
  })

  const deleteItemMut = useMutation({
    mutationFn: (itemId: number) => api.delete(`/api/shopping/lists/${id}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', id] }),
  })

  const generateMut = useMutation({
    mutationFn: () => api.post(`/api/shopping/lists/${id}/generate-request`, null, {
      params: { title: genTitle.trim() || undefined, only_pending: true },
    }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['shopping-requests'] })
      navigate(`/compras/pedidos/${resp.data.id}`)
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao gerar pedido')),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>
  if (!data) return <p className="text-sm text-red-600">Lista não encontrada</p>

  const pendingCount = data.items.filter((i) => !i.is_purchased).length

  return (
    <div className="space-y-5">
      <div>
        <Link to="/compras/listas" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar para listas
        </Link>
        <h1 className="text-2xl font-bold mt-2">{data.name}</h1>
        {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
      </div>

      {/* Adicionar item */}
      <div className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-3 text-sm">Adicionar item</h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <input
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            placeholder="Descrição *"
            className="md:col-span-5 border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number" step="0.01" min="0.01"
            value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
            placeholder="Qtd"
            className="md:col-span-2 border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={newItem.unit}
            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
            placeholder="Un"
            className="md:col-span-1 border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number" step="0.01" min="0"
            value={newItem.estimated_price}
            onChange={(e) => setNewItem({ ...newItem, estimated_price: e.target.value })}
            placeholder="Preço estimado"
            className="md:col-span-2 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            disabled={!newItem.description.trim() || addItemMut.isPending}
            onClick={() => addItemMut.mutate()}
            className="md:col-span-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* Itens */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Itens ({data.items.length})</h2>
          <span className="text-xs text-muted-foreground">{pendingCount} pendente(s)</span>
        </header>
        {data.items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-muted-foreground text-center">Nenhum item ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 w-10"></th>
                <th className="text-left px-3 py-2">Descrição</th>
                <th className="text-left px-3 py-2 w-20">Qtd</th>
                <th className="text-left px-3 py-2 w-16">Un</th>
                <th className="text-right px-3 py-2 w-32">Estimado</th>
                <th className="px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.id} className={`border-t ${it.is_purchased ? 'bg-emerald-50/40 text-muted-foreground' : ''}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={it.is_purchased}
                      onChange={(e) => togglePurchasedMut.mutate({ itemId: it.id, val: e.target.checked })}
                    />
                  </td>
                  <td className={`px-3 py-2 ${it.is_purchased ? 'line-through' : ''}`}>{it.description}</td>
                  <td className="px-3 py-2">{it.quantity}</td>
                  <td className="px-3 py-2">{it.unit ?? '-'}</td>
                  <td className="px-3 py-2 text-right">
                    {it.estimated_price != null ? it.estimated_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => { if (window.confirm('Remover item?')) deleteItemMut.mutate(it.id) }}
                      className="text-red-600 hover:bg-red-50 p-1 rounded"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Gerar pedido */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        {!generating ? (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" /> Gerar pedido de compra
              </h3>
              <p className="text-xs text-muted-foreground">
                Cria um pedido com os itens pendentes ({pendingCount}) desta lista.
              </p>
            </div>
            <button
              disabled={pendingCount === 0}
              onClick={() => { setGenTitle(`Pedido — ${data.name}`); setGenerating(true) }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-40"
            >
              Gerar pedido
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Confirmar geração</h3>
            <input
              value={genTitle}
              onChange={(e) => setGenTitle(e.target.value)}
              placeholder="Título do pedido"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                disabled={generateMut.isPending}
                onClick={() => generateMut.mutate()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> Confirmar
              </button>
              <button
                onClick={() => setGenerating(false)}
                className="px-4 py-2 border rounded-lg text-sm flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
