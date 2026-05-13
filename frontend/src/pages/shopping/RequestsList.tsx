import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Plus, Eye, ClipboardList } from 'lucide-react'

interface Request {
  id: number
  title: string
  supplier?: string | null
  status: string
  items_count: number
  total_estimated: number
  total_final: number
  created_at?: string | null
}

const STATUS_BADGE: Record<string, string> = {
  Pendente: 'bg-amber-100 text-amber-800',
  Aprovado: 'bg-blue-100 text-blue-800',
  Rejeitado: 'bg-red-100 text-red-800',
  Recebido: 'bg-emerald-100 text-emerald-800',
  Cancelado: 'bg-gray-100 text-gray-700',
}

const STATUS_LIST = ['Pendente', 'Aprovado', 'Recebido', 'Rejeitado', 'Cancelado']

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function RequestsList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? ''

  const setStatus = (v: string) => {
    const next = new URLSearchParams(searchParams)
    if (v) next.set('status', v); else next.delete('status')
    setSearchParams(next, { replace: true })
  }

  const { data: requests = [], isLoading } = useQuery<Request[]>({
    queryKey: ['shopping-requests', status],
    queryFn: () =>
      api.get('/api/shopping/requests', { params: { status: status || undefined } }).then((r) => r.data),
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos de Compra</h1>
          <p className="text-sm text-muted-foreground">{requests.length} pedido(s)</p>
        </div>
        <Link
          to="novo"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Novo pedido
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatus('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${!status ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
        >Todos</button>
        {STATUS_LIST.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${status === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
          >{s}</button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : requests.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-sm text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
          Nenhum pedido encontrado.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Título</th>
                <th className="text-left px-3 py-2">Fornecedor</th>
                <th className="text-left px-3 py-2 w-28">Status</th>
                <th className="text-right px-3 py-2 w-20">Itens</th>
                <th className="text-right px-3 py-2 w-32">Estimado</th>
                <th className="text-right px-3 py-2 w-32">Final</th>
                <th className="px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link to={`${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                  </td>
                  <td className="px-3 py-2">{r.supplier || '-'}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{r.items_count}</td>
                  <td className="px-3 py-2 text-right">{formatBRL(r.total_estimated)}</td>
                  <td className="px-3 py-2 text-right">{r.total_final > 0 ? formatBRL(r.total_final) : '-'}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`${r.id}`} className="text-blue-700 hover:bg-blue-50 p-1 rounded inline-block">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
