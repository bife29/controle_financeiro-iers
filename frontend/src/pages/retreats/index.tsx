import { Routes, Route } from 'react-router-dom'
import { RetreatsList } from './RetreatsList'
import { RetreatForm } from './RetreatForm'
import { RetreatDetail } from './RetreatDetail'
import { RetreatParticipants } from './RetreatParticipants'
import { ParticipantPayments } from './ParticipantPayments'

export function RetreatsPage() {
  return (
    <Routes>
      <Route index element={<RetreatsList />} />
      <Route path="novo" element={<RetreatForm />} />
      <Route path=":id" element={<RetreatDetail />} />
      <Route path=":id/editar" element={<RetreatForm />} />
      <Route path=":id/participantes" element={<RetreatParticipants />} />
      <Route path=":id/participantes/:participantId/pagamentos" element={<ParticipantPayments />} />
    </Routes>
  )
}
