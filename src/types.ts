import type { DocsState, SavedDoc } from './docTypes'

export type ClientType =
  | 'final' // cliente final: a pessoa dona da casa/obra (quem contrata arquiteto ou designer)
  | 'arquiteto'
  | 'designer'
  | 'escritorio'
  | 'construtora'
  | 'estudante'
  | 'outro'

/** Como a conta trabalha: presta serviço para escritórios, atende cliente final ou os dois. */
export type WorkProfile = 'freelancer' | 'final' | 'ambos'

/** Ficha do cliente final (mais dados para conhecer a família e o imóvel). */
export interface ClientProfile {
  profession?: string
  marital?: string
  birthDate?: string
  household?: string // quem mora / vai usar o espaço
  kids?: string
  pets?: string
  routine?: string
  style?: string
  propertyType?: string
  propertyOwnership?: string
  propertyAddress?: string
  propertyArea?: string
  investment?: string
  deadline?: string
}

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
  profile?: ClientProfile // só para cliente final
  panel?: ClientPanel // painel do cliente (link com tudo o que o profissional compartilhar)
  archived: boolean
  createdAt: string
}

/** Painel do cliente: uma página só dele, pelo link, com projetos, etapas, pagamentos e documentos. */
export interface ClientPanel {
  token: string
  enabled: boolean
  file?: boolean // publicado como arquivo: link curto (/#/cliente/…)
  message?: string // recado no topo do painel
  showPayments: boolean
  showVisits?: boolean
  showQuotes?: boolean // propostas enviadas/fechadas
  showBriefings?: boolean
  hideProjects?: string[] // demandas que não aparecem
  contracts?: string[] // contratos compartilhados
  docs?: string[] // documentos salvos compartilhados
  files?: PanelFile[] // arquivos enviados (PDF, imagem…)
  publishedAt?: string
}
export interface PanelFile {
  id: string
  name: string
  url: string
  path?: string // caminho na nuvem (para apagar)
  size?: number
  type?: string
  projectId?: string
  at: string
}

/** Aviso dentro do sistema: algo que o cliente preencheu, assinou ou mandou. */
export interface Notice {
  id: string
  at: string
  kind: 'briefing' | 'assinatura' | 'recado' | 'aviso'
  title: string
  text?: string
  clientId?: string
  link?: string // rota interna (ex.: contratos/<id>)
  read?: boolean
  ref?: string // o que gerou o aviso (evita repetir)
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
  kind?: 'final' | 'freela' | 'estudante' // tipo de trabalho escolhido à mão (vazio = pelo cliente)
  // plano Estúdio
  phases?: ProjectPhase[] // cronograma: etapas do projeto com prazo e parcela
  visits?: SiteVisit[] // acompanhamento de obra
  costs?: ProjectCost[] // custos do projeto (taxas, impressões, deslocamento…)
  portal?: ProjectPortal // página de acompanhamento para o cliente
}

/** Etapa do cronograma (estudo preliminar, anteprojeto, executivo…). */
export interface ProjectPhase {
  id: string
  name: string
  start?: string
  due?: string
  done?: boolean
  doneAt?: string
  paymentId?: string // parcela que é cobrada quando esta etapa termina
  note?: string
}
export interface VisitPhoto {
  id: string
  path?: string // arquivo guardado na nuvem (pasta da conta)
  data?: string // prévia: a própria imagem (só neste aparelho)
  caption?: string
}
/** Visita de obra: o que foi visto, fotos e o que fazer depois. */
export interface SiteVisit {
  id: string
  date: string
  title: string
  notes: string
  next?: string // próximos passos / pendências
  photos: VisitPhoto[]
}
export interface ProjectCost {
  id: string
  date: string
  description: string
  category: string
  amount: number
}
export interface ProjectPortal {
  token: string
  enabled: boolean
  showPayments: boolean
  showFiles: boolean
  showVisits: boolean
  message?: string
  publishedAt?: string
  file?: boolean // publicada também como arquivo: link curto (/#/p/…)
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
  projectRemoved?: boolean // a demanda deste orçamento foi apagada de propósito (não pede para lançar de novo)
  closedNote?: string // o que mudou no fechamento (escopo, valor…)
  audience?: QuoteAudience // para quem é: cliente final (proposta em slides, etapas) ou escritório parceiro (vazio = parceiro)
  processId?: string // processo de trabalho usado como base das etapas
  steps?: ProcessStep[] // etapas do projeto (cliente final): o que inclui, prazo e % do pagamento
  intro?: string // texto de abertura da proposta (cliente final)
}

export type QuoteAudience = 'final' | 'parceiro'

/** Uma etapa do processo de projeto (briefing, layout, anteprojeto, executivo, obra…). */
export interface ProcessStep {
  id: string
  name: string
  description: string
  items: string[] // o que está incluído nesta etapa (vira lista na proposta)
  days: number // prazo desta etapa (0 = sem prazo)
  dayType?: 'uteis' | 'corridos'
  percent: number // parte do pagamento cobrada nesta etapa (0 = nada)
}

/** Jeito de trabalhar (interiores, arquitetônico, consultoria online…): cada pessoa edita o seu. */
export interface ProjectProcess {
  id: string
  name: string
  description: string
  steps: ProcessStep[]
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
  group?: string // grupo na tabela (ex.: "projetos complementares"), só para organizar
  pricing: Pricing // por unidade, pacotes, por m² × complexidade ou valor livre
  price: number // R$ por unidade (ou por m²)
  tiers: PriceTier[] // pacotes com desconto por quantidade
  min: number // valor mínimo do item
  base?: number // valor base do projeto, somado ao m² (serviços por m²)
  hours: number // horas estimadas por unidade
  studentPrice?: number // (antigo) substituído pelo desconto de estudante
  checklistTitle?: string // ex.: "plantas executivas" (título da lista que o cliente escolhe)
  askText?: string // pergunta ao cliente sobre esta lista (ex.: "Quais plantas você gostaria?")
  checklist?: string[] // o que o cliente pode escolher (plantas, tipos de detalhamento…)
  checklistPrices?: Record<string, number> // valor de cada opção: R$/m² (serviço por m²) ou R$ cada (por unidade)
  customRate?: number // valor de um item personalizado (escrito à mão), na mesma unidade
  delivery?: string // como é entregue (ex.: "PDF fechado, pronto para execução")
  noteHints?: string[] // observações prontas para este serviço (aparecem como sugestão no orçamento)
  deliveryOpen?: string // como é entregue quando o cliente quer o arquivo aberto ('' = não se aplica)
  audience?: 'final' | 'parceiro' | 'ambos' // para quem este serviço aparece no orçamento (vazio = pelo tipo do serviço)
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
  hidden?: string[] // modelos prontos que a pessoa apagou (não voltam sozinhos)
}

export type ContractStatus = 'rascunho' | 'enviado' | 'assinado'

/** Assinatura registrada: pelo link do traço (aceite com nome e CPF) ou por um site de assinatura. */
export interface ContractSignature {
  via: 'link' | 'externo'
  name: string
  doc?: string // CPF / CNPJ de quem assinou
  at: string // data e hora (ISO)
  hash?: string // código que liga a assinatura a este texto exato (pelo link)
  site?: string // site usado (gov.br, ZapSign…)
  method?: 'desenho' | 'digitado' // como o cliente assinou pelo link
  drawing?: string // traço da assinatura desenhada (caminho SVG, área 600 × 200)
  font?: string // letra escolhida para o nome digitado
  contact?: string // e-mail ou WhatsApp informado por quem assinou
  device?: string // aparelho e navegador usados
  tz?: string // fuso horário do aparelho
  geo?: string // localização aproximada (só se a pessoa permitiu)
  docHash?: string // SHA-256 do texto do contrato assinado
  confirmedAt?: string // quando a confirmação chegou e foi registrada
}

export interface Contract {
  id: string
  title: string
  quoteId: string
  clientId: string
  templateId: string
  body: string // texto final (já preenchido e editável)
  status: ContractStatus
  createdAt: string
  signToken?: string // identifica o link de assinatura
  signLink?: string
  sign?: ContractSignature
}

export interface Settings {
  workProfile?: WorkProfile // vazio = como sempre foi (freelancer)
  hourlyCost?: number // quanto vale uma hora sua (para o lucro por projeto)
  processes?: ProjectProcess[] // processos de trabalho para cliente final (vazio = os prontos)
  freelaTasks?: string[] // etapas da demanda freelancer / escritório parceiro (vazio = as prontas)
  studentTasks?: string[] // etapas da demanda de estudante (vazio = as prontas)
  portfolio?: string[] // fotos de projetos para a proposta e a apresentação (data URL, trocáveis)
  about?: string // "sobre" do escritório, na proposta para cliente final
  briefingTemplates?: BriefingTemplate[] // modelos de briefing criados ou editados pela pessoa
  hiddenBriefings?: string[] // modelos prontos que a pessoa tirou da lista dela
  docs?: DocsState // documentos do estúdio (guia de medição, placa de obra, apresentação)
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
  newsShown?: string[] // novidades que já abriram sozinhas uma vez (cada atualização aparece sozinha uma vez só)
  welcomed?: boolean // já viu o cartão de boas-vindas
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
  instagramOff?: boolean // não usa o planejamento do instagram (some do menu)
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
  briefings?: Briefing[] // briefings enviados para clientes finais
  docs?: SavedDoc[] // documentos salvos nas fichas dos clientes (guia, placa, apresentação…)
  notices?: Notice[] // central de avisos (o que os clientes preencheram)
  deleted?: string[] // ids apagados (outro aparelho aberto com a versão antiga não traz de volta)
  settings: Settings
}

export type BriefingKind = 'text' | 'long' | 'choice' | 'multi' | 'photos' | 'date'
export interface BriefingQuestion {
  id: string
  section: string
  label: string
  kind: BriefingKind
  options?: string[]
  field?: keyof ClientProfile // a resposta também preenche a ficha do cliente
  required?: boolean
  hint?: string // explicação curta embaixo da pergunta
  images?: string[] // imagens de referência que o arquiteto mostra (ex.: estilos)
  other?: boolean // escolha com opção "outro" para escrever
  optionImages?: Record<string, string> // escolha por imagem: foto/ilustração de cada opção ("art:..." = ilustração pronta)
  showIf?: { q: string; is?: string; value?: string } // sub-pergunta: só aparece quando a pergunta `q` tem a resposta `is` (`value` nos links antigos)
  tips?: string[] // fotos sugeridas (perguntas de anexar fotos): "de cada parede", "do teto"…
}
export interface BriefingSection {
  id: string
  title: string
  description?: string
}
/** Modelo de briefing (os prontos do sistema e os que a pessoa cria ou edita). */
export interface BriefingTemplate {
  id: string
  name: string
  description: string
  icon?: string
  sections: BriefingSection[]
  questions: BriefingQuestion[]
  updatedAt?: string
}
export type BriefingAnswers = Record<string, string | string[]>
export interface Briefing {
  id: string // também é o código do link
  clientId: string
  title: string
  questions: BriefingQuestion[]
  sections?: BriefingSection[]
  templateId?: string
  answers?: BriefingAnswers
  status: 'enviado' | 'respondido'
  createdAt: string
  answeredAt?: string
  pack?: string // cópia compacta que vai dentro do link (abre mesmo sem a nuvem)
  short?: string // código do link curto (/#/b/…): o briefing fica num arquivo público da conta
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
