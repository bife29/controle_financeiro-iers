import { useState } from 'react'
import { FileText, FileSpreadsheet, MessageCircle, Printer, Copy, Check } from 'lucide-react'
import {
  buildShoppingText, buildShoppingCsv, downloadTextFile,
  shareViaWhatsapp, slugifyFilename,
  type ExportItem, type ExportListMeta,
} from '@/lib/shoppingExport'

interface Props {
  meta: ExportListMeta
  items: ExportItem[]
  /** id sufixo para `data-testid` (ex.: "list-12" ou "request-7"). */
  testIdSuffix?: string
}

/** Conjunto compacto de botões para exportar/compartilhar uma lista de compras
 *  ou pedido de compra. 100% client-side. */
export function ShoppingExportButtons({ meta, items, testIdSuffix }: Props) {
  const [copied, setCopied] = useState(false)
  const slug = slugifyFilename(meta.title)
  const text = buildShoppingText(meta, items)
  const csv = buildShoppingCsv(meta, items)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // fallback: download
      downloadTextFile(`${slug}.txt`, text)
    }
  }

  const suffix = testIdSuffix ? `-${testIdSuffix}` : ''

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid={`shopping-export${suffix}`}>
      <button
        type="button"
        onClick={() => shareViaWhatsapp(text)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        title="Compartilhar pelo WhatsApp"
        data-testid={`shopping-export-whatsapp${suffix}`}
      >
        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
      </button>

      <button
        type="button"
        onClick={() => downloadTextFile(`${slug}.txt`, text)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white hover:bg-gray-50"
        title="Baixar como TXT"
        data-testid={`shopping-export-txt${suffix}`}
      >
        <FileText className="w-3.5 h-3.5" /> TXT
      </button>

      <button
        type="button"
        onClick={() => downloadTextFile(`${slug}.csv`, csv, 'text/csv;charset=utf-8')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white hover:bg-gray-50"
        title="Baixar como CSV (Excel)"
        data-testid={`shopping-export-csv${suffix}`}
      >
        <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
      </button>

      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white hover:bg-gray-50"
        title="Copiar texto formatado"
        data-testid={`shopping-export-copy${suffix}`}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? 'Copiado!' : 'Copiar'}
      </button>

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white hover:bg-gray-50"
        title="Imprimir"
        data-testid={`shopping-export-print${suffix}`}
      >
        <Printer className="w-3.5 h-3.5" /> Imprimir
      </button>
    </div>
  )
}
