import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const API_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
})

/**
 * Extrai uma mensagem de erro segura para renderização a partir de uma resposta
 * de erro do backend. FastAPI/Pydantic retornam 422 com `detail` como Array
 * de objetos — renderizar isso direto no JSX provoca crash ("Objects are not
 * valid as a React child"). Esta função normaliza para string em qualquer caso.
 */
export function getErrorMessage(err: unknown, fallback = 'Erro inesperado'): string {
  // axios error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const detail = (err as any)?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === 'string') return d
        if (d && typeof d === 'object') {
          const loc = Array.isArray(d.loc) ? d.loc.filter((x: unknown) => x !== 'body').join('.') : ''
          const msg = d.msg || d.message || ''
          return loc ? `${loc}: ${msg}` : msg
        }
        return String(d)
      })
      .filter(Boolean)
      .join('; ') || fallback
  }
  if (detail && typeof detail === 'object') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (detail as any).msg || (detail as any).message || JSON.stringify(detail)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((err as any)?.message) return (err as any).message
  return fallback
}

// Interceptor para adicionar token em todas as requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor para tratar 401 (token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
