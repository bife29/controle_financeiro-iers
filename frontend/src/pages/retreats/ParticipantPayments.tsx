import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState } from 'react'
import {
  ArrowLeft, CheckCircle2, CreditCard, DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Payment {
  id: number
  participant_id: number
  retreat_id: number
  installment_number: number
  value: number
  due_date: string | null
  paid_date: string | null
  status: string
  payment_method: string | null
  transaction_id: number | null
}

interface Participant {
  id: number
  name: string | null
  member_id: number | null
  is_member: boolean
  participant_type: string
  individual_cost: number
  paid_value: number
  payment_status: string
  installments_count: number
}

export function ParticipantPayments() {
  const { id: retreatId, participantId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [payingId, setPayingId] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('Pix')

  const { data: participant } = useQuery<Participant>({
    queryKey: ['participant-info', participantId],
    queryFn: async () => {
      const res = await api.get(`/api/retreats/${retreatId}/participants`)
      const list = res.data as Participant[]
      return list.find((p) => p.id === parseInt(participantId!))!
    },
  })

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['participant-payments', participantId],
    queryFn: () => api.get(`/api/retreats/participants/${participantId}/payments`).then((r) => r.data),
  })

  const payMutation = useMutation({
    mutationFn: ({ paymentId, method }: { paymentId: number; method: string }) =>
      api.post(`/api/retreats/payments/${paymentId}/pay`, {
        paid_date: new Date().toISOString().split('T')[0],
        status: 'Pago',
        payment_method: method,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participant-payments', participantId] })
      queryClient.invalidateQueries({ queryKey: ['retreat-dashboard', retreatId] })
      queryClient.invalidateQueries({ queryKey: ['retreat-participants', retreatId] })
      queryClient.invalidateQueries({ queryKey: ['participant-info', participantId] })
      setPayingId(null)
    },
  })

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  const paidCount = payments.filter((p) => p.status === 'Pago').length
  const totalPaid = payments.filter((p) => p.status === 'Pago').reduce((acc, p) => acc + p.value, 0)
  const totalValue = payments.reduce((acc, p) => acc + p.value, 0)
  const progressPercent = totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/retiros/${retreatId}/participantes`)}
          className="p-2 hover:bg-muted rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Carnê de Pagamento</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {participant?.name || `Participante #${participantId}`}
            {participant && ` • ${participant.participant_type === 'adulto' ? 'Adulto' : 'Criança'}`}
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Progresso de pagamento</p>
              <p className="text-lg font-bold">
                {formatCurrency(totalPaid)}
                <span className="text-muted-foreground font-normal text-sm"> / {formatCurrency(totalValue)}</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">{progressPercent}%</p>
            <p className="text-xs text-muted-foreground">{paidCount}/{payments.length} parcelas</p>
          </div>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              progressPercent === 100 ? "bg-green-500" : "bg-primary"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Parcelas */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Parcelas</h3>

        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
            Nenhuma parcela gerada para este participante.
          </div>
        ) : (
          payments.map((payment) => (
            <div
              key={payment.id}
              className={cn(
                "bg-card border rounded-xl p-4 flex items-center justify-between gap-4 transition",
                payment.status === 'Pago' && "border-green-200 bg-green-50/30"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  payment.status === 'Pago' ? "bg-green-100" : "bg-muted"
                )}>
                  {payment.status === 'Pago' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">{payment.installment_number}</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    Parcela {payment.installment_number} de {payments.length}
                  </p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    {payment.due_date && <span>Vencimento: {formatDate(payment.due_date)}</span>}
                    {payment.paid_date && <span className="text-green-600">Pago em: {formatDate(payment.paid_date)}</span>}
                    {payment.payment_method && <span>• {payment.payment_method}</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={cn("font-bold text-sm", payment.status === 'Pago' ? "text-green-700" : "")}>
                  {formatCurrency(payment.value)}
                </span>

                {payment.status === 'Pendente' && payingId !== payment.id && (
                  <button
                    onClick={() => setPayingId(payment.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg font-medium hover:opacity-90 transition"
                  >
                    <CreditCard className="w-3 h-3" />
                    Pagar
                  </button>
                )}

                {payment.status === 'Pago' && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pago
                  </span>
                )}
              </div>

              {/* Inline pay form */}
              {payingId === payment.id && (
                <div className="absolute inset-0" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal inline de pagamento */}
      {payingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg">Confirmar Pagamento</h3>
            <p className="text-sm text-muted-foreground">
              Parcela {payments.find((p) => p.id === payingId)?.installment_number} —{' '}
              {formatCurrency(payments.find((p) => p.id === payingId)?.value || 0)}
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="Pix">Pix</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão Débito">Cartão Débito</option>
                <option value="Cartão Crédito">Cartão Crédito</option>
                <option value="Transferência">Transferência</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPayingId(null)}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={() => payMutation.mutate({ paymentId: payingId, method: paymentMethod })}
                disabled={payMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {payMutation.isPending ? 'Processando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
