import { Routes, Route, Navigate } from 'react-router-dom'
import { SecretariaHome } from './SecretariaHome'
import { CalendarPage } from './CalendarPage'
import { EventsList } from './EventsList'
import { EventForm } from './EventForm'
import { WhatsappGroupsList } from './WhatsappGroupsList'
import { MessageTemplatesList } from './MessageTemplatesList'
import { SecretariaSettings } from './SecretariaSettings'

export function SecretariaPage() {
  return (
    <Routes>
      <Route index element={<SecretariaHome />} />
      <Route path="calendario" element={<CalendarPage />} />
      <Route path="eventos" element={<EventsList />} />
      <Route path="eventos/novo" element={<EventForm />} />
      <Route path="eventos/:id" element={<EventForm />} />
      <Route path="grupos-whatsapp" element={<WhatsappGroupsList />} />
      <Route path="mensagens" element={<MessageTemplatesList />} />
      <Route path="configuracoes" element={<SecretariaSettings />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  )
}
