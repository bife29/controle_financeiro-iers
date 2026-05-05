import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  ArrowLeft, Edit2, Users, DollarSign, TrendingUp,
  UserX, Clock, CheckCircle2, AlertCircle, Mountain,
  Bus, BedDouble, UserCheck, Hourglass
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Logistics {
  bus_capacity: number | null
  bus_occupied: number
  bus_available: number
  bus_sim_count: number
  bus_colo_count: number
  bed_capacity: number | null
  bed_occupied: number
  bed_available: number
  bed_sim_count: number
  bed_divide_count: number
  waiting_count: number
}

interface Dashboard {
  retreat: {
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
    bus_capacity: number | null
    bed_capacity: number | null
    status: string
  }
  total_participants: number
  confirmed_count: number
  waiting_count: number
  adults_count: number
  children_count: number
  members_count: number
  non_members_count: number
  paid_count: number
  partial_count: number
  pending_count: number
  exempt_count: number
  total_collected: number
  total_expected: number
  total_budget: number
  balance: number
  logistics: Logistics
}

const statusConfig: Record<string, { label: string; color: string }> = {
  Planejamento: { label: 'Planejamento', color: 'bg-slate-100 text-slate-700' },
  Inscricoes: { label: 'Inscrições Abertas', color: 'bg-blue-50 text-blue-700' },
  Em_andamento: { label: 'Em Andamento', color: 'bg-emerald-50 text-emerald-700' },
  Encerrado: { label: 'Encerrado', color: 'bg-gray-100 text-gray-500' },
}

export function RetreatDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: dashboard, isLoading } = useQuery<Dashboard>({
    queryKey: ['retreat-dashboard', id],
    queryFn: () => api.get(`/api/retreats/${id}/dashboard`).then((r) => r.data),
  })

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')

  if (isLoading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-10 bg-muted rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted rounded-xl" />)}</div>
    </div>
  }

  if (!dashboard) {
    return <p className="text-muted-foreground">Retiro não encontrado</p>
  }

  const { retreat, logistics } = dashboard
  const cfg = statusConfig[retreat.status] || statusConfig.Planejamento
  const progressPercent = dashboard.total_expected > 0
    ? Math.min(100, Math.round((dashboard.total_collected / dashboard.total_expected) * 100))
    : 0

  const busPercent = logistics.bus_capacity
    ? Math.min(100, Math.round((logistics.bus_occupied / logistics.bus_capacity) * 100))
    : 0
  const bedPercent = logistics.bed_capacity
    ? Math.min(100, Math.round((logistics.bed_occupied / logistics.bed_capacity) * 100))
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/retiros')}
            className="p-2 hover:bg-muted rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{retreat.name}</h1>
              <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", cfg.color)}>
                {cfg.label}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {retreat.location && `${retreat.location} • `}
              {formatDate(retreat.start_date)} a {formatDate(retreat.end_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/retiros/${id}/participantes`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            <Users className="w-4 h-4" />
            Participantes
          </Link>
          <Link
            to={`/retiros/${id}/editar`}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-muted transition"
          >
            <Edit2 className="w-4 h-4" />
            Editar
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dashboard.total_participants}</p>
              <p className="text-xs text-muted-foreground">Total Inscritos</p>
            </div>
          </div>
          <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><UserCheck className="w-3 h-3 text-emerald-600" /> {dashboard.confirmed_count} confirmados</span>
            {dashboard.waiting_count > 0 && (
              <span className="flex items-center gap-1 text-orange-600"><Hourglass className="w-3 h-3" /> {dashboard.waiting_count} em espera</span>
            )}
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(dashboard.total_collected)}</p>
              <p className="text-xs text-muted-foreground">Arrecadado</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{progressPercent}%</span>
              <span>de {formatCurrency(dashboard.total_expected)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatCurrency(retreat.total_budget)}</p>
              <p className="text-xs text-muted-foreground">Custo Total</p>
            </div>
          </div>
          <p className={cn(
            "text-xs font-medium mt-3",
            dashboard.balance >= 0 ? "text-green-600" : "text-red-500"
          )}>
            Saldo: {formatCurrency(dashboard.balance)}
          </p>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Mountain className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium">Valores por pessoa</p>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Adulto</span>
              <span className="font-medium">{formatCurrency(retreat.cost_adult)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Criança</span>
              <span className="font-medium">{formatCurrency(retreat.cost_child)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Logístico */}
      {(logistics.bus_capacity || logistics.bed_capacity) && (
        <div className="bg-card border rounded-xl p-6">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Bus className="w-4 h-4 text-primary" />
            Painel Logístico
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ônibus */}
            {logistics.bus_capacity != null && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Bus className="w-4 h-4" /> Ônibus
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {logistics.bus_occupied} / {logistics.bus_capacity} vagas
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      busPercent >= 100 ? "bg-red-500" : busPercent >= 80 ? "bg-amber-500" : "bg-blue-500"
                    )}
                    style={{ width: `${busPercent}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-700">{logistics.bus_sim_count}</p>
                    <p className="text-[10px] text-blue-600">Assento</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-purple-700">{logistics.bus_colo_count}</p>
                    <p className="text-[10px] text-purple-600">Colo</p>
                  </div>
                  <div className={cn("rounded-lg p-2", logistics.bus_available > 0 ? "bg-emerald-50" : "bg-red-50")}>
                    <p className={cn("text-lg font-bold", logistics.bus_available > 0 ? "text-emerald-700" : "text-red-600")}>
                      {logistics.bus_available}
                    </p>
                    <p className={cn("text-[10px]", logistics.bus_available > 0 ? "text-emerald-600" : "text-red-500")}>Disponível</p>
                  </div>
                </div>
              </div>
            )}

            {/* Camas */}
            {logistics.bed_capacity != null && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <BedDouble className="w-4 h-4" /> Camas
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {logistics.bed_occupied} / {logistics.bed_capacity} vagas
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      bedPercent >= 100 ? "bg-red-500" : bedPercent >= 80 ? "bg-amber-500" : "bg-blue-500"
                    )}
                    style={{ width: `${bedPercent}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-blue-700">{logistics.bed_sim_count}</p>
                    <p className="text-[10px] text-blue-600">Própria</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-purple-700">{logistics.bed_divide_count}</p>
                    <p className="text-[10px] text-purple-600">Divide</p>
                  </div>
                  <div className={cn("rounded-lg p-2", logistics.bed_available > 0 ? "bg-emerald-50" : "bg-red-50")}>
                    <p className={cn("text-lg font-bold", logistics.bed_available > 0 ? "text-emerald-700" : "text-red-600")}>
                      {logistics.bed_available}
                    </p>
                    <p className={cn("text-[10px]", logistics.bed_available > 0 ? "text-emerald-600" : "text-red-500")}>Disponível</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lista de espera */}
          {logistics.waiting_count > 0 && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3">
              <Hourglass className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-800">
                  {logistics.waiting_count} participante{logistics.waiting_count !== 1 && 's'} em lista de espera
                </p>
                <p className="text-xs text-orange-600">
                  Serão promovidos automaticamente quando houver vaga disponível
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status de Pagamentos */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-semibold text-sm mb-4">Situação dos Pagamentos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-lg font-bold text-green-700">{dashboard.paid_count}</p>
              <p className="text-xs text-green-600">Pagos</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-lg font-bold text-blue-700">{dashboard.partial_count}</p>
              <p className="text-xs text-blue-600">Parciais</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-lg font-bold text-amber-700">{dashboard.pending_count}</p>
              <p className="text-xs text-amber-600">Pendentes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
            <UserX className="w-5 h-5 text-slate-500" />
            <div>
              <p className="text-lg font-bold text-slate-600">{dashboard.exempt_count}</p>
              <p className="text-xs text-slate-500">Isentos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Composição dos participantes */}
      <div className="bg-card border rounded-xl p-6">
        <h3 className="font-semibold text-sm mb-4">Composição dos Participantes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3">
            <p className="text-2xl font-bold">{dashboard.members_count}</p>
            <p className="text-xs text-muted-foreground mt-1">Membros da Igreja</p>
          </div>
          <div className="text-center p-3">
            <p className="text-2xl font-bold">{dashboard.non_members_count}</p>
            <p className="text-xs text-muted-foreground mt-1">Não-Membros</p>
          </div>
          <div className="text-center p-3">
            <p className="text-2xl font-bold">{dashboard.adults_count}</p>
            <p className="text-xs text-muted-foreground mt-1">Adultos</p>
          </div>
          <div className="text-center p-3">
            <p className="text-2xl font-bold">{dashboard.children_count}</p>
            <p className="text-xs text-muted-foreground mt-1">Crianças</p>
          </div>
        </div>
      </div>
    </div>
  )
}
