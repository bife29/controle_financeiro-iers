/**
 * View de impressão de participantes de retiro.
 *
 * Spec: docs/specs/SPEC-003-retiros-listagem-imprimir-e-revalidar.md
 *
 * Rotas:
 *   /retiros/:id/participantes/impressao?modo=completa
 *   /retiros/:id/participantes/impressao?modo=onibus
 *   (opcional) &q=busca
 *
 * Modos:
 *   completa: cabeçalho + todas as colunas + totais no rodapé + observações
 *   onibus:   cabeçalho enxuto + nome + tipo + telefone + status (chamada rápida)
 *
 * Layout print-friendly. Deixa o usuário escolher orientação no diálogo
 * nativo do navegador (não força @page size).
 */
import { useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Printer } from 'lucide-react'

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
  responsible_participant_id: number | null
  responsible_name: string | null
  bus_option: string
  bed_option: string
  inscription_status: string
  notes: string | null
}

interface Retreat {
  id: number
  name: string
  location: string | null
  start_date: string | null
  end_date: string | null
}

type PrintMode = 'completa' | 'onibus'

const busLabels: Record<string, string> = { Sim: 'Sim', Nao: 'Não', Colo: 'Colo' }
const bedLabels: Record<string, string> = { Sim: 'Sim', Nao: 'Não', Divide: 'Divide' }

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function RetreatParticipantsPrint() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const modeParam = searchParams.get('modo')
  const mode: PrintMode = modeParam === 'onibus' ? 'onibus' : 'completa'
  const q = (searchParams.get('q') || '').trim().toLowerCase()

  const { data: retreat, isLoading: retreatLoading } = useQuery<Retreat>({
    queryKey: ['retreat', id],
    queryFn: () => api.get(`/api/retreats/${id}`).then((r) => r.data),
  })

  const { data: participants = [], isLoading: partsLoading } = useQuery<Participant[]>({
    queryKey: ['retreat-participants-print', id],
    queryFn: () => api.get(`/api/retreats/${id}/participants`).then((r) => r.data),
  })

  const filtered = useMemo(() => {
    if (!q) return participants
    return participants.filter((p) => {
      const name = (p.name || `Membro #${p.member_id}`).toLowerCase()
      return name.includes(q)
    })
  }, [participants, q])

  const totals = useMemo(() => {
    let expected = 0
    let paid = 0
    for (const p of filtered) {
      // Isentos não entram no esperado.
      if (p.payment_status !== 'Isento') {
        expected += p.individual_cost || 0
      }
      paid += p.paid_value || 0
    }
    return {
      expected,
      paid,
      pending: Math.max(0, expected - paid),
    }
  }, [filtered])

  // Dispara o diálogo de impressão automaticamente quando terminar de
  // carregar. Se o usuário fechar sem imprimir, mantém a tela visível
  // (mostra botão manual "Imprimir novamente").
  useEffect(() => {
    if (retreatLoading || partsLoading) return
    // Pequeno delay para garantir que o DOM está pintado.
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [retreatLoading, partsLoading])

  if (retreatLoading || partsLoading) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Carregando listagem para impressão...
      </div>
    )
  }

  const dateRange =
    retreat?.start_date && retreat?.end_date
      ? `${formatDate(retreat.start_date)} a ${formatDate(retreat.end_date)}`
      : retreat?.start_date
      ? formatDate(retreat.start_date)
      : ''

  return (
    <div
      className="print-view mx-auto max-w-[1100px] p-6 bg-white text-black text-[13px] leading-normal"
      data-testid="print-view"
      data-mode={mode}
    >
      {/* Estilos específicos para impressão */}
      <style>{`
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-view { padding: 0 !important; margin: 0 auto !important; max-width: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>

      {/* Botões de controle (não imprimem) */}
      <div className="no-print flex items-center justify-between mb-4 pb-3 border-b">
        <p className="text-sm text-gray-600">
          Prévia de impressão — feche esta aba para voltar ao sistema.
        </p>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          data-testid="print-again-button"
        >
          <Printer className="w-4 h-4" />
          Imprimir novamente
        </button>
      </div>

      {/* Cabeçalho */}
      <header className="flex items-start gap-4 mb-4 pb-3 border-b-2 border-gray-800">
        <img
          src="/logo.png"
          alt="IERS"
          className="w-14 h-14 rounded object-contain"
        />
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            IERS — Sistema Integrado
          </p>
          <h1 className="text-xl font-bold leading-tight" data-testid="print-title">
            {mode === 'onibus' ? 'Lista de Ônibus' : 'Listagem de Participantes'}
          </h1>
          <p className="text-sm text-gray-700 mt-1">
            <strong>{retreat?.name || '—'}</strong>
            {retreat?.location ? ` · ${retreat.location}` : ''}
            {dateRange ? ` · ${dateRange}` : ''}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            Total impresso: <strong data-testid="print-count">{filtered.length}</strong>
            {q ? ` (filtrado por "${q}")` : ''}
          </p>
        </div>
        <div className="text-right text-[10px] text-gray-500">
          Emitido em<br />
          {new Date().toLocaleString('pt-BR')}
        </div>
      </header>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <p className="text-center py-8 text-sm text-gray-500 italic">
          Nenhum participante encontrado{q ? ` para "${q}"` : ''}.
        </p>
      ) : mode === 'onibus' ? (
        <table className="w-full border-collapse text-[12px]" data-testid="print-table-onibus">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-800">
              <th className="text-left px-2 py-1 border border-gray-300 w-10">#</th>
              <th className="text-left px-2 py-1 border border-gray-300">Nome</th>
              <th className="text-center px-2 py-1 border border-gray-300 w-24">Tipo</th>
              <th className="text-left px-2 py-1 border border-gray-300 w-36">Telefone</th>
              <th className="text-center px-2 py-1 border border-gray-300 w-24">Pagamento</th>
              <th className="text-center px-2 py-1 border border-gray-300 w-20">Presente</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className="border-b border-gray-300" data-testid={`print-row-${p.id}`}>
                <td className="px-2 py-1 border border-gray-300 text-center">{i + 1}</td>
                <td className="px-2 py-1 border border-gray-300">
                  {p.name || `Membro #${p.member_id}`}
                </td>
                <td className="px-2 py-1 border border-gray-300 text-center">
                  {p.participant_type === 'adulto' ? 'Adulto' : 'Criança'}
                </td>
                <td className="px-2 py-1 border border-gray-300">{p.phone || '—'}</td>
                <td className="px-2 py-1 border border-gray-300 text-center">
                  {p.payment_status}
                </td>
                <td className="px-2 py-1 border border-gray-300 text-center">☐</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full border-collapse text-[11px]" data-testid="print-table-completa">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-800">
              <th className="text-left px-1.5 py-1 border border-gray-300 w-8">#</th>
              <th className="text-left px-1.5 py-1 border border-gray-300">Nome</th>
              <th className="text-center px-1.5 py-1 border border-gray-300 w-16">Tipo</th>
              <th className="text-left px-1.5 py-1 border border-gray-300 w-28">Telefone</th>
              <th className="text-center px-1.5 py-1 border border-gray-300 w-16">Origem</th>
              <th className="text-left px-1.5 py-1 border border-gray-300 w-24">Paga por</th>
              <th className="text-center px-1.5 py-1 border border-gray-300 w-14">Ônibus</th>
              <th className="text-center px-1.5 py-1 border border-gray-300 w-14">Cama</th>
              <th className="text-right px-1.5 py-1 border border-gray-300 w-20">Valor</th>
              <th className="text-right px-1.5 py-1 border border-gray-300 w-20">Pago</th>
              <th className="text-center px-1.5 py-1 border border-gray-300 w-20">Status</th>
              <th className="text-left px-1.5 py-1 border border-gray-300">Observações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className="border-b border-gray-300" data-testid={`print-row-${p.id}`}>
                <td className="px-1.5 py-1 border border-gray-300 text-center">{i + 1}</td>
                <td className="px-1.5 py-1 border border-gray-300 font-medium">
                  {p.name || `Membro #${p.member_id}`}
                </td>
                <td className="px-1.5 py-1 border border-gray-300 text-center">
                  {p.participant_type === 'adulto' ? 'Adulto' : 'Criança'}
                </td>
                <td className="px-1.5 py-1 border border-gray-300">{p.phone || '—'}</td>
                <td className="px-1.5 py-1 border border-gray-300 text-center">
                  {p.is_member ? 'Membro' : 'Visitante'}
                </td>
                <td className="px-1.5 py-1 border border-gray-300">
                  {p.responsible_name || '—'}
                </td>
                <td className="px-1.5 py-1 border border-gray-300 text-center">
                  {busLabels[p.bus_option] || p.bus_option}
                </td>
                <td className="px-1.5 py-1 border border-gray-300 text-center">
                  {bedLabels[p.bed_option] || p.bed_option}
                </td>
                <td className="px-1.5 py-1 border border-gray-300 text-right font-mono">
                  {formatCurrency(p.individual_cost)}
                </td>
                <td className="px-1.5 py-1 border border-gray-300 text-right font-mono">
                  {formatCurrency(p.paid_value)}
                </td>
                <td className="px-1.5 py-1 border border-gray-300 text-center">
                  {p.payment_status}
                </td>
                <td
                  className="px-1.5 py-1 border border-gray-300 text-[10px] break-words"
                  style={{ maxWidth: 180 }}
                >
                  {p.notes || ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 border-t-2 border-gray-800 font-semibold">
              <td colSpan={8} className="px-1.5 py-2 border border-gray-300 text-right">
                Totais ({filtered.length} participante{filtered.length !== 1 ? 's' : ''})
              </td>
              <td
                className="px-1.5 py-2 border border-gray-300 text-right font-mono"
                data-testid="print-total-expected"
              >
                {formatCurrency(totals.expected)}
              </td>
              <td
                className="px-1.5 py-2 border border-gray-300 text-right font-mono"
                data-testid="print-total-paid"
              >
                {formatCurrency(totals.paid)}
              </td>
              <td
                className="px-1.5 py-2 border border-gray-300 text-right font-mono"
                data-testid="print-total-pending"
                colSpan={2}
              >
                Pendente: {formatCurrency(totals.pending)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* Rodapé de assinatura (só modo completa) */}
      {mode === 'completa' && filtered.length > 0 && (
        <div className="mt-8 pt-4 border-t text-[11px] text-gray-600 flex justify-between">
          <div>
            <p className="mb-8">Responsável pela conferência:</p>
            <p className="border-t border-gray-400 pt-1 w-64">Nome e assinatura</p>
          </div>
          <div className="text-right">
            <p className="mb-8">Data:</p>
            <p className="border-t border-gray-400 pt-1 w-40">____/____/________</p>
          </div>
        </div>
      )}
    </div>
  )
}
