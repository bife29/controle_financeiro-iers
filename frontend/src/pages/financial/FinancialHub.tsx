import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, Receipt, FolderOpen, Upload, Tag } from 'lucide-react'

interface Summary {
  total_income: number
  total_expense: number
  balance: number
  total_transactions: number
  pending_receivables: number
  pending_payables: number
}

export function FinancialHub() {
  const { data: summary } = useQuery<Summary>({
    queryKey: ['financial-dashboard'],
    queryFn: () => api.get('/api/financial/dashboard').then((r) => r.data),
  })

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestão de transações, projetos e categorias
        </p>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <ArrowUpCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Entradas</span>
            </div>
            <p className="text-xl font-bold">{fmt(summary.total_income)}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <ArrowDownCircle className="w-5 h-5" />
              <span className="text-sm font-medium">Saídas</span>
            </div>
            <p className="text-xl font-bold">{fmt(summary.total_expense)}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-medium">Saldo</span>
            </div>
            <p className={`text-xl font-bold ${summary.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(summary.balance)}
            </p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Receipt className="w-5 h-5" />
              <span className="text-sm font-medium">Transações</span>
            </div>
            <p className="text-xl font-bold">{summary.total_transactions}</p>
          </div>
        </div>
      )}

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/financeiro/transacoes"
          className="bg-card border rounded-xl p-6 hover:shadow-md transition block"
        >
          <Receipt className="w-8 h-8 text-primary mb-3" />
          <h3 className="font-semibold">Transações</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Lançamentos de entrada e saída
          </p>
        </Link>
        <Link
          to="/financeiro/projetos"
          className="bg-card border rounded-xl p-6 hover:shadow-md transition block"
        >
          <FolderOpen className="w-8 h-8 text-primary mb-3" />
          <h3 className="font-semibold">Projetos / Eventos</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Centro de custo por evento
          </p>
        </Link>
        <Link
          to="/financeiro/importacao"
          className="bg-card border rounded-xl p-6 hover:shadow-md transition block"
        >
          <Upload className="w-8 h-8 text-primary mb-3" />
          <h3 className="font-semibold">Importação</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Upload de extrato OFX/CSV
          </p>
        </Link>
        <Link
          to="/financeiro/categorias"
          className="bg-card border rounded-xl p-6 hover:shadow-md transition block"
        >
          <Tag className="w-8 h-8 text-primary mb-3" />
          <h3 className="font-semibold">Categorias</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Tipos de entrada e saída
          </p>
        </Link>
      </div>
    </div>
  )
}
