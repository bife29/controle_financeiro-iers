import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, getErrorMessage } from '@/lib/api'
import {
  ArrowLeft, Edit2, Wrench, ArrowDownCircle, RotateCcw, Trash2, Plus,
  ShieldCheck, Calendar, FileText, MapPin, Tag, X,
} from 'lucide-react'
import { formatBrDate, formatCurrency, statusInfo, WRITE_OFF_REASONS, reasonLabel } from '@/lib/patrimony'
import { useAuthStore } from '@/stores/auth'

interface MaintenanceRow {
  id: number
  asset_id: number
  sent_date: string
  expected_return?: string | null
  returned_date?: string | null
  provider_name?: string | null
  provider_address?: string | null
  provider_phone?: string | null
  provider_deadline?: string | null
  service_warranty_until?: string | null
  cost?: number | null
  notes?: string | null
}

interface AssetDetail {
  id: number
  code: string
  name: string
  description?: string | null
  acquisition_date?: string | null
  value?: number | null
  invoice_number?: string | null
  status: string
  maintenance_interval_months?: number | null
  last_maintenance_date?: string | null
  next_maintenance_due?: string | null
  warranty_until?: string | null
  decommission_reason?: string | null
  decommission_other?: string | null
  decommission_date?: string | null
  notes?: string | null
  category?: { id: number; name: string } | null
  location?: { id: number; name: string } | null
  location_other?: string | null
  maintenances: MaintenanceRow[]
}

export function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { hasRole } = useAuthStore()
  const canDelete = hasRole('super_admin', 'pastor')

  const [showMaintForm, setShowMaintForm] = useState(false)
  const [returnTarget, setReturnTarget] = useState<MaintenanceRow | null>(null)
  const [showWriteOff, setShowWriteOff] = useState(false)

  const { data: asset, isLoading } = useQuery<AssetDetail>({
    queryKey: ['asset', id],
    queryFn: () => api.get(`/api/patrimony/${id}`).then((r) => r.data),
  })

  const reactivate = useMutation({
    mutationFn: () => api.post(`/api/patrimony/${id}/reactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', id] })
      qc.invalidateQueries({ queryKey: ['assets'] })
    },
  })

  const deleteMaint = useMutation({
    mutationFn: (mid: number) => api.delete(`/api/patrimony/${id}/maintenances/${mid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asset', id] }),
  })

  if (isLoading || !asset) {
    return <div className="animate-pulse h-96 bg-muted rounded-xl" />
  }

  const s = statusInfo(asset.status)
  const inMaintenance = asset.status === 'in_maintenance'
  const decommissioned = asset.status === 'decommissioned'
  const openMaint = asset.maintenances.find((m) => !m.returned_date) ?? null

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/patrimonio/bens')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 flex-wrap">
              {asset.name}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${s.color} inline-flex items-center gap-1`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground font-mono">{asset.code}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!decommissioned && !inMaintenance && (
            <button
              onClick={() => setShowMaintForm(true)}
              className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 inline-flex items-center gap-1.5"
            >
              <Wrench className="w-4 h-4" /> Enviar p/ manutenção
            </button>
          )}
          {!decommissioned && canDelete && (
            <button
              onClick={() => setShowWriteOff(true)}
              className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 inline-flex items-center gap-1.5"
            >
              <ArrowDownCircle className="w-4 h-4" /> Dar baixa
            </button>
          )}
          {decommissioned && canDelete && (
            <button
              onClick={() => reactivate.mutate()}
              disabled={reactivate.isPending}
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" /> Reativar
            </button>
          )}
          <Link
            to="editar"
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1.5"
          >
            <Edit2 className="w-4 h-4" /> Editar
          </Link>
        </div>
      </div>

      {decommissioned && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
          <p className="font-semibold text-red-800">
            Bem baixado em {formatBrDate(asset.decommission_date)}
          </p>
          <p className="text-red-700">
            Motivo: <strong>{reasonLabel(asset.decommission_reason)}</strong>
            {asset.decommission_other && <> — {asset.decommission_other}</>}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border rounded-xl p-5 space-y-2">
          <h3 className="font-semibold text-sm text-blue-700 mb-2">Identificação</h3>
          <Row icon={<Tag className="w-4 h-4" />} label="Categoria" value={asset.category?.name} />
          <Row icon={<MapPin className="w-4 h-4" />} label="Local" value={asset.location?.name ?? asset.location_other} />
          <Row icon={<Calendar className="w-4 h-4" />} label="Data de aquisição" value={formatBrDate(asset.acquisition_date)} />
          <Row icon={<FileText className="w-4 h-4" />} label="Nota fiscal" value={asset.invoice_number} />
          <Row icon={<ShieldCheck className="w-4 h-4" />} label="Garantia até" value={formatBrDate(asset.warranty_until)} />
        </div>

        <div className="bg-white border rounded-xl p-5 space-y-2">
          <h3 className="font-semibold text-sm text-blue-700 mb-2">Valores e manutenção</h3>
          <Row label="Valor de aquisição" value={formatCurrency(asset.value)} />
          <Row label="Manutenção a cada" value={asset.maintenance_interval_months ? `${asset.maintenance_interval_months} mês(es)` : null} />
          <Row label="Última manutenção" value={formatBrDate(asset.last_maintenance_date)} />
          <Row label="Próxima manutenção" value={formatBrDate(asset.next_maintenance_due)} highlight={!!asset.next_maintenance_due} />
        </div>
      </div>

      {asset.description && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-sm text-blue-700 mb-2">Descrição</h3>
          <p className="text-sm whitespace-pre-wrap">{asset.description}</p>
        </div>
      )}

      {asset.notes && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold text-sm text-blue-700 mb-2">Observações</h3>
          <p className="text-sm whitespace-pre-wrap">{asset.notes}</p>
        </div>
      )}

      {/* Histórico de manutenções */}
      <section className="bg-white border rounded-xl p-5">
        <header className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-blue-700">Histórico de manutenções ({asset.maintenances.length})</h3>
          {!decommissioned && !inMaintenance && (
            <button
              onClick={() => setShowMaintForm(true)}
              className="text-xs px-2 py-1 border rounded hover:bg-gray-50 inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Nova manutenção
            </button>
          )}
        </header>
        {asset.maintenances.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhuma manutenção registrada.</p>
        ) : (
          <ul className="space-y-3">
            {asset.maintenances.map((m) => (
              <li key={m.id} className={`border rounded-lg p-3 ${!m.returned_date ? 'border-orange-300 bg-orange-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      Saída: {formatBrDate(m.sent_date)}
                      {m.returned_date ? (
                        <span className="ml-2 text-emerald-700">→ Retornou em {formatBrDate(m.returned_date)}</span>
                      ) : (
                        <span className="ml-2 text-orange-700">• Em andamento</span>
                      )}
                    </p>
                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                      {m.provider_name && <p><strong>Prestador:</strong> {m.provider_name} {m.provider_phone && `• ${m.provider_phone}`}</p>}
                      {m.provider_address && <p><strong>Endereço:</strong> {m.provider_address}</p>}
                      {m.provider_deadline && <p><strong>Prazo informado:</strong> {m.provider_deadline}</p>}
                      {m.expected_return && <p><strong>Previsão de retorno:</strong> {formatBrDate(m.expected_return)}</p>}
                      {m.service_warranty_until && <p><strong>Garantia da manutenção:</strong> até {formatBrDate(m.service_warranty_until)}</p>}
                      {m.cost != null && <p><strong>Custo:</strong> {formatCurrency(m.cost)}</p>}
                      {m.notes && <p className="whitespace-pre-wrap"><strong>Notas:</strong> {m.notes}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!m.returned_date && (
                      <button
                        onClick={() => setReturnTarget(m)}
                        className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                      >
                        Registrar retorno
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => { if (confirm('Excluir este registro de manutenção?')) deleteMaint.mutate(m.id) }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showMaintForm && asset && (
        <MaintenanceFormModal
          assetId={asset.id}
          existing={openMaint}
          onClose={() => setShowMaintForm(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['asset', id] })
            qc.invalidateQueries({ queryKey: ['patrimony-dashboard'] })
            setShowMaintForm(false)
          }}
        />
      )}

      {returnTarget && asset && (
        <ReturnMaintenanceModal
          assetId={asset.id}
          maintenance={returnTarget}
          onClose={() => setReturnTarget(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['asset', id] })
            qc.invalidateQueries({ queryKey: ['assets'] })
            qc.invalidateQueries({ queryKey: ['patrimony-dashboard'] })
            setReturnTarget(null)
          }}
        />
      )}

      {showWriteOff && asset && (
        <WriteOffModal
          assetId={asset.id}
          onClose={() => setShowWriteOff(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['asset', id] })
            qc.invalidateQueries({ queryKey: ['assets'] })
            qc.invalidateQueries({ queryKey: ['patrimony-dashboard'] })
            setShowWriteOff(false)
          }}
        />
      )}
    </div>
  )
}

function Row({ icon, label, value, highlight }: { icon?: React.ReactNode; label: string; value?: string | number | null; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-dashed last:border-0 text-sm">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-muted-foreground w-40 shrink-0">{label}</span>
      <span className={`font-medium ${highlight ? 'text-amber-700' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

// ----- Modais -----

function MaintenanceFormModal({
  assetId, existing, onClose, onSaved,
}: { assetId: number; existing: MaintenanceRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    sent_date: existing?.sent_date ?? new Date().toISOString().slice(0, 10),
    expected_return: existing?.expected_return ?? '',
    provider_name: existing?.provider_name ?? '',
    provider_address: existing?.provider_address ?? '',
    provider_phone: existing?.provider_phone ?? '',
    provider_deadline: existing?.provider_deadline ?? '',
    notes: existing?.notes ?? '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        sent_date: form.sent_date,
        expected_return: form.expected_return || null,
        provider_name: form.provider_name || null,
        provider_address: form.provider_address || null,
        provider_phone: form.provider_phone || null,
        provider_deadline: form.provider_deadline || null,
        notes: form.notes || null,
      }
      return existing
        ? api.put(`/api/patrimony/${assetId}/maintenances/${existing.id}`, payload)
        : api.post(`/api/patrimony/${assetId}/maintenances`, payload)
    },
    onSuccess: onSaved,
    onError: (e) => setError(getErrorMessage(e, 'Erro ao salvar')),
  })

  return (
    <Modal title={existing ? 'Editar manutenção em andamento' : 'Enviar para manutenção'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de saída *">
            <input type="date" value={form.sent_date}
              onChange={(e) => setForm({ ...form, sent_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="Previsão de retorno">
            <input type="date" value={form.expected_return}
              onChange={(e) => setForm({ ...form, expected_return: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
        </div>
        <Field label="Prestador / Loja">
          <input type="text" value={form.provider_name}
            onChange={(e) => setForm({ ...form, provider_name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <Field label="Endereço">
          <input type="text" value={form.provider_address}
            onChange={(e) => setForm({ ...form, provider_address: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <input type="tel" value={form.provider_phone}
              onChange={(e) => setForm({ ...form, provider_phone: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="Prazo informado">
            <input type="text" value={form.provider_deadline}
              onChange={(e) => setForm({ ...form, provider_deadline: e.target.value })}
              placeholder="Ex: 7 dias úteis"
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
        </div>
        <Field label="Observações">
          <textarea value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </Field>

        {error && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>}

        <ModalFooter
          onClose={onClose}
          onSubmit={() => mutation.mutate()}
          loading={mutation.isPending}
          submitLabel={existing ? 'Atualizar' : 'Enviar'}
        />
      </div>
    </Modal>
  )
}

function ReturnMaintenanceModal({
  assetId, maintenance, onClose, onSaved,
}: { assetId: number; maintenance: MaintenanceRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    returned_date: new Date().toISOString().slice(0, 10),
    service_warranty_until: '',
    cost: '',
    notes: maintenance.notes ?? '',
    new_status: 'active_in_use',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/api/patrimony/${assetId}/maintenances/${maintenance.id}/return`, {
        returned_date: form.returned_date,
        service_warranty_until: form.service_warranty_until || null,
        cost: form.cost !== '' ? Number(form.cost) : null,
        notes: form.notes || null,
        new_status: form.new_status,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(getErrorMessage(e, 'Erro ao salvar')),
  })

  return (
    <Modal title="Registrar retorno da manutenção" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data de retorno *">
            <input type="date" value={form.returned_date}
              onChange={(e) => setForm({ ...form, returned_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="Garantia da manutenção até">
            <input type="date" value={form.service_warranty_until}
              onChange={(e) => setForm({ ...form, service_warranty_until: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Custo (R$)">
            <input type="number" step="0.01" value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </Field>
          <Field label="Volta ao status">
            <select value={form.new_status}
              onChange={(e) => setForm({ ...form, new_status: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
              <option value="active_in_use">Ativo em uso</option>
              <option value="active_reserve">Ativo / Reserva</option>
            </select>
          </Field>
        </div>
        <Field label="Observações">
          <textarea value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </Field>

        {error && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>}

        <ModalFooter
          onClose={onClose}
          onSubmit={() => mutation.mutate()}
          loading={mutation.isPending}
          submitLabel="Registrar retorno"
          submitClass="bg-emerald-600 hover:bg-emerald-700"
        />
      </div>
    </Modal>
  )
}

function WriteOffModal({
  assetId, onClose, onSaved,
}: { assetId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    reason: 'broken' as typeof WRITE_OFF_REASONS[number]['value'],
    other_text: '',
    decommission_date: new Date().toISOString().slice(0, 10),
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/api/patrimony/${assetId}/write-off`, {
        reason: form.reason,
        other_text: form.other_text || null,
        decommission_date: form.decommission_date || null,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(getErrorMessage(e, 'Erro ao registrar baixa')),
  })

  return (
    <Modal title="Dar baixa no bem" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
          O bem ficará marcado como <strong>baixado/inativo</strong>. Você poderá reativá-lo depois.
        </p>
        <Field label="Motivo *">
          <select value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value as typeof form.reason })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500">
            {WRITE_OFF_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </Field>
        {form.reason === 'other' && (
          <Field label="Justificativa *">
            <textarea value={form.other_text}
              onChange={(e) => setForm({ ...form, other_text: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </Field>
        )}
        <Field label="Data da baixa">
          <input type="date" value={form.decommission_date}
            onChange={(e) => setForm({ ...form, decommission_date: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500" />
        </Field>

        {error && <p className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">{error}</p>}

        <ModalFooter
          onClose={onClose}
          onSubmit={() => mutation.mutate()}
          loading={mutation.isPending}
          submitLabel="Confirmar baixa"
          submitClass="bg-red-600 hover:bg-red-700"
        />
      </div>
    </Modal>
  )
}

// ----- Helpers de UI -----
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
    </div>
  )
}
function ModalFooter({
  onClose, onSubmit, loading, submitLabel, submitClass = 'bg-blue-600 hover:bg-blue-700',
}: { onClose: () => void; onSubmit: () => void; loading?: boolean; submitLabel: string; submitClass?: string }) {
  return (
    <div className="flex gap-3 justify-end pt-2 border-t">
      <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
      <button
        onClick={onSubmit}
        disabled={loading}
        className={`px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${submitClass}`}
      >
        {loading ? 'Salvando...' : submitLabel}
      </button>
    </div>
  )
}
