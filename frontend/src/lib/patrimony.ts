export type AssetStatus = 'active_in_use' | 'active_reserve' | 'in_maintenance' | 'decommissioned'

export const ASSET_STATUSES: { value: AssetStatus; label: string; color: string; dot: string }[] = [
  { value: 'active_in_use', label: 'Ativo em uso', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', dot: 'bg-emerald-500' },
  { value: 'active_reserve', label: 'Ativo / Reserva', color: 'bg-blue-100 text-blue-800 border-blue-300', dot: 'bg-blue-500' },
  { value: 'in_maintenance', label: 'Em manutenção', color: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-orange-500' },
  { value: 'decommissioned', label: 'Baixado / Inativo', color: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-500' },
]

export function statusInfo(s?: string | null) {
  return ASSET_STATUSES.find((x) => x.value === s) ?? {
    value: 'active_in_use' as AssetStatus,
    label: s ?? '—',
    color: 'bg-gray-100 text-gray-700 border-gray-300',
    dot: 'bg-gray-400',
  }
}

export const WRITE_OFF_REASONS = [
  { value: 'defect', label: 'Defeito' },
  { value: 'broken', label: 'Quebra' },
  { value: 'theft', label: 'Roubo' },
  { value: 'loss', label: 'Perda' },
  { value: 'other', label: 'Outro' },
] as const

export function reasonLabel(r?: string | null): string {
  return WRITE_OFF_REASONS.find((x) => x.value === r)?.label ?? '—'
}

export function formatCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatBrDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
