import { Routes, Route, Navigate } from 'react-router-dom'
import { PatrimonyHome } from './PatrimonyHome'
import { AssetsList } from './AssetsList'
import { AssetForm } from './AssetForm'
import { AssetDetail } from './AssetDetail'
import { PatrimonySettings } from './PatrimonySettings'

export function PatrimonyPage() {
  return (
    <Routes>
      <Route index element={<PatrimonyHome />} />
      <Route path="bens" element={<AssetsList />} />
      <Route path="bens/novo" element={<AssetForm />} />
      <Route path="bens/:id" element={<AssetDetail />} />
      <Route path="bens/:id/editar" element={<AssetForm />} />
      <Route path="configuracoes" element={<PatrimonySettings />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  )
}
