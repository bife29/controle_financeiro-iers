import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { ArrowLeft, Check, X, PackageCheck, Edit2, Trash2, ExternalLink } from 'lucide-react'

interface Item {
  id: number; request_id: number
  description: string; quantity: number; unit?: string | null
  estimated_price?: number | null; final_price?: number | null
  notes?: string | null
}

interface Request {
  id: number
  list_id?: number | null
  title: string
  supplier?: string | null
  notes?: string | null
  status: string
  project_id?: number | null
  category_id?: number | null
  requested_by_id?: number | null
  approved_by_id?: number | null
  approved_at?: string | null
  rejection_reason?: string | null
  received_at?: string | null
  transaction_id?: number | null
  created_at?: string | null
  items: Item[]
  items_count: number
  total_estimated: number
  total_final: number
}

const STATUS_BADGE: Record<string, string> = {
  Pendente: 'bg-amber-100 text-amber-800 border-amber-300',
  Aprovado: 'bg-blue-100 text-blue-800 border-blue-300',
  Rejeitado: 'bg-red-100 text-red-800 border-red-300',
  Recebido: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Cancelado: 'bg-gray-100 text-gray-700 border-gray-300',
}

function formatBRL(v: number | null | undefined) {
  if (v == null) return '-'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function RequestDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canApprove = user && ['super_admin', 'pastor'].includes(user.role)
  const canEdit = user && ['super_admin', 'pastor', 'financeiro', 'secretaria'].includes(user.role)
  const canDelete = user && ['super_admin', 'pastor', 'financeiro'].includes(user.role)

  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReceive, setShowReceive] = useState(false)
  const [finals, setFinals] = useState<Record<number, string>>({})
  const [paymentMethod, setPaymentMethod] = useState('')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [txStatus, setTxStatus] = useState<'Confirmado' | 'Previsto'>('Confirmado')
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery<Request>({
    queryKey: ['shopping-request', id],
    queryFn: () => api.get(`/api/shopping/requests/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  const approveMut = useMutation({
    mutationFn: () => api.post(`/api/shopping/requests/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-request', id] }),
    onError: (e) => setError(getErrorMessage(e, 'Erro ao aprovar')),
  })

  const rejectMut = useMutation({
    mutationFn: () => api.post(`/api/shopping/requests/${id}/reject`, { reason: rejectReason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-request', id] })
      setShowReject(false); setRejectReason(''); setError(null)
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao rejeitar')),
  })

  const receiveMut = useMutation({
    mutationFn: () =>
      api.post(`/api/shopping/requests/${id}/receive`, {
        items: Object.entries(finals).map(([k, v]) => ({ id: Number(k), final_price: v === '' ? 0 : Number(v) })),
        payment_method: paymentMethod || null,
        payment_date: paymentDate || null,
        status: txStatus,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-request', id] })
      qc.invalidateQueries({ queryKey: ['shopping-requests'] })
      qc.invalidateQueries({ queryKey: ['shopping-dashboard'] })
      setShowReceive(false); setError(null)
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao receber')),
  })

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/api/shopping/requests/${id}`),
    onSuccess: () => navigate('/compras/pedidos'),
    onError: (e) => setError(getErrorMessage(e, 'Erro ao excluir')),
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>
  if (!data) return <p className="text-sm text-red-600">Pedido não encontrado</p>

  const isPending = data.status === 'Pendente'
  const isApproved = data.status === 'Aprovado'
  const isReceived = data.status === 'Recebido'
  const isRequester = user?.id === data.requested_by_id

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <Link to="/compras/pedidos" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar para pedidos
        </Link>
        <div className="flex items-start justify-between mt-2 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">{data.title}</h1>
            {data.supplier && <p className="text-sm text-muted-foreground">Fornecedor: {data.supplier}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${STATUS_BADGE[data.status] ?? 'bg-gray-100'}`}>
            {data.status}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Itens" value={String(data.items_count)} />
        <Kpi label="Total estimado" value={formatBRL(data.total_estimated)} />
        <Kpi label="Total final" value={data.total_final > 0 ? formatBRL(data.total_final) : '-'} />
        <Kpi label="Status" value={data.status} />
      </div>

      {/* Itens */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <header className="px-4 py-3 border-b font-semibold text-sm">Itens</header>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Descrição</th>
              <th className="text-right px-3 py-2 w-20">Qtd</th>
              <th className="text-left px-3 py-2 w-16">Un</th>
              <th className="text-right px-3 py-2 w-32">Estimado</th>
              <th className="text-right px-3 py-2 w-32">Final</th>
              <th className="text-right px-3 py-2 w-32">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => {
              const finalUsed = it.final_price ?? it.estimated_price ?? 0
              return (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2">{it.description}</td>
                  <td className="px-3 py-2 text-right">{it.quantity}</td>
                  <td className="px-3 py-2">{it.unit ?? '-'}</td>
                  <td className="px-3 py-2 text-right">{formatBRL(it.estimated_price)}</td>
                  <td className="px-3 py-2 text-right">{formatBRL(it.final_price)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatBRL(finalUsed * it.quantity)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Notas e rejeição */}
      {data.notes && (
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-1">Observações</h3>
          <p className="text-sm whitespace-pre-line">{data.notes}</p>
        </div>
      )}
      {data.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-800 mb-1">Motivo da rejeição</h3>
          <p className="text-sm text-red-700">{data.rejection_reason}</p>
        </div>
      )}
      {isReceived && data.transaction_id && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-emerald-800">Transação financeira gerada</h3>
            <p className="text-xs text-emerald-700">ID #{data.transaction_id} no módulo Financeiro</p>
          </div>
          <Link
            to={`/financeiro/transacoes`}
            className="text-sm text-emerald-800 hover:underline inline-flex items-center gap-1"
          >
            Ver lançamentos <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        {isPending && canApprove && !isRequester && (
          <>
            <button
              onClick={() => approveMut.mutate()}
              disabled={approveMut.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> Aprovar
            </button>
            <button
              onClick={() => setShowReject(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Rejeitar
            </button>
          </>
        )}
        {isPending && canApprove && isRequester && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            Você criou este pedido. A aprovação precisa ser feita por outro usuário.
          </p>
        )}
        {isApproved && canEdit && (
          <button
            onClick={() => setShowReceive(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <PackageCheck className="w-4 h-4" /> Registrar recebimento
          </button>
        )}
        {(isPending || isApproved) && canEdit && (
          <Link
            to={`/compras/pedidos/${id}/editar`}
            className="px-4 py-2 border rounded-lg text-sm flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" /> Editar
          </Link>
        )}
        {!isReceived && canDelete && (
          <button
            onClick={() => { if (window.confirm('Excluir este pedido?')) deleteMut.mutate() }}
            className="px-4 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Excluir
          </button>
        )}
      </div>

      {/* Modal rejeitar */}
      {showReject && (
        <Modal title="Rejeitar pedido" onClose={() => setShowReject(false)}>
          <textarea
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da rejeição *"
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex gap-2 mt-3">
            <button
              disabled={!rejectReason.trim() || rejectMut.isPending}
              onClick={() => rejectMut.mutate()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
            >Confirmar rejeição</button>
            <button onClick={() => setShowReject(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Modal receber */}
      {showReceive && (
        <Modal title="Registrar recebimento" onClose={() => setShowReceive(false)}>
          <p className="text-xs text-muted-foreground mb-3">
            Informe o preço final pago por item. Itens sem preço final usarão o estimado. Uma transação Saída
            será criada no Financeiro.
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-2">
            {data.items.map((it) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-center text-sm">
                <span className="col-span-7 truncate">{it.description} <span className="text-muted-foreground">×{it.quantity}</span></span>
                <span className="col-span-2 text-right text-xs text-muted-foreground">{formatBRL(it.estimated_price)}</span>
                <input
                  type="number" step="0.01" min="0"
                  value={finals[it.id] ?? (it.final_price != null ? String(it.final_price) : '')}
                  onChange={(e) => setFinals({ ...finals, [it.id]: e.target.value })}
                  placeholder="Final"
                  className="col-span-3 border rounded px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
            <div>
              <label className="text-xs font-medium">Forma de pagamento</label>
              <input
                value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="Ex.: PIX, Dinheiro"
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Data do pagamento</label>
              <input
                type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Status da transação</label>
              <select
                value={txStatus} onChange={(e) => setTxStatus(e.target.value as 'Confirmado' | 'Previsto')}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white"
              >
                <option value="Confirmado">Confirmado</option>
                <option value="Previsto">Previsto</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              disabled={receiveMut.isPending}
              onClick={() => receiveMut.mutate()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50"
            >Confirmar recebimento</button>
            <button onClick={() => setShowReceive(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  )
}
