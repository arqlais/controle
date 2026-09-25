import { ARTIFACT } from './env'
import { toast } from './components/dialog'
import type {
  Client,
  ClientType,
  Data,
  EventType,
  ExpenseCategory,
  Payment,
  Priority,
  Project,
  ProjectStatus,
  Quote,
  QuoteStatus,
} from './types'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/* ---------- rótulos ---------- */

export const CLIENT_TYPES: Record<ClientType, string> = {
  arquiteto: 'Arquiteto(a)',
  designer: 'Designer de interiores',
  escritorio: 'Escritório',
  construtora: 'Construtora',
  incorporadora: 'Incorporadora',
  estudante: 'Estudante',
  outro: 'Outro',
}

export const isStudent = (c?: Client) => c?.type === 'estudante'

export const STATUS: Record<ProjectStatus, { label: string; color: string }> = {
  briefing: { label: 'Briefing', color: '#9aa3ab' },
  producao: { label: 'Em execução', color: '#5b7a99' },
  revisao: { label: 'Em revisão', color: '#c29a55' },
  aguardando: { label: 'Aguardando cliente', color: '#a888a8' },
  entregue: { label: 'Entregue', color: '#6f9a7c' },
  pausado: { label: 'Pausado', color: '#b8b0aa' },
  cancelado: { label: 'Cancelado', color: '#b5524c' },
}

/** Etapas padrão — o método: briefing → ajustes → execução → entrega final. */
export const DEFAULT_TASKS = [
  'Briefing: arquivos e referências recebidos',
  'Ajustes no arquivo recebido',
  'Execução',
  'Prévia enviada para aprovação',
  'Revisões',
  'Entrega final',
]
export const BOARD_COLUMNS: ProjectStatus[] = ['briefing', 'producao', 'revisao', 'aguardando', 'entregue']
export const OPEN_STATUSES: ProjectStatus[] = ['briefing', 'producao', 'revisao', 'aguardando', 'pausado']

export const PRIORITY: Record<Priority, { label: string; color: string; weight: number }> = {
  baixa: { label: 'Baixa', color: '#9aa3ab', weight: 0 },
  media: { label: 'Média', color: '#5b7a99', weight: 1 },
  alta: { label: 'Alta', color: '#c98a5e', weight: 2 },
  urgente: { label: 'Urgente', color: '#b5524c', weight: 3 },
}

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  software: 'Softwares / licenças',
  equipamento: 'Equipamento / hardware',
  impostos: 'Impostos (DAS / MEI)',
  marketing: 'Marketing / anúncios',
  internet: 'Internet / energia',
  cursos: 'Cursos / assets',
  terceiros: 'Terceiros / parceiros',
  outros: 'Outros',
}

export const EVENT_TYPES: Record<EventType, { label: string; color: string }> = {
  reuniao: { label: 'Reunião com cliente', color: '#5b7a99' },
  faculdade: { label: 'Faculdade / TCC', color: '#a888a8' },
  entrega: { label: 'Entrega parcial', color: '#6f9a7c' },
  pessoal: { label: 'Pessoal', color: '#d19a8f' },
  outro: { label: 'Outro', color: '#9aa3ab' },
}

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: '#9aa3ab' },
  enviado: { label: 'Enviado', color: '#5b7a99' },
  aprovado: { label: 'Aprovado', color: '#6f9a7c' },
  recusado: { label: 'Recusado', color: '#b5524c' },
}

export const PAYMENT_METHODS = ['Pix', 'Transferência', 'Boleto', 'Cartão', 'Dinheiro']

/* ---------- formatação ---------- */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (n: number) => brl.format(Number.isFinite(n) ? n : 0)

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/* ---------- datas (sempre yyyy-mm-dd, fuso local) ---------- */

export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const today = () => toISO(new Date())
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
export const addDays = (s: string, n: number) => {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
export const daysBetween = (a: string, b: string) =>
  Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000)
export const daysUntil = (s: string) => daysBetween(today(), s)
export const monthKey = (s: string) => s.slice(0, 7)
export const fmtDate = (s?: string | null) => {
  if (!s) return '—'
  const d = parseISO(s)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}
export const fmtDateLong = (s?: string | null) => (s ? parseISO(s).toLocaleDateString('pt-BR') : '—')
export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
export const relativeDays = (s: string) => {
  const n = daysUntil(s)
  if (n === 0) return 'hoje'
  if (n === 1) return 'amanhã'
  if (n === -1) return 'ontem'
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`
}

/* ---------- cálculos de projeto ---------- */

export const projectTotal = (p: Project) => Math.max(0, p.value - p.discount)
export const projectPaid = (p: Project) => p.payments.filter((x) => x.paidDate).reduce((s, x) => s + x.amount, 0)
export const projectOpen = (p: Project) => projectTotal(p) - projectPaid(p)
export const projectHours = (p: Project) => p.timeLogs.reduce((s, t) => s + t.hours, 0)
export const isOpen = (p: Project) => OPEN_STATUSES.includes(p.status)
export const isLate = (p: Project) => isOpen(p) && !!p.dueDate && daysUntil(p.dueDate) < 0
export const paymentLate = (x: Payment) => !x.paidDate && !!x.dueDate && daysUntil(x.dueDate) < 0

export type PaymentState = 'pago' | 'vencido' | 'pendente'
export const paymentState = (x: Payment): PaymentState => (x.paidDate ? 'pago' : paymentLate(x) ? 'vencido' : 'pendente')

/** Urgência calculada: combina prioridade escolhida com a proximidade do prazo. */
export function urgency(p: Project): { level: Priority; reason: string } {
  if (!isOpen(p) || !p.dueDate) return { level: p.priority, reason: '' }
  const d = daysUntil(p.dueDate)
  if (d < 0) return { level: 'urgente', reason: `atrasado ${-d}d` }
  if (d <= 2) return { level: 'urgente', reason: d === 0 ? 'entrega hoje' : `entrega em ${d}d` }
  if (d <= 5 && PRIORITY[p.priority].weight < 2) return { level: 'alta', reason: `entrega em ${d}d` }
  return { level: p.priority, reason: '' }
}

export const urgencyScore = (p: Project) => {
  const u = urgency(p)
  const d = p.dueDate ? daysUntil(p.dueDate) : 999
  return PRIORITY[u.level].weight * 1000 - d
}

export function allPayments(data: Data) {
  return data.projects
    .filter((p) => p.status !== 'cancelado')
    .flatMap((p) => p.payments.map((pay) => ({ pay, project: p, client: data.clients.find((c) => c.id === p.clientId) })))
}

/** Despesas recorrentes se repetem todo mês a partir da data de início. */
export function expensesInMonth(data: Data, key: string) {
  return data.expenses.filter((e) => {
    if (!e.recurring) return monthKey(e.date) === key
    return monthKey(e.date) <= key
  })
}

export function monthSummary(data: Data, key: string) {
  const pays = allPayments(data)
  const received = pays.filter((x) => x.pay.paidDate && monthKey(x.pay.paidDate) === key).reduce((s, x) => s + x.pay.amount, 0)
  const toReceive = pays.filter((x) => !x.pay.paidDate && monthKey(x.pay.dueDate) === key).reduce((s, x) => s + x.pay.amount, 0)
  const expenses = expensesInMonth(data, key).reduce((s, e) => s + e.amount, 0)
  return { received, toReceive, expenses, profit: received - expenses }
}

export function lastMonths(n: number, from = today()) {
  const d = parseISO(from)
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1)
    keys.push(toISO(x).slice(0, 7))
  }
  return keys
}

export const quoteSubtotal = (q: Quote) => q.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
export const quoteTotal = (q: Quote, urgencyFee: number) => {
  const sub = quoteSubtotal(q)
  const withUrg = q.urgency ? sub * (1 + urgencyFee / 100) : sub
  return Math.max(0, withUrg - q.discount)
}

/** Divide um valor em parcelas (ex.: 50% entrada + 50% na entrega). */
export function splitPayments(total: number, mode: 'avista' | '50-50' | '3x' | '30-70', start: string, due: string): Payment[] {
  const mk = (description: string, amount: number, dueDate: string): Payment => ({
    id: uid(),
    description,
    amount: Math.round(amount * 100) / 100,
    dueDate,
    paidDate: null,
    method: 'Pix',
  })
  switch (mode) {
    case 'avista':
      return [mk('Pagamento único', total, start)]
    case '50-50':
      return [mk('Entrada 50%', total / 2, start), mk('Saldo 50% na entrega', total - Math.round((total / 2) * 100) / 100, due || start)]
    case '30-70':
      return [mk('Sinal 30%', total * 0.3, start), mk('Saldo 70% na entrega', total - Math.round(total * 30) / 100, due || start)]
    case '3x': {
      const part = Math.round((total / 3) * 100) / 100
      return [
        mk('Parcela 1/3', part, start),
        mk('Parcela 2/3', part, addDays(start, 30)),
        mk('Parcela 3/3', total - part * 2, addDays(start, 60)),
      ]
    }
  }
}

export const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0)

export const whatsappLink = (phone: string, text = '') => {
  const digits = phone.replace(/\D/g, '')
  const full = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export const instagramLink = (handle: string) => `https://instagram.com/${handle.replace(/^@/, '').trim()}`

export function download(filename: string, content: string, type = 'application/json') {
  if (ARTIFACT) {
    // o visualizador de Artifacts bloqueia downloads: copia o conteúdo
    navigator.clipboard
      ?.writeText(content)
      .then(() => toast(`Conteúdo de ${filename} copiado. Cole num arquivo de texto para salvar.`))
      .catch(() => toast('Downloads não funcionam aqui. Use o sistema publicado para baixar arquivos.'))
    return
  }
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
