import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Link } from 'react-router-dom'
import { Mountain, Plus, Users, MapPin, Calendar, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Retreat {
  id: number
  name: string
  description: string | null
  location: string | null
  start_date: string
  end_date: string
  max_participants: number | null
  cost_adult: number
  cost_child: number
  total_budget: number
  status: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  Planejamento: { label: 'Planejamento', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  Inscricoes: { label: 'Inscrições Abertas', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  Em_andamento: { label: 'Em Andamento', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Encerrado: { label: 'Encerrado', color: 'bg-gray-100 text-gray-500 border-gray-200' },
}

export function RetreatsList() {
  const { data: retreats = [], isLoading } = useQuery<Retreat[]>({
    queryKey: ['retreats'],
    queryFn: () => api.get('/api/retreats/').then((r) => r.data),
  })

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Retiros</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão de retiros, inscrições e controle financeiro
          </p>
        </div>
        <Link
          to="/retiros/novo"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Retiro
        </Link>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 bg-muted rounded-xl" />
          ))}
        </div>
      ) : retreats.length === 0 ? (
        <div className="bg-card border rounded-xl p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Mountain className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mt-4">Nenhum retiro cadastrado</h3>
          <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
            Crie seu primeiro retiro para gerenciar inscrições, participantes e pagamentos.
          </p>
          <Link
            to="/retiros/novo"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" />
            Criar Retiro
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {retreats.map((retreat) => {
            const cfg = statusConfig[retreat.status] || statusConfig.Planejamento
            return (
              <Link
                key={retreat.id}
                to={`/retiros/${retreat.id}`}
                className="group bg-card border rounded-xl p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-200"
              >
                {/* Topo: Nome + Status */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {retreat.name}
                  </h3>
                  <span className={cn(
                    "text-xs px-2.5 py-1 rounded-full font-medium border whitespace-nowrap",
                    cfg.color
                  )}>
                    {cfg.label}
                  </span>
                </div>

                {/* Descrição */}
                {retreat.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {retreat.description}
                  </p>
                )}

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3 mt-5">
                  {retreat.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{retreat.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{formatDate(retreat.start_date)}</span>
                  </div>
                  {retreat.max_participants && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span>Máx. {retreat.max_participants} pessoas</span>
                    </div>
                  )}
                </div>

                {/* Valores */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-sm font-medium">Adulto: {formatCurrency(retreat.cost_adult)}</span>
                  </div>
                  {retreat.cost_child > 0 && (
                    <div className="text-sm text-muted-foreground">
                      Criança: {formatCurrency(retreat.cost_child)}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
