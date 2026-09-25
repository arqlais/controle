export type ClientType =
  | 'arquiteto'
  | 'designer'
  | 'escritorio'
  | 'construtora'
  | 'incorporadora'
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

export type Priority = 'baixa' | 'media' | 'alta' | 'urgente'

export interface Payment {
  id: string
  description: string
  amount: number
  dueDate: string // yyyy-mm-dd
  paidDate: string | null
  method: string
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

export interface QuoteItem {
  id: string
  service: string
  description: string
  quantity: number
  unitPrice: number
}

export interface Quote {
  id: string
  number: number
  clientId: string
  title: string
  items: QuoteItem[]
  discount: number
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
}

export interface ServiceDef {
  id: string
  name: string
  unit: string // imagem, prancha, m², segundo, projeto
  price: number // preço profissional
  studentPrice: number // preço estudante
  hours: number // horas estimadas por unidade
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
  meiLimit: number // teto anual do MEI
  hourlyTarget: number
  urgencyFee: number // %
  defaultRevisions: number
  defaultPaymentTerms: string
  services: ServiceDef[]
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
