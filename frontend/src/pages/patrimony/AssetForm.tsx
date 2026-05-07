import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import { ArrowLeft, Save } from 'lucide-react'
import { ASSET_STATUSES } from '@/lib/patrimony'

interface Cat { id: number; name: string }
interface Project { id: number; name: string }
interface FinCategory { id: number; name: string; type: string }

interface AssetForm {
  code: string
  name: string
  description: string
  acquisition_date: string
  value: string
  invoice_number: string
  category_id: string
  location_id: string
  location_other: string
  status: string
  maintenance_interval_months: string
  warranty_until: string
  notes: string
  create_financial_transaction: boolean
  financial_project_id: string
  financial_category_id: string
}

const EMPTY: AssetForm = {
  code: '', name: '', description: '', acquisition_date: '', value: '',
  invoice_number: '', category_id: '', location_id: '', location_other: '',
  status: 'active_in_use', maintenance_interval_months: '', warranty_until: '',
  notes: '', create_financial_transaction: false,
  financial_project_id: '', financial_category_id: '',
}

export function AssetForm() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<AssetForm>(EMPTY)
  const [error, setError] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api.get(`/api/patrimony/${id}`).then((r) => r.data),
    enabled: isEditing,
  })

  const { data: categories = [] } = useQuery<Cat[]>({
    queryKey: ['asset-categories'],
    queryFn: () => api.get('/api/patrimony/categories').then((r) => r.data),
  })
  const { data: locations = [] } = useQuery<Cat[]>({
    queryKey: ['asset-locations'],
    queryFn: () => api.get('/api/patrimony/locations').then((r) => r.data),
  })
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['fin-projects'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
    enabled: form.create_financial_transaction,
  })
  const { data: finCategories = [] } = useQuery<FinCategory[]>({
    queryKey: ['fin-categories'],
    queryFn: () => api.get('/api/financial/categories').then((r) => r.data),
    enabled: form.create_financial_transaction,
  })

  useEffect(() => {
    if (existing) {
      setForm({
        ...EMPTY,
        code: existing.code ?? '',
        name: existing.name ?? '',
        description: existing.description ?? '',
        acquisition_date: existing.acquisition_date ?? '',
        value: existing.value != null ? String(existing.value) : '',
        invoice_number: existing.invoice_number ?? '',
        category_id: existing.category_id != null ? String(existing.category_id) : '',
        location_id: existing.location_id != null ? String(existing.location_id) : '',
        location_other: existing.location_other ?? '',
        status: existing.status ?? 'active_in_use',
        maintenance_interval_months: existing.maintenance_interval_months != null ? String(existing.maintenance_interval_months) : '',
        warranty_until: existing.warranty_until ?? '',
        notes: existing.notes ?? '',
      })
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        code: form.code || undefined,
        name: form.name,
        description: form.description || null,
        acquisition_date: form.acquisition_date || null,
        value: form.value !== '' ? Number(form.value) : null,
        invoice_number: form.invoice_number || null,
        category_id: form.category_id ? Number(form.category_id) : null,
        location_id: form.location_id ? Number(form.location_id) : null,
        location_other: form.location_other || null,
        status: form.status,
        maintenance_interval_months: form.maintenance_interval_months !== '' ? Number(form.maintenance_interval_months) : null,
        warranty_until: form.warranty_until || null,
        notes: form.notes || null,
      }
      if (!isEditing) {
        payload.create_financial_transaction = form.create_financial_transaction
        payload.financial_project_id = form.financial_project_id ? Number(form.financial_project_id) : null
        payload.financial_category_id = form.financial_category_id ? Number(form.financial_category_id) : null
      }
      return isEditing
        ? api.put(`/api/patrimony/${id}`, payload)
        : api.post('/api/patrimony', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['asset', id] })
      qc.invalidateQueries({ queryKey: ['patrimony-dashboard'] })
      navigate('/patrimonio/bens')
    },
    onError: (e) => setError(getErrorMessage(e, 'Erro ao salvar')),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/patrimonio/bens')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? 'Editar bem' : 'Novo bem'}</h1>
          <p className="text-sm text-muted-foreground">
            {!isEditing && 'O código será gerado automaticamente (PAT-XXXX) se você não informar um.'}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <fieldset className="bg-white border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-blue-700 px-2">Identificação</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nº de controle</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={isEditing ? '' : 'Auto: PAT-0001'}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Nome / Descrição *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição detalhada</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </fieldset>

        <fieldset className="bg-white border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-blue-700 px-2">Categoria & Local</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— selecione —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Local / Ambiente</label>
              <select
                value={form.location_id}
                onChange={(e) => setForm({ ...form, location_id: e.target.value, location_other: e.target.value ? '' : form.location_other })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— selecione —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Outro local (informar manualmente, se não estiver na lista)
              </label>
              <input
                type="text"
                value={form.location_other}
                onChange={(e) => setForm({ ...form, location_other: e.target.value, location_id: e.target.value ? '' : form.location_id })}
                placeholder="Ex: Sala de oração"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="bg-white border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-blue-700 px-2">Aquisição</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data de aquisição</label>
              <input
                type="date"
                value={form.acquisition_date}
                onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nota Fiscal</label>
              <input
                type="text"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                placeholder="Nº NF"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Garantia até</label>
            <input
              type="date"
              value={form.warranty_until}
              onChange={(e) => setForm({ ...form, warranty_until: e.target.value })}
              className="w-full sm:w-1/3 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!isEditing && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-3">
              <label className="inline-flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.create_financial_transaction}
                  onChange={(e) => setForm({ ...form, create_financial_transaction: e.target.checked })}
                  className="mt-0.5 rounded"
                />
                <span>
                  <strong>Lançar saída no Financeiro</strong>
                  <span className="block text-xs text-muted-foreground">
                    Cria uma transação de saída automática no módulo Financeiro com o valor informado.
                  </span>
                </span>
              </label>
              {form.create_financial_transaction && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                  <select
                    value={form.financial_project_id}
                    onChange={(e) => setForm({ ...form, financial_project_id: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">— Projeto (opcional) —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select
                    value={form.financial_category_id}
                    onChange={(e) => setForm({ ...form, financial_category_id: e.target.value })}
                    className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">— Categoria (opcional) —</option>
                    {finCategories.filter((c) => c.type === 'Saída').map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </fieldset>

        <fieldset className="bg-white border rounded-xl p-5 space-y-4">
          <legend className="text-sm font-bold text-blue-700 px-2">Status & Manutenção</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ASSET_STATUSES.filter((s) => s.value !== 'in_maintenance' && s.value !== 'decommissioned').map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
                {isEditing && (
                  <>
                    <option value="in_maintenance">Em manutenção</option>
                    <option value="decommissioned">Baixado</option>
                  </>
                )}
              </select>
              {!isEditing && (
                <p className="text-xs text-muted-foreground mt-1">
                  Para enviar à manutenção ou dar baixa, use as ações na tela de detalhes.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Manutenção a cada (meses)</label>
              <input
                type="number"
                min={0}
                value={form.maintenance_interval_months}
                onChange={(e) => setForm({ ...form, maintenance_interval_months: e.target.value })}
                placeholder="Ex: 6"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-muted-foreground mt-1">
                A próxima manutenção será calculada automaticamente.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="bg-white border rounded-xl p-5">
          <legend className="text-sm font-bold text-blue-700 px-2">Observações</legend>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </fieldset>

        {error && (
          <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/patrimonio/bens')} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
