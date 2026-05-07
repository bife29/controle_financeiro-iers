/** Helpers para envio de mensagens via WhatsApp.
 *
 * Limitação técnica importante: o WhatsApp não expõe API pública para envio
 * automático em GRUPOS. Para grupos, usamos o fluxo "copia e cola":
 * copiamos o texto para clipboard e o usuário cola no grupo desejado.
 *
 * Para envio individual, usamos o link click-to-chat: https://wa.me/<num>?text=...
 */

/** Sanitiza um número de telefone BR, retornando apenas dígitos com DDI 55. */
export function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('55')) return digits
  // assume número BR sem DDI
  return `55${digits}`
}

/** Substitui placeholders {nome}, {idade}, etc. */
export function renderTemplate(
  body: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  let out = body
  for (const [key, value] of Object.entries(vars)) {
    const safe = value == null ? '' : String(value)
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), safe)
  }
  return out
}

/** Abre o WhatsApp com a mensagem pronta para um número específico. */
export function openWhatsappIndividual(phone: string, message: string): boolean {
  const normalized = normalizePhone(phone)
  if (!normalized) return false
  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

/** Abre o WhatsApp Web (sem grupo específico — não é possível via API). */
export function openWhatsappWeb(): void {
  window.open('https://web.whatsapp.com', '_blank', 'noopener,noreferrer')
}

/** Copia para clipboard. Retorna true em caso de sucesso. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
