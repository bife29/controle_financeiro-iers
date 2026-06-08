import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  addMonths, subMonths, format, isSameMonth, isSameDay, parseISO,
  differenceInCalendarDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, ArrowLeft, ArrowUpCircle, ArrowDownCircle,
  CalendarClock, AlertTriangle,
} from 'lucide-react'

interface Transaction {
  id: number
  description: string
  value: number
  type: 'Entrada' | 'Saída'
  status: 'Previsto' | 'Confirmado'
  date: string // ISO yyyy-mm-dd
  payment_date?: string | null
  category_id?: number | null
  project_id?: number | null
}

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Calendário Financeiro — mostra todas as transações Previstas (a pagar / a receber)
 *  no mês corrente, destacando dias com vencimento próximo. */
export function FinancialCalendar() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [statusFilter, setStatusFilter] = useState<'Previsto' | 'Confirmado' | 'all'>('Previsto')

  const monthStart = startOfMonth(cursor)
  const monthEnd = endOfMonth(cursor)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days = useMemo(() => {
    const out: Date[] = []
    let d = gridStart
    while (d <= gridEnd) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [gridStart, gridEnd])

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['financial-calendar', format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd'), statusFilter],
    queryFn: () =>
      api.get('/api/financial/transactions', {
        params: {
          start_date: format(gridStart, 'yyyy-MM-dd'),
          end_date: format(gridEnd, 'yyyy-MM-dd'),
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: 500,
        },
      }).then((r) => r.data),
  })

  // Index by day key
  const txByDay = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    transactions.forEach((t) => {
      const key = t.date.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    return map
  }, [transactions])

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null
  const selectedTx = selectedKey ? txByDay.get(selectedKey) ?? [] : []

  // Totais do mês (somente dias dentro do mês)
  const monthTotals = useMemo(() => {
    let entradas = 0
    let saidas = 0
    let entradasCount = 0
    let saidasCount = 0
    transactions.forEach((t) => {
      const d = parseISO(t.date)
      if (!isSameMonth(d, cursor)) return
      if (t.type === 'Entrada') {
        entradas += t.value
        entradasCount += 1
      } else {
        saidas += t.value
        saidasCount += 1
      }
    })
    return { entradas, saidas, entradasCount, saidasCount, saldo: entradas - saidas }
  }, [transactions, cursor])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-4">
      <Link to="/financeiro" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Voltar para Financeiro
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold capitalize flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-blue-600" />
            {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
          </h1>
          <p className="text-sm text-muted-foreground">
            Calendário financeiro — contas a pagar e a receber por dia
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'Previsto' | 'Confirmado' | 'all')}
            className="px-3 py-2 border rounded-lg text-sm"
            data-testid="financial-calendar-status-filter"
          >
            <option value="Previsto">Apenas Previstos</option>
            <option value="Confirmado">Apenas Confirmados</option>
            <option value="all">Todos</option>
          </select>
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-1 text-sm"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" /> Mês anterior
          </button>
          <button
            onClick={() => { setCursor(startOfMonth(new Date())); setSelectedDay(new Date()) }}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            Hoje
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-1 text-sm"
            aria-label="Próximo mês"
          >
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPIs do mês */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
            <ArrowUpCircle className="w-4 h-4" /> Entradas no mês
          </div>
          <p className="text-lg font-bold text-emerald-800">{fmtBRL(monthTotals.entradas)}</p>
          <p className="text-[11px] text-emerald-700/70">{monthTotals.entradasCount} lançamento(s)</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-red-700 text-xs font-medium">
            <ArrowDownCircle className="w-4 h-4" /> Saídas no mês
          </div>
          <p className="text-lg font-bold text-red-800">{fmtBRL(monthTotals.saidas)}</p>
          <p className="text-[11px] text-red-700/70">{monthTotals.saidasCount} lançamento(s)</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <div className="text-xs font-medium text-blue-700">Saldo do mês</div>
          <p className={`text-lg font-bold ${monthTotals.saldo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {fmtBRL(monthTotals.saldo)}
          </p>
          <p className="text-[11px] text-blue-700/70">Entradas − Saídas</p>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500"></span> Entrada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500"></span> Saída
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-400 border border-amber-600"></span> Vence em 1–3 dias
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-600 border border-red-800"></span> Vence/Venceu hoje
        </span>
      </div>

      {/* Grid */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b text-xs font-medium text-center">
          {WEEK_LABELS.map((w) => (
            <div key={w} className="py-2 text-gray-600">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const inMonth = isSameMonth(day, cursor)
            const isToday = isSameDay(day, new Date())
            const dayTx = txByDay.get(key) ?? []
            const isSelected = selectedDay && isSameDay(selectedDay, day)
            const entradas = dayTx.filter((t) => t.type === 'Entrada')
            const saidas = dayTx.filter((t) => t.type === 'Saída')
            const totalEntradas = entradas.reduce((s, t) => s + t.value, 0)
            const totalSaidas = saidas.reduce((s, t) => s + t.value, 0)
            // Marcador de urgência: tem saída prevista vencendo
            const hasPrevistoSaida = saidas.some((t) => t.status === 'Previsto')
            const diffDays = differenceInCalendarDays(day, today)
            let urgencyRing = ''
            if (hasPrevistoSaida) {
              if (diffDays < 0) urgencyRing = 'ring-2 ring-red-600 ring-inset'
              else if (diffDays === 0) urgencyRing = 'ring-2 ring-red-500 ring-inset'
              else if (diffDays <= 3) urgencyRing = 'ring-2 ring-amber-400 ring-inset'
            }
            return (
              <button
                key={key}
                onClick={() => setSelectedDay(day)}
                data-testid={`finc-day-${key}`}
                className={`min-h-[92px] border-b border-r p-1.5 text-left flex flex-col gap-1 transition ${
                  inMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'
                } ${isSelected ? 'bg-blue-50' : 'hover:bg-blue-50/40'} ${urgencyRing}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center'
                        : ''
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {hasPrevistoSaida && diffDays >= 0 && diffDays <= 3 && (
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {entradas.length > 0 && (
                    <div className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded truncate">
                      ↑ {fmtBRL(totalEntradas)} ({entradas.length})
                    </div>
                  )}
                  {saidas.length > 0 && (
                    <div className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded truncate">
                      ↓ {fmtBRL(totalSaidas)} ({saidas.length})
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detalhe do dia */}
      {selectedDay && (
        <div className="bg-white border rounded-xl p-5 space-y-3" data-testid="finc-day-detail">
          <h3 className="font-semibold capitalize">
            {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : selectedTx.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma transação para esse dia.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-1">Descrição</th>
                  <th className="text-left py-1 w-24">Tipo</th>
                  <th className="text-left py-1 w-28">Status</th>
                  <th className="text-right py-1 w-32">Valor</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {selectedTx.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-1.5">{t.description}</td>
                    <td className="py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.type === 'Entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === 'Previsto' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-1.5 text-right font-medium">{fmtBRL(t.value)}</td>
                    <td className="py-1.5 text-right">
                      <Link
                        to={`/financeiro/transacoes/${t.id}/editar`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
