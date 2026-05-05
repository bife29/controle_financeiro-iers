import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  ArrowLeft, UserPlus, Search, CreditCard,
  CheckCircle2, Clock, AlertCircle, UserX, Bus, BedDouble
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Participant {
  id: number
  retreat_id: number
  member_id: number | null
  name: string | null
  phone: string | null
  is_member: boolean
  participant_type: string
  individual_cost: number
  payment_status: string
  paid_value: number
  installments_count: number
  bus_option: string
  bed_option: string
  inscription_status: string
  notes: string | null
}

interface MemberSummary {
  id: number
  name: string
  cel: string | null
  email: string | null
}

const paymentStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  Pago: { label: 'Pago', color: 'text-green-700 bg-green-50', icon: CheckCircle2 },
  Parcial: { label: 'Parcial', color: 'text-blue-700 bg-blue-50', icon: Clock },
  Pendente: { label: 'Pendente', color: 'text-amber-700 bg-amber-50', icon: AlertCircle },
  Isento: { label: 'Isento', color: 'text-slate-500 bg-slate-50', icon: UserX },
}

const inscriptionBadge: Record<string, { label: string; color: string }> = {
  Confirmado: { label: 'Confirmado', color: 'bg-emerald-50 text-emerald-700' },
  Espera: { label: 'Em Espera', color: 'bg-orange-50 text-orange-700' },
}

const busLabels: Record<string, string> = { Sim: 'Sim', Nao: 'Não', Colo: 'Colo' }
const bedLabels: Record<string, string> = { Sim: 'Sim', Nao: 'Não', Divide: 'Divide' }

export function RetreatParticipants() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [inscriptionFilter, setInscriptionFilter] = useState('')

  const { data: retreat } = useQuery({
    queryKey: ['retreat', id],
    queryFn: () => api.get(`/api/retreats/${id}`).then((r) => r.data),
  })

  const { data: participants = [], isLoading } = useQuery<Participant[]>({
    queryKey: ['retreat-participants', id, statusFilter, inscriptionFilter],
    queryFn: () => api.get(`/api/retreats/${id}/participants`, {
      params: {
        payment_status: statusFilter || undefined,
        inscription_status: inscriptionFilter || undefined,
      }
    }).then((r) => r.data),
  })

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const filteredParticipants = participants.filter((p) => {
    if (!searchFilter) return true
    const name = p.name || `Membro #${p.member_id}`
    return name.toLowerCase().includes(searchFilter.toLowerCase())
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/retiros/${id}`)}
            className="p-2 hover:bg-muted rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Participantes</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {retreat?.name} — {participants.length} inscrito{participants.length !== 1 && 's'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:opacity-90 transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Inscrever Participante
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar participante..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
        >
          <option value="">Pagamento: Todos</option>
          <option value="Pago">Pagos</option>
          <option value="Parcial">Parciais</option>
          <option value="Pendente">Pendentes</option>
          <option value="Isento">Isentos</option>
        </select>
        <select
          value={inscriptionFilter}
          onChange={(e) => setInscriptionFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
        >
          <option value="">Inscrição: Todos</option>
          <option value="Confirmado">Confirmados</option>
          <option value="Espera">Em Espera</option>
        </select>
      </div>

      {/* Tabela de participantes */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Participante</th>
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
                <th className="text-center px-4 py-3 font-medium">Inscrição</th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">
                  <span className="inline-flex items-center gap-1"><Bus className="w-3.5 h-3.5" /> Ônibus</span>
                </th>
                <th className="text-center px-4 py-3 font-medium hidden md:table-cell">
                  <span className="inline-flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> Cama</span>
                </th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Valor</th>
                <th className="text-center px-4 py-3 font-medium">Pagamento</th>
                <th className="text-center px-4 py-3 font-medium w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filteredParticipants.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum participante encontrado</td></tr>
              ) : (
                filteredParticipants.map((p) => {
                  const statusCfg = paymentStatusConfig[p.payment_status] || paymentStatusConfig.Pendente
                  const Icon = statusCfg.icon
                  const inscCfg = inscriptionBadge[p.inscription_status] || inscriptionBadge.Confirmado
                  return (
                    <tr key={p.id} className={cn("hover:bg-muted/30 transition", p.inscription_status === 'Espera' && 'opacity-70')}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{p.name || `Membro #${p.member_id}`}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {p.phone && <span className="text-xs text-muted-foreground">{p.phone}</span>}
                            <span className={cn("text-xs px-1.5 py-0.5 rounded", p.is_member ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700")}>
                              {p.is_member ? "Membro" : "Visitante"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          p.participant_type === "adulto" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"
                        )}>
                          {p.participant_type === "adulto" ? "Adulto" : "Criança"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("text-xs px-2 py-1 rounded-full font-medium", inscCfg.color)}>
                          {inscCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell text-xs">
                        {busLabels[p.bus_option] || p.bus_option}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell text-xs">
                        {bedLabels[p.bed_option] || p.bed_option}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs hidden sm:table-cell">
                        {formatCurrency(p.individual_cost)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium", statusCfg.color)}>
                          <Icon className="w-3 h-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/retiros/${id}/participantes/${p.id}/pagamentos`}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition font-medium"
                        >
                          <CreditCard className="w-3 h-3" />
                          Carnê
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Inscrição */}
      {showAddModal && (
        <AddParticipantModal
          retreatId={parseInt(id!)}
          costAdult={retreat?.cost_adult || 0}
          costChild={retreat?.cost_child || 0}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            queryClient.invalidateQueries({ queryKey: ['retreat-participants', id] })
            queryClient.invalidateQueries({ queryKey: ['retreat-dashboard', id] })
          }}
        />
      )}
    </div>
  )
}

// ============ MODAL DE INSCRIÇÃO ============

function AddParticipantModal({
  retreatId, costAdult, costChild, onClose, onSuccess
}: {
  retreatId: number
  costAdult: number
  costChild: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [isMember, setIsMember] = useState(true)
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [participantType, setParticipantType] = useState('adulto')
  const [customCost, setCustomCost] = useState<string>('')
  const [installments, setInstallments] = useState(1)
  const [isExempt, setIsExempt] = useState(false)
  const [busOption, setBusOption] = useState('Sim')
  const [bedOption, setBedOption] = useState('Sim')
  const [error, setError] = useState('')

  const { data: membersResults = [] } = useQuery<MemberSummary[]>({
    queryKey: ['members-search', memberSearch],
    queryFn: () => api.get('/api/members/summary', { params: { search: memberSearch } }).then((r) => r.data),
    enabled: isMember && memberSearch.length >= 2,
  })

  const mutation = useMutation({
    mutationFn: (data: any) => api.post(`/api/retreats/${retreatId}/participants`, data),
    onSuccess,
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Erro ao inscrever participante')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isMember && !selectedMember) {
      setError('Selecione um membro da igreja')
      return
    }
    if (!isMember && !name.trim()) {
      setError('Nome é obrigatório para não-membros')
      return
    }
    setError('')

    const cost = customCost ? parseFloat(customCost) : (participantType === 'adulto' ? costAdult : costChild)

    mutation.mutate({
      retreat_id: retreatId,
      member_id: isMember ? selectedMember?.id : null,
      name: isMember ? selectedMember?.name : name,
      phone: isMember ? selectedMember?.cel : phone,
      is_member: isMember,
      participant_type: participantType,
      individual_cost: isExempt ? 0 : cost,
      payment_status: isExempt ? 'Isento' : 'Pendente',
      installments_count: isExempt ? 0 : installments,
      bus_option: busOption,
      bed_option: bedOption,
    })
  }

  const displayCost = customCost
    ? parseFloat(customCost) || 0
    : (participantType === 'adulto' ? costAdult : costChild)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-bold">Inscrever Participante</h2>
          <p className="text-sm text-muted-foreground mt-1">Adicione um participante ao retiro</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Tipo: Membro ou Visitante */}
          <div>
            <label className="block text-sm font-medium mb-2">Vínculo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setIsMember(true); setSelectedMember(null) }}
                className={cn(
                  "p-3 border rounded-xl text-sm font-medium transition",
                  isMember ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"
                )}
              >
                Membro da Igreja
              </button>
              <button
                type="button"
                onClick={() => { setIsMember(false); setSelectedMember(null) }}
                className={cn(
                  "p-3 border rounded-xl text-sm font-medium transition",
                  !isMember ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted"
                )}
              >
                Visitante / Convidado
              </button>
            </div>
          </div>

          {/* Buscar Membro ou digitar dados */}
          {isMember ? (
            <div>
              <label className="block text-sm font-medium mb-1">Buscar Membro</label>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setSelectedMember(null) }}
                placeholder="Digite o nome do membro..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
              {memberSearch.length >= 2 && !selectedMember && membersResults.length > 0 && (
                <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                  {membersResults.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setSelectedMember(m); setMemberSearch(m.name) }}
                      className="w-full text-left px-3 py-2 hover:bg-muted transition text-sm border-b last:border-0"
                    >
                      <span className="font-medium">{m.name}</span>
                      {m.cel && <span className="text-muted-foreground ml-2">{m.cel}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedMember && (
                <div className="mt-2 p-2 bg-green-50 rounded-lg text-sm text-green-700">
                  {selectedMember.name} selecionado
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nome *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefone / Celular</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
          )}

          {/* Tipo participante e valores */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select
                value={participantType}
                onChange={(e) => setParticipantType(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="adulto">Adulto</option>
                <option value="crianca">Criança</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Parcelas</label>
              <select
                value={installments}
                onChange={(e) => setInstallments(parseInt(e.target.value))}
                disabled={isExempt}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
            </div>
          </div>

          {/* Logística */}
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Bus className="w-4 h-4 text-primary" />
              Logística
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Ônibus</label>
                <select
                  value={busOption}
                  onChange={(e) => setBusOption(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                >
                  <option value="Sim">Sim — Assento próprio</option>
                  <option value="Colo">Colo — No colo (criança)</option>
                  <option value="Nao">Não — Vai por conta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Cama</label>
                <select
                  value={bedOption}
                  onChange={(e) => setBedOption(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                >
                  <option value="Sim">Sim — Cama própria</option>
                  <option value="Divide">Divide — Divide cama</option>
                  <option value="Nao">Não — Não precisa</option>
                </select>
              </div>
            </div>
          </div>

          {/* Valor customizado */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Valor Individual (R$)
              <span className="text-muted-foreground font-normal ml-1">
                — padrão: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  participantType === 'adulto' ? costAdult : costChild
                )}
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              value={customCost}
              onChange={(e) => setCustomCost(e.target.value)}
              placeholder="Deixe vazio para usar o valor padrão"
              disabled={isExempt}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
            />
          </div>

          {/* Isenção */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isExempt}
              onChange={(e) => setIsExempt(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Isentar pagamento</span>
          </label>

          {/* Resumo */}
          {!isExempt && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">Resumo do carnê:</p>
              <p className="text-muted-foreground">
                {installments}x de{' '}
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayCost / installments)}
                {' '}= {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(displayCost)}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {mutation.isPending ? 'Inscrevendo...' : 'Inscrever'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
