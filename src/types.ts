export type ClientType =
  | 'arquiteto'
  | 'designer'
  | 'escritorio'
  | 'construtora'
  | 'estudante'
  | 'outro'

export interface ClientNote {
  id: string
  date: string
  text: string
}

export interface Client {
  id: string
  name: string
  company: string
  type: ClientType
  email: string
  phone: string
  instagram: string
  city: string
  document: string // CPF/CNPJ para recibos
  origin: string // indicação, instagram, site...
  notes: string
  favorite: boolean
  history: ClientNote[] // conversas e combinados, com data
  archived: boolean
  createdAt: string
}

export type ProjectStatus =
  | 'briefing'
  | 'producao'
  | 'revisao'
  | 'aguardando'
  | 'entregue'
  | 'pausado'
  | 'cancelado'
  | (string & {}) // colunas criadas pela usuária (ex.: "col-ab12")

export interface BoardColumn {
  id: string
  label: string
  color: string
}

export type Priority = 'baixa' | 'media' | 'alta' | 'urgente'

export interface Payment {
  id: string
  description: string
  amount: number
  dueDate: string // yyyy-mm-dd
  paidDate: string | null
  method: string
  on?: 'fechamento' | 'conclusao' // quando é cobrada: sinal no fechamento, saldo na conclusão
}

export interface Task {
  id: string
  text: string
  done: boolean
}

export interface TimeLog {
  id: string
  date: string
  hours: number
  note: string
}

/** Serviço pedido depois do fechamento (opcional). Entra no total e no financeiro. */
export interface Extra {
  id: string
  date: string
  title: string
  value: number
  mode: 'saldo' | 'separado' // somado à próxima parcela em aberto ou cobrado à parte
  quantity?: number // opcional: quantidade × valor unitário (ex.: 15 imagens × R$ 35)
  unitPrice?: number
  paymentId: string // parcela que recebeu o valor
}

/** Item de um pacote fechado (ex.: 3 projetos com desconto). Retirado = cancelado, fica no histórico. */
export interface ProjectItem {
  id: string
  title: string
  price: number
  removed?: boolean
}

export interface Project {
  id: string
  clientId: string
  title: string
  service: string // id do serviço em settings.services
  quantity: number // nº de imagens / pranchas / segundos
  description: string
  status: ProjectStatus
  priority: Priority
  startDate: string
  dueDate: string
  deliveredDate: string | null
  value: number
  discount: number
  payments: Payment[]
  extras?: Extra[]
  items?: ProjectItem[] // opcional: pacote com vários projetos
  pkgDiscount?: number // desconto original do pacote (redistribuído se um item sair)
  revisionsIncluded: number
  revisionsUsed: number
  estimatedHours: number
  timeLogs: TimeLog[]
  tasks: Task[]
  filesLink: string
  timerStart: string | null // cronômetro rodando desde (ISO)
  notes: string
  createdAt: string
}

export type ExpenseCategory =
  | 'software'
  | 'equipamento'
  | 'impostos'
  | 'marketing'
  | 'internet'
  | 'cursos'
  | 'terceiros'
  | 'outros'

export interface Expense {
  id: string
  description: string
  category: ExpenseCategory
  amount: number
  date: string
  recurring: boolean // repete todo mês
  notes: string
}

export type EventType = 'reuniao' | 'faculdade' | 'entrega' | 'pessoal' | 'outro'

export interface CalendarEvent {
  id: string
  title: string
  date: string
  time: string
  type: EventType
  projectId: string
  notes: string
  done: boolean
}

export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado'

export type Complexity = 'simples' | 'media' | 'alta'

export interface QuoteItem {
  id: string
  service: string // id do serviço ('' = personalizado)
  title: string // nome que aparece na proposta
  detail: string // "5 imagens", "120 m² · complexidade média"…
  description: string // o que está incluso
  quantity: number
  complexity: Complexity
  price: number // valor total do item
  unitDiscount?: number // desconto em R$ por unidade (ex.: por imagem) sobre a tabela
  auto: boolean // true = valor segue a tabela; false = digitado à mão
}

export interface QuoteOption {
  id: string
  name: string // título do quadro (ex.: "renderização V-Ray • 10 imagens")
  items: QuoteItem[] // serviços desta opção, cada um com valor
  note: string // observação dentro do quadro
  discount: number // desconto desta opção (R$)
  discountNote: string // texto abaixo do total
  deadlineDays: number
  // campos antigos (propostas criadas antes do modelo novo)
  summary?: string
  included?: string[]
  price?: number
}

export interface Quote {
  id: string
  number: number
  clientId: string
  title: string
  mode: 'escopo' | 'opcoes' // valor único com escopo, ou 2 opções para o cliente escolher
  pdf: boolean // gera a proposta em PDF (nem todo orçamento precisa)
  area: number // m² do projeto, mostrado na legenda da proposta (0 = não mostrar)
  areaApprox?: boolean // área estimada: aparece como "≈ 45.000 m²"
  clientLabel: string // nome em "para …" (vazio = nome do cliente)
  items: QuoteItem[]
  options: QuoteOption[]
  chosenOption: string
  discount: number
  discountNote: string
  files: string // formatos de arquivos entregues
  schedule: string // prazos e cronograma (texto da proposta)
  urgency: boolean
  deadlineDays: number
  validityDays: number
  revisions: number
  paymentTerms: string
  notes: string
  status: QuoteStatus
  sentAt: string // quando foi enviado ao cliente (para lembrar de cobrar resposta)
  createdAt: string
  projectId: string
  closedValue?: number // valor fechado depois da negociação (0 = o da proposta)
}

export type Pricing = 'unidade' | 'pacote' | 'm2' | 'livre'

export interface PriceTier {
  qty: number // a partir desta quantidade
  price: number // valor do pacote (ex.: 5 imagens = 370)
}

export interface ServiceDef {
  id: string
  name: string
  unit: string // imagem, prancha, m², projeto
  pricing: Pricing // por unidade, pacotes, por m² × complexidade ou valor livre
  price: number // R$ por unidade (ou por m²)
  tiers: PriceTier[] // pacotes com desconto por quantidade
  min: number // valor mínimo do item
  hours: number // horas estimadas por unidade
  studentPrice?: number // (antigo) substituído pelo desconto de estudante
}

export interface MessageTemplate {
  id: string
  name: string // quando usar (ex.: "cobrar resposta do orçamento")
  text: string // com {cliente}, {projeto}, {valor}…
}

export interface ProposalStyle {
  version: number
  eyebrow: string // "proposta de"
  title: string // "orçamento"
  serif: string // fonte do título
  ink: string // azul dos textos
  rose: string // rosé dos rótulos
  arch: string // fundo da faixa do total
  paper: string // fundo da folha
  bar: string // faixa do topo e ícones
  files: string // formatos de arquivos entregues (padrão)
  schedule: string // prazos e cronograma (padrão)
  showArch: boolean
}

export interface Settings {
  brandName: string
  tagline: string
  ownerName: string
  email: string
  phone: string
  instagram: string
  website: string
  document: string
  pixKey: string
  calendarToken: string // chave secreta do link de agenda para o celular
  city: string
  logo: string // data URL
  customFont: string // arquivo de fonte enviado (data URL), ex.: The Seasons
  themeVersion: number
  accent: string
  accentSoft: string
  accentInk: string // rosé terroso dos itálicos e rótulos
  background: string
  surface: string
  text: string
  displayFont: string
  bodyFont: string
  radius: number
  uppercaseLabels: boolean
  dark: boolean
  monthlyGoal: number
  studentDiscount: number // % de desconto na tabela para estudantes
  complexity: Record<Complexity, number> // multiplicadores do m²
  legalName: string // nome completo (proposta, recibo)
  proposal: ProposalStyle
  meiLimit: number // teto anual do MEI
  hourlyTarget: number
  urgencyFee: number // %
  defaultRevisions: number
  quoteStart?: number // numeração dos orçamentos começa aqui (ex.: 100); depois segue o maior + 1
  revisionsV1?: boolean // já migrou o padrão de rodadas de ajuste para 1
  defaultPaymentTerms: string
  services: ServiceDef[]
  customColumns: BoardColumn[] // colunas extras do quadro de demandas
  navOrder: string[] // ordem do menu lateral
  messages: MessageTemplate[] // mensagens padrão para o cliente
}

export interface Data {
  version: number
  demo?: boolean // true enquanto só houver dados de exemplo
  clients: Client[]
  projects: Project[]
  expenses: Expense[]
  events: CalendarEvent[]
  quotes: Quote[]
  settings: Settings
}
