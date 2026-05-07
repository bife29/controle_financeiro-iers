import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  addMonths, subMonths, format, isSameMonth, isSameDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Cake, CalendarDays, Plus, ArrowLeft } from 'lucide-react'
import { ageGroupColor, ageGroupLabel } from '@/lib/ageGroups'

interface BirthdayItem {
  id: number
  name: string
  cel?: string | null
  data_nascimento: string
  day: number
  month: number
  age_turning: number
  age_group: string
}
interface EventItem {
  id: number
  title: string
  date: string
  type?: string | null
  location?: string | null
  description?: string | null
}

const WEEK_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

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

  const month = cursor.getMonth() + 1
  const year = cursor.getFullYear()

  const { data: birthdays = [] } = useQuery<BirthdayItem[]>({
    queryKey: ['birthdays-month', month, year],
    queryFn: () =>
      api.get('/api/members/birthdays', { params: { month, year } }).then((r) => r.data),
  })

  const { data: events = [] } = useQuery<EventItem[]>({
    queryKey: ['events-range', format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd')],
    queryFn: () =>
      api.get('/api/secretaria/events', {
        params: {
          start: format(gridStart, 'yyyy-MM-dd'),
          end: format(gridEnd, 'yyyy-MM-dd'),
        },
      }).then((r) => r.data),
  })

  // Index by yyyy-mm-dd
  const birthdaysByDay = useMemo(() => {
    const map = new Map<string, BirthdayItem[]>()
    birthdays.forEach((b) => {
      const key = `${year}-${String(b.month).padStart(2, '0')}-${String(b.day).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(b)
    })
    return map
  }, [birthdays, year])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    events.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    })
    return map
  }, [events])

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null
  const selectedBirthdays = selectedKey ? birthdaysByDay.get(selectedKey) ?? [] : []
  const selectedEvents = selectedKey ? eventsByDay.get(selectedKey) ?? [] : []

  return (
    <div className="space-y-4">
      <Link to="/secretaria" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Voltar para Secretaria
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold capitalize">
            {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
          </h1>
          <p className="text-sm text-muted-foreground">
            Aniversariantes e eventos da igreja
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-1 text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Mês anterior
          </button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            Hoje
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-1 text-sm"
          >
            Próximo <ChevronRight className="w-4 h-4" />
          </button>
          <Link
            to="../eventos/novo"
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Novo evento
          </Link>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-pink-500"></span> Aniversário
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-indigo-500"></span> Evento
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
            const dayBirthdays = birthdaysByDay.get(key) ?? []
            const dayEvents = eventsByDay.get(key) ?? []
            const isSelected = selectedDay && isSameDay(selectedDay, day)
            return (
              <button
                key={key}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[88px] border-b border-r p-1.5 text-left flex flex-col gap-1 transition ${
                  inMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'
                } ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50/50'}`}
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
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayBirthdays.slice(0, 2).map((b) => (
                    <div
                      key={`b-${b.id}`}
                      className="text-[10px] bg-pink-100 text-pink-800 px-1.5 py-0.5 rounded truncate flex items-center gap-1"
                    >
                      <Cake className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{b.name}</span>
                    </div>
                  ))}
                  {dayEvents.slice(0, 2).map((e) => (
                    <div
                      key={`e-${e.id}`}
                      className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded truncate flex items-center gap-1"
                    >
                      <CalendarDays className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{e.title}</span>
                    </div>
                  ))}
                  {(dayBirthdays.length + dayEvents.length) > 4 && (
                    <span className="text-[10px] text-gray-500 px-1.5">
                      +{dayBirthdays.length + dayEvents.length - 4} mais
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detalhe do dia */}
      {selectedDay && (
        <div className="bg-white border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold capitalize">
            {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>

          {selectedBirthdays.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-pink-700 flex items-center gap-1.5 mb-1">
                <Cake className="w-4 h-4" /> Aniversariantes
              </h4>
              <ul className="space-y-1">
                {selectedBirthdays.map((b) => (
                  <li key={b.id} className="text-sm flex items-center gap-2">
                    <Link to={`/membros/${b.id}`} className="hover:underline">
                      {b.name}
                    </Link>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ageGroupColor(b.age_group)}`}>
                      {ageGroupLabel(b.age_group)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • completa {b.age_turning} anos
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedEvents.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-indigo-700 flex items-center gap-1.5 mb-1">
                <CalendarDays className="w-4 h-4" /> Eventos
              </h4>
              <ul className="space-y-1">
                {selectedEvents.map((e) => (
                  <li key={e.id} className="text-sm">
                    <Link to={`../eventos/${e.id}`} className="font-medium hover:underline">
                      {e.title}
                    </Link>
                    {e.location && <span className="text-xs text-muted-foreground"> • {e.location}</span>}
                    {e.type && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border bg-gray-50">
                        {e.type}
                      </span>
                    )}
                    {e.description && (
                      <p className="text-xs text-muted-foreground">{e.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedBirthdays.length === 0 && selectedEvents.length === 0 && (
            <p className="text-sm text-muted-foreground">Nada agendado para esse dia.</p>
          )}
        </div>
      )}
    </div>
  )
}
