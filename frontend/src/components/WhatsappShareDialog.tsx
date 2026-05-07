import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  copyToClipboard,
  openWhatsappIndividual,
  openWhatsappWeb,
  renderTemplate,
} from '@/lib/whatsapp'
import { X, Copy, Send, Globe, Check, Phone } from 'lucide-react'

interface WhatsappGroup {
  id: number
  name: string
  kind?: string | null
  invite_link?: string | null
}
interface MessageTemplate {
  id: number
  kind: string
  title: string
  body: string
  is_default: boolean
}
interface Settings {
  secretary_phone?: string | null
  church_name?: string | null
}

export interface WhatsappShareDialogProps {
  open: boolean
  onClose: () => void
  /** título exibido no topo do dialog */
  title?: string
  /** Mensagem inicial. Se omitida, lê o template default do `templateKind`. */
  initialMessage?: string
  /** Qual tipo de template carregar como sugestão (ex.: 'birthday'). */
  templateKind?: 'birthday' | 'event_reminder' | 'generic'
  /** Variáveis a substituir no body do template (placeholders {nome}, {idade}…). */
  templateVars?: Record<string, string | number | undefined | null>
  /** Se informado, exibe botão "Enviar para este número" (envio individual). */
  individualPhone?: string | null
  /** Nome a mostrar no botão de envio individual. */
  individualName?: string | null
}

export function WhatsappShareDialog({
  open,
  onClose,
  title = 'Compartilhar via WhatsApp',
  initialMessage,
  templateKind,
  templateVars,
  individualPhone,
  individualName,
}: WhatsappShareDialogProps) {
  const { data: groups = [] } = useQuery<WhatsappGroup[]>({
    queryKey: ['whatsapp-groups'],
    queryFn: () => api.get('/api/secretaria/whatsapp-groups').then((r) => r.data),
    enabled: open,
  })
  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ['message-templates', templateKind],
    queryFn: () =>
      api
        .get('/api/secretaria/message-templates', { params: templateKind ? { kind: templateKind } : {} })
        .then((r) => r.data),
    enabled: open,
  })
  const { data: settings } = useQuery<Settings>({
    queryKey: ['church-settings'],
    queryFn: () => api.get('/api/secretaria/settings').then((r) => r.data),
    enabled: open,
  })

  const [message, setMessage] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initialMessage) {
      setMessage(renderTemplate(initialMessage, templateVars ?? {}))
      return
    }
    const def = templates.find((t) => t.is_default) ?? templates[0]
    if (def) {
      setMessage(renderTemplate(def.body, templateVars ?? {}))
    } else {
      setMessage('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templates.length])

  if (!open) return null

  const useTemplate = (tpl: MessageTemplate) => {
    setMessage(renderTemplate(tpl.body, templateVars ?? {}))
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(message)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleCopyAndOpenWeb = async () => {
    await handleCopy()
    openWhatsappWeb()
  }

  const handleSendIndividual = () => {
    if (!individualPhone) return
    openWhatsappIndividual(individualPhone, message)
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Lembrete sobre limitação técnica */}
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
            <strong>Sobre grupos:</strong> o WhatsApp não permite envio automático em
            grupos. Para grupos, copie a mensagem e cole no WhatsApp Web/Mobile no
            grupo desejado. Para envio individual, abrimos o chat já com a mensagem.
          </div>

          {/* Templates rápidos */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Modelos disponíveis
              </label>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => useTemplate(t)}
                    className="px-3 py-1 text-xs rounded-full border bg-gray-50 hover:bg-gray-100"
                  >
                    {t.title}
                    {t.is_default && (
                      <span className="ml-1 text-emerald-600">★</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mensagem */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Mensagem (edite se necessário)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm font-mono"
              placeholder="Digite sua mensagem ou escolha um modelo"
            />
            {settings?.secretary_phone && (
              <p className="text-xs text-muted-foreground mt-1">
                <Phone className="inline w-3 h-3 mr-1" />
                Remetente sugerido (secretaria): {settings.secretary_phone}
              </p>
            )}
          </div>

          {/* Grupo destinatário */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Grupo destinatário (opcional, apenas referência)
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) =>
                setSelectedGroupId(e.target.value ? Number(e.target.value) : '')
              }
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="">— Selecionar grupo —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.kind ? ` (${g.kind})` : ''}
                </option>
              ))}
            </select>
            {selectedGroup?.invite_link && (
              <a
                href={selectedGroup.invite_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 inline-block"
              >
                Abrir link do grupo "{selectedGroup.name}"
              </a>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 min-w-[160px] px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'Copiar mensagem'}
            </button>
            <button
              type="button"
              onClick={handleCopyAndOpenWeb}
              className="flex-1 min-w-[160px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              <Globe className="w-4 h-4" /> Copiar e abrir WhatsApp Web
            </button>
            {individualPhone && (
              <button
                type="button"
                onClick={handleSendIndividual}
                className="flex-1 min-w-[160px] px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar para {individualName || 'este número'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
