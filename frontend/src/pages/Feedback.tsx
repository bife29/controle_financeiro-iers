import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import { MessageSquare, Bug, Lightbulb, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeedbackItem {
  id: number
  type: string
  title: string
  description: string
  priority: string
  status: string
  module: string | null
  admin_response: string | null
  created_at: string
}

const typeIcons: Record<string, typeof MessageSquare> = {
  sugestao: Lightbulb,
  erro: Bug,
  melhoria: MessageSquare,
}

const typeLabels: Record<string, string> = {
  sugestao: 'Sugestão',
  erro: 'Erro/Bug',
  melhoria: 'Melhoria',
}

const priorityColors: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-700',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700',
}

const statusColors: Record<string, string> = {
  aberto: 'bg-yellow-100 text-yellow-700',
  em_analise: 'bg-blue-100 text-blue-700',
  resolvido: 'bg-green-100 text-green-700',
  recusado: 'bg-gray-100 text-gray-500',
}

export function FeedbackPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    type: 'sugestao',
    title: '',
    description: '',
    priority: 'media',
    module: 'geral',
  })

  const { data: feedbacks = [], isLoading } = useQuery<FeedbackItem[]>({
    queryKey: ['feedbacks'],
    queryFn: () => api.get('/api/feedback/').then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/api/feedback/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbacks'] })
      setShowForm(false)
      setForm({ type: 'sugestao', title: '', description: '', priority: 'media', module: 'geral' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(form)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Feedback & Sugestões</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Envie sugestões, reporte erros ou solicite melhorias
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition"
        >
          <Send className="w-4 h-4" />
          Novo Feedback
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="sugestao">Sugestão</option>
                <option value="erro">Erro/Bug</option>
                <option value="melhoria">Melhoria</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Prioridade</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Módulo</label>
              <select
                value={form.module}
                onChange={(e) => setForm({ ...form, module: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="geral">Geral</option>
                <option value="financeiro">Financeiro</option>
                <option value="secretaria">Secretaria</option>
                <option value="retiro">Retiro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Título</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Resumo curto do feedback"
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Descrição detalhada</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descreva com detalhes o que observou, onde ocorre, e sugestão de como resolver..."
              rows={4}
              className="w-full px-3 py-2 border rounded-lg resize-none"
              required
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {mutation.isPending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de feedbacks */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-xl" />
            ))}
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-4">Nenhum feedback enviado ainda</p>
          </div>
        ) : (
          feedbacks.map((fb) => {
            const Icon = typeIcons[fb.type] || MessageSquare
            return (
              <div key={fb.id} className="bg-card border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{fb.title}</h3>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", priorityColors[fb.priority])}>
                        {fb.priority}
                      </span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColors[fb.status])}>
                        {fb.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{fb.description}</p>
                    {fb.admin_response && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                        <span className="font-medium text-green-800">Resposta:</span> {fb.admin_response}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(fb.created_at).toLocaleDateString('pt-BR')} • {typeLabels[fb.type]} • {fb.module}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
