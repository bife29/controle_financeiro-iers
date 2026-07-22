import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

interface NotificationItem {
  id: number
  user_id: number
  type: string
  title: string
  message?: string | null
  link?: string | null
  is_read: boolean
  created_at?: string | null
}

interface NotificationList {
  items: NotificationItem[]
  unread_count: number
}

// Altura estimada máxima do dropdown (header ~40px + max-h-96 = 384px + borda + shadow).
// Usado para decidir se abre pra baixo ou pra cima quando não há espaço.
// Ver SPEC-002 seção 13.
const DROPDOWN_ESTIMATED_HEIGHT = 440
const DROPDOWN_ESTIMATED_WIDTH = 320  // w-80

function relTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString('pt-BR')
}

export function NotificationBell({ inverted = false }: { inverted?: boolean }) {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom')
  const [align, setAlign] = useState<'left' | 'right'>('right')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { data } = useQuery<NotificationList>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/notifications', { params: { limit: 15 } }).then((r) => r.data),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })

  const markRead = useMutation({
    mutationFn: (id: number) => api.patch(`/api/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAll = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  // Decide dinamicamente se o dropdown abre pra baixo (top-full) ou pra cima
  // (bottom-full) e se alinha à direita ou à esquerda do botão com base no
  // espaço disponível no viewport. Necessário porque o sino do sidebar
  // (desktop) fica no rodapé-esquerda da tela — se abrir pra baixo, fica
  // cortado; se alinhar à direita com `right-0`, sai pela esquerda.
  // Ver SPEC-002 seção 13.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    function decide() {
      if (!buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      // Vertical: se abaixo não cabe mas acima cabe → abre pra cima.
      if (spaceBelow < DROPDOWN_ESTIMATED_HEIGHT && spaceAbove > spaceBelow) {
        setPlacement('top')
      } else {
        setPlacement('bottom')
      }
      // Horizontal: com right-0, dropdown estende para a esquerda do botão.
      // Se essa extensão passa da borda esquerda do viewport, alinhar left-0.
      const spaceLeftOfButtonRight = rect.right
      if (spaceLeftOfButtonRight < DROPDOWN_ESTIMATED_WIDTH) {
        setAlign('left')
      } else {
        setAlign('right')
      }
    }
    decide()
    window.addEventListener('resize', decide)
    return () => window.removeEventListener('resize', decide)
  }, [open])

  const unread = data?.unread_count ?? 0
  const items = data?.items ?? []

  function handleItemClick(n: NotificationItem) {
    if (!n.is_read) markRead.mutate(n.id)
    if (n.link) {
      setOpen(false)
      navigate(n.link)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-lg transition ${
          inverted ? 'hover:bg-white/10 text-white' : 'hover:bg-muted text-foreground'
        }`}
        aria-label="Notificações"
        data-testid="notifications-bell"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center"
            data-testid="notifications-unread-badge"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute w-80 max-w-[90vw] bg-white text-gray-900 border rounded-xl shadow-xl z-50 overflow-hidden ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } ${align === 'left' ? 'left-0' : 'right-0'}`}
          data-testid="notifications-dropdown"
          data-placement={placement}
          data-align={align}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
            <h3 className="font-semibold text-sm">Notificações</h3>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
                data-testid="notifications-mark-all"
              >
                <CheckCheck className="w-3 h-3" /> Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-center text-muted-foreground">
                Nenhuma notificação
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`w-full text-left px-4 py-3 border-b last:border-0 hover:bg-blue-50/60 transition ${
                    !n.is_read ? 'bg-blue-50/40' : ''
                  }`}
                  data-testid={`notification-${n.id}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {n.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">{relTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span title="Não lida"><Check className="w-3 h-3 text-blue-600 shrink-0 mt-1" /></span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
