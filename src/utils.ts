import { ARTIFACT } from './env'
import { toast } from './components/dialog'
import type {
  BoardColumn,
  Client,
  Complexity,
  Pricing,
  ServiceDef,
  Settings,
  ClientType,
  Data,
  EventType,
  ExpenseCategory,
  Payment,
  Priority,
  Project,
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
  estudante: 'Estudante',
  outro: 'Outro',
}

export const isStudent = (c?: Client) => c?.type === 'estudante'

/** Cor de cada tipo de cliente — tons da paleta, diferentes entre si. */
export const CLIENT_COLORS: Record<ClientType, string> = {
  arquiteto: '#5b7a99',
  designer: '#c07f73',
  escritorio: '#3e4b57',
  construtora: '#8f7a52',
  estudante: '#9a7aa6',
  outro: '#8e979e',
}

export const STATUS: Record<string, { label: string; color: string }> = {
  briefing: { label: 'Em alinhamento', color: '#9aa3ab' },
  producao: { label: 'Em execução', color: '#5b7a99' },
  revisao: { label: 'Em ajustes', color: '#c29a55' },
  aguardando: { label: 'Aguardando aprovação', color: '#a888a8' },
  entregue: { label: 'Entregue', color: '#6f9a7c' },
  pausado: { label: 'Pausado', color: '#b8b0aa' },
  cancelado: { label: 'Cancelado', color: '#b5524c' },
}

/** Etapas padrão de uma demanda freelancer (sem questionário de briefing). */
export const DEFAULT_TASKS = [
  'Sinal recebido',
  'Arquivos e informações recebidos',
  'Ajustes no arquivo recebido',
  'Execução',
  'Prévia enviada para aprovação',
  'Ajustes pedidos',
  'Entrega final',
]
/* Colunas criadas pela usuária (Configurações → customColumns), registradas pelo App. */
let customColumns: BoardColumn[] = []
export const setCustomColumns = (cols: BoardColumn[]) => {
  customColumns = cols
}
/** Nome e cor de um status, padrão ou criado pela usuária. */
export const statusInfo = (id: string) => STATUS[id] ?? customColumns.find((c) => c.id === id) ?? { label: 'Sem coluna', color: '#9aa3ab' }
/** Colunas do quadro: padrão + as criadas (antes de "entregue"). */
export const boardColumns = (): string[] => ['briefing', 'producao', 'revisao', 'aguardando', ...customColumns.map((c) => c.id), 'entregue']
/** Todos os status para seleção (inclui pausado e cancelado). */
export const allStatuses = (): string[] => [...boardColumns(), 'pausado', 'cancelado']
export const COLUMN_COLORS = ['#5b7a99', '#c29a55', '#a888a8', '#6f9a7c', '#c98a7a', '#8a7a5c', '#6b8f94', '#9aa3ab']

export const PRIORITY: Record<Priority, { label: string; color: string; weight: number }> = {
  baixa: { label: 'Baixa', color: '#9aa3ab', weight: 0 },
  media: { label: 'Média', color: '#5b7a99', weight: 1 },
  alta: { label: 'Alta', color: '#c98a5e', weight: 2 },
  urgente: { label: 'Urgente', color: '#b5524c', weight: 3 },
}

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  software: 'Softwares / licenças',
  equipamento: 'Equipamento / hardware',
  impostos: 'Impostos (carnê-leão / IR)',
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

export const PAYMENT_METHODS = ['Pix', 'Cartão de crédito']

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
export const isOpen = (p: Project) => p.status !== 'entregue' && p.status !== 'cancelado'
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

/* ---------- preços e orçamentos ---------- */

export const COMPLEXITY: Record<Complexity, string> = { simples: 'simples', media: 'média', alta: 'alta' }
export const PRICING: Record<Pricing, string> = { unidade: 'por unidade', pacote: 'pacotes', m2: 'por m² × complexidade', livre: 'valor livre' }

const round2 = (n: number) => Math.round(n * 100) / 100

/** Valor por unidade que vale para esta quantidade (o maior pacote alcançado). */
export function unitRate(s: ServiceDef, qty: number) {
  if (s.pricing !== 'pacote') return s.price
  let rate = s.price
  for (const t of [...s.tiers].sort((a, b) => a.qty - b.qty)) if (qty >= t.qty && t.qty > 0) rate = t.price / t.qty
  return rate
}

/** Sugestão de valor pela tabela (0 quando o serviço é de valor livre). */
export function suggestPrice(s: ServiceDef | undefined, qty: number, complexity: Complexity, student: boolean, st: Settings) {
  if (!s || s.pricing === 'livre') return 0
  let v = s.pricing === 'm2' ? s.price * qty * (st.complexity[complexity] ?? 1) : unitRate(s, qty) * qty
  v = Math.max(v, s.min || 0)
  if (student && st.studentDiscount) v *= 1 - st.studentDiscount / 100
  return round2(v)
}

/** Texto curto que aparece na proposta ao lado do serviço. */
export function itemDetail(s: ServiceDef | undefined, qty: number, _complexity?: Complexity) {
  if (!s || s.pricing === 'livre') return ''
  // metragem vai no título do quadro (área do projeto); a complexidade não aparece para o cliente
  if (s.pricing === 'm2') return ''
  const unit = qty === 1 ? s.unit : s.unit.endsWith('m') ? s.unit.slice(0, -1) + 'ns' : s.unit + 's'
  return `${qty} ${unit}`
}

/** Desconto dado por unidade nos itens que seguem a tabela. */
export const itemDiscount = (i: { auto: boolean; unitDiscount?: number; quantity: number }) => (i.auto ? (i.unitDiscount ?? 0) * i.quantity : 0)

export const quoteSubtotal = (q: Quote) => (q.mode === 'opcoes' ? 0 : q.items.reduce((s, i) => s + (i.price || 0), 0))
export const quoteNumber = (q: Quote) => `#${String(q.number).padStart(3, '0')}`

/** Total de uma opção: soma dos serviços menos o desconto da opção. */
export const optionTotal = (o: { items: { price: number }[]; discount: number }) => Math.max(0, o.items.reduce((s, i) => s + (i.price || 0), 0) - (o.discount || 0))
export const quoteTotal = (q: Quote, urgencyFee: number) => {
  if (q.mode === 'opcoes') {
    // opção escolhida; sem escolha ainda, considera a de menor valor
    const chosen = q.options.find((o) => o.id === q.chosenOption)
    if (chosen) return optionTotal(chosen)
    const prices = q.options.map(optionTotal).filter((n) => n > 0)
    return prices.length ? Math.min(...prices) : 0
  }
  const sub = quoteSubtotal(q)
  const withUrg = q.urgency ? sub * (1 + urgencyFee / 100) : sub
  return Math.max(0, withUrg - q.discount)
}

/** Divide um valor em parcelas (ex.: 50% entrada + 50% na entrega). */
export type PayMode = '50-50' | 'inicio' | 'cartao'

export const PAY_MODES: Record<PayMode, string> = {
  '50-50': '50% sinal + 50% na aprovação',
  inicio: '100% no início',
  cartao: 'cartão de crédito',
}

/** Parcelas conforme a forma combinada: sinal + aprovação, tudo no início, ou cartão. */
export function splitPayments(total: number, mode: PayMode | 'avista', start: string, due: string): Payment[] {
  const mk = (description: string, amount: number, dueDate: string, method = 'Pix'): Payment => ({
    id: uid(),
    description,
    amount: Math.round(amount * 100) / 100,
    dueDate,
    paidDate: null,
    method,
  })
  switch (mode) {
    case 'cartao':
      return [mk('Pagamento no cartão', total, start, 'Cartão de crédito')]
    case 'inicio':
    case 'avista':
      return [mk('Pagamento 100% no início', total, start)]
    default:
      return [mk('Sinal 50%', total / 2, start), mk('Saldo 50% na aprovação', total - Math.round((total / 2) * 100) / 100, due || start)]
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

/** Formata telefone enquanto digita: (11) 96928-8192 — com +55 fica +55 11 96928-8192. */
export function formatPhone(value: string) {
  let d = value.replace(/\D/g, '')
  const intl = value.trim().startsWith('+') || (d.startsWith('55') && d.length > 11)
  let prefix = ''
  if (intl && d.startsWith('55')) {
    prefix = '+55 '
    d = d.slice(2)
  }
  d = d.slice(0, 11)
  if (!d) return prefix.trim()
  const dd = d.slice(0, 2)
  const n = d.slice(2)
  const ddPart = prefix ? `${dd}` : `(${dd}${d.length > 2 ? ')' : ''}`
  if (!n) return prefix + ddPart
  const split = n.length > 8 ? 5 : 4 // celular 9 dígitos, fixo 8
  const body = n.length > split ? `${n.slice(0, split)}-${n.slice(split)}` : n
  return `${prefix}${ddPart} ${body}`
}

export const EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'yahoo.com.br', 'live.com', 'uol.com.br', 'bol.com.br']

/** Nome próprio com iniciais maiúsculas: "natasha da silva" → "Natasha da Silva". */
export function titleCase(name: string) {
  const small = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1)))
    .join(' ')
}

/** Detalhe do serviço sem a complexidade — o cliente não vê (vale para orçamentos antigos também). */
export const cleanDetail = (d: string) =>
  d
    .replace(/\s*·?\s*complexidade\s+\S+/gi, '')
    .replace(/^\s*[\d.,]+\s*m²\s*·?\s*/i, '') // m² fica só no título do quadro
    .trim()

/** Variáveis disponíveis nas mensagens padrão. */
export const MESSAGE_VARS: [string, string][] = [
  ['cliente', 'primeiro nome da cliente'],
  ['projeto', 'nome do projeto / orçamento'],
  ['valor', 'valor total'],
  ['proposta', 'número da proposta (#001)'],
  ['parcela', 'próxima parcela em aberto'],
  ['valor_parcela', 'valor dessa parcela'],
  ['vencimento', 'vencimento dessa parcela'],
  ['prazo', 'prazo de entrega'],
  ['arquivos', 'link dos arquivos'],
  ['pix', 'sua chave pix'],
  ['meu_nome', 'seu nome'],
]

export function messageVars(st: Settings, client?: Client, project?: Project, quote?: Quote): Record<string, string> {
  const next = project?.payments.find((x) => !x.paidDate)
  const total = project ? projectTotal(project) : quote ? quoteTotal(quote, st.urgencyFee) : 0
  return {
    cliente: client?.name.split(' ')[0] ?? '',
    projeto: project?.title || quote?.title || '',
    valor: total ? money(total) : '',
    proposta: quote ? quoteNumber(quote) : '',
    parcela: next?.description.toLowerCase() ?? '',
    valor_parcela: next ? money(next.amount) : total ? money(total / 2) : '',
    vencimento: next ? fmtDateLong(next.dueDate) : '',
    prazo: project?.dueDate ? fmtDateLong(project.dueDate) : '',
    arquivos: project?.filesLink ?? '',
    pix: st.pixKey,
    meu_nome: st.ownerName || st.legalName,
  }
}

/** Troca {variáveis} pelos dados; variável vazia some sem deixar chaves no texto. */
export const fillMessage = (text: string, vars: Record<string, string>) =>
  text
    .replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
    .replace(/ {2,}/g, ' ')
    .replace(/ ([,.!?)])/g, '$1')

/** Texto de uma mensagem padrão pelo id, já preenchido (com um texto de reserva se ela foi apagada). */
export function templateText(st: Settings, id: string, fallback: string, client?: Client, project?: Project, quote?: Quote) {
  const t = st.messages.find((m) => m.id === id)?.text ?? fallback
  return fillMessage(t, messageVars(st, client, project, quote))
}
