import { Routes, Route } from 'react-router-dom'
import { MembersList } from './MembersList'
import { MemberForm } from './MemberForm'
import { MemberDetail } from './MemberDetail'

export function MembersPage() {
  return (
    <Routes>
      <Route index element={<MembersList />} />
      <Route path="novo" element={<MemberForm />} />
      <Route path=":id" element={<MemberDetail />} />
      <Route path=":id/editar" element={<MemberForm />} />
    </Routes>
  )
}
