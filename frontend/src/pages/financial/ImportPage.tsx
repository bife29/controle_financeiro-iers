import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Upload, FileText, AlertTriangle, Check, X, Loader2,
  Sparkles, Link2, ArrowLeftRight
} from 'lucide-react'

interface PreviewTransaction {
  date: string
  type: string
  value: number
  description: string
  payment_method: string
  status: string
  imported_from: string
  category_id?: number | null
  bank_origin?: string | null
  bank_reference?: string | null
}

interface DuplicateItem {
  arquivo: PreviewTransaction
  existente_id: number
  motivo?: string
  existente: {
    id: number
    date: string
    type: string
    value: number
    description: string
    status: string
  }
}

interface MatchPrevistoItem {
  arquivo: PreviewTransaction
  previsto_id: number
  previsto: {
    id: number
    date: string
    type: string
    value: number
    description: string
    status: string
  }
}

interface AmbiguousItem {
  arquivo: PreviewTransaction
  candidatos: MatchPrevistoItem['previsto'][]
}

interface ImportResult {
  preview: PreviewTransaction[]
  possiveis_duplicidades: DuplicateItem[]
  matches_previstos: MatchPrevistoItem[]
  ambiguos: AmbiguousItem[]
  total_importado: number
  total_duplicidades: number
  total_matches_previstos: number
  total_ambiguos: number
}

interface Suggestion {
  index: number
  category_id: number | null
  category_name: string | null
  confidence: number
}

interface MatchResult {
  index: number
  match: {
    type: string
    entity: string
    entity_id: number
    description: string
    expected_value: number
    expected_date?: string
  } | null
}

interface Category {
  id: number
  name: string
  type: string
}

interface Project {
  id: number
  name: string
}

interface MemberSummary {
  id: number
  name: string
}

export function ImportPage() {
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)

  const [projectId, setProjectId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [bankOrigin, setBankOrigin] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [skipDuplicates, setSkipDuplicates] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [duplicateDecisions, setDuplicateDecisions] = useState<Record<number, 'ignore' | 'import'>>({})
  const [transactionCategories, setTransactionCategories] = useState<Record<number, number | null>>({})
  const [ambigChoices, setAmbigChoices] = useState<Record<number, number | null>>({})

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
  })

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/financial/categories').then((r) => r.data),
  })

  const { data: members = [] } = useQuery<MemberSummary[]>({
    queryKey: ['members-summary'],
    queryFn: () => api.get('/api/members/summary').then((r) => r.data),
  })

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const fmtDate = (d: string) => {
    try {
      const [y, m, day] = d.split('-')
      return `${day}/${m}/${y}`
    } catch {
      return d
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImportResult(null)
      setSuggestions([])
      setMatches([])
      setError('')
      setSuccess('')
      setDuplicateDecisions({})
      setTransactionCategories({})
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Selecione um arquivo')
      return
    }

    setUploading(true)
    setError('')
    setSuggestions([])
    setMatches([])

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (projectId) {
        formData.append('project_id', projectId)
      }
      if (categoryId) {
        formData.append('category_id', categoryId)
      }
      if (memberId) {
        formData.append('member_id', memberId)
      }
      if (bankOrigin) {
        formData.append('bank_origin', bankOrigin)
      }
      if (typeFilter) {
        formData.append('type_filter', typeFilter)
      }
      if (skipDuplicates) {
        formData.append('skip_duplicates', 'true')
      }

      const response = await api.post('/api/financial/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const result: ImportResult = response.data
      setImportResult(result)

      // Auto-preencher banco de origem se veio do OFX
      if (!bankOrigin && result.preview.length > 0 && result.preview[0].bank_origin) {
        setBankOrigin(result.preview[0].bank_origin)
      }

      // Buscar sugestões de categoria (ML)
      if (result.preview.length > 0) {
        try {
          const sugResp = await api.post('/api/financial/import/suggest-categories', {
            transactions: result.preview,
          })
          const sugs: Suggestion[] = sugResp.data
          setSuggestions(sugs)
          // Auto-aplicar sugestões com confiança alta
          const autoCats: Record<number, number | null> = {}
          sugs.forEach((s, i) => {
            if (s.category_id && s.confidence >= 60) {
              autoCats[i] = s.category_id
            }
          })
          setTransactionCategories(autoCats)
        } catch { /* ML é opcional */ }

        // Buscar matches bidirecionais
        try {
          const matchResp = await api.post('/api/financial/import/match-receivables', {
            transactions: result.preview,
            project_id: Number(projectId),
          })
          setMatches(matchResp.data)
        } catch { /* Match é opcional */ }
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao processar arquivo')
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!importResult) return

    // Juntar preview + duplicatas que o usuário optou por importar
    const toImport = [
      ...importResult.preview.map((t, i) => ({
        ...t,
        category_id: transactionCategories[i] || null,
      })),
      ...importResult.possiveis_duplicidades
        .filter((_, i) => duplicateDecisions[i] === 'import')
        .map((d) => d.arquivo),
    ]

    if (toImport.length === 0) return

    setConfirming(true)
    setError('')

    try {
      // Inclui matches escolhidos pelo usuário em ambiguidades
      const ambigMatches: MatchPrevistoItem[] = []
      if (importResult.ambiguos) {
        importResult.ambiguos.forEach((amb, idx) => {
          const chosen = ambigChoices[idx]
          if (chosen) {
            const previsto = amb.candidatos.find((c) => c.id === chosen)
            if (previsto) {
              ambigMatches.push({ arquivo: amb.arquivo, previsto_id: chosen, previsto })
            }
          }
        })
      }

      const matches_previstos = [...(importResult.matches_previstos || []), ...ambigMatches]

      const resp = await api.post('/api/financial/import/confirm', {
        transactions: toImport,
        matches_previstos,
        project_id: projectId ? Number(projectId) : null,
        category_id: categoryId ? Number(categoryId) : null,
        member_id: memberId ? Number(memberId) : null,
        bank_origin: bankOrigin || null,
      })

      const data = resp.data || {}
      const total = data.count ?? toImport.length + matches_previstos.length
      const updated = data.updated_count ?? matches_previstos.length
      setSuccess(
        `${total} lançamento(s) processados — ${data.created_count ?? toImport.length} novo(s)` +
        (updated > 0 ? `, ${updated} previsto(s) confirmado(s)` : '')
      )
      setImportResult(null)
      setSelectedFile(null)
      setSuggestions([])
      setMatches([])
      setDuplicateDecisions({})
      setTransactionCategories({})
      setAmbigChoices({})
      if (fileInput.current) fileInput.current.value = ''
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['financial-dashboard'] })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao confirmar importação')
    } finally {
      setConfirming(false)
    }
  }

  const extraFromDuplicates = Object.values(duplicateDecisions).filter((d) => d === 'import').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/financeiro" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Importação OFX/CSV</h1>
          <p className="text-sm text-muted-foreground">
            Importe transações com inteligência preditiva e conciliação automática
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Upload Form */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-lg">1. Selecione o arquivo e configure a importação</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Projeto de destino (opcional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Nenhum (classificar depois)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Categoria (opcional)</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Nenhuma (classificar depois)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Membro (opcional)</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Nenhum</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Banco de origem (opcional)</label>
            <input
              type="text"
              placeholder="Ex: Bradesco, Itaú, Sicoob..."
              value={bankOrigin}
              onChange={(e) => setBankOrigin(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Preenchido automaticamente para arquivos OFX quando disponível
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Filtrar por tipo</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Todos (Entradas e Saídas)</option>
              <option value="Entrada">Somente Entradas</option>
              <option value="Saída">Somente Saídas</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Arquivo (.ofx ou .csv) *</label>
            <input
              ref={fileInput}
              type="file"
              accept=".ofx,.csv"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-sm file:cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            Ignorar duplicidades (importar tudo)
          </label>
        </div>

        {selectedFile && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{selectedFile.name}</span>
            <span className="text-xs">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? 'Processando...' : 'Processar Arquivo'}
        </button>
      </div>

      {/* Preview */}
      {importResult && (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">2. Grade de Conferência</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 font-medium">Novas</p>
                <p className="text-lg font-bold text-green-800">{importResult.total_importado}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 font-medium">Confirmam previstos</p>
                <p className="text-lg font-bold text-blue-800">{importResult.total_matches_previstos || 0}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600 font-medium">Duplicadas</p>
                <p className="text-lg font-bold text-amber-800">{importResult.total_duplicidades}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 font-medium">Categorizadas (IA)</p>
                <p className="text-lg font-bold text-purple-800">
                  {suggestions.filter((s) => s.category_id).length}/{importResult.preview.length}
                </p>
              </div>
            </div>

            {/* Tabela com sugestões de categoria e matches */}
            {importResult.preview.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium">Data</th>
                      <th className="text-left px-3 py-2 font-medium">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium">Descrição</th>
                      <th className="text-right px-3 py-2 font-medium">Valor</th>
                      <th className="text-left px-3 py-2 font-medium">Categoria</th>
                      <th className="text-left px-3 py-2 font-medium">Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.preview.map((t, i) => {
                      const sug = suggestions[i]
                      const matchItem = matches[i]
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              t.type === 'Entrada'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {t.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={t.description}>
                            {t.description}
                          </td>
                          <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${
                            t.type === 'Entrada' ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {fmt(t.value)}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={transactionCategories[i] || ''}
                              onChange={(e) => setTransactionCategories((prev) => ({
                                ...prev,
                                [i]: e.target.value ? Number(e.target.value) : null,
                              }))}
                              className="text-xs border rounded px-2 py-1 max-w-[140px]"
                            >
                              <option value="">Sem categoria</option>
                              {categories
                                .filter((c) => c.type === t.type)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            {sug?.category_id && sug.confidence >= 30 && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Sparkles className="w-3 h-3 text-purple-500" />
                                <span className="text-[10px] text-purple-600">
                                  {sug.category_name} ({sug.confidence}%)
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {matchItem?.match && (
                              <div className="flex items-center gap-1">
                                <Link2 className="w-3 h-3 text-blue-500" />
                                <span className="text-[10px] text-blue-700 max-w-[130px] truncate block" title={matchItem.match.description}>
                                  {matchItem.match.type === 'receivable' ? '📥 ' : '📤 '}
                                  {matchItem.match.description}
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Todas as transações são duplicadas. Nada a importar.
              </p>
            )}
          </div>

          {/* Side-by-side Duplicatas */}
          {importResult.possiveis_duplicidades.length > 0 && (            <div className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-amber-600" />
                3. Análise de Duplicidades ({importResult.possiveis_duplicidades.length})
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Compare os lançamentos do arquivo com os existentes no banco. Decida para cada um — ou use as ações em massa abaixo.
              </p>

              {/* Ações em massa */}
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/30 rounded-lg border">
                <span className="text-xs font-medium text-muted-foreground mr-1">
                  Ações em massa:
                </span>
                <button
                  onClick={() => {
                    const all: Record<number, 'ignore' | 'import'> = {}
                    importResult.possiveis_duplicidades.forEach((_, i) => { all[i] = 'ignore' })
                    setDuplicateDecisions(all)
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-gray-100 transition"
                  data-testid="dup-ignore-all"
                >
                  Ignorar todas (são duplicadas)
                </button>
                <button
                  onClick={() => {
                    const all: Record<number, 'ignore' | 'import'> = {}
                    importResult.possiveis_duplicidades.forEach((_, i) => { all[i] = 'import' })
                    setDuplicateDecisions(all)
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-blue-50 transition"
                  data-testid="dup-import-all"
                >
                  Importar todas (são lançamentos diferentes)
                </button>
                <button
                  onClick={() => setDuplicateDecisions({})}
                  className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-gray-100 transition text-muted-foreground"
                  data-testid="dup-clear-all"
                >
                  Limpar decisões
                </button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {Object.keys(duplicateDecisions).length}/{importResult.possiveis_duplicidades.length} decididas
                </span>
              </div>

              <div className="space-y-3">
                {importResult.possiveis_duplicidades.map((dup, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-stretch">
                      {/* Arquivo */}
                      <div className="p-3 bg-blue-50/50">
                        <p className="text-[10px] font-semibold text-blue-600 uppercase mb-1">📄 Do Arquivo</p>
                        <p className="text-sm font-medium">{dup.arquivo.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{fmtDate(dup.arquivo.date)}</span>
                          <span className={dup.arquivo.type === 'Entrada' ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                            {fmt(dup.arquivo.value)}
                          </span>
                        </div>
                      </div>

                      {/* Separador */}
                      <div className="flex items-center justify-center px-3 bg-muted/30">
                        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
                      </div>

                      {/* Existente */}
                      <div className="p-3 bg-amber-50/50">
                        <p className="text-[10px] font-semibold text-amber-600 uppercase mb-1">🗄️ No Banco (#{dup.existente.id})</p>
                        <p className="text-sm font-medium">{dup.existente.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{fmtDate(dup.existente.date)}</span>
                          <span className={dup.existente.type === 'Entrada' ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                            {fmt(dup.existente.value)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 rounded">
                            {dup.existente.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/20 border-t">
                      <button
                        onClick={() => setDuplicateDecisions((p) => ({ ...p, [i]: 'ignore' }))}
                        className={`text-xs px-3 py-1 rounded-full border transition ${
                          duplicateDecisions[i] === 'ignore'
                            ? 'bg-gray-800 text-white border-gray-800'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        Ignorar (é duplicada)
                      </button>
                      <button
                        onClick={() => setDuplicateDecisions((p) => ({ ...p, [i]: 'import' }))}
                        className={`text-xs px-3 py-1 rounded-full border transition ${
                          duplicateDecisions[i] === 'import'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'hover:bg-blue-50'
                        }`}
                      >
                        Importar mesmo assim (é outro lançamento)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Matches automáticos com Previstos */}
          {importResult.matches_previstos && importResult.matches_previstos.length > 0 && (
            <div className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-600" />
                Confirmações automáticas de Previstos ({importResult.matches_previstos.length})
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Estes lançamentos do extrato bateram exatamente com previstos já cadastrados (mesmo valor, ±3 dias).
                Ao confirmar a importação, o previsto vira <strong>Confirmado</strong> sem criar registro novo.
              </p>
              <ul className="divide-y text-sm">
                {importResult.matches_previstos.map((m, i) => (
                  <li key={i} className="py-2 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{m.arquivo.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Extrato {fmtDate(m.arquivo.date)} → Previsto #{m.previsto_id} ({fmtDate(m.previsto.date)})
                      </p>
                    </div>
                    <span className={`text-sm font-medium whitespace-nowrap ${m.arquivo.type === 'Entrada' ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(m.arquivo.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Ambiguidades — usuário escolhe qual previsto confirmar */}
          {importResult.ambiguos && importResult.ambiguos.length > 0 && (
            <div className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Decisões necessárias ({importResult.ambiguos.length})
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Mais de um previsto bate com a mesma linha do extrato. Escolha qual deve ser confirmado, ou deixe em branco para criar como novo lançamento.
              </p>
              <div className="space-y-3">
                {importResult.ambiguos.map((amb, idx) => (
                  <div key={idx} className="border rounded-lg p-3">
                    <p className="text-sm font-medium">{amb.arquivo.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Extrato: {fmtDate(amb.arquivo.date)} • <span className={amb.arquivo.type === 'Entrada' ? 'text-green-700' : 'text-red-700'}>{fmt(amb.arquivo.value)}</span>
                    </p>
                    <select
                      value={ambigChoices[idx] ?? ''}
                      onChange={(e) => setAmbigChoices((p) => ({ ...p, [idx]: e.target.value ? Number(e.target.value) : null }))}
                      className="mt-2 w-full text-xs border rounded px-2 py-1"
                    >
                      <option value="">Criar como novo lançamento (não confirmar previsto)</option>
                      {amb.candidatos.map((c) => (
                        <option key={c.id} value={c.id}>
                          Confirmar Previsto #{c.id} — {fmtDate(c.date)} — {c.description || '(sem descrição)'}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirmação */}
          {(importResult.preview.length > 0 || extraFromDuplicates > 0) && (
            <div className="flex items-center justify-between bg-card border rounded-xl p-4">
              <div className="text-sm text-muted-foreground">
                Total a importar: <strong>{importResult.preview.length + extraFromDuplicates}</strong> transação(ões)
                {extraFromDuplicates > 0 && (
                  <span className="text-blue-600 ml-1">(+{extraFromDuplicates} de duplicatas aprovadas)</span>
                )}              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setImportResult(null)
                    setSelectedFile(null)
                    setSuggestions([])
                    setMatches([])
                    setDuplicateDecisions({})
                    setTransactionCategories({})
                    if (fileInput.current) fileInput.current.value = ''
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {confirming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {confirming ? 'Importando...' : 'Confirmar Importação'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
