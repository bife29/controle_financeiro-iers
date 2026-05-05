import { Routes, Route } from 'react-router-dom'
import { FinancialHub } from './FinancialHub'
import { TransactionsList } from './TransactionsList'
import { TransactionForm } from './TransactionForm'
import { ProjectsList } from './ProjectsList'
import { ProjectForm } from './ProjectForm'
import { ProjectDetail } from './ProjectDetail'
import { ImportPage } from './ImportPage'
import { CategoriesList } from './CategoriesList'

export function FinancialPage() {
  return (
    <Routes>
      <Route index element={<FinancialHub />} />
      <Route path="transacoes" element={<TransactionsList />} />
      <Route path="transacoes/nova" element={<TransactionForm />} />
      <Route path="transacoes/:id/editar" element={<TransactionForm />} />
      <Route path="projetos" element={<ProjectsList />} />
      <Route path="projetos/novo" element={<ProjectForm />} />
      <Route path="projetos/:id" element={<ProjectDetail />} />
      <Route path="projetos/:id/editar" element={<ProjectForm />} />
      <Route path="importacao" element={<ImportPage />} />
      <Route path="categorias" element={<CategoriesList />} />
    </Routes>
  )
}
