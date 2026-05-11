import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowLeft, ArrowUpCircle, ArrowDownCircle, TrendingUp, Users,
  Edit2, UserPlus, Trash2, X,
} from 'lucide-react'

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

interface MemberSummary { id: number; name: string }

interface ParticipantEvent {
  id: number
  member_id: number
  project_id: number
  agreed_value: number
  paid_value: number
  status: string
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

      <ProjectParticipantsSection projectId={p.id} />
    </div>
  )
}

// ============ Participantes do Projeto/Evento ============

function ProjectParticipantsSection({ projectId }: { projectId: number }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<ParticipantEvent | null>(null)

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const { data: participants = [], isLoading } = useQuery<ParticipantEvent[]>({
    queryKey: ['project-participants', projectId],
    queryFn: () =>
      api
        .get('/api/financial/participant-events', { params: { project_id: projectId } })
        .then((r) => r.data),
  })
  const { data: members = [] } = useQuery<MemberSummary[]>({
    queryKey: ['members-summary'],
    queryFn: () => api.get('/api/members/summary').then((r) => r.data),
  })

  const removeMutation = useMutation({
    mutationFn: (peId: number) =>
      api.delete(`/api/financial/participant-events/${peId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-participants', projectId] })
      qc.invalidateQueries({ queryKey: ['project-dashboard'] })
      setConfirmRemove(null)
    },
  })

  const memberName = (id: number) =>
    members.find((m) => m.id === id)?.name || `Membro #${id}`

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Membros vinculados ao Projeto/Evento</h3>
          <p className="text-xs text-muted-foreground">
            Vincule membros e acompanhe o que cada um se comprometeu a contribuir e
            o quanto já pagou.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          data-testid="project-add-participant-btn"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90"
        >
          <UserPlus className="w-4 h-4" /> Vincular Membro
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum membro vinculado ainda. Clique em <strong>Vincular Membro</strong> para começar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="project-participants-table">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Membro</th>
                <th className="px-3 py-2 font-medium text-right">Acordado</th>
                <th className="px-3 py-2 font-medium text-right">Pago</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {participants.map((pe) => (
                <tr key={pe.id} className="border-t">
                  <td className="px-3 py-2">{memberName(pe.member_id)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(pe.agreed_value)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(pe.paid_value)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        pe.status === 'Pago'
                          ? 'bg-green-100 text-green-800'
                          : pe.status === 'Parcial'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {pe.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setConfirmRemove(pe)}
                      className="p-1.5 text-muted-foreground hover:text-red-600 rounded"
                      title="Remover vínculo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddParticipantModal
          projectId={projectId}
          members={members}
          existingMemberIds={new Set(participants.map((p) => p.member_id))}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['project-participants', projectId] })
            qc.invalidateQueries({ queryKey: ['project-dashboard'] })
            setShowAdd(false)
          }}
        />
      )}

      {confirmRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg">Remover vínculo</h3>
            <p className="text-sm text-muted-foreground mt-2">
              Remover <strong>{memberName(confirmRemove.member_id)}</strong> deste projeto?
              As transações financeiras já lançadas <strong>não</strong> serão apagadas.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={() => removeMutation.mutate(confirmRemove.id)}
                disabled={removeMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {removeMutation.isPending ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddParticipantModal({
  projectId,
  members,
  existingMemberIds,
  onClose,
  onSuccess,
}: {
  projectId: number
  members: MemberSummary[]
  existingMemberIds: Set<number>
  onClose: () => void
  onSuccess: () => void
}) {
  const [memberId, setMemberId] = useState('')
  const [agreedValue, setAgreedValue] = useState('')
  const [error, setError] = useState('')

  const available = members.filter((m) => !existingMemberIds.has(m.id))

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/api/financial/participant-events', data),
    onSuccess,
    onError: (err: unknown) =>
      setError(getErrorMessage(err, 'Erro ao vincular membro')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!memberId) {
      setError('Selecione um membro')
      return
    }
    create.mutate({
      member_id: Number(memberId),
      project_id: projectId,
      agreed_value: agreedValue ? Number(agreedValue) : 0,
      status: 'Pendente',
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b flex items-center justify-between">
          <h3 className="font-semibold">Vincular membro ao projeto</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Membro *</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              data-testid="project-add-participant-member"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Selecione...</option>
              {available.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {available.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Todos os membros cadastrados já estão vinculados.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Valor acordado (R$) <span className="text-muted-foreground font-normal">— opcional</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={agreedValue}
              onChange={(e) => setAgreedValue(e.target.value)}
              data-testid="project-add-participant-value"
              placeholder="0,00"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Quanto o membro se comprometeu a contribuir. Pode deixar zero.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending || !memberId}
              data-testid="project-add-participant-submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {create.isPending ? 'Vinculando...' : 'Vincular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
