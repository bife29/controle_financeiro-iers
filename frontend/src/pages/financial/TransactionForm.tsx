import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'

interface Category {
  id: number
  name: string
  type: string
  nature: string
}

interface Project {
  id: number
  name: string
}

interface TransactionData {
  id?: number
  date: string
  type: string
  value: number
  description: string
  payment_method: string
  category_id: number | null
  project_id: number | null
  status: string
}

export function TransactionForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Entrada',
    value: '',
    description: '',
    payment_method: 'Dinheiro',
    category_id: '',
    project_id: '',
    status: 'Previsto',
  })
  const [error, setError] = useState('')

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/financial/categories').then((r) => r.data),
  })

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
  })

  // Carregar dados para edição
  useEffect(() => {
    if (id) {
      api.get('/api/financial/transactions', { params: { limit: 500 } }).then((r) => {
        const tx = r.data.find((t: TransactionData) => t.id === Number(id))
        if (tx) {
          setForm({
            date: tx.date,
            type: tx.type,
            value: String(tx.value),
            description: tx.description || '',
            payment_method: tx.payment_method || 'Dinheiro',
            category_id: tx.category_id ? String(tx.category_id) : '',
            project_id: tx.project_id ? String(tx.project_id) : '',
            status: tx.status,
          })
        }
      })
    }
  }, [id])

  const filteredCategories = categories.filter((c) => c.type === form.type)

  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEditing
        ? api.put(`/api/financial/transactions/${id}`, data)
        : api.post('/api/financial/transactions', data),
    onSuccess: () => navigate('/financeiro/transacoes'),
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Erro ao salvar transação')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.project_id) {
      setError('Selecione um projeto')
      return
    }
    if (!form.value || Number(form.value) <= 0) {
      setError('Informe um valor válido')
      return
    }
    save.mutate({
      date: form.date,
      type: form.type,
      value: Number(form.value),
      description: form.description || null,
      payment_method: form.payment_method || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      project_id: Number(form.project_id),
      status: form.status,
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/financeiro/transacoes" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Transação' : 'Nova Transação'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados do lançamento financeiro
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-4">
        {/* Tipo */}
        <div className="grid grid-cols-2 gap-3">
          {['Entrada', 'Saída'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm({ ...form, type: t, category_id: '' })}
              className={`py-3 rounded-lg font-medium transition ${
                form.type === t
                  ? t === 'Entrada'
                    ? 'bg-green-600 text-white'
                    : 'bg-red-600 text-white'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Data e Valor */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Data *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium mb-1">Descrição</label>
          <input
            type="text"
            placeholder="Descrição do lançamento"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        {/* Projeto e Categoria */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Projeto *</label>
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Selecione...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Categoria</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Nenhuma</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.nature})</option>
              ))}
            </select>
          </div>
        </div>

        {/* Forma de pagamento e Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Forma de Pagamento</label>
            <select
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="Dinheiro">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="Cartão de Débito">Cartão de Débito</option>
              <option value="Cartão de Crédito">Cartão de Crédito</option>
              <option value="Transferência Bancária">Transferência Bancária</option>
              <option value="Boleto">Boleto</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="Previsto">Previsto</option>
              <option value="Confirmado">Confirmado</option>
              <option value="Conciliado">Conciliado</option>
            </select>
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-3 pt-4">
          <Link
            to="/financeiro/transacoes"
            className="px-4 py-2 border rounded-lg hover:bg-muted"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {save.isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Transação'}
          </button>
        </div>
      </form>
    </div>
  )
}
