import type { Quote, QuoteAudience, QuoteItem, ServiceDef } from './types'
import { uid } from './utils'

/* Sugestão de orçamento que a IA devolve no fim da resposta (bloco ```orcamento {json}```).
   Vira um botão no chat: "jogar pro orçamento" abre um orçamento novo já preenchido, e lá tudo é editável. */

export interface AIQuoteItem {
  servico?: string // id do serviço na tabela ('' = personalizado)
  titulo: string
  detalhe?: string
  descricao?: string
  quantidade?: number
  valor: number
}
export interface AIQuote {
  titulo?: string
  publico?: 'final' | 'parceiro' | string
  area?: number
  itens: AIQuoteItem[]
  prazoDias?: number
  pagamento?: string
  observacoes?: string
}

const BLOCK = /```\s*or[cç]amento\s*\n?([\s\S]*?)```/i

const num = (v: unknown) => {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Separa o texto da resposta do bloco com a sugestão (se houver). */
export function parseAIQuote(text: string): { clean: string; quote?: AIQuote } {
  const m = BLOCK.exec(text)
  if (!m) return { clean: text }
  const clean = text.replace(BLOCK, '').trim()
  try {
    const raw = JSON.parse(m[1].trim())
    const itens: AIQuoteItem[] = (Array.isArray(raw.itens) ? raw.itens : [])
      .map((x: Record<string, unknown>) => ({
        servico: String(x.servico ?? ''),
        titulo: String(x.titulo ?? '').trim(),
        detalhe: x.detalhe ? String(x.detalhe) : '',
        descricao: x.descricao ? String(x.descricao) : '',
        quantidade: num(x.quantidade) || 1,
        valor: Math.max(0, num(x.valor)),
      }))
      .filter((x: AIQuoteItem) => x.titulo || x.valor)
    if (!itens.length) return { clean }
    return {
      clean,
      quote: {
        titulo: raw.titulo ? String(raw.titulo) : '',
        publico: raw.publico ? String(raw.publico) : '',
        area: num(raw.area) || 0,
        itens,
        prazoDias: num(raw.prazoDias) || 0,
        pagamento: raw.pagamento ? String(raw.pagamento) : '',
        observacoes: raw.observacoes ? String(raw.observacoes) : '',
      },
    }
  } catch {
    return { clean }
  }
}

export const aiTotal = (q: AIQuote) => q.itens.reduce((n, x) => n + x.valor, 0)

/** Itens do orçamento a partir da sugestão (com o valor sugerido, editável). */
export function aiItems(q: AIQuote, services: ServiceDef[]): QuoteItem[] {
  return q.itens.map((x) => {
    const sv = services.find((s) => s.id === x.servico) ?? services.find((s) => s.name.toLowerCase() === (x.titulo || '').toLowerCase())
    return { id: uid(), service: sv?.id ?? '', title: x.titulo || sv?.name || 'serviço', detail: x.detalhe ?? '', description: x.descricao ?? '', quantity: x.quantidade || 1, complexity: 'media', price: Math.round(x.valor * 100) / 100, auto: false }
  })
}

/** O que entra no orçamento novo. */
export function aiPrefill(q: AIQuote, audience: QuoteAudience, services: ServiceDef[]): Partial<Quote> {
  return {
    audience,
    title: q.titulo || '',
    ...(q.area ? { area: q.area } : {}),
    items: aiItems(q, services),
    ...(q.prazoDias ? { deadlineDays: q.prazoDias } : {}),
    ...(q.pagamento ? { paymentTerms: q.pagamento } : {}),
    ...(q.observacoes ? { notes: q.observacoes } : {}),
  }
}

export const AI_PREFILL_KEY = 'ia-orcamento-novo'
export const AI_APPLY_EVENT = 'ia-aplicar-orcamento'
