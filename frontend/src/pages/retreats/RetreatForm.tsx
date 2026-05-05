import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ArrowLeft, Save } from 'lucide-react'

interface RetreatData {
  name: string
  description: string
  location: string
  start_date: string
  end_date: string
  max_participants: number | null
  cost_adult: number
  cost_child: number
  total_budget: number
  bus_capacity: number | null
  bed_capacity: number | null
  status: string
}

const initialData: RetreatData = {
  name: '',
  description: '',
  location: '',
  start_date: '',
  end_date: '',
  max_participants: null,
  cost_adult: 0,
  cost_child: 0,
  total_budget: 0,
  bus_capacity: null,
  bed_capacity: null,
  status: 'Planejamento',
}

export function RetreatForm() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<RetreatData>(initialData)
  const [error, setError] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['retreat', id],
    queryFn: () => api.get(`/api/retreats/${id}`).then((r) => r.data),
    enabled: isEditing,
  })

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name || '',
        description: existing.description || '',
        location: existing.location || '',
        start_date: existing.start_date || '',
        end_date: existing.end_date || '',
        max_participants: existing.max_participants,
        cost_adult: existing.cost_adult || 0,
        cost_child: existing.cost_child || 0,
        total_budget: existing.total_budget || 0,
        bus_capacity: existing.bus_capacity,
        bed_capacity: existing.bed_capacity,
        status: existing.status || 'Planejamento',
      })
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: (data: RetreatData) =>
      isEditing
        ? api.put(`/api/retreats/${id}`, data)
        : api.post('/api/retreats/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retreats'] })
      navigate('/retiros')
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Erro ao salvar retiro')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Nome do retiro é obrigatório')
      return
    }
    if (!form.start_date || !form.end_date) {
      setError('Datas de início e fim são obrigatórias')
      return
    }
    setError('')
    mutation.mutate(form)
  }

  const updateField = (field: keyof RetreatData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/retiros')}
          className="p-2 hover:bg-muted rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Retiro' : 'Novo Retiro'}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Preencha as informações do retiro / evento
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações Gerais */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Informações Gerais</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome do Retiro / Evento *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Ex: Retiro de Carnaval 2026"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                placeholder="Detalhes sobre o retiro..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Local</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => updateField('location', e.target.value)}
                placeholder="Ex: Hotel Fazenda Boa Vista - Petrópolis/RJ"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Datas e Capacidade */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Datas e Capacidade</legend>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data Início *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => updateField('start_date', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Fim *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => updateField('end_date', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Máximo Participantes</label>
              <input
                type="number"
                value={form.max_participants || ''}
                onChange={(e) => updateField('max_participants', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Sem limite"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Logística */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Logística</legend>
          <p className="text-xs text-muted-foreground -mt-2">
            Defina a capacidade logística. Quando as vagas esgotarem, novos participantes entrarão automaticamente em lista de espera.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Vagas de Ônibus</label>
              <input
                type="number"
                value={form.bus_capacity || ''}
                onChange={(e) => updateField('bus_capacity', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Sem limite"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
              <p className="text-xs text-muted-foreground mt-1">Total de assentos disponíveis no transporte</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Camas Disponíveis</label>
              <input
                type="number"
                value={form.bed_capacity || ''}
                onChange={(e) => updateField('bed_capacity', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Sem limite"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
              <p className="text-xs text-muted-foreground mt-1">Total de camas/leitos no alojamento</p>
            </div>
          </div>
        </fieldset>

        {/* Valores */}
        <fieldset className="bg-card border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-primary px-2">Valores</legend>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Valor por Adulto (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.cost_adult || ''}
                onChange={(e) => updateField('cost_adult', parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor por Criança (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.cost_child || ''}
                onChange={(e) => updateField('cost_child', parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Custo Total Estimado (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.total_budget || ''}
                onChange={(e) => updateField('total_budget', parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </fieldset>

        {/* Status (somente edição) */}
        {isEditing && (
          <fieldset className="bg-card border rounded-xl p-5 space-y-4">
            <legend className="text-sm font-bold text-primary px-2">Status</legend>
            <select
              value={form.status}
              onChange={(e) => updateField('status', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="Planejamento">Planejamento</option>
              <option value="Inscricoes">Inscrições Abertas</option>
              <option value="Em_andamento">Em Andamento</option>
              <option value="Encerrado">Encerrado</option>
            </select>
          </fieldset>
        )}

        {/* Erro e botão */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/retiros')}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Retiro'}
          </button>
        </div>
      </form>
    </div>
  )
}
