import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Eye, ArrowLeft } from 'lucide-react'

interface Project {
  id: number
  name: string
  description: string | null
  start_date: string
  end_date: string | null
  financial_goal: number | null
  status: string
  created_at: string | null
}

const STATUS_COLORS: Record<string, string> = {
  Ativo: 'bg-green-100 text-green-800',
  Encerrado: 'bg-gray-100 text-gray-800',
  Cancelado: 'bg-red-100 text-red-800',
}

export function ProjectsList() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
  })

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/financeiro" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Projetos / Eventos</h1>
            <p className="text-sm text-muted-foreground">
              {projects.length} projeto{projects.length !== 1 ? 's' : ''} cadastrado{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Link
          to="/financeiro/projetos/novo"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" /> Novo Projeto
        </Link>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum projeto cadastrado
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="bg-card border rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{p.description}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-800'}`}>
                  {p.status}
                </span>
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <p>Início: {fmtDate(p.start_date)}</p>
                {p.end_date && <p>Fim: {fmtDate(p.end_date)}</p>}
                {p.financial_goal != null && p.financial_goal > 0 && (
                  <p>Meta: {fmt(p.financial_goal)}</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Link
                  to={`/financeiro/projetos/${p.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                >
                  <Eye className="w-3.5 h-3.5" /> Dashboard
                </Link>
                <Link
                  to={`/financeiro/projetos/${p.id}/editar`}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
