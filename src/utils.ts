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
  WorkProfile,
  Data,
  EventType,
  ExpenseCategory,
  Payment,
  Priority,
  Project,
  ProjectItem,
  Quote,
  QuoteOption,
  QuoteStatus,
} from './types'

/** Instagram sempre com @ na frente (a pessoa pode digitar com ou sem). */
export const atHandle = (v: string) => (v.trim() ? '@' + v.trim().replace(/^@+/, '') : '')
/** Enquanto digita: sempre com @ na frente; link do perfil vira só o @ (instagram.com/perfil → @perfil). */
export const typeHandle = (v: string) => {
  const h = v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/[/?].*$/, '')
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
  return h ? '@' + h : ''
}
/** CPF (11 dígitos) ou CNPJ (14) com a pontuação, conforme vai digitando. */
export const formatDoc = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11)
    return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, (_, a, b, c, e, f) => `${a}.${b}.${c}/${e}${f ? '-' + f : ''}`)
}
/** Mostra CPF/CNPJ já guardado com a pontuação (texto com letras fica como está). */
export const showDoc = (v: string) => (/^[\d.\-/\s]+$/.test(v || '') ? formatDoc(v) : v || '')
export const formatCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')

/** Endereço pelo CEP (ViaCEP, gratuito). null = CEP não encontrado ou sem internet. */
export async function lookupCep(cep: string): Promise<{ street: string; district: string; city: string; uf: string } | null> {
  const d = cep.replace(/\D/g, '')
  if (d.length !== 8) return null
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
    if (!r.ok) return null
    const j = await r.json()
    if (j.erro) return null
    return { street: j.logradouro ?? '', district: j.bairro ?? '', city: j.localidade ?? '', uf: j.uf ?? '' }
  } catch {
    return null
  }
}

/** Dados públicos da empresa pelo CNPJ (BrasilAPI, gratuito). null = não achou ou sem internet. */
export async function lookupCnpj(cnpj: string): Promise<{ legal: string; trade: string; kind: string; cep: string; address: string; city: string } | null> {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return null
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`)
    if (!r.ok) return null
    const j = await r.json()
    const cap = (t: string) => (t || '').toLowerCase().replace(/(^|\s)(\S+)/g, (_m, sp, w) => sp + (/^(da|das|de|do|dos|e)$/.test(w) && sp ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    const kind = j.opcao_pelo_mei ? 'MEI' : /micro/i.test(j.porte ?? '') ? 'ME' : /pequeno/i.test(j.porte ?? '') ? 'EPP' : /limitada|ltda/i.test(j.natureza_juridica ?? '') ? 'LTDA' : ''
    return {
      legal: j.razao_social ?? '',
      trade: cap(j.nome_fantasia ?? ''),
      kind,
      cep: formatCep(j.cep ?? ''),
      address: [[cap(j.descricao_tipo_de_logradouro ? `${j.descricao_tipo_de_logradouro} ${j.logradouro}` : j.logradouro), j.numero].filter(Boolean).join(', '), cap(j.bairro)].filter(Boolean).join(', '),
      city: [cap(j.municipio), j.uf].filter(Boolean).join(' - '),
    }
  } catch {
    return null
  }
}

/** Em nome de quem sai o recibo: a pessoa (CPF) ou a empresa (CNPJ). */
export function payerOf(c?: Client) {
  if (!c) return { name: '—', doc: '' }
  const company = c.billTo === 'empresa' || (!c.billTo && !!c.companyDoc)
  if (company) return { name: c.companyLegal || c.company || c.name, doc: c.companyDoc || '' }
  if (c.billTo === 'pessoa') return { name: c.name, doc: c.document }
  return { name: c.company || c.name, doc: c.document } // cadastros antigos: como era
}

export const docKind = (v: string) => {
  const n = v.replace(/\D/g, '').length
  return n === 11 ? 'CPF' : n === 14 ? 'CNPJ' : ''
}
/** Site sem https:// nem www., do jeito que fica bonito impresso. */
export const cleanSite = (v: string) => v.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/* ---------- rótulos ---------- */

export const CLIENT_TYPES: Record<ClientType, string> = {
  final: 'Cliente final',
  arquiteto: 'Arquiteto(a)',
  designer: 'Designer de interiores',
  escritorio: 'Escritório',
  construtora: 'Construtora',
  estudante: 'Estudante',
  outro: 'Outro',
}

export const isStudent = (c?: Client) => c?.type === 'estudante'
export const isFinalClient = (c?: Client) => c?.type === 'final'

/** Tipos de cliente na ordem de quem usa: quem atende cliente final vê "cliente final" primeiro;
 *  quem é só freelancer não vê essa opção (a não ser que o cliente já seja desse tipo). */
export function clientTypeOptions(profile: WorkProfile | undefined, current?: ClientType): [ClientType, string][] {
  const all = Object.entries(CLIENT_TYPES) as [ClientType, string][]
  if (profile === 'final') return all
  if (profile === 'ambos') return all
  return all.filter(([k]) => k !== 'final' || current === 'final')
}
/** Tipo de cliente novo, conforme o jeito de trabalhar. */
export const defaultClientType = (profile?: WorkProfile): ClientType => (profile === 'final' ? 'final' : 'arquiteto')

/** Cor de cada tipo de cliente — tons da paleta, diferentes entre si. */
export const CLIENT_COLORS: Record<ClientType, string> = {
  final: '#566779',
  arquiteto: '#566779',
  designer: '#c29b92',
  escritorio: '#3e4b57',
  construtora: '#8f6d64',
  estudante: '#a88a80',
  outro: '#9aa3ab',
}

export const STATUS: Record<string, { label: string; color: string }> = {
  briefing: { label: 'Em alinhamento', color: '#9aa3ab' },
  producao: { label: 'Em execução', color: '#566779' },
  revisao: { label: 'Em ajustes', color: '#b08a7e' },
  aguardando: { label: 'Em aprovação', color: '#8f6d64' },
  entregue: { label: 'Entregue', color: '#3e4b57' },
  pausado: { label: 'Pausado', color: '#b8aca6' },
  cancelado: { label: 'Cancelado', color: '#9a5b53' },
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
export const COLUMN_COLORS = ['#566779', '#b08a7e', '#8f6d64', '#3e4b57', '#d6b3ab', '#7d8c99', '#7d8c99', '#9aa3ab']

export const PRIORITY: Record<Priority, { label: string; color: string; weight: number }> = {
  baixa: { label: 'Baixa', color: '#9aa3ab', weight: 0 },
  media: { label: 'Média', color: '#566779', weight: 1 },
  alta: { label: 'Alta', color: '#a07a70', weight: 2 },
  urgente: { label: 'Urgente', color: '#9a5b53', weight: 3 },
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
  reuniao: { label: 'Reunião com cliente', color: '#566779' },
  faculdade: { label: 'Estudos / faculdade', color: '#8f6d64' },
  entrega: { label: 'Entrega parcial', color: '#3e4b57' },
  pessoal: { label: 'Pessoal', color: '#c29b92' },
  outro: { label: 'Outro', color: '#9aa3ab' },
}
/** Nomes dos tipos de compromisso trocados pela pessoa (configurações → na própria agenda). */
let eventNames: Partial<Record<EventType, string>> = {}
export const setEventLabels = (m?: Partial<Record<EventType, string>>) => {
  eventNames = m ?? {}
}
export const eventTypeLabel = (t: EventType) => eventNames[t]?.trim() || EVENT_TYPES[t].label
/** Nome do tipo do compromisso: o digitado, quando é "outro". */
export const eventLabel = (e: { type: EventType; customType?: string }) => (e.type === 'outro' && e.customType?.trim() ? e.customType.trim() : eventTypeLabel(e.type))

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: '#9aa3ab' },
  enviado: { label: 'Enviado', color: '#566779' },
  aprovado: { label: 'Aprovado', color: '#3e4b57' },
  recusado: { label: 'Não fechou', color: '#c29b92' },
}

export const PAYMENT_METHODS = ['Pix', 'Cartão de crédito']
/** Formas de receber desta conta (a lista editada em Configurações, ou a padrão). */
export const paymentMethods = (s: { paymentMethods?: string[] }) => (s.paymentMethods?.filter((m) => m.trim()).length ? s.paymentMethods.filter((m) => m.trim()) : PAYMENT_METHODS)

/* ---------- formatação ---------- */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const money = (n: number) => brl.format(Number.isFinite(n) ? n : 0)
/** Minúsculas para exibir, mas o "R$" continua sempre com R maiúsculo. */
export const lower = (t: string) => t.toLowerCase().replace(/r\$/g, 'R$')

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

/* ---------- feriados nacionais e dias úteis ---------- */

/** Domingo de Páscoa (algoritmo gregoriano anônimo). */
function easter(y: number): string {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
const holidayCache = new Map<number, Map<string, string>>()
/** Feriados nacionais (e Carnaval / Corpus Christi, que param quase tudo) de um ano. */
export function holidaysOf(y: number): Map<string, string> {
  const hit = holidayCache.get(y)
  if (hit) return hit
  const p = easter(y)
  const m = new Map<string, string>([
    [`${y}-01-01`, 'Confraternização Universal'],
    [addDays(p, -48), 'Carnaval'],
    [addDays(p, -47), 'Carnaval'],
    [addDays(p, -2), 'Sexta-feira Santa'],
    [`${y}-04-21`, 'Tiradentes'],
    [`${y}-05-01`, 'Dia do Trabalho'],
    [addDays(p, 60), 'Corpus Christi'],
    [`${y}-09-07`, 'Independência'],
    [`${y}-10-12`, 'Nossa Senhora Aparecida'],
    [`${y}-11-02`, 'Finados'],
    [`${y}-11-15`, 'Proclamação da República'],
    [`${y}-11-20`, 'Consciência Negra'],
    [`${y}-12-25`, 'Natal'],
  ])
  holidayCache.set(y, m)
  return m
}
/** Dia da semana curto, ex.: "sex". */
export const fmtWeekday = (iso: string) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][parseISO(iso).getDay()]
export const holidayName = (iso: string) => holidaysOf(Number(iso.slice(0, 4))).get(iso)
export const isWeekend = (iso: string) => [0, 6].includes(parseISO(iso).getDay())
export const isBusinessDay = (iso: string) => !isWeekend(iso) && !holidayName(iso)
/** Data de entrega contando só dias úteis a partir do dia seguinte ao início. */
export function addBusinessDays(start: string, n: number): string {
  let d = start
  let left = Math.max(0, Math.round(n))
  while (left > 0) {
    d = addDays(d, 1)
    if (isBusinessDay(d)) left--
  }
  return d
}
/** Quantos dias úteis faltam até a data (sem contar hoje). */
export function businessDaysUntil(iso: string, from = today()): number {
  if (!iso || iso <= from) return 0
  let n = 0
  for (let d = addDays(from, 1); d <= iso; d = addDays(d, 1)) if (isBusinessDay(d)) n++
  return n
}
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

export const projectExtras = (p: Project) => (p.extras ?? []).reduce((s, x) => s + x.value, 0)
export const projectTotal = (p: Project) => Math.max(0, p.value - p.discount) + projectExtras(p)
export const projectPaid = (p: Project) => p.payments.filter((x) => x.paidDate).reduce((s, x) => s + x.amount, 0)
export const projectOpen = (p: Project) => projectTotal(p) - projectPaid(p)
export const projectHours = (p: Project) => p.timeLogs.reduce((s, t) => s + t.hours, 0)
export const isOpen = (p: Project) => p.status !== 'entregue' && p.status !== 'cancelado'
export const isLate = (p: Project) => isOpen(p) && !!p.dueDate && daysUntil(p.dueDate) < 0

/** Situação do prazo em palavras: "faltam 5 dias", "entrega hoje", "atrasado 12 dias", "entregue no prazo"… */
export function deadlineInfo(p: Project): { text: string; tone: 'good' | 'warn' | 'bad' | 'muted' } {
  const dias = (n: number) => `${n} dia${n === 1 ? '' : 's'}`
  if (p.status === 'cancelado') return { text: 'cancelado', tone: 'muted' }
  if (p.status === 'entregue') {
    if (p.dueDate && p.deliveredDate) {
      const late = daysBetween(p.dueDate, p.deliveredDate)
      return late > 0 ? { text: `entregue com ${dias(late)} de atraso`, tone: 'warn' } : { text: 'entregue no prazo', tone: 'good' }
    }
    return { text: p.deliveredDate ? `entregue em ${fmtDate(p.deliveredDate)}` : 'entregue', tone: 'good' }
  }
  if (!p.dueDate) return { text: 'sem prazo definido', tone: 'muted' }
  const d = daysUntil(p.dueDate)
  if (d < 0) return { text: `atrasado ${dias(-d)}`, tone: 'bad' }
  if (d === 0) return { text: 'entrega hoje', tone: 'bad' }
  if (d === 1) return { text: 'entrega amanhã', tone: 'warn' }
  return { text: `faltam ${dias(d)}`, tone: d <= 3 ? 'warn' : 'good' }
}
/** Sem vencimento por data: o sinal é cobrado no fechamento e o saldo na conclusão. */
export const payWhen = (x: Payment): 'fechamento' | 'conclusao' => x.on ?? (/saldo|aprova|conclus|entrega/i.test(x.description) ? 'conclusao' : 'fechamento')
export const PAY_WHEN = { fechamento: 'no fechamento', conclusao: 'na conclusão' } as const
/** Já dá para cobrar: sinal em aberto, ou saldo em aberto com a demanda em aprovação/entregue. */
// parcela ligada a uma etapa do cronograma (cliente final): vira "a cobrar" quando a etapa termina
const phaseDone = (x: Payment, p?: Project) => !!p?.phases?.some((f) => f.paymentId === x.id && f.done)
export const paymentDue = (x: Payment, p?: Project) => !x.paidDate && (x.monthly ? !!x.dueDate && daysUntil(x.dueDate) <= 3 : payWhen(x) === 'fechamento' || phaseDone(x, p) || (!!p && (p.status === 'aguardando' || p.status === 'entregue')))

export type PaymentState = 'pago' | 'cobrar' | 'pendente'
export const paymentState = (x: Payment, p?: Project): PaymentState => (x.paidDate ? 'pago' : paymentDue(x, p) ? 'cobrar' : 'pendente')

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

/** Recebido no cartão de crédito? (a taxa da maquininha / Mercado Pago sai do valor) */
export const isCard = (method?: string) => /cart[aã]o|cr[eé]dito/i.test(method || '')
export const DEFAULT_CARD_FEE = 4.98
/** Taxa retida num pagamento recebido no crédito: a digitada na parcela ou a % das configurações. */
export function paymentFee(pay: { amount: number; method: string; fee?: number }, s: { cardFee?: number }) {
  if (typeof pay.fee === 'number') return pay.fee
  return isCard(pay.method) ? Math.round(pay.amount * (s.cardFee ?? DEFAULT_CARD_FEE)) / 100 : 0
}

export function monthSummary(data: Data, key: string) {
  const pays = allPayments(data)
  const paid = pays.filter((x) => x.pay.paidDate && monthKey(x.pay.paidDate) === key)
  const received = paid.reduce((s, x) => s + x.pay.amount, 0)
  const toReceive = pays.filter((x) => !x.pay.paidDate && monthKey(x.pay.dueDate) === key).reduce((s, x) => s + x.pay.amount, 0)
  // taxas do cartão entram como despesa do mês em que o dinheiro caiu
  const fees = Math.round(paid.reduce((s, x) => s + paymentFee(x.pay, data.settings), 0) * 100) / 100
  const expenses = expensesInMonth(data, key).reduce((s, e) => s + e.amount, 0) + fees
  return { received, toReceive, expenses, fees, profit: received - expenses }
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
export const PRICING: Record<Pricing, string> = { unidade: 'por unidade', pacote: 'pacotes', m2: 'por m² × complexidade', hora: 'por hora', livre: 'valor livre' }

const round2 = (n: number) => Math.round(n * 100) / 100

/** Valor por unidade que vale para esta quantidade (o maior pacote alcançado). */
export function unitRate(s: ServiceDef, qty: number) {
  if (s.pricing !== 'pacote') return s.price
  let rate = s.price
  for (const t of [...s.tiers].sort((a, b) => a.qty - b.qty)) if (qty >= t.qty && t.qty > 0) rate = t.price / t.qty
  return rate
}

/* ---------- serviços com lista (plantas executivas, detalhamentos): preço por item marcado ---------- */

const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'com', 'para', 'em', 'no', 'na'])
/** Chave para comparar nomes parecidos: "planta de layout (mobiliário)" = "planta de layout/mobiliário". */
export const scopeKey = (s: string) =>
  [
    ...new Set(
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w && !STOP.has(w))
        .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)),
    ),
  ]
    .sort()
    .join(' ')

const hasList = (s?: ServiceDef) => !!s?.checklist?.some((c) => c.trim())
/** Opção da lista que corresponde a uma linha escrita (ou undefined se for um item personalizado). */
export const checklistMatch = (s: ServiceDef, line: string) => {
  const k = scopeKey(line)
  if (!k) return undefined
  const opts = (s.checklist ?? []).filter((c) => c.trim())
  const exact = opts.find((c) => scopeKey(c) === k)
  if (exact) return exact
  // "elevações internas" → "elevações": todas as palavras da opção aparecem na linha (vence a mais específica)
  const words = new Set(k.split(' '))
  return opts
    .map((c) => ({ c, w: scopeKey(c).split(' ') }))
    .filter(({ w }) => w.length && w.every((x) => words.has(x)))
    .sort((a, b) => b.w.length - a.w.length)[0]?.c
}
/** Serviços agrupados na ordem em que os grupos aparecem (sem grupo: um bloco só, sem título). */
export function groupServices(list: ServiceDef[]): [string, ServiceDef[]][] {
  const out: [string, ServiceDef[]][] = []
  for (const x of list) {
    const g = x.group?.trim() || ''
    const hit = out.find(([k]) => k === g)
    if (hit) hit[1].push(x)
    else out.push([g, [x]])
  }
  return out
}

/** Valor de uma opção (ou de um item personalizado). */
export const checklistPrice = (s: ServiceDef, option?: string) => (option ? s.checklistPrices?.[option] ?? s.customRate ?? 0 : s.customRate ?? 0)
/** Soma dos itens marcados (linhas de "o que está incluso"): R$/m² ou R$ por item, antes da complexidade. */
export function checklistRate(s: ServiceDef, lines: string[]) {
  const picked = lines.map((l) => l.trim()).filter(Boolean)
  const rate = picked.reduce((acc, l) => acc + checklistPrice(s, checklistMatch(s, l)), 0)
  return { rate: round2(rate), count: picked.length }
}
/** O serviço é calculado pelos itens marcados? (tem lista com valores e há itens marcados) */
export const pricedByList = (s: ServiceDef | undefined, lines: string[]) =>
  !!s && hasList(s) && !!s.checklistPrices && Object.keys(s.checklistPrices).length > 0 && lines.some((l) => l.trim()) && s.pricing !== 'livre'

/** Sugestão de valor pela tabela (0 quando o serviço é de valor livre). */
/** Serviço que já é entregue aberto (ex.: modelagem em SketchUp): a taxa de arquivo aberto não se aplica. */
export const alreadyOpen = (s?: ServiceDef) => !!s && !s.deliveryOpen && /aberto|sketchup|\bskp\b/i.test(s.delivery ?? '')

export function suggestPrice(s: ServiceDef | undefined, qty: number, complexity: Complexity, student: boolean, st: Settings, lines: string[] = [], openFile = false, floors = 1) {
  if (!s || s.pricing === 'livre') return 0
  const cx = st.complexity[complexity] ?? 1
  let v: number
  if (pricedByList(s, lines)) {
    // cada planta/detalhamento marcado soma: R$/m² × área × complexidade, ou R$ cada × complexidade
    const { rate } = checklistRate(s, lines)
    v = s.pricing === 'm2' ? (s.base || 0) + rate * qty * cx : rate * cx
  } else v = s.pricing === 'm2' ? (s.base || 0) + s.price * qty * cx : unitRate(s, qty) * qty
  v = Math.max(v, s.min || 0)
  // cada pavimento a mais: pranchas, arquivos e modelos a mais
  if (s.perFloor && floors > 1) v *= 1 + ((floors - 1) * (st.floorFee ?? 50)) / 100
  // arquivo aberto: taxa interna embutida no valor (a proposta só diz como será entregue)
  if (openFile && !alreadyOpen(s)) v *= 1 + (st.openFileFee ?? 30) / 100
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
/** Próximo nº de orçamento: contagem contínua (maior já usado + 1), nunca abaixo do início escolhido. */
export const nextQuoteNumber = (d: Data) => Math.max((d.settings.quoteStart ?? 1) - 1, 0, ...d.quotes.map((x) => x.number || 0)) + 1
export const quoteNumber = (q: Quote) => (q.noNumber ? 'sem nº' : `#${String(q.number).padStart(3, '0')}`)

/** Total de uma opção: soma dos serviços menos o desconto da opção. */
export const optionTotal = (o: { items: { price: number }[]; discount: number }) => Math.max(0, o.items.reduce((s, i) => s + (i.price || 0), 0) - (o.discount || 0))
/** "propostas + juntas": o cliente pode fechar uma, outra, ou todas juntas com desconto. */
/** Tudo em minúsculas, menos R$ (e links, que quebrariam). */
export const lowerKeepRS = (t: string) =>
  t
    .split(/(https?:\/\/\S+)/g)
    .map((part, i) => (i % 2 ? part : part.toLowerCase().replace(/r\$/g, 'R$')))
    .join('')

/** Área e pavimentos de um quadro: cada opção/proposta pode ter os seus. */
export const optionArea = (q: Quote, o?: QuoteOption) => ({
  area: o?.area ?? q.area,
  approx: o?.areaApprox ?? !!q.areaApprox,
  floors: Math.max(1, o?.floors ?? q.floors ?? 1),
  floorsHidden: o?.floorsHidden ?? !!q.floorsHidden,
})

/** Para pesquisar sem se importar com acento ou maiúscula: "Araújo" = "araujo". */
export const fold = (s: string | undefined | null) => (s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
/** Todas as palavras digitadas aparecem em algum dos textos (em qualquer ordem, sem acento). */
export const matches = (term: string, ...texts: (string | number | undefined | null)[]) => {
  const words = fold(term).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = fold(texts.filter((t) => t !== undefined && t !== null).join(' '))
  return words.every((w) => hay.includes(w))
}

export const BOTH = 'ambas'
/** até 3 opções/propostas lado a lado */
export const MAX_OPTIONS = 3
export const shownOptions = (q: Quote) => q.options.slice(0, MAX_OPTIONS)
/** "as duas" / "as três" */
export const allLabel = (q: Quote) => (shownOptions(q).length >= 3 ? 'as três' : 'as duas')
export const isCombo = (q: Quote) => q.mode === 'opcoes' && !!q.combo
export const comboSeparate = (q: Quote) => shownOptions(q).reduce((s, o) => s + optionTotal(o), 0)
export const comboTotal = (q: Quote) => Math.max(0, comboSeparate(q) - (q.comboDiscount || 0))
export const quoteTotal = (q: Quote, urgencyFee: number) => {
  if (isCombo(q) && q.chosenOption === BOTH) return comboTotal(q)
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

/** Valor que vale para o financeiro: o fechado na negociação, ou o da proposta. */
export const quoteDeal = (q: Quote, urgencyFee: number) => (q.closedValue && q.closedValue > 0 ? q.closedValue : quoteTotal(q, urgencyFee))

/* ---- pacote / parceria mensal: o total dividido em parcelas mensais iguais ---- */
export const packageMonths = (q: Pick<Quote, 'months'>) => (q.months && q.months >= 2 ? Math.min(24, Math.round(q.months)) : 0)
/** Mesmo dia nos meses seguintes (31/jan + 1 mês = 28/fev). */
export const addMonths = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const last = new Date(y, m - 1 + n + 1, 0).getDate()
  const dt = new Date(y, m - 1 + n, Math.min(d, last))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
/** Parcelas mensais: centavos que sobram vão na primeira. */
export function monthlyPayments(total: number, months: number, start: string, method = 'Pix'): Payment[] {
  const each = Math.floor((total / months) * 100) / 100
  const first = Math.round((total - each * (months - 1)) * 100) / 100
  return Array.from({ length: months }, (_, i) => ({
    id: uid(),
    description: `Parcela ${i + 1}/${months} do pacote`,
    amount: i === 0 ? first : each,
    dueDate: addMonths(start, i),
    paidDate: null,
    method,
    on: 'fechamento' as const,
    monthly: true,
  }))
}
/** Texto do pagamento de um pacote (vai na proposta e no WhatsApp). */
export const packageText = (months: number, total?: number) =>
  `pacote fechado em ${months} parcelas mensais${total ? ` de ${money(Math.round((total / months) * 100) / 100)}` : ' iguais'}: a primeira na aprovação e as outras no mesmo dia dos meses seguintes, por Pix.`

/** Divide um valor em parcelas (ex.: 50% entrada + 50% na entrega). */
export type PayMode = '50-50' | 'inicio' | 'cartao'

export const PAY_MODES: Record<PayMode, string> = {
  '50-50': '50% sinal + 50% na aprovação',
  inicio: '100% no início',
  cartao: 'cartão de crédito',
}

/** Parcelas conforme a forma combinada: sinal + aprovação, tudo no início, ou cartão. */
export function splitPayments(total: number, mode: PayMode | 'avista', start: string, due: string): Payment[] {
  const mk = (description: string, amount: number, dueDate: string, method = 'Pix', on: Payment['on'] = 'fechamento'): Payment => ({
    id: uid(),
    description,
    amount: Math.round(amount * 100) / 100,
    dueDate,
    paidDate: null,
    method,
    on,
  })
  switch (mode) {
    case 'cartao':
      return [mk('Pagamento no cartão', total, start, 'Cartão de crédito')]
    case 'inicio':
    case 'avista':
      return [mk('Pagamento 100% no início', total, start)]
    default:
      return [mk('Sinal 50%', total / 2, start), mk('Saldo 50% na aprovação', total - Math.round((total / 2) * 100) / 100, due, 'Pix', 'conclusao')]
  }
}

export const sum = <T,>(arr: T[], f: (x: T) => number) => arr.reduce((s, x) => s + f(x), 0)

export const whatsappLink = (phone: string, text = '') => {
  const digits = phone.replace(/\D/g, '')
  // número com + já tem o código do país (ex.: +351); sem +, é do Brasil
  const full = phone.trim().startsWith('+') || digits.length > 11 ? digits : `55${digits}`
  // api.whatsapp.com (e não wa.me): o redirecionamento do wa.me estraga os emojis no WhatsApp do computador
  return `https://api.whatsapp.com/send?phone=${full}${text ? `&text=${encodeURIComponent(text)}` : ''}`
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
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000) // revogar cedo cancelava o download no Safari
}

/** Formata telefone enquanto digita: (11) 96928-8192 — com +55 fica +55 11 96928-8192. */
/** Códigos de país mais comuns (o maior que combinar vence). */
const COUNTRY_CODES = ['1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '351', '352', '353', '354', '356', '358', '370', '371', '372', '380', '385', '386', '420', '421', '591', '593', '595', '598', '971', '972', '974']

/** Telefone formatado: Brasil "(11) 99999-9999" ou "+55 11 99999-9999"; outro país "+351 912 345 678". */
export function formatPhone(value: string) {
  const raw = value.trim()
  let d = raw.replace(/\D/g, '')
  const intl = raw.startsWith('+') || (d.startsWith('55') && d.length > 11)
  if (intl && !d.startsWith('55')) {
    // outro país: +código e o resto em grupos de 3 (EUA/Canadá: 3 3 4)
    if (!d) return '+'
    const cc = [...COUNTRY_CODES].sort((a, b) => b.length - a.length).find((c) => d.startsWith(c)) ?? d.slice(0, Math.min(3, d.length))
    const rest = d.slice(cc.length, cc.length + 12)
    const groups = cc === '1' ? [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 10)] : (rest.match(/.{1,3}/g) ?? [])
    // não deixa um dígito sozinho no fim: "345 6" vira "3456"
    if (groups.length > 1 && groups[groups.length - 1].length === 1) groups.splice(-2, 2, groups[groups.length - 2] + groups[groups.length - 1])
    return `+${cc}${rest ? ' ' + groups.filter(Boolean).join(' ') : ''}`
  }
  let prefix = ''
  if (intl) {
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
  ['cliente', 'primeiro nome do cliente'],
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
  ['site', 'seu site (perfil)'],
  ['instagram', 'link do seu instagram (perfil)'],
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
    vencimento: next ? (next.dueDate ? fmtDateLong(next.dueDate) : PAY_WHEN[payWhen(next)]) : '',
    prazo: project?.dueDate ? fmtDateLong(project.dueDate) : '',
    arquivos: project?.filesLink ?? '',
    pix: st.pixKey,
    meu_nome: st.ownerName || st.legalName,
    site: st.website ? 'www.' + cleanSite(st.website) : '',
    instagram: st.instagram ? `www.instagram.com/${st.instagram.trim().replace(/^@+/, '')}` : '',
  }
}

/** Troca {variáveis} pelos dados; variável vazia some sem deixar chaves no texto. */
export const fillMessage = (text: string, vars: Record<string, string>) =>
  text
    .replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
    .replace(/ {2,}/g, ' ')
    .replace(/ ([,.!?)])/g, '$1')
    .replace(/,([,!?])/g, '$1') // sem nome do cliente: "oii, , tudo bem" → "oii, tudo bem"

/** Texto de uma mensagem padrão pelo id, já preenchido (com um texto de reserva se ela foi apagada). */
export function templateText(st: Settings, id: string, fallback: string, client?: Client, project?: Project, quote?: Quote) {
  const t = st.messages.find((m) => m.id === id)?.text ?? fallback
  return fillMessage(t, messageVars(st, client, project, quote))
}

/* ---------- pacote (vários projetos numa demanda, com desconto) ---------- */

const r2 = (n: number) => Math.round(n * 100) / 100
export const pkgFull = (p: Project) => (p.items ?? []).reduce((s, i) => s + (i.price || 0), 0)
export const pkgActive = (p: Project) => (p.items ?? []).filter((i) => !i.removed).reduce((s, i) => s + (i.price || 0), 0)

/** Ajusta as parcelas em aberto para fechar com o total (sem mexer nas pagas nem nos adicionais cobrados à parte). */
export function rebalancePayments(p: Project): Payment[] {
  const fixed = new Set((p.extras ?? []).filter((x) => x.mode === 'separado').map((x) => x.paymentId))
  const paid = projectPaid(p)
  const fixedOpen = p.payments.filter((x) => !x.paidDate && fixed.has(x.id)).reduce((s, x) => s + x.amount, 0)
  const target = Math.max(0, r2(projectTotal(p) - paid - fixedOpen))
  const open = p.payments.filter((x) => !x.paidDate && !fixed.has(x.id))
  if (!open.length) {
    return target > 0.004 ? [...p.payments, { id: uid(), description: 'Saldo', amount: target, dueDate: p.dueDate || '', paidDate: null, method: 'Pix', on: 'conclusao' }] : p.payments
  }
  const cur = open.reduce((s, x) => s + x.amount, 0)
  let left = target
  const amounts = new Map<string, number>()
  open.forEach((x, i) => {
    const v = i === open.length - 1 ? r2(left) : cur > 0 ? r2((target * x.amount) / cur) : i === 0 ? target : 0
    amounts.set(x.id, v)
    left = r2(left - v)
  })
  return p.payments.map((x) => (amounts.has(x.id) ? { ...x, amount: amounts.get(x.id)! } : x))
}

/** Aplica itens + desconto do pacote: desconto proporcional aos itens que ficaram, e saldo recalculado. */
export function withPackage(p: Project, items: ProjectItem[], pkgDiscount: number): Project {
  const next: Project = { ...p, items, pkgDiscount }
  const full = pkgFull(next)
  const active = pkgActive(next)
  const done: Project = { ...next, value: r2(active), discount: full > 0 ? r2((pkgDiscount * active) / full) : 0 }
  return { ...done, payments: rebalancePayments(done) }
}

/** Texto de resumo para a cliente, no estilo das mensagens da Laís. */
export function packageSummary(p: Project): string {
  const items = p.items ?? []
  const removed = items.filter((i) => i.removed)
  const kept = items.filter((i) => !i.removed)
  const full = pkgFull(p)
  const disc = p.pkgDiscount ?? 0
  const pkgTotal = r2(projectTotal({ ...p, extras: [] }))
  const paid = projectPaid(p)
  const lines: string[] = []
  lines.push(`➡️ o pacote ${removed.length ? 'inicial ' : ''}dos ${items.length} projetos ${removed.length ? 'era' : 'é'} ${money(full)}${disc ? `, com ${money(disc)} de desconto, ficando em ${money(full - disc)}` : ''}`)
  if (removed.length) {
    lines.push('')
    lines.push(`como ${removed.map((i) => `${i.title} (${money(i.price)})`).join(' e ')} ${removed.length > 1 ? 'foram retirados' : 'foi retirado'}, o desconto foi ajustado proporcionalmente ${kept.length > 1 ? `aos ${kept.length} projetos restantes` : 'ao projeto restante'}:`)
    lines.push('')
    kept.forEach((i) => lines.push(`* ${i.title} — ${money(i.price)}`))
    lines.push(`novo total com desconto: ${money(pkgTotal)}`)
  }
  if (paid > 0) lines.push('', `como já foi pago ${money(paid)}, o saldo dos projetos fica em ${money(Math.max(0, pkgTotal - paid))}`)
  const extras = p.extras ?? []
  if (extras.length) {
    lines.push('', '➡️ adicionais:')
    extras.forEach((x) => lines.push(`* ${x.title}${x.quantity && x.unitPrice ? ` — ${x.quantity} × ${money(x.unitPrice)}` : ''} — ${money(x.value)}`))
    lines.push('', '➡️ resumo:')
    lines.push(`* saldo dos projetos: ${money(Math.max(0, pkgTotal - paid))}`)
    lines.push(`* adicionais: ${money(extras.reduce((s, x) => s + x.value, 0))}`)
  }
  lines.push(`💵 total restante: ${money(Math.max(0, projectOpen(p)))}`)
  return lines.join('\n')
}

/* ---------- escopo: perguntar ao cliente o que ele precisa e ler a resposta ---------- */

const scopeNorm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[⁠​‌‍﻿]/g, '')
    .toLowerCase()
    .replace(/^[\s\-–—•·*>✔✅☑️\d.)]+/u, '')
    .replace(/\s+/g, ' ')
    .replace(/[:\s]+$/, '')
    .trim()
const scopeCore = (s: string) => scopeNorm(s.replace(/\(.*?\)/g, ''))

/** Mensagem "quais plantas você gostaria?" com as listas dos serviços (executivo, detalhamento…). */
/** Pergunta de cada serviço com lista (a escrita em configurações, ou uma padrão pelo título). */
export const serviceAsk = (s: ServiceDef) => s.askText?.trim() || (/planta/i.test(s.checklistTitle || s.name) ? 'Quais plantas você gostaria?' : `Sobre ${(s.checklistTitle || s.name).toLowerCase()}: o que você precisa?`)

/** Pergunta para o cliente: só dos serviços que estão neste orçamento e que têm lista para escolher. */
export function scopeQuestion(services: ServiceDef[], onlyIds?: string[]) {
  // a lista principal (a maior, ex.: plantas executivas) vem primeiro
  const lists = services
    .filter((s) => s.checklist?.some((c) => c.trim()) && (!onlyIds || onlyIds.includes(s.id)))
    .sort((a, b) => b.checklist!.length - a.checklist!.length)
  if (!lists.length) return ''
  const block = (s: ServiceDef) => [`${s.checklistTitle || s.name}:`, ...s.checklist!.filter((c) => c.trim()).map((c) => `- ${c.trim()}`), '- outros: ___'].join('\n')
  const file = lists.some((s) => s.deliveryOpen) ? ['E o arquivo final: você precisa só do PDF pronto para execução ou também do arquivo aberto (editável)?'] : []
  // um serviço: a pergunta dele; vários: cada lista com a sua pergunta
  const body = lists.length === 1 ? [serviceAsk(lists[0]), block(lists[0])] : ['Para eu te passar o valor certinho, me conta:', ...lists.map((s) => `${serviceAsk(s)}\n${block(s)}`)]
  return [...body, ...file, 'Com isso consigo te passar o valor certinho 😊'].join('\n\n')
}

/** Lê a resposta do cliente (a mesma lista, só com o que ele quer) e separa por serviço. */
export function parseScopeReply(text: string, services: ServiceDef[]) {
  const lists = services.filter((s) => s.checklist?.length)
  const out: Record<string, string[]> = {}
  let current: ServiceDef | undefined
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[⁠​﻿]/g, '').trim()
    const n = scopeNorm(line)
    if (!n || n.endsWith('?') || n.includes('valor certinho')) continue
    // título de uma lista ("plantas executivas:", "detalhamentos (caso precise):")
    const head = lists.find((s) => {
      const t = scopeCore(s.checklistTitle || s.name)
      const c = scopeCore(line)
      return c === t || c === scopeNorm(s.name) || (line.trim().endsWith(':') && (c.startsWith(t) || t.startsWith(c)))
    })
    if (head) {
      current = head
      continue
    }
    let item = line.replace(/^[\s\-–—•·*>✔✅☑️\d.)]+/u, '').trim()
    const other = /^outros?\s*:/i.exec(item)
    if (other) item = item.slice(other[0].length).trim()
    if (!item || /^_+$/.test(item)) continue
    // item igual ao da lista → usa o nome da lista; senão mantém como o cliente escreveu
    const exact = (s: ServiceDef) => s.checklist!.find((c) => scopeNorm(c) === scopeNorm(item) || scopeCore(c) === scopeCore(item)) ?? checklistMatch(s, item)
    const owner = (current && (exact(current) || !lists.some((s) => s !== current && exact(s))) ? current : lists.find((s) => exact(s))) ?? current
    if (!owner) continue
    // só troca pelo nome da lista quando é o mesmo item; "serralheria com vidraçaria" fica como o cliente escreveu
    const same = exact(owner)
    const name = same && scopeKey(same) === scopeKey(item) ? same : item
    out[owner.id] = [...(out[owner.id] ?? []), ...(out[owner.id]?.includes(name) ? [] : [name])]
  }
  return out
}

/* ---------- formatos de arquivos entregues ---------- */

/** O orçamento tem algum serviço que pode ser entregue com arquivo aberto? */
export const quoteServices = (q: Quote, services: ServiceDef[]) => {
  const items = q.mode === 'opcoes' ? q.options.flatMap((o) => o.items) : q.items
  const ids = [...new Set(items.map((i) => i.service).filter(Boolean))]
  return ids.map((id) => services.find((s) => s.id === id)).filter((s): s is ServiceDef => !!s)
}
/** Tem algum serviço no orçamento em que o arquivo aberto faz sentido (tudo menos o que já vai aberto). */
export const canOpenFile = (q: Quote, services: ServiceDef[]) =>
  [...q.items, ...(q.mode === 'opcoes' ? q.options.flatMap((o) => o.items) : [])].some((it) => !it.joined && (it.price > 0 || it.service) && !alreadyOpen(services.find((x) => x.id === it.service)))

/** Texto de "formatos de arquivos entregues" montado pelos serviços do orçamento. */
export function autoFiles(q: Quote, services: ServiceDef[]) {
  const parts = quoteServices(q, services)
    .map((s) => ({ name: s.name, text: ((q.openFile && (s.deliveryOpen || (!alreadyOpen(s) && s.delivery ? `${s.delivery} + arquivo aberto (editável)` : ''))) || s.delivery || '').trim() }))
    .filter((x) => x.text)
  const texts = [...new Set(parts.map((x) => x.text))]
  if (!texts.length) return ''
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
  if (texts.length === 1) return `${cap(texts[0])}.`
  // serviços com entregas diferentes: "executivo e detalhamento: PDF… · renderização V-Ray: PNG…"
  return texts.map((t) => `${parts.filter((x) => x.text === t).map((x) => x.name).join(' e ')}: ${t}`).join(' · ')
}
/** O que vai no PDF: automático (pelos serviços) ou o texto escrito à mão. */
export const quoteFiles = (q: Quote, services: ServiceDef[]) => (q.filesAuto ? autoFiles(q, services) || q.files : q.files)
