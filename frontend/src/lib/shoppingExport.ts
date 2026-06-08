/** Helpers de exportação/compartilhamento de listas e pedidos de compra.
 *
 * Tudo client-side — não há rota nova no backend. Os formatos suportados são:
 *  - TXT formatado para colar em WhatsApp/email (com emojis e checkboxes)
 *  - CSV para abrir em Excel/LibreOffice
 *  - WhatsApp click-to-chat (https://wa.me/?text=...) — abre escolha de conversa
 *  - Imprimir via window.print() — abre o PDF/impressora do navegador
 */

export interface ExportItem {
  description: string
  quantity: number
  unit?: string | null
  estimated_price?: number | null
  final_price?: number | null
  notes?: string | null
  is_purchased?: boolean
  due_date?: string | null // ISO yyyy-mm-dd
}

export interface ExportListMeta {
  title: string
  subtitle?: string | null
  status?: string | null
  supplier?: string | null
}

function fmtBRL(v: number | null | undefined): string {
  if (v == null) return ''
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtBrDate(iso?: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

/** Monta texto formatado para WhatsApp/TXT. */
export function buildShoppingText(meta: ExportListMeta, items: ExportItem[]): string {
  const lines: string[] = []
  lines.push(`🛒 *${meta.title}*`)
  if (meta.subtitle) lines.push(meta.subtitle)
  if (meta.status) lines.push(`Status: ${meta.status}`)
  if (meta.supplier) lines.push(`Fornecedor: ${meta.supplier}`)
  lines.push('')
  if (items.length === 0) {
    lines.push('_(sem itens)_')
  } else {
    let total = 0
    items.forEach((it, idx) => {
      const mark = it.is_purchased ? '☑' : '☐'
      const qty = it.quantity ?? 1
      const unit = it.unit ? ` ${it.unit}` : ''
      const price = it.final_price ?? it.estimated_price
      const subtotal = price != null ? price * qty : null
      if (subtotal != null) total += subtotal
      let line = `${mark} ${idx + 1}. ${it.description} — ${qty}${unit}`
      if (price != null) line += ` (${fmtBRL(price)})`
      if (it.due_date) line += ` ⏰ ${fmtBrDate(it.due_date)}`
      lines.push(line)
      if (it.notes) lines.push(`   _${it.notes}_`)
    })
    lines.push('')
    if (total > 0) lines.push(`*Total estimado:* ${fmtBRL(total)}`)
    lines.push(`*Total de itens:* ${items.length}`)
  }
  lines.push('')
  lines.push(`_Gerado em ${new Date().toLocaleString('pt-BR')} — IERS_`)
  return lines.join('\n')
}

/** Monta CSV (separador `;` para Excel pt-BR). */
export function buildShoppingCsv(meta: ExportListMeta, items: ExportItem[]): string {
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }
  const headers = [
    'Item', 'Descrição', 'Quantidade', 'Unidade',
    'Preço estimado', 'Preço final', 'Vencimento', 'Comprado', 'Observações',
  ]
  const rows: string[] = []
  // BOM para Excel pt-BR abrir UTF-8 corretamente
  rows.push('\ufeff' + headers.join(';'))
  items.forEach((it, idx) => {
    rows.push([
      idx + 1,
      escape(it.description),
      escape(it.quantity),
      escape(it.unit ?? ''),
      escape(it.estimated_price ?? ''),
      escape(it.final_price ?? ''),
      escape(fmtBrDate(it.due_date)),
      it.is_purchased ? 'SIM' : 'NÃO',
      escape(it.notes ?? ''),
    ].join(';'))
  })
  rows.unshift('') // linha em branco antes dos dados
  rows.unshift(`Título;${escape(meta.title)}`)
  if (meta.subtitle) rows.unshift(`Subtítulo;${escape(meta.subtitle)}`)
  return rows.join('\n')
}

/** Dispara download de um arquivo de texto. */
export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Abre o WhatsApp com a mensagem pronta — o usuário escolhe a conversa/grupo. */
export function shareViaWhatsapp(text: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Slugifica string para nome de arquivo. */
export function slugifyFilename(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'lista'
}
