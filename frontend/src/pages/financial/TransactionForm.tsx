import { useQuery, useMutation } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Repeat } from 'lucide-react'

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

interface MemberSummary {
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
  member_id: number | null
  project_id: number | null
  status: string
  is_recurring?: boolean
  recurring_group_id?: string | null
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
    member_id: '',
    project_id: '',
    status: 'Previsto',
  })
  const [error, setError] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceCount, setRecurrenceCount] = useState('12')
  const [recurrenceDay, setRecurrenceDay] = useState('')
  // Edição de tx que faz parte de grupo recorrente: usuário escolhe escopo
  const [recurringGroupId, setRecurringGroupId] = useState<string | null>(null)
  const [recurringScope, setRecurringScope] = useState<'one' | 'forward' | 'all'>('one')

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/financial/categories').then((r) => r.data),
  })

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
  })

  const { data: members = [] } = useQuery<MemberSummary[]>({
    queryKey: ['members-summary'],
    queryFn: () => api.get('/api/members/summary').then((r) => r.data),
  })

  // Carregar dados para edição.
  // Usamos /transactions/by-id/{id} (rota dedicada) em vez de listar todas as
  // transações com limit=500 — isso falhava silenciosamente quando havia mais
  // de 500 lançamentos no banco (form ficava em branco e Salvar virava no-op).
  useEffect(() => {
    if (!id) return
    api.get(`/api/financial/transactions/by-id/${id}`).then((r) => {
      const tx = r.data as TransactionData
      setForm({
        date: tx.date,
        type: tx.type,
        value: String(tx.value),
        description: tx.description || '',
        payment_method: tx.payment_method || 'Dinheiro',
        category_id: tx.category_id ? String(tx.category_id) : '',
        member_id: tx.member_id ? String(tx.member_id) : '',
        project_id: tx.project_id ? String(tx.project_id) : '',
        status: tx.status,
      })
      setRecurringGroupId(tx.recurring_group_id || null)
    })
  }, [id])

  const filteredCategories = categories.filter((c) => c.type === form.type)

  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      if (isEditing && recurringGroupId && recurringScope !== 'one') {
        const params: Record<string, string> = {}
        if (recurringScope === 'forward') {
          params.from_date = form.date
        }
        return api.put(
          `/api/financial/transactions/recurring/${recurringGroupId}`,
          data,
          { params },
        )
      }
      return isEditing
        ? api.put(`/api/financial/transactions/${id}`, data)
        : isRecurring
        ? api.post('/api/financial/transactions/recurring', data)
        : api.post('/api/financial/transactions', data)
    },
    onSuccess: () => navigate('/financeiro/transacoes'),
    onError: (err: unknown) => {
      setError(getErrorMessage(err, 'Erro ao salvar transação'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.value || Number(form.value) <= 0) {
      setError('Informe um valor válido')
      return
    }

    const baseData: Record<string, unknown> = {
      date: form.date,
      type: form.type,
      value: Number(form.value),
      description: form.description || null,
      payment_method: form.payment_method || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      member_id: form.member_id ? Number(form.member_id) : null,
      project_id: form.project_id ? Number(form.project_id) : null,
      status: form.status,
    }

    // Sanitiza payload: remove chaves com string vazia/undefined (evita erros
    // de Pydantic do tipo "date: Input should be a valid date" quando o front
    // envia "" em campo opcional).
    Object.keys(baseData).forEach((k) => {
      const v = baseData[k]
      if (v === '' || v === undefined) delete baseData[k]
    })

    if (isRecurring && !isEditing) {
      baseData.recurrence_count = Number(recurrenceCount)
      if (recurrenceDay) baseData.recurrence_day = Number(recurrenceDay)
    }

    save.mutate(baseData)
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
            <label className="block text-sm font-medium mb-1">Projeto</label>
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Nenhum (classificar depois)</option>
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

        {/* Membro */}
        <div>
          <label className="block text-sm font-medium mb-1">Membro (opcional)</label>
          <select
            value={form.member_id}
            onChange={(e) => setForm({ ...form, member_id: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="">Nenhum</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Associar a um membro para rastrear quem pagou/recebeu
          </p>
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
              <option value="Previsto">Previsto (promessa, não entra no caixa)</option>
              <option value="Confirmado">Confirmado (já entrou/saiu do caixa)</option>
            </select>
          </div>
        </div>

        {/* Escopo de edição para tx recorrente (Ajuste 10) */}
        {isEditing && recurringGroupId && (
          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 space-y-2">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-blue-700" />
              <span className="text-sm font-medium text-blue-900">
                Esta transação faz parte de uma série recorrente
              </span>
            </div>
            <label className="block text-xs font-medium text-blue-900">Aplicar alteração a:</label>
            <select
              value={recurringScope}
              onChange={(e) =>
                setRecurringScope(e.target.value as 'one' | 'forward' | 'all')
              }
              data-testid="recurring-scope"
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="one">Apenas esta transação</option>
              <option value="forward">Esta e as próximas (mesmo grupo)</option>
              <option value="all">Todas do grupo</option>
            </select>
            <p className="text-xs text-blue-800">
              Os campos <em>data</em> e <em>data de pagamento</em> são individuais e
              só se aplicam a esta transação, mesmo nos modos em lote.
            </p>
          </div>
        )}

        {/* Recorrência (apenas em novo lançamento) */}
        {!isEditing && (
        <div className="border rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Repeat className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Transação recorrente</span>
            </label>
            {isRecurring && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium mb-1">Repetir por (meses)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={recurrenceCount}
                    onChange={(e) => setRecurrenceCount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Dia do vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Mesmo da data"
                    value={recurrenceDay}
                    onChange={(e) => setRecurrenceDay(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  />
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Serão criados {recurrenceCount} lançamentos com status "Previsto", um por mês a partir da data informada.
                </p>
              </div>
            )}
        </div>
        )}

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
