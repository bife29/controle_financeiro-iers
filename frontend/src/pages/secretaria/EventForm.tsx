import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { ArrowLeft, Save } from 'lucide-react'

interface EventFormData {
  title: string
  date: string
  type: string
  description: string
  location: string
  is_active: boolean
}

const EMPTY: EventFormData = {
  title: '', date: '', type: '', description: '', location: '', is_active: true,
}

export function EventForm() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<EventFormData>(EMPTY)
  const [error, setError] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get(`/api/secretaria/events/${id}`).then((r) => r.data),
    enabled: isEditing,
  })

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title ?? '',
        date: existing.date ?? '',
        type: existing.type ?? '',
        description: existing.description ?? '',
        location: existing.location ?? '',
        is_active: existing.is_active ?? true,
      })
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: (data: EventFormData) => {
      const payload = {
        title: data.title,
        date: data.date,
        type: data.type || null,
        description: data.description || null,
        location: data.location || null,
        is_active: data.is_active,
      }
      return isEditing
        ? api.put(`/api/secretaria/events/${id}`, payload)
        : api.post('/api/secretaria/events', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events-list'] })
      qc.invalidateQueries({ queryKey: ['events-range'] })
      qc.invalidateQueries({ queryKey: ['secretaria-dashboard'] })
      navigate('/secretaria/eventos')
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao salvar evento')),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.date) {
      setError('Título e data são obrigatórios')
      return
    }
    setError('')
    mutation.mutate(form)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/secretaria/eventos')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? 'Editar evento' : 'Novo evento'}</h1>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white border rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Título *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Data *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tipo</label>
            <input
              type="text"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              placeholder="culto, reunião, retiro..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Local</label>
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded"
          />
          Ativo (aparece no calendário)
        </label>

        {error && (
          <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2 border-t">
          <button
            type="button"
            onClick={() => navigate('/secretaria/eventos')}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
