import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  Cake, CalendarDays, Phone, MessageCircle, Settings as SettingsIcon,
  Users as UsersIcon, BellRing, AlertCircle,
} from 'lucide-react'
import { ageGroupLabel, ageGroupColor } from '@/lib/ageGroups'
import { WhatsappShareDialog } from '@/components/WhatsappShareDialog'

interface DashboardBirthday {
  id: number
  name: string
  cel?: string | null
  data_nascimento: string
  day: number
  month: number
  age_turning: number
  age_group: string
  days_until: number
}
interface DashboardEvent {
  id: number
  title: string
  date: string
  type?: string | null
  location?: string | null
  days_until: number
}
interface Dashboard {
  today: string
  upcoming_birthdays: DashboardBirthday[]
  upcoming_events: DashboardEvent[]
  counts: {
    total_members: number
    birthdays_this_month: number
    events_this_month: number
  }
}

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]

export function SecretariaHome() {
  const [days, setDays] = useState(7)
  const [shareTarget, setShareTarget] = useState<DashboardBirthday | null>(null)

  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['secretaria-dashboard', days],
    queryFn: () =>
      api.get('/api/secretaria/dashboard', { params: { days } }).then((r) => r.data),
  })

  const today = data ? new Date(data.today + 'T00:00') : new Date()

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Secretaria</h1>
          <p className="text-sm text-muted-foreground">
            Aniversários, eventos e comunicação com a igreja.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="calendario"
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <CalendarDays className="w-4 h-4" /> Calendário
          </Link>
          <Link
            to="eventos"
            className="px-3 py-2 rounded-lg bg-white border text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <CalendarDays className="w-4 h-4" /> Eventos
          </Link>
          <Link
            to="grupos-whatsapp"
            className="px-3 py-2 rounded-lg bg-white border text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <Phone className="w-4 h-4" /> Grupos WhatsApp
          </Link>
          <Link
            to="mensagens"
            className="px-3 py-2 rounded-lg bg-white border text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" /> Mensagens
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
        <Kpi label="Membros ativos" value={data?.counts.total_members ?? 0} icon={<UsersIcon className="w-5 h-5" />} color="blue" />
        <Kpi label="Aniversariantes do mês" value={data?.counts.birthdays_this_month ?? 0} icon={<Cake className="w-5 h-5" />} color="pink" />
        <Kpi label="Eventos do mês" value={data?.counts.events_this_month ?? 0} icon={<CalendarDays className="w-5 h-5" />} color="indigo" />
        <Kpi label={`Alertas (${days}d)`} value={(data?.upcoming_birthdays.length ?? 0) + (data?.upcoming_events.length ?? 0)} icon={<BellRing className="w-5 h-5" />} color="amber" />
      </div>

      {/* Janela de antecedência */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Mostrar próximos:</span>
        {[2, 7, 15, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded-full border text-xs font-medium ${
              days === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'
            }`}
          >
            {d} dias
          </button>
        ))}
      </div>

      {/* Aniversariantes próximos */}
      <section className="bg-white border rounded-xl p-5">
        <header className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Cake className="w-5 h-5 text-pink-600" />
            Aniversariantes nos próximos {days} dias
          </h2>
          <Link to="calendario" className="text-xs text-blue-600 hover:underline">
            Ver calendário completo →
          </Link>
        </header>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !data?.upcoming_birthdays.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhum aniversariante nesse intervalo.
          </p>
        ) : (
          <ul className="divide-y">
            {data.upcoming_birthdays.map((b) => (
              <li key={b.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{b.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ageGroupColor(b.age_group)}`}>
                      {ageGroupLabel(b.age_group)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {b.day.toString().padStart(2, '0')}/{b.month.toString().padStart(2, '0')} —
                    {' '}
                    {b.days_until === 0 ? <strong className="text-pink-600">É hoje! 🎉</strong>
                      : b.days_until === 1 ? <strong className="text-amber-600">Amanhã</strong>
                      : <>em {b.days_until} dias</>}
                    {' '} • completa {b.age_turning} anos
                  </p>
                </div>
                <button
                  onClick={() => setShareTarget(b)}
                  disabled={!b.cel}
                  className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                  title={b.cel ?? 'Sem celular cadastrado'}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Parabenizar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Eventos próximos */}
      <section className="bg-white border rounded-xl p-5">
        <header className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
            Próximos eventos
          </h2>
          <Link to="eventos" className="text-xs text-blue-600 hover:underline">
            Gerenciar eventos →
          </Link>
        </header>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !data?.upcoming_events.length ? (
          <p className="text-sm text-muted-foreground">Nenhum evento nesse intervalo.</p>
        ) : (
          <ul className="divide-y">
            {data.upcoming_events.map((e) => (
              <li key={e.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateBr(e.date, today)} {e.location && `• ${e.location}`}
                    {e.type && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border bg-gray-50">
                        {e.type}
                      </span>
                    )}
                  </p>
                  <p className="text-xs">
                    {e.days_until === 0 ? <strong className="text-indigo-700">É hoje!</strong>
                      : e.days_until === 1 ? <strong className="text-amber-600">Amanhã</strong>
                      : <span className="text-muted-foreground">em {e.days_until} dias</span>}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Aviso sobre WhatsApp */}
      <div className="text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Sobre o envio em grupos:</strong> o WhatsApp não permite envio
          automatizado em grupos. Para mensagens em grupo, o sistema copia o texto
          para você colar no WhatsApp Web. Para mensagens individuais (parabéns
          direto à pessoa), abrimos o chat com a mensagem já preparada.
        </div>
      </div>

      {/* Dialog de envio individual */}
      {shareTarget && (
        <WhatsappShareDialog
          open
          onClose={() => setShareTarget(null)}
          title={`Parabenizar ${shareTarget.name}`}
          templateKind="birthday"
          templateVars={{
            nome: shareTarget.name,
            idade: shareTarget.age_turning,
          }}
          individualPhone={shareTarget.cel}
          individualName={shareTarget.name.split(' ')[0]}
        />
      )}
    </div>
  )
}

function Kpi({
  label, value, icon, color,
}: { label: string; value: number; icon: React.ReactNode; color: 'blue' | 'pink' | 'indigo' | 'amber' }) {
  const colorMap = {
    blue: 'text-blue-700 bg-blue-50',
    pink: 'text-pink-700 bg-pink-50',
    indigo: 'text-indigo-700 bg-indigo-50',
    amber: 'text-amber-700 bg-amber-50',
  }
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function formatDateBr(iso: string, _today: Date) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y} (${MONTHS[Number(m) - 1]})`
}
