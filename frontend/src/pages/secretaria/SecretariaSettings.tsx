import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { Link } from 'react-router-dom'
import { Save, ArrowLeft } from 'lucide-react'

interface ChurchSettings {
  id: number
  secretary_phone?: string | null
  church_name?: string | null
  birthday_alert_days: number
  event_alert_days: number
}

export function SecretariaSettings() {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<ChurchSettings>>({
    secretary_phone: '',
    church_name: '',
    birthday_alert_days: 2,
    event_alert_days: 2,
  })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const { data } = useQuery<ChurchSettings>({
    queryKey: ['church-settings'],
    queryFn: () => api.get('/api/secretaria/settings').then((r) => r.data),
  })

  useEffect(() => {
    if (data) {
      setForm({
        secretary_phone: data.secretary_phone ?? '',
        church_name: data.church_name ?? '',
        birthday_alert_days: data.birthday_alert_days ?? 2,
        event_alert_days: data.event_alert_days ?? 2,
      })
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: () =>
      api.put('/api/secretaria/settings', {
        secretary_phone: form.secretary_phone || null,
        church_name: form.church_name || null,
        birthday_alert_days: Number(form.birthday_alert_days) || 2,
        event_alert_days: Number(form.event_alert_days) || 2,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['church-settings'] })
      qc.invalidateQueries({ queryKey: ['secretaria-dashboard'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao salvar')),
  })

  return (
    <div className="space-y-5 max-w-xl">
      <Link to="/secretaria" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft className="w-4 h-4" /> Voltar para Secretaria
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Configurações da Secretaria</h1>
        <p className="text-sm text-muted-foreground">
          Telefone da secretaria, nome da igreja e antecedência dos alertas.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setError(''); mutation.mutate() }}
        className="bg-white border rounded-xl p-5 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Nome da igreja</label>
          <input
            type="text"
            value={form.church_name ?? ''}
            onChange={(e) => setForm({ ...form, church_name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Telefone da secretaria</label>
          <input
            type="tel"
            value={form.secretary_phone ?? ''}
            onChange={(e) => setForm({ ...form, secretary_phone: e.target.value })}
            placeholder="(00) 00000-0000"
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Aparece como remetente sugerido nas mensagens copiadas para colar nos grupos.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Aniversários: dias de antecedência</label>
            <input
              type="number"
              min={1}
              max={30}
              value={form.birthday_alert_days ?? 2}
              onChange={(e) => setForm({ ...form, birthday_alert_days: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Eventos: dias de antecedência</label>
            <input
              type="number"
              min={1}
              max={30}
              value={form.event_alert_days ?? 2}
              onChange={(e) => setForm({ ...form, event_alert_days: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>
        )}
        {saved && (
          <p className="text-sm bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3">
            Configurações salvas com sucesso.
          </p>
        )}

        <div className="flex justify-end pt-2 border-t">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
