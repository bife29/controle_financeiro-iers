import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ShieldAlert, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

interface ResetResult {
  detail: string
  preserved: { users: number; members: number; church_settings: number }
  deleted_counts: Record<string, number>
  seeded: {
    projects: number
    categories: number
    patrimony_categories?: number
    patrimony_locations?: number
  }
}

const REQUIRED_PHRASE = 'LIMPAR TUDO'

export function ResetData() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [confirmText, setConfirmText] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [result, setResult] = useState<ResetResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useMutation({
    mutationFn: () =>
      api
        .post<ResetResult>('/api/admin/reset-data', { confirm: REQUIRED_PHRASE })
        .then((r) => r.data),
    onSuccess: (data) => {
      setResult(data)
      setError(null)
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Falha ao limpar dados.')
    },
  })

  // Restrição visual extra — o backend já valida super_admin.
  if (user?.role !== 'super_admin') {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          Apenas super-administradores podem acessar esta área.
        </div>
        <button
          onClick={() => navigate('/usuarios')}
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </div>
    )
  }

  const canSubmit =
    confirmText === REQUIRED_PHRASE && acknowledged && !reset.isPending && !result

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button
        onClick={() => navigate('/usuarios')}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para usuários
      </button>

      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-7 h-7 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-red-700">
              Limpar dados para iniciar produção
            </h1>
            <p className="text-sm text-red-900/80">
              Esta ação <strong>apaga permanentemente</strong> todas as
              movimentações, retiros, compras, patrimônio, eventos, feedbacks,
              notificações e auditoria. <strong>Não pode ser desfeita.</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-600" /> O que será apagado
        </h2>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• Todas as <strong>transações financeiras</strong></li>
          <li>• Todos os <strong>retiros</strong>, participantes e pagamentos</li>
          <li>• Todas as <strong>listas e pedidos de compras</strong></li>
          <li>• Todo o <strong>patrimônio</strong>, manutenções, categorias e localizações</li>
          <li>• <strong>Eventos</strong>, grupos WhatsApp e modelos de mensagem</li>
          <li>• <strong>Feedbacks</strong>, notificações e logs de auditoria</li>
          <li>• Categorias e projetos financeiros (re-semeados padrão)</li>
        </ul>
        <h2 className="font-semibold flex items-center gap-2 mt-4">
          <ShieldAlert className="w-4 h-4 text-emerald-600" /> O que será preservado
        </h2>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• <strong>Usuários</strong> e suas permissões</li>
          <li>• <strong>Membros</strong> cadastrados</li>
          <li>• <strong>Configurações da igreja</strong> (nome, CNPJ, logotipo)</li>
        </ul>
      </div>

      {result ? (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 space-y-3">
          <h2 className="font-bold text-emerald-700 flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Limpeza concluída
          </h2>
          <p className="text-sm text-emerald-900">{result.detail}</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white rounded p-2 border">
              <p className="font-semibold mb-1">Preservados</p>
              <p>Usuários: {result.preserved.users}</p>
              <p>Membros: {result.preserved.members}</p>
              <p>Config. Igreja: {result.preserved.church_settings}</p>
            </div>
            <div className="bg-white rounded p-2 border">
              <p className="font-semibold mb-1">Re-semeados</p>
              <p>Projetos padrão: {result.seeded.projects}</p>
              <p>Categorias padrão: {result.seeded.categories}</p>
              {result.seeded.patrimony_categories != null && (
                <p>Categorias patrimônio: {result.seeded.patrimony_categories}</p>
              )}
              {result.seeded.patrimony_locations != null && (
                <p>Locais patrimônio: {result.seeded.patrimony_locations}</p>
              )}
            </div>
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">
              Detalhamento da exclusão
            </summary>
            <pre className="mt-2 bg-white border rounded p-2 overflow-auto">
              {JSON.stringify(result.deleted_counts, null, 2)}
            </pre>
          </details>
          <button
            onClick={() => navigate('/usuarios')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            Voltar
          </button>
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" /> Confirmação obrigatória
          </h2>

          <label className="flex items-start gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              data-testid="reset-data-ack"
            />
            <span>
              Entendo que esta ação é <strong>irreversível</strong> e que estou
              prestes a apagar todos os dados operacionais da igreja.
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium mb-1">
              Digite{' '}
              <code className="px-1.5 py-0.5 bg-muted rounded font-mono">
                {REQUIRED_PHRASE}
              </code>{' '}
              para liberar o botão:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-400 outline-none font-mono"
              placeholder={REQUIRED_PHRASE}
              data-testid="reset-data-phrase"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <button
            onClick={() => reset.mutate()}
            disabled={!canSubmit}
            data-testid="reset-data-submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            {reset.isPending ? 'Apagando...' : 'Apagar todos os dados'}
          </button>
        </div>
      )}
    </div>
  )
}
