import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'

export function ProjectForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    financial_goal: '',
    status: 'Ativo',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      api.get('/api/financial/projects').then((r) => {
        const project = r.data.find((p: any) => p.id === Number(id))
        if (project) {
          setForm({
            name: project.name,
            description: project.description || '',
            start_date: project.start_date,
            end_date: project.end_date || '',
            financial_goal: project.financial_goal ? String(project.financial_goal) : '',
            status: project.status,
          })
        }
      })
    }
  }, [id])

  const save = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEditing
        ? api.put(`/api/financial/projects/${id}`, data)
        : api.post('/api/financial/projects', data),
    onSuccess: () => navigate('/financeiro/projetos'),
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Erro ao salvar projeto')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) {
      setError('Informe o nome do projeto')
      return
    }

    const data: Record<string, unknown> = {
      name: form.name,
      description: form.description || null,
      start_date: form.start_date,
      end_date: form.end_date || null,
      financial_goal: form.financial_goal ? Number(form.financial_goal) : null,
      status: form.status,
    }

    save.mutate(data)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/financeiro/projetos" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? 'Editar Projeto' : 'Novo Projeto'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Preencha os dados do projeto ou evento financeiro
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome *</label>
          <input
            type="text"
            placeholder="Ex: Retiro de Verão 2026"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Descrição</label>
          <textarea
            placeholder="Detalhes sobre o projeto..."
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Data de Início *</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data de Fim</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Meta Financeira (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={form.financial_goal}
              onChange={(e) => setForm({ ...form, financial_goal: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          {isEditing && (
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="Ativo">Ativo</option>
                <option value="Encerrado">Encerrado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link to="/financeiro/projetos" className="px-4 py-2 border rounded-lg hover:bg-muted">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {save.isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Projeto'}
          </button>
        </div>
      </form>
    </div>
  )
}
