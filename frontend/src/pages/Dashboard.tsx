import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useState } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Users,
  ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

interface FinancialSummary {
  total_income: number
  total_expense: number
  balance: number
  total_transactions: number
  pending_receivables: number
  pending_payables: number
}

interface Project {
  id: number
  name: string
}

const PIE_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be185d', '#65a30d']

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [selectedProject, setSelectedProject] = useState<number | undefined>(undefined)
  const canSeeFinancial = ['super_admin', 'financeiro', 'pastor'].includes(user?.role || '')

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects-list'],
    queryFn: () => api.get('/api/financial/projects').then((r) => r.data),
    enabled: canSeeFinancial,
  })

  const { data: summary, isLoading } = useQuery<FinancialSummary>({
    queryKey: ['financial-dashboard', selectedProject],
    queryFn: () => api.get('/api/financial/dashboard', { params: { project_id: selectedProject } }).then((r) => r.data),
    enabled: canSeeFinancial,
  })

  const { data: memberCount } = useQuery({
    queryKey: ['member-count'],
    queryFn: () => api.get('/api/members/count').then((r) => r.data),
  })

  const { data: monthlyData } = useQuery<{ month: string; entradas: number; saidas: number }[]>({
    queryKey: ['charts-monthly', selectedProject],
    queryFn: () => api.get('/api/financial/charts/monthly', { params: { project_id: selectedProject } }).then((r) => r.data),
    enabled: canSeeFinancial,
  })

  const { data: projectData } = useQuery<{ name: string; value: number }[]>({
    queryKey: ['charts-by-project'],
    queryFn: () => api.get('/api/financial/charts/by-project').then((r) => r.data),
    enabled: canSeeFinancial && !selectedProject,
  })

  const { data: categoryData } = useQuery<{ name: string; type: string; value: number }[]>({
    queryKey: ['charts-by-category', selectedProject],
    queryFn: () => api.get('/api/financial/charts/by-category', { params: { project_id: selectedProject } }).then((r) => r.data),
    enabled: canSeeFinancial,
  })

  const { data: paymentMethodData } = useQuery<{ name: string; value: number; count: number }[]>({
    queryKey: ['charts-by-payment-method', selectedProject],
    queryFn: () => api.get('/api/financial/charts/by-payment-method', { params: { project_id: selectedProject } }).then((r) => r.data),
    enabled: canSeeFinancial,
  })

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: 'Total Entradas',
      value: formatCurrency(summary?.total_income || 0),
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Total Saídas',
      value: formatCurrency(summary?.total_expense || 0),
      icon: TrendingDown,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      title: 'Saldo',
      value: formatCurrency(summary?.balance || 0),
      icon: DollarSign,
      color: (summary?.balance || 0) >= 0 ? 'text-blue-600' : 'text-red-600',
      bg: (summary?.balance || 0) >= 0 ? 'bg-blue-50' : 'bg-red-50',
    },
    {
      title: 'Membros Ativos',
      value: memberCount?.count?.toString() || '0',
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bem-vindo, {user?.name}
          </p>
        </div>

        {/* Filtro Global por Projeto */}
        {canSeeFinancial && projects && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedProject || ''}
              onChange={(e) => setSelectedProject(e.target.value ? Number(e.target.value) : undefined)}
              className="border rounded-lg px-3 py-2 text-sm bg-card min-w-[200px]"
            >
              <option value="">Todos os projetos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-card rounded-xl border p-5 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
              <div className={cn("p-2 rounded-lg", card.bg)}>
                <card.icon className={cn("w-4 h-4", card.color)} />
              </div>
            </div>
            <p className={cn("text-2xl font-bold mt-2", card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Resumo de pendências */}
      {summary && (summary.pending_receivables > 0 || summary.pending_payables > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-amber-600" />
              <span className="font-medium text-amber-800">A Receber (Pendente)</span>
            </div>
            <p className="text-xl font-bold text-amber-700 mt-1">
              {formatCurrency(summary.pending_receivables)}
            </p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-orange-800">A Pagar (Pendente)</span>
            </div>
            <p className="text-xl font-bold text-orange-700 mt-1">
              {formatCurrency(summary.pending_payables)}
            </p>
          </div>
        </div>
      )}

      {/* Gráficos - Linha 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border p-6 min-h-[300px]">
          <h3 className="font-semibold mb-4">Entradas vs Saídas (Mensal)</h3>
          {monthlyData && monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px]">
              <p className="text-muted-foreground text-sm">Nenhuma transação no período</p>
            </div>
          )}
        </div>

        {/* Gráfico por Categoria */}
        <div className="bg-card rounded-xl border p-6 min-h-[300px]">
          <h3 className="font-semibold mb-4">Acumulado por Categoria</h3>
          {categoryData && categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]}>
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.type === 'Entrada' ? '#16a34a' : '#dc2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px]">
              <p className="text-muted-foreground text-sm">Nenhuma transação categorizada</p>
            </div>
          )}
        </div>
      </div>

      {/* Gráficos - Linha 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Por Forma de Pagamento */}
        <div className="bg-card rounded-xl border p-6 min-h-[300px]">
          <h3 className="font-semibold mb-4">Por Forma de Pagamento</h3>
          {paymentMethodData && paymentMethodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {paymentMethodData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px]">
              <p className="text-muted-foreground text-sm">Nenhuma transação registrada</p>
            </div>
          )}
        </div>

        {/* Distribuição por Projeto */}
        {!selectedProject && (
          <div className="bg-card rounded-xl border p-6 min-h-[300px]">
            <h3 className="font-semibold mb-4">Distribuição por Projeto</h3>
            {projectData && projectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={projectData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {projectData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px]">
                <p className="text-muted-foreground text-sm">Nenhum projeto com transações</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
