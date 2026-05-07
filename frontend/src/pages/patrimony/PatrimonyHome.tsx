import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Boxes, Plus, Settings as SettingsIcon, AlertTriangle,
  Wrench, ShieldCheck, Clock, ArrowRight,
} from 'lucide-react'
import { ASSET_STATUSES, formatBrDate, formatCurrency } from '@/lib/patrimony'

interface Alert {
  asset_id: number
  code: string
  name: string
  days_until: number
  due_date: string
  kind: 'maintenance' | 'warranty' | 'service_warranty' | 'expected_return'
}

interface Dashboard {
  total_assets: number
  total_value: number
  counts_by_status: { status: string; count: number }[]
  in_maintenance: number
  upcoming_maintenance: Alert[]
  upcoming_warranty: Alert[]
  overdue_returns: Alert[]
}

export function PatrimonyHome() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['patrimony-dashboard'],
    queryFn: () => api.get('/api/patrimony/dashboard/summary', { params: { days: 30 } }).then((r) => r.data),
  })

  const countsMap = new Map((data?.counts_by_status ?? []).map((c) => [c.status, c.count]))

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Patrimônio</h1>
          <p className="text-sm text-muted-foreground">
            Bens da igreja, manutenções e alertas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="bens"
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <Boxes className="w-4 h-4" /> Lista de bens
          </Link>
          <Link
            to="bens/novo"
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo bem
          </Link>
          <Link
            to="configuracoes"
            className="px-3 py-2 rounded-lg bg-white border text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <SettingsIcon className="w-4 h-4" /> Configurações
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Total de bens" value={data?.total_assets ?? 0} color="blue" />
        <Kpi label="Em manutenção" value={data?.in_maintenance ?? 0} color="orange" />
        <Kpi label="Valor patrimonial" value={formatCurrency(data?.total_value ?? 0)} color="emerald" />
        <Kpi label="Alertas (30d)" value={(data?.upcoming_maintenance.length ?? 0) + (data?.upcoming_warranty.length ?? 0) + (data?.overdue_returns.length ?? 0)} color="red" />
      </div>

      {/* Status breakdown */}
      <section className="bg-white border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Distribuição por status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ASSET_STATUSES.map((s) => {
            const c = countsMap.get(s.value) ?? 0
            return (
              <Link
                to={`bens?status=${s.value}`}
                key={s.value}
                className="border rounded-lg p-3 hover:bg-gray-50 transition flex items-center gap-3"
              >
                <span className={`w-3 h-3 rounded-full ${s.dot}`} />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold">{c}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      </section>

      {/* Alertas */}
      <section className="bg-white border rounded-xl p-5">
        <header className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Alertas (próximos 30 dias)
          </h2>
        </header>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AlertColumn
              title="Manutenções programadas"
              icon={<Wrench className="w-4 h-4 text-orange-600" />}
              items={data?.upcoming_maintenance ?? []}
              empty="Nenhuma manutenção próxima."
            />
            <AlertColumn
              title="Garantias vencendo"
              icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />}
              items={data?.upcoming_warranty ?? []}
              empty="Nenhuma garantia vencendo."
            />
            <AlertColumn
              title="Retornos atrasados"
              icon={<Clock className="w-4 h-4 text-red-600" />}
              items={data?.overdue_returns ?? []}
              empty="Nenhum retorno atrasado."
              negative
            />
          </div>
        )}
      </section>

      {/* Hint sobre status / cores */}
      <div className="text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3">
        <strong>Dica:</strong> os status seguem cores padrão — verde (em uso), azul (reserva),
        laranja (em manutenção) e vermelho (baixado). Bens enviados para manutenção mudam de status
        automaticamente e voltam ao status escolhido quando você registra o retorno.
      </div>
    </div>
  )
}

function Kpi({
  label, value, color,
}: { label: string; value: number | string; color: 'blue' | 'orange' | 'emerald' | 'red' }) {
  const map = {
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className="bg-white border rounded-xl p-4">
      <p className={`text-xs font-medium px-2 py-1 inline-block rounded ${map[color]}`}>{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  )
}

function AlertColumn({
  title, icon, items, empty, negative = false,
}: { title: string; icon: React.ReactNode; items: Alert[]; empty: string; negative?: boolean }) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">{icon} {title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{empty}</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {items.slice(0, 8).map((a) => (
            <li key={`${a.kind}-${a.asset_id}-${a.due_date}`} className="py-2 text-sm">
              <Link to={`bens/${a.asset_id}`} className="font-medium hover:underline">
                {a.code} — {a.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {formatBrDate(a.due_date)} •{' '}
                {a.days_until < 0 ? (
                  <strong className={negative ? 'text-red-600' : 'text-amber-600'}>
                    Atrasado há {Math.abs(a.days_until)} dia(s)
                  </strong>
                ) : a.days_until === 0 ? (
                  <strong className="text-amber-700">É hoje</strong>
                ) : (
                  <>em {a.days_until} dia(s)</>
                )}
              </p>
            </li>
          ))}
          {items.length > 8 && (
            <li className="py-2 text-xs text-muted-foreground italic">+{items.length - 8} mais</li>
          )}
        </ul>
      )}
    </div>
  )
}
