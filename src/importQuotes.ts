import type { Client, Data, Quote, QuoteItem, QuoteOption } from './types'
import { quoteTotal, uid } from './utils'

/* Importa orçamentos antigos (feitos fora do sistema) a partir de um arquivo .json.
   Não apaga nada: cria os clientes que faltam (pelo nome) e adiciona os orçamentos
   como rascunho. Nº já existente, ou mesmo cliente + data + valor, é pulado. */

interface PackItem {
  service?: string // id do serviço (executivo, detalhamento, modelagem, render-ia…)
  title: string
  detail?: string
  description?: string | string[]
  price: number
  quantity?: number
}
interface PackOption {
  name?: string
  items: PackItem[]
  note?: string
  discount?: number
  discountNote?: string
}
export interface PackQuote {
  number: number
  date: string // aaaa-mm-dd
  client: string
  title: string
  area?: number
  areaApprox?: boolean
  floors?: number
  items?: PackItem[]
  options?: PackOption[] // 2 opções ou 2 propostas
  combo?: boolean // 2 propostas: fechando juntas tem desconto
  comboDiscount?: number
  discount?: number
  discountNote?: string
  notes?: string
  files?: string
  schedule?: string
  paymentTerms?: string
}
export interface QuotePack {
  kind: 'orcamentos'
  quotes: PackQuote[]
}

export const isQuotePack = (x: unknown): x is QuotePack => !!x && typeof x === 'object' && (x as QuotePack).kind === 'orcamentos' && Array.isArray((x as QuotePack).quotes)

const toItem = (i: PackItem): QuoteItem => ({
  id: uid(),
  service: i.service ?? '',
  title: i.title,
  detail: i.detail ?? '',
  description: Array.isArray(i.description) ? i.description.join('\n') : (i.description ?? ''),
  quantity: i.quantity ?? 1,
  complexity: 'media',
  price: i.price,
  auto: false, // valor real do orçamento: não recalcula pela tabela
})

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export function mergeQuotePack(data: Data, pack: QuotePack, urgencyFee: number) {
  const clients = [...data.clients]
  const quotes = [...data.quotes]
  const added: number[] = []
  const skipped: string[] = []
  let newClients = 0

  for (const pq of pack.quotes) {
    let c = clients.find((x) => norm(x.name) === norm(pq.client))
    const options: QuoteOption[] = (pq.options ?? []).map((o) => ({
      id: uid(),
      name: o.name ?? '',
      items: o.items.map(toItem),
      note: o.note ?? '',
      discount: o.discount ?? 0,
      discountNote: o.discountNote ?? '',
      deadlineDays: 10,
    }))
    const two = options.length >= 2
    const q: Quote = {
      id: uid(),
      number: pq.number,
      clientId: c?.id ?? '',
      title: pq.title,
      mode: two ? 'opcoes' : 'escopo',
      pdf: true,
      area: pq.area ?? 0,
      areaApprox: pq.areaApprox,
      floors: pq.floors,
      clientLabel: '',
      items: two ? [] : (pq.items ?? []).map(toItem),
      options,
      chosenOption: '',
      combo: two && !!pq.combo,
      comboDiscount: pq.comboDiscount ?? 0,
      discount: pq.discount ?? 0,
      discountNote: pq.discountNote ?? '',
      files: pq.files ?? '',
      filesAuto: !pq.files,
      schedule: pq.schedule ?? '',
      urgency: false,
      deadlineDays: 10,
      validityDays: 15,
      revisions: 1,
      paymentTerms: pq.paymentTerms ?? '',
      notes: pq.notes ?? '',
      status: 'rascunho',
      sentAt: '',
      createdAt: pq.date,
      projectId: '',
    }
    const total = quoteTotal(q, urgencyFee)
    const dup =
      quotes.find((x) => x.number === pq.number) ??
      (c ? quotes.find((x) => x.clientId === c!.id && x.createdAt === pq.date && Math.abs(quoteTotal(x, urgencyFee) - total) < 0.01) : undefined)
    if (dup) {
      skipped.push(`#${pq.number} ${pq.client}${dup.number !== pq.number ? ` (igual ao #${dup.number})` : ''}`)
      continue
    }
    if (!c) {
      c = {
        id: uid(),
        name: pq.client,
        company: '',
        type: 'arquiteto',
        email: '',
        phone: '',
        instagram: '',
        city: '',
        document: '',
        origin: '',
        notes: '',
        favorite: false,
        archived: false,
        history: [],
        createdAt: pq.date,
      } satisfies Client
      clients.push(c)
      newClients++
    }
    quotes.push({ ...q, clientId: c.id })
    added.push(pq.number)
  }
  return { data: { ...data, clients, quotes }, added, skipped, newClients }
}
