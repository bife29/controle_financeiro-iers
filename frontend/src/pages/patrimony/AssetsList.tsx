import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Plus, Search, Eye, Edit2, Wrench } from 'lucide-react'
import { ASSET_STATUSES, formatCurrency, formatBrDate, statusInfo } from '@/lib/patrimony'

interface AssetRow {
  id: number
  code: string
  name: string
  acquisition_date?: string | null
  value?: number | null
  status: string
  invoice_number?: string | null
  next_maintenance_due?: string | null
  warranty_until?: string | null
  category?: { id: number; name: string } | null
  location?: { id: number; name: string } | null
  location_other?: string | null
}

interface Cat { id: number; name: string }

export function AssetsList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const status = searchParams.get('status') ?? ''
  const categoryId = searchParams.get('category_id') ?? ''
  const locationId = searchParams.get('location_id') ?? ''

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(searchParams)
    if (v) next.set(k, v); else next.delete(k)
    setSearchParams(next, { replace: true })
  }

  const { data: assets = [], isLoading } = useQuery<AssetRow[]>({
    queryKey: ['assets', search, status, categoryId, locationId],
    queryFn: () =>
      api.get('/api/patrimony', {
        params: {
          search: search || undefined,
          status: status || undefined,
          category_id: categoryId || undefined,
          location_id: locationId || undefined,
        },
      }).then((r) => r.data),
  })

  const { data: categories = [] } = useQuery<Cat[]>({
    queryKey: ['asset-categories'],
    queryFn: () => api.get('/api/patrimony/categories').then((r) => r.data),
  })
  const { data: locations = [] } = useQuery<Cat[]>({
    queryKey: ['asset-locations'],
    queryFn: () => api.get('/api/patrimony/locations').then((r) => r.data),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bens da Igreja</h1>
          <p className="text-sm text-muted-foreground">
            {assets.length} bem(ns) listado(s)
          </p>
        </div>
        <Link
          to="novo"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo bem
        </Link>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => update('search', search)}
            onKeyDown={(e) => e.key === 'Enter' && update('search', search)}
            placeholder="Buscar por código, nome ou NF..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => update('status', e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os status</option>
          {ASSET_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={categoryId}
          onChange={(e) => update('category_id', e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={locationId}
          onChange={(e) => update('location_id', e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos os locais</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Código</th>
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Categoria</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Local</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Valor</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Próx. manut.</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : assets.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum bem encontrado.</td></tr>
              ) : assets.map((a) => {
                const s = statusInfo(a.status)
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link to={`${a.id}`} className="hover:underline">{a.name}</Link>
                      {a.invoice_number && (
                        <p className="text-[10px] text-muted-foreground">NF {a.invoice_number}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {a.category?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {a.location?.name ?? a.location_other ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-right font-mono">
                      {formatCurrency(a.value)}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-xs">
                      {formatBrDate(a.next_maintenance_due)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${s.color} inline-flex items-center gap-1`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <Link
                          to={`${a.id}`}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded inline-flex items-center gap-1"
                          title="Ver detalhes"
                          data-testid={`asset-detail-${a.id}`}
                        >
                          <Eye className="w-3.5 h-3.5" /> Detalhes
                        </Link>
                        {a.status !== 'in_maintenance' && a.status !== 'decommissioned' && (
                          <Link
                            to={`${a.id}?action=maintenance`}
                            className="px-2 py-1 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 rounded inline-flex items-center gap-1"
                            title="Enviar para manutenção"
                            data-testid={`asset-maintenance-${a.id}`}
                          >
                            <Wrench className="w-3.5 h-3.5" /> Manutenção
                          </Link>
                        )}
                        <Link
                          to={`${a.id}/editar`}
                          className="p-1.5 hover:bg-gray-100 rounded"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
