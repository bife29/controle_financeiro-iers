import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { Plus, Edit2, Trash2, MessageCircle, MapPin } from 'lucide-react'
import { WhatsappShareDialog } from '@/components/WhatsappShareDialog'

interface EventItem {
  id: number
  title: string
  date: string
  type?: string | null
  description?: string | null
  location?: string | null
  is_active: boolean
}

export function EventsList() {
  const qc = useQueryClient()
  const [share, setShare] = useState<EventItem | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<EventItem | null>(null)
  const [error, setError] = useState('')

  const { data: events = [], isLoading } = useQuery<EventItem[]>({
    queryKey: ['events-list'],
    queryFn: () => api.get('/api/secretaria/events').then((r) => r.data),
  })

  const delMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/secretaria/events/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events-list'] })
      qc.invalidateQueries({ queryKey: ['secretaria-dashboard'] })
      setConfirmDelete(null)
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao excluir')),
  })

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Eventos</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de eventos da igreja para o calendário e avisos.
          </p>
        </div>
        <Link
          to="novo"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo evento
        </Link>
      </div>

      {error && (
        <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Data</th>
              <th className="text-left px-4 py-3 font-medium">Título</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Local</th>
              <th className="text-center px-4 py-3 font-medium w-32">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum evento cadastrado.</td></tr>
            ) : sorted.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{formatBr(e.date)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{e.title}</p>
                  {e.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{e.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {e.type && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-50">
                      {e.type}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                  {e.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setShare(e)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                      title="Enviar aviso via WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <Link to={`${e.id}`} className="p-1.5 hover:bg-gray-100 rounded" title="Editar">
                      <Edit2 className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => setConfirmDelete(e)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      title="Excluir"
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

      {confirmDelete && (
        <ConfirmModal
          title="Excluir evento"
          message={`Excluir "${confirmDelete.title}"? Essa ação não pode ser desfeita.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => delMutation.mutate(confirmDelete.id)}
          loading={delMutation.isPending}
        />
      )}

      {share && (
        <WhatsappShareDialog
          open
          onClose={() => setShare(null)}
          title={`Avisar sobre: ${share.title}`}
          templateKind="event_reminder"
          templateVars={{
            evento: share.title,
            data: formatBr(share.date),
            local: share.location ?? '',
            tipo: share.type ?? '',
          }}
          initialMessage={`📢 *${share.title}*\nData: ${formatBr(share.date)}${share.location ? `\nLocal: ${share.location}` : ''}${share.description ? `\n\n${share.description}` : ''}`}
        />
      )}
    </div>
  )
}

function formatBr(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function ConfirmModal({ title, message, onCancel, onConfirm, loading }: {
  title: string; message: string; onCancel: () => void; onConfirm: () => void; loading?: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full space-y-4">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Excluindo...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
