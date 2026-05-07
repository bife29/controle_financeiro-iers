import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { Plus, Edit2, Trash2, X, ExternalLink } from 'lucide-react'

interface WhatsappGroup {
  id: number
  name: string
  kind?: string | null
  invite_link?: string | null
  notes?: string | null
  is_active: boolean
}

const KIND_OPTIONS = [
  { value: '', label: '— sem categoria —' },
  { value: 'avisos', label: 'Avisos' },
  { value: 'jovens', label: 'Jovens' },
  { value: 'lideranca', label: 'Liderança' },
  { value: 'mulheres', label: 'Mulheres' },
  { value: 'homens', label: 'Homens' },
  { value: 'casais', label: 'Casais' },
  { value: 'geral', label: 'Geral' },
]

export function WhatsappGroupsList() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<WhatsappGroup | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmDel, setConfirmDel] = useState<WhatsappGroup | null>(null)

  const { data: groups = [], isLoading } = useQuery<WhatsappGroup[]>({
    queryKey: ['wa-groups'],
    queryFn: () => api.get('/api/secretaria/whatsapp-groups').then((r) => r.data),
  })

  const delMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/secretaria/whatsapp-groups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-groups'] })
      setConfirmDel(null)
    },
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grupos de WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre os grupos da igreja para usar como referência no envio de mensagens.
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo grupo
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nome</th>
              <th className="text-left px-4 py-3 font-medium">Categoria</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Convite</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Observações</th>
              <th className="text-center px-4 py-3 font-medium w-24">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : groups.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum grupo cadastrado.</td></tr>
            ) : groups.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{g.name}</td>
                <td className="px-4 py-3 text-xs">
                  {g.kind && (
                    <span className="px-2 py-0.5 rounded-full border bg-gray-50">{g.kind}</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs">
                  {g.invite_link && (
                    <a
                      href={g.invite_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      Abrir <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground line-clamp-1">
                  {g.notes}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => { setEditing(g); setShowForm(true) }}
                      className="p-1.5 hover:bg-gray-100 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDel(g)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <GroupFormModal
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['wa-groups'] })
            setShowForm(false)
          }}
        />
      )}

      {confirmDel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-lg">Excluir grupo</h3>
            <p className="text-sm text-muted-foreground">Excluir "{confirmDel.name}"?</p>
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

function GroupFormModal({
  editing, onClose, onSaved,
}: { editing: WhatsappGroup | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    kind: editing?.kind ?? '',
    invite_link: editing?.invite_link ?? '',
    notes: editing?.notes ?? '',
    is_active: editing?.is_active ?? true,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        kind: form.kind || null,
        invite_link: form.invite_link || null,
        notes: form.notes || null,
        is_active: form.is_active,
      }
      return editing
        ? api.put(`/api/secretaria/whatsapp-groups/${editing.id}`, payload)
        : api.post('/api/secretaria/whatsapp-groups', payload)
    },
    onSuccess: onSaved,
    onError: (e) => setError(getErrorMessage(e, 'Erro ao salvar')),
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{editing ? 'Editar grupo' : 'Novo grupo'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nome *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Categoria</label>
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Link de convite (opcional)</label>
          <input
            type="url"
            value={form.invite_link}
            onChange={(e) => setForm({ ...form, invite_link: e.target.value })}
            placeholder="https://chat.whatsapp.com/..."
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Observações</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded"
          />
          Ativo
        </label>

        {error && (
          <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => {
              if (!form.name.trim()) { setError('Nome obrigatório'); return }
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
