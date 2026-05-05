import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowUpCircle, ArrowDownCircle, TrendingUp, Users, Edit2 } from 'lucide-react'

interface ProjectDashboard {
  project: {
    id: number
    name: string
    description: string | null
    start_date: string
    end_date: string | null
    financial_goal: number | null
    status: string
  }
  total_received: number
  total_spent: number
  balance: number
  participant_count: number
  paid_count: number
  pending_count: number
}

export function ProjectDetail() {
  const { id } = useParams()

  const { data, isLoading, error } = useQuery<ProjectDashboard>({
    queryKey: ['project-dashboard', id],
    queryFn: () => api.get(`/api/financial/projects/${id}/dashboard`).then((r) => r.data),
    enabled: !!id,
  })

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Carregando...</div>
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Projeto não encontrado</p>
        <Link to="/financeiro/projetos" className="text-primary hover:underline mt-2 inline-block">
          Voltar
        </Link>
      </div>
    )
  }

  const { project: p } = data
  const goalProgress = p.financial_goal && p.financial_goal > 0
    ? Math.min((data.total_received / p.financial_goal) * 100, 100)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/financeiro/projetos" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{p.name}</h1>
            <p className="text-sm text-muted-foreground">
              {fmtDate(p.start_date)}
              {p.end_date ? ` — ${fmtDate(p.end_date)}` : ''} · {p.status}
            </p>
          </div>
        </div>
        <Link
          to={`/financeiro/projetos/${p.id}/editar`}
          className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted"
        >
          <Edit2 className="w-4 h-4" /> Editar
        </Link>
      </div>

      {p.description && (
        <p className="text-muted-foreground">{p.description}</p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <ArrowUpCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Recebido</span>
          </div>
          <p className="text-xl font-bold">{fmt(data.total_received)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <ArrowDownCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Gasto</span>
          </div>
          <p className="text-xl font-bold">{fmt(data.total_spent)}</p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Saldo</span>
          </div>
          <p className={`text-xl font-bold ${data.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {fmt(data.balance)}
          </p>
        </div>
        <div className="bg-card border rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Users className="w-5 h-5" />
            <span className="text-sm font-medium">Participantes</span>
          </div>
          <p className="text-xl font-bold">{data.participant_count}</p>
          <p className="text-xs text-muted-foreground">
            {data.paid_count} pago{data.paid_count !== 1 ? 's' : ''} · {data.pending_count} pendente{data.pending_count !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Meta financeira */}
      {goalProgress !== null && (
        <div className="bg-card border rounded-xl p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Meta Financeira</span>
            <span className="text-muted-foreground">
              {fmt(data.total_received)} de {fmt(p.financial_goal!)}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className="bg-primary rounded-full h-3 transition-all"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {goalProgress.toFixed(1)}%
          </p>
        </div>
      )}

      {/* Link para transações */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="font-semibold mb-2">Transações deste Projeto</h3>
        <Link
          to={`/financeiro/transacoes?project=${p.id}`}
          className="text-primary hover:underline text-sm"
        >
          Ver todas as transações →
        </Link>
      </div>
    </div>
  )
}
