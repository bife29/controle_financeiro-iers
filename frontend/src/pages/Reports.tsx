import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  FileText, FileSpreadsheet, BookOpen, Tags, Mountain, Users, CalendarClock, Eye,
} from 'lucide-react'

type ReportKey = 'cashbook' | 'by-category' | 'by-project' | 'projects-by-member' | 'payables-receivables'

interface ReportDef {
  key: ReportKey
  title: string
  description: string
  icon: typeof FileText
  fields: Array<'period' | 'type' | 'status' | 'project' | 'member'>
  defaultStatus?: string
  endpoint: string
}

const REPORTS: ReportDef[] = [
  {
    key: 'cashbook',
    title: 'Livro Caixa',
    description: 'Listagem cronológica de transações do período com totais de Entradas e Saídas.',
    icon: BookOpen,
    fields: ['period', 'status'],
    defaultStatus: 'Confirmado',
    endpoint: '/api/reports/cashbook',
  },
  {
    key: 'by-category',
    title: 'Por Categoria',
    description: 'Lançamentos agrupados por categoria, com subtotal de cada uma e total geral.',
    icon: Tags,
    fields: ['period', 'type', 'status'],
    defaultStatus: 'Confirmado',
    endpoint: '/api/reports/by-category',
  },
  {
    key: 'by-project',
    title: 'Por Projeto / Evento',
    description: 'Movimentação financeira por projeto/evento, com saldo individual.',
    icon: Mountain,
    fields: ['period', 'project', 'status'],
    defaultStatus: 'Confirmado',
    endpoint: '/api/reports/by-project',
  },
  {
    key: 'projects-by-member',
    title: 'Pagamentos por Membro',
    description: 'Pagamentos realizados por pessoa, agrupados por membro (entradas confirmadas com membro vinculado).',
    icon: Users,
    fields: ['period', 'member', 'project'],
    endpoint: '/api/reports/projects-by-member',
  },
  {
    key: 'payables-receivables',
    title: 'Contas a Pagar e a Receber',
    description: 'Listagem dos lançamentos Previstos por período (Entradas a receber e Saídas a pagar).',
    icon: CalendarClock,
    fields: ['period', 'type'],
    endpoint: '/api/reports/payables-receivables',
  },
]

interface SimpleOption { id: number; name: string }

export function ReportsPage() {
  const [selected, setSelected] = useState<ReportKey>('cashbook')
  const def = REPORTS.find((r) => r.key === selected)!

  // filtros — primeiro dia do mês até hoje por padrão
  const today = new Date()
  const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const ymd = (d: Date) => d.toISOString().slice(0, 10)

  const [start, setStart] = useState(ymd(firstDayMonth))
  const [end, setEnd] = useState(ymd(today))
  const [type, setType] = useState('')
  const [status, setStatus] = useState(def.defaultStatus ?? '')
  const [projectId, setProjectId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [downloading, setDownloading] = useState<'pdf' | 'xlsx' | 'preview' | null>(null)
  const [error, setError] = useState('')

  // Atualiza status default ao trocar relatório
  useEffect(() => {
    setStatus(def.defaultStatus ?? '')
    setError('')
  }, [selected, def.defaultStatus])

  const { data: projects = [] } = useQuery<SimpleOption[]>({
    queryKey: ['reports-projects'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
    enabled: def.fields.includes('project'),
  })
  const { data: members = [] } = useQuery<SimpleOption[]>({
    queryKey: ['reports-members'],
    queryFn: () => api.get('/api/members/summary').then((r) => r.data),
    enabled: def.fields.includes('member'),
  })

  function buildParams(fmt: 'pdf' | 'xlsx'): Record<string, string> {
    const params: Record<string, string> = { format: fmt }
    if (def.fields.includes('period')) {
      if (start) params.start = start
      if (end) params.end = end
    }
    if (def.fields.includes('type') && type) params.type = type
    if (def.fields.includes('status') && status) params.status = status
    if (def.fields.includes('project') && projectId) params.project_id = projectId
    if (def.fields.includes('member') && memberId) params.member_id = memberId
    return params
  }

  async function previewPdf() {
    setError('')
    setDownloading('preview')
    try {
      const res = await api.get(def.endpoint, {
        params: buildParams('pdf'),
        responseType: 'blob',
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      // Abre o PDF em nova aba (sem disparar download). O navegador renderiza
      // inline graças ao Content-Type application/pdf.
      const w = window.open(url, '_blank', 'noopener')
      if (!w) {
        // Pop-up bloqueado: faz fallback baixando.
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      // Libera o object URL após tempo suficiente para a aba carregar.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Falha ao visualizar PDF')
    } finally {
      setDownloading(null)
    }
  }

  async function download(fmt: 'pdf' | 'xlsx') {
    setError('')
    setDownloading(fmt)
    try {
      const params = buildParams(fmt)

      const res = await api.get(def.endpoint, { params, responseType: 'blob' })
      const cd = String(res.headers['content-disposition'] || '')
      const match = /filename="([^"]+)"/.exec(cd)
      const filename = match ? match[1] : `${selected}.${fmt}`
      const blob = new Blob([res.data], { type: String(res.headers['content-type'] || '') })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Falha ao gerar relatório')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Relatórios analíticos</h1>
        <p className="text-sm text-muted-foreground">
          Gere relatórios em <strong>PDF</strong> (impressão) ou <strong>Excel</strong> (XLSX) para análise.
        </p>
      </div>

      {/* Cards de seleção */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORTS.map((r) => {
          const Icon = r.icon
          const active = r.key === selected
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setSelected(r.key)}
              data-testid={`report-card-${r.key}`}
              className={`text-left border rounded-xl p-4 transition ${
                active ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' : 'bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-5 h-5 ${active ? 'text-blue-700' : 'text-blue-600'}`} />
                <h3 className={`font-semibold text-sm ${active ? 'text-blue-900' : ''}`}>{r.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-blue-700">Filtros</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {def.fields.includes('period') && (
            <>
              <div>
                <label className="text-xs text-muted-foreground">Data inicial</label>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  data-testid="report-start"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data final</label>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  data-testid="report-end"
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {def.fields.includes('type') && (
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                data-testid="report-type"
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </div>
          )}

          {def.fields.includes('status') && (
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                data-testid="report-status"
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="Confirmado">Confirmado</option>
                <option value="Previsto">Previsto</option>
              </select>
            </div>
          )}

          {def.fields.includes('project') && (
            <div>
              <label className="text-xs text-muted-foreground">Projeto / Evento</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                data-testid="report-project"
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {def.fields.includes('member') && (
            <div>
              <label className="text-xs text-muted-foreground">Membro</label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                data-testid="report-member"
                className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <button
            type="button"
            disabled={downloading !== null}
            onClick={previewPdf}
            data-testid="report-preview-pdf"
            title="Abre o PDF em uma nova aba para visualizar antes de baixar"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            {downloading === 'preview' ? 'Abrindo...' : 'Visualizar PDF'}
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => download('pdf')}
            data-testid="report-download-pdf"
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {downloading === 'pdf' ? 'Gerando...' : 'Baixar PDF'}
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => download('xlsx')}
            data-testid="report-download-xlsx"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {downloading === 'xlsx' ? 'Gerando...' : 'Baixar Excel (XLSX)'}
          </button>
        </div>
      </div>
    </div>
  )
}
