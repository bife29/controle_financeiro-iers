import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, FileText, AlertTriangle, Check, X, Loader2 } from 'lucide-react'

interface PreviewTransaction {
  date: string
  type: string
  value: number
  description: string
  payment_method: string
  status: string
  imported_from: string
}

interface ImportResult {
  preview: PreviewTransaction[]
  possiveis_duplicidades: Array<{
    arquivo: PreviewTransaction
    existente_id: number
  }>
  total_importado: number
  total_duplicidades: number
}

interface Project {
  id: number
  name: string
}

export function ImportPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)

  const [projectId, setProjectId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
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
      setError('')
      setSuccess('')
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !projectId) {
      setError('Selecione um arquivo e um projeto')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('project_id', projectId)

      const response = await api.post('/api/financial/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setImportResult(response.data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao processar arquivo')
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (!importResult || importResult.preview.length === 0) return

    setConfirming(true)
    setError('')

    try {
      await api.post('/api/financial/import/confirm', {
        transactions: importResult.preview,
        project_id: Number(projectId),
      })

      setSuccess(`${importResult.preview.length} transações importadas com sucesso!`)
      setImportResult(null)
      setSelectedFile(null)
      if (fileInput.current) fileInput.current.value = ''
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['financial-dashboard'] })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao confirmar importação')
    } finally {
      setConfirming(false)
    }
  }

  const totalValue = importResult?.preview.reduce(
    (acc, t) => acc + (t.type === 'Entrada' ? t.value : -t.value),
    0
  ) || 0

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
            Importe transações de extratos bancários
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
        <h2 className="font-semibold text-lg">1. Selecione o arquivo e o projeto</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Projeto de destino *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">Selecione...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
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

        {selectedFile && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{selectedFile.name}</span>
            <span className="text-xs">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || !projectId || uploading}
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
          <div className="bg-card border rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">2. Preview das transações</h2>

            {/* Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 font-medium">Novas</p>
                <p className="text-lg font-bold text-green-800">{importResult.total_importado}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600 font-medium">Duplicadas</p>
                <p className="text-lg font-bold text-amber-800">{importResult.total_duplicidades}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 font-medium">Valor Líquido</p>
                <p className={`text-lg font-bold ${totalValue >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  {fmt(totalValue)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 font-medium">Formato</p>
                <p className="text-lg font-bold text-gray-800 uppercase">
                  {importResult.preview[0]?.imported_from || '—'}
                </p>
              </div>
            </div>

            {/* Tabela preview */}
            {importResult.preview.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium">Data</th>
                      <th className="text-left px-3 py-2 font-medium">Tipo</th>
                      <th className="text-left px-3 py-2 font-medium">Descrição</th>
                      <th className="text-right px-3 py-2 font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.preview.map((t, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">{fmtDate(t.date)}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            t.type === 'Entrada'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[250px] truncate">{t.description}</td>
                        <td className={`px-3 py-2 text-right font-medium ${
                          t.type === 'Entrada' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {fmt(t.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Todas as transações são duplicadas. Nada a importar.
              </p>
            )}

            {/* Duplicidades */}
            {importResult.possiveis_duplicidades.length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-medium text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {importResult.possiveis_duplicidades.length} possível(is) duplicidade(s) ignorada(s)
                </h3>
                <ul className="mt-2 text-sm text-amber-700 space-y-1">
                  {importResult.possiveis_duplicidades.slice(0, 5).map((d, i) => (
                    <li key={i}>
                      {fmtDate(d.arquivo.date)} — {d.arquivo.description} — {fmt(d.arquivo.value)}
                      <span className="text-xs"> (existente #{d.existente_id})</span>
                    </li>
                  ))}
                  {importResult.possiveis_duplicidades.length > 5 && (
                    <li className="text-xs">
                      ... e mais {importResult.possiveis_duplicidades.length - 5}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Confirmação */}
          {importResult.preview.length > 0 && (
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setImportResult(null)
                  setSelectedFile(null)
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
                {confirming ? 'Importando...' : `Confirmar Importação (${importResult.preview.length})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
