import { Routes, Route, Navigate } from 'react-router-dom'
import { ShoppingHome } from './ShoppingHome'
import { ListsList } from './ListsList'
import { ListDetail } from './ListDetail'
import { RequestsList } from './RequestsList'
import { RequestForm } from './RequestForm'
import { RequestDetail } from './RequestDetail'

export function ShoppingPage() {
  return (
    <Routes>
      <Route index element={<ShoppingHome />} />
      <Route path="listas" element={<ListsList />} />
      <Route path="listas/:id" element={<ListDetail />} />
      <Route path="pedidos" element={<RequestsList />} />
      <Route path="pedidos/novo" element={<RequestForm />} />
      <Route path="pedidos/:id" element={<RequestDetail />} />
      <Route path="pedidos/:id/editar" element={<RequestForm />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  )
}
