import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ShoppingCart, ListChecks, Plus, ClipboardList, ArrowRight, CheckCircle2, XCircle, Clock, PackageCheck } from 'lucide-react'

interface Dashboard {
  by_status: Record<string, number>
  received_month_total: number
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  Pendente: { label: 'Pendentes', color: 'amber', icon: Clock },
  Aprovado: { label: 'Aprovados', color: 'blue', icon: CheckCircle2 },
  Rejeitado: { label: 'Rejeitados', color: 'red', icon: XCircle },
  Recebido: { label: 'Recebidos', color: 'emerald', icon: PackageCheck },
  Cancelado: { label: 'Cancelados', color: 'gray', icon: XCircle },
}

const COLOR_BG: Record<string, string> = {
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-red-50 text-red-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  gray: 'bg-gray-50 text-gray-700',
}

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ShoppingHome() {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['shopping-dashboard'],
    queryFn: () => api.get('/api/shopping/dashboard').then((r) => r.data),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Listas de compras, pedidos e fluxo de aprovação.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="listas"
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            <ListChecks className="w-4 h-4" /> Listas
          </Link>
          <Link
            to="pedidos"
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
          >
            <ClipboardList className="w-4 h-4" /> Pedidos
          </Link>
          <Link
            to="pedidos/novo"
            className="px-3 py-2 rounded-lg bg-white border text-sm hover:bg-gray-50 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo pedido
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(STATUS_META).map(([k, meta]) => {
              const Icon = meta.icon
              return (
                <Link
                  key={k}
                  to={`pedidos?status=${k}`}
                  className="bg-white border rounded-xl p-4 hover:shadow transition"
                >
                  <span className={`text-xs font-medium px-2 py-1 inline-flex items-center gap-1 rounded ${COLOR_BG[meta.color]}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                  <p className="text-2xl font-bold mt-2">{data?.by_status[k] ?? 0}</p>
                </Link>
              )
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-xl p-5">
              <p className="text-sm opacity-90 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Total recebido este mês
              </p>
              <p className="text-3xl font-bold mt-2">{formatBRL(data?.received_month_total ?? 0)}</p>
              <p className="text-xs opacity-80 mt-1">
                Soma das transações geradas a partir de pedidos recebidos no mês corrente.
              </p>
            </section>

            <section className="bg-white border rounded-xl p-5">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Como funciona
              </h2>
              <ol className="text-sm space-y-2 list-decimal list-inside text-gray-700">
                <li>Crie <strong>listas</strong> nomeadas (ex.: Cozinha, Limpeza) e adicione itens.</li>
                <li>A partir de uma lista, <strong>gere um pedido</strong> com os itens pendentes.</li>
                <li>Outro usuário com permissão <strong>aprova</strong> ou rejeita o pedido.</li>
                <li>Após aprovado, registre o <strong>recebimento</strong> com os preços finais — gera uma <strong>Saída</strong> no Financeiro automaticamente.</li>
              </ol>
              <Link to="listas" className="mt-4 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
                Começar pelas listas <ArrowRight className="w-3 h-3" />
              </Link>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
