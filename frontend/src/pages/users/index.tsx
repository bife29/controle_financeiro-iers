import { Routes, Route } from 'react-router-dom'
import { UsersList } from './UsersList'
import { UserForm } from './UserForm'
import { ResetData } from './ResetData'

export function UsersPage() {
  return (
    <Routes>
      <Route index element={<UsersList />} />
      <Route path="novo" element={<UserForm />} />
      <Route path=":id/editar" element={<UserForm />} />
      <Route path="limpar-dados" element={<ResetData />} />
    </Routes>
  )
}
