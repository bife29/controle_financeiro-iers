import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { Plus, Edit2, Trash2, X, Star } from 'lucide-react'

interface MessageTemplate {
  id: number
  kind: string
  title: string
  body: string
  is_default: boolean
  is_active: boolean
}

const KINDS = [
  { value: 'birthday', label: 'Aniversário' },
  { value: 'event_reminder', label: 'Aviso de evento' },
  { value: 'generic', label: 'Genérico' },
]

const PLACEHOLDERS_HELP: Record<string, string> = {
  birthday: 'Variáveis: {nome}, {idade}',
  event_reminder: 'Variáveis: {evento}, {data}, {local}, {tipo}',
  generic: 'Sem variáveis específicas',
}

export function MessageTemplatesList() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmDel, setConfirmDel] = useState<MessageTemplate | null>(null)

  const { data: templates = [], isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ['msg-templates'],
    queryFn: () => api.get('/api/secretaria/message-templates').then((r) => r.data),
  })

  const delMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/secretaria/message-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['msg-templates'] }); setConfirmDel(null) },
  })

  const grouped = KINDS.map((k) => ({
    kind: k,
    items: templates.filter((t) => t.kind === k.value),
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modelos de mensagem</h1>
          <p className="text-sm text-muted-foreground">
            Modelos reutilizáveis para WhatsApp. Marque um como padrão para ser pré-selecionado.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo modelo
        </button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : grouped.map((g) => (
        <section key={g.kind.value} className="bg-white border rounded-xl p-4 space-y-2">
          <header className="flex items-center justify-between">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-gray-600">
              {g.kind.label}
            </h2>
            <span className="text-xs text-muted-foreground">{PLACEHOLDERS_HELP[g.kind.value]}</span>
          </header>
          {g.items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum modelo cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {g.items.map((t) => (
                <li key={t.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{t.title}</span>
                      {t.is_default && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                          <Star className="w-3 h-3" /> Padrão
                        </span>
                      )}
                      {!t.is_active && (
                        <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">Inativo</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{t.body}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditing(t); setShowForm(true) }}
                      className="p-1.5 hover:bg-gray-100 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(t)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {showForm && (
        <TemplateFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['msg-templates'] })
            setShowForm(false)
          }}
        />
      )}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-lg">Excluir modelo</h3>
            <p className="text-sm text-muted-foreground">Excluir "{confirmDel.title}"?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button
                onClick={() => delMutation.mutate(confirmDel.id)}
                disabled={delMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {delMutation.isPending ? 'Excluindo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateFormModal({
  editing, onClose, onSaved,
}: { editing: MessageTemplate | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    kind: editing?.kind ?? 'birthday',
    title: editing?.title ?? '',
    body: editing?.body ?? '',
    is_default: editing?.is_default ?? false,
    is_active: editing?.is_active ?? true,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { ...form }
      return editing
        ? api.put(`/api/secretaria/message-templates/${editing.id}`, payload)
        : api.post('/api/secretaria/message-templates', payload)
    },
    onSuccess: onSaved,
    onError: (e) => setError(getErrorMessage(e, 'Erro ao salvar')),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{editing ? 'Editar modelo' : 'Novo modelo'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Categoria *</label>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mensagem *</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={6}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
            placeholder="Use placeholders como {nome}, {idade}, {evento}..."
          />
          <p className="text-xs text-muted-foreground mt-1">{PLACEHOLDERS_HELP[form.kind]}</p>
        </div>
        <div className="flex gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="rounded"
            />
            Padrão para esta categoria
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="rounded"
            />
            Ativo
          </label>
        </div>

        {error && (
          <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => {
              if (!form.title.trim() || !form.body.trim()) { setError('Título e mensagem obrigatórios'); return }
              setError('')
              mutation.mutate()
            }}
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
