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
  cep?: string
  address?: string // rua e bairro
  addressNumber?: string // nº e complemento
  document: string // CPF/CNPJ para recibos
  companyDoc?: string // CNPJ do escritório/empresa
  companyLegal?: string // razão social
  companyKind?: string // MEI, ME, EPP, LTDA…
  billTo?: 'pessoa' | 'empresa' // em nome de quem sai o recibo
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
  fee?: number // taxa da maquininha/Mercado Pago (em branco: calcula pela % das configurações)
  monthly?: boolean // parcela mensal de um pacote: só vira "cobrar" perto do vencimento
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
  removed?: boolean // cliente cancelou depois de fechado (fica no histórico, não é apagado)
  removedAt?: string
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
  noPhone?: boolean // true = prazo e parcelas desta demanda não vão para a agenda do celular
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
  customType?: string // quando o tipo é "outro": nome digitado (ex.: "curso", "médico")
  noPhone?: boolean // true = não vai para a agenda do celular
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
  joined?: boolean // cobrado junto com o serviço de cima (um valor só para os dois)
  openFee?: boolean // valor digitado à mão já com a taxa de arquivo aberto somada
}

export interface QuoteOption {
  id: string
  name: string // título do quadro (ex.: "renderização V-Ray • 10 imagens")
  items: QuoteItem[] // serviços desta opção, cada um com valor
  note: string // observação dentro do quadro
  discount: number // desconto desta opção (R$)
  discountNote: string // texto abaixo do total
  deadlineDays: number
  // área e pavimentos deste quadro (opções/propostas de projetos diferentes); em branco = os do orçamento
  area?: number
  areaApprox?: boolean
  floors?: number
  floorsHidden?: boolean // não mostra os pavimentos no PDF (só servem para o valor)
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
  mode: 'escopo' | 'opcoes' // valor único com escopo, ou 2–3 opções para o cliente escolher
  pdf: boolean // gera a proposta em PDF (nem todo orçamento precisa)
  area: number // m² do projeto, mostrado na legenda da proposta (0 = não mostrar)
  areaApprox?: boolean // área estimada: aparece como "≈ 45.000 m²"
  floors?: number // nº de pavimentos (1 = térreo só); cada um a mais encarece
  floorsHidden?: boolean // não mostra os pavimentos no PDF (só servem para o valor)
  clientLabel: string // nome em "para …" (vazio = nome do cliente)
  items: QuoteItem[]
  options: QuoteOption[]
  chosenOption: string // id da opção escolhida, ou 'ambas' (2 propostas fechadas juntas)
  combo?: boolean // 2 propostas independentes: fechar as duas juntas dá desconto
  comboDiscount?: number // desconto em R$ para fechar as duas juntas
  discount: number
  discountNote: string
  files: string // formatos de arquivos entregues
  filesAuto?: boolean // true = o texto de entrega sai dos serviços escolhidos
  openFile?: boolean // cliente quer o arquivo aberto (taxa interna, não aparece no PDF)
  schedule: string // prazos e cronograma (texto da proposta)
  urgency: boolean
  deadlineDays: number
  validityDays: number
  revisions: number
  paymentTerms: string
  notes: string
  status: QuoteStatus
  sentAt: string // quando foi enviado ao cliente (para lembrar de cobrar resposta)
  closedAt?: string // quando a cliente fechou (pode ser dias depois do orçamento)
  pdfAt?: string // quando o PDF deste rascunho foi baixado (reserva o número)
  imported?: boolean // veio da importação de orçamentos antigos (mantém o número real)
  noNumber?: boolean // orçamento antigo lançado sem número (não entra na numeração)
  months?: number // pacote / parceria: o total dividido em parcelas mensais (0 ou vazio = normal)
  dateFixed?: boolean // rascunho com data escolhida por ela (senão a data vai para hoje ao abrir)
  createdAt: string
  projectId: string
  closedValue?: number // valor fechado depois da negociação (0 = o da proposta)
  closedNote?: string // o que mudou no fechamento (escopo, valor…)
}

export type Pricing = 'unidade' | 'pacote' | 'm2' | 'hora' | 'livre'

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
  base?: number // valor base do projeto, somado ao m² (serviços por m²)
  hours: number // horas estimadas por unidade
  studentPrice?: number // (antigo) substituído pelo desconto de estudante
  checklistTitle?: string // ex.: "plantas executivas" (título da lista que o cliente escolhe)
  checklist?: string[] // o que o cliente pode escolher (plantas, tipos de detalhamento…)
  checklistPrices?: Record<string, number> // valor de cada opção: R$/m² (serviço por m²) ou R$ cada (por unidade)
  customRate?: number // valor de um item personalizado (escrito à mão), na mesma unidade
  delivery?: string // como é entregue (ex.: "PDF fechado, pronto para execução")
  noteHints?: string[] // observações prontas para este serviço (aparecem como sugestão no orçamento)
  deliveryOpen?: string // como é entregue quando o cliente quer o arquivo aberto ('' = não se aplica)
  perFloor?: boolean // encarece a cada pavimento a mais (pranchas, arquivos e modelos em dobro, triplo…)
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
  template?: string // modelo escolhido (src/proposalTemplates.ts); vazio = padrão do plano
  pdfOff?: boolean // não usa PDF: orçamento vai só como resumo no WhatsApp
  sans?: string // fonte dos textos da proposta (padrão Poppins)
  showLogo?: boolean // logo do perfil no topo da proposta
}

/** Modelo de contrato com {variáveis} preenchidas pelo orçamento. */
export interface ContractTemplate {
  id: string
  name: string
  body: string
}

export interface ContractSettings {
  off?: boolean // não usa contratos (some do menu)
  templates: ContractTemplate[]
}

export type ContractStatus = 'rascunho' | 'enviado' | 'assinado'

export interface Contract {
  id: string
  title: string
  quoteId: string
  clientId: string
  templateId: string
  body: string // texto final (já preenchido e editável)
  status: ContractStatus
  createdAt: string
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
  calendarToken: string // chave secreta do link de agenda para o celular ('' = desligada)
  calendarSync?: { entregas: boolean; pagamentos: boolean; compromissos: boolean; periodos?: boolean } // o que vai para o celular
  city: string
  cep?: string
  address?: string // rua e bairro
  addressNumber?: string // nº e complemento
  logo: string // data URL
  avatarIcon?: string // símbolo no lugar da foto (quando não há logo)
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
  openFileFee?: number // % a mais quando o cliente quer o arquivo aberto (interno)
  floorFee?: number // % a mais por pavimento adicional
  defaultRevisions: number
  quoteStart?: number // numeração dos orçamentos começa aqui (ex.: 100); depois segue o maior + 1
  revisionsV1?: boolean // já migrou o padrão de rodadas de ajuste para 1
  defaultPaymentTerms: string
  paymentMethods?: string[] // formas de receber (lista editável)
  cardFee?: number // % de taxa no cartão de crédito (Mercado Pago, receber na hora)
  signature?: string // imagem da assinatura (data URL), vai no contrato
  firstStepsHidden?: boolean // cartão "primeiros passos" escondido
  tour?: string // passo a passo do primeiro acesso: 'feito' ou a data em que escolheu "ver depois"
  newsSeen?: string[] // novidades já vistas (vazio/ausente: ainda não começou a acompanhar)
  eventLabels?: Partial<Record<EventType, string>> // nomes dos tipos de compromisso (editáveis)
  aiKey?: string // chave do Gemini (Google AI Studio) para o chat
  messagesV3?: boolean // migração: mensagens de cobrar retorno (ajustes/aprovação)
  messagesV2?: boolean // migração: mensagens padrão reescritas em minúsculas, com emojis
  imagesV1?: boolean // migração: imagens deixaram de encarecer por pavimento
  slidesV1?: boolean // migração: serviço de apresentação em slides
  aiLowercase?: boolean // respostas da IA em minúsculas (R$ sempre maiúsculo); padrão ligado
  aiNotes?: string // regras e jeito de trabalhar, escritas por você, para a IA seguir
  notDuplicates?: string[] // pares de clientes marcados como pessoas diferentes (ids "a|b")
  aiShareNames?: boolean // mandar nomes de clientes para a IA (padrão: não)
  services: ServiceDef[]
  customColumns: BoardColumn[] // colunas extras do quadro de demandas
  navOrder: string[] // ordem do menu lateral
  messages: MessageTemplate[] // mensagens padrão para o cliente
  contracts?: ContractSettings // modelos de contrato (plano Completo)
}

export interface Data {
  version: number
  demo?: boolean // true enquanto só houver dados de exemplo
  clients: Client[]
  projects: Project[]
  expenses: Expense[]
  events: CalendarEvent[]
  quotes: Quote[]
  posts?: SocialPost[] // planejamento do instagram
  contracts?: Contract[] // contratos gerados a partir dos orçamentos
  settings: Settings
}

export type PostFormat = 'carrossel' | 'reels' | 'story' | 'post'
export type PostStatus = 'ideia' | 'produzindo' | 'pronto' | 'postado'
/** Postagem planejada do instagram (conteúdo pronto e editável). */
export interface SocialPost {
  id: string
  date: string // aaaa-mm-dd ('' = sem data, fica no banco de ideias do mês)
  time: string
  format: PostFormat
  pillar: string
  title: string
  hook: string // primeira frase / capa
  script: string // slides do carrossel, cenas do reels ou telas do story (uma por linha)
  caption: string
  art: string // ideia de arte
  cta: string
  hashtags: string
  status: PostStatus
  ideaId?: string // de qual ideia pronta veio
}
