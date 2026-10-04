/* ============================================================
   Plataforma: nome, preços, planos e o que cada plano libera.
   TUDO que é "comercial" fica aqui — trocar nome ou preço é só neste arquivo.
   ============================================================ */

/** Nome, contatos e endereço da plataforma. */
export const PLATFORM = {
  name: 'planê',
  domain: 'useplane.com.br', // site oficial
  email: 'equipe.plane@gmail.com', // contato e suporte
  instagram: '@sou.plane',
  provisional: false, // mostra o aviso "nome provisório" na prévia e no painel
  tagline: 'gestão leve para quem vive de projeto',
  owner: 'Laís', // só aparece para você (painel, prévia)
  // como os clientes chamam quem responde o chat (troque por 'CEO', 'desenvolvedora'…)
  support: 'assistente online',
  supportWith: 'o assistente online', // "conversar com o assistente online"
  whatsapp: '', // opcional: número para "falar no WhatsApp" na página de vendas
}

/* Como cobrar (decidido para ser bom para a dona e claro para quem assina):
   · mensal: Pix todo mês ou cartão recorrente;
   · semestral: 10% de desconto à vista no Pix, ou 6x sem juros no cartão com a taxa do parcelamento embutida;
   · anual: "2 meses grátis" à vista no Pix, ou 12x sem juros no cartão com a taxa do parcelamento embutida.
   No cartão a taxa entra no preço: a dona recebe o mesmo que no Pix e nunca sai no prejuízo, e mesmo assim
   o cartão sai mais barato que o mensal. A dona muda os números no painel → planos. */
export let ANNUAL_FREE_MONTHS = 2
export let ANNUAL_DISCOUNT = Math.round((ANNUAL_FREE_MONTHS / 12) * 1000) / 10 // % equivalente (para textos antigos)
export const setAnnualFreeMonths = (n: number) => {
  ANNUAL_FREE_MONTHS = n
  ANNUAL_DISCOUNT = Math.round((n / 12) * 1000) / 10
}
export let CARD_FEE = 12 // % da taxa do cartão em 12x, embutida no anual parcelado
export const setCardFee = (n: number) => {
  CARD_FEE = n
}
export let CARD_FEE_6 = 8 // % da taxa do cartão em 6x, embutida no semestral parcelado
export const setCardFee6 = (n: number) => {
  CARD_FEE_6 = n
}
export let SEMESTER_DISCOUNT = 10
export const setSemesterDiscount = (n: number) => {
  SEMESTER_DISCOUNT = n
}

export type BillCycle = 'mensal' | 'semestral' | 'anual'
export const CYCLES: BillCycle[] = ['mensal', 'semestral', 'anual']
export const CYCLE_MONTHS: Record<BillCycle, number> = { mensal: 1, semestral: 6, anual: 12 }
/** Em quantas vezes sem juros no cartão (o mensal é recorrente, não parcela). */
export const CYCLE_INSTALLMENTS: Record<BillCycle, number> = { mensal: 1, semestral: 6, anual: 12 }
export const cardAllowed = (_c: BillCycle) => true
export const CYCLE_UNIT: Record<BillCycle, string> = { mensal: 'mês', semestral: 'semestre', anual: 'ano' }
export const cycleDiscount = (c: BillCycle) => (c === 'anual' ? ANNUAL_DISCOUNT : c === 'semestral' ? SEMESTER_DISCOUNT : 0)
const cents = (n: number) => Math.round(n * 100) / 100
/** Total à vista no Pix (mensal = o preço do mês). */
export const cyclePrice = (monthly: number, c: BillCycle) =>
  c === 'anual' ? cents(monthly * (12 - ANNUAL_FREE_MONTHS)) : cents(monthly * CYCLE_MONTHS[c] * (1 - cycleDiscount(c) / 100))
/** Total no cartão: no semestral e no anual, com a taxa do parcelamento embutida (6x ou 12x sem juros). */
export const cardPrice = (monthly: number, c: BillCycle) =>
  c === 'anual' ? cents(cyclePrice(monthly, c) * (1 + CARD_FEE / 100)) : c === 'semestral' ? cents(cyclePrice(monthly, c) * (1 + CARD_FEE_6 / 100)) : cyclePrice(monthly, c)
/** Quanto sai por mês à vista no Pix. */
export const cycleMonthly = (monthly: number, c: BillCycle) => cents(cyclePrice(monthly, c) / CYCLE_MONTHS[c])
/** Parcela no cartão sem juros (12x no anual, 6x no semestral). */
export const cardInstallment = (monthly: number, c: BillCycle = 'anual') => cents(cardPrice(monthly, c) / CYCLE_INSTALLMENTS[c])
export const annualPrice = (monthly: number) => cyclePrice(monthly, 'anual')
/** Selo do anual: "2 meses grátis". */
export const annualBadge = () => (ANNUAL_FREE_MONTHS > 0 ? `${ANNUAL_FREE_MONTHS} ${ANNUAL_FREE_MONTHS === 1 ? 'mês grátis' : 'meses grátis'}` : '')

/** Dias de teste grátis (a dona pode mudar no painel → planos). */
export let TRIAL_DAYS = 14
/** Pré-lançamento: enquanto for false, ninguém consegue assinar (só testar). A dona liga no painel quando lançar. */
export let LAUNCHED = false
export const setLaunched = (v: boolean) => {
  LAUNCHED = v
}
export const setTrialDays = (n: number) => {
  TRIAL_DAYS = n
}

/** Tudo o que um plano pode ligar ou desligar. */
export type Feature =
  | 'assistenteIA' // chat com IA (só a dona: gasta créditos dela)
  | 'chatDona' // chat de suporte com a dona
  | 'painelDona' // painel da plataforma (assinantes, vendas, conversas)
  | 'modeloExclusivo' // modelo de proposta da Laís ("Proposta #001")
  | 'fonteExclusiva' // fonte The Seasons (identidade da Laís)
  | 'propostaPdf' // gerar PDF (proposta e recibos); sem isso, só o texto pronto
  | 'contratos' // contratos a partir do orçamento
  | 'instagram' // planejamento do instagram
  | 'agendaCelular' // agenda sincronizada no celular
  | 'identidade' // logo, cores e fontes próprias
  | 'briefing' // briefing online para o cliente final responder por link
  | 'cronograma' // etapas do projeto com prazo e parcela
  | 'obra' // acompanhamento de obra (visitas, fotos, relatório)
  | 'lucro' // custos e lucro por projeto
  | 'portal' // página de acompanhamento para o cliente
  | 'documentos' // guia de medição, placa de obra com QR e apresentação de projeto

export type PlanId = 'essencial' | 'completo' | 'estudio'

export interface Plan {
  id: PlanId
  name: string
  price: number // R$ por mês (PROVISÓRIO)
  pitch: string // frase curta no cartão do plano
  features: Feature[]
  highlights: string[] // o que aparece na lista do cartão
  featured?: boolean // cartão em destaque
  inviteOnly?: boolean // só entra quem a dona liberar (a pessoa pede acesso; a dona ativa no painel)
}

/** O que todos os planos têm (não depende de feature flag). */
export const BASE_FEATURES = [
  'clientes, demandas e prazos com urgência automática',
  'orçamentos com a sua tabela de preços',
  'orçamento pronto em texto para o WhatsApp',
  'financeiro: parcelas, despesas e metas',
  'agenda com prazos, pagamentos e compromissos',
  'funciona no celular, tablet e computador',
  'chat direto com o assistente online',
]

export const PLANS: Record<PlanId, Plan> = {
  essencial: {
    id: 'essencial',
    name: 'Essencial',
    price: 39.9,
    pitch: 'para organizar clientes, orçamentos e o financeiro',
    features: ['chatDona'],
    highlights: BASE_FEATURES,
  },
  completo: {
    id: 'completo',
    name: 'Completo',
    price: 59.9,
    pitch: 'tudo do Essencial + PDF, contratos e ferramentas extras',
    features: ['chatDona', 'propostaPdf', 'contratos', 'instagram', 'agendaCelular', 'identidade'],
    highlights: ['tudo do Essencial', 'sua identidade visual nos documentos: logo, cores e fontes', 'proposta em PDF com modelos prontos e a sua identidade', 'recibos em PDF', 'contratos que puxam os dados do orçamento', 'agenda sincronizada no celular', 'planejamento do instagram'],
  },
  estudio: {
    id: 'estudio',
    name: 'Estúdio',
    price: 89.9,
    pitch: 'tudo do Completo + briefing online, painel do cliente e obra',
    features: ['chatDona', 'propostaPdf', 'contratos', 'instagram', 'agendaCelular', 'identidade', 'briefing', 'cronograma', 'obra', 'lucro', 'portal', 'documentos'],
    highlights: ['tudo do Completo', 'documentos de obra: memorial, compras, custos, diário, visita, ata e OS', 'guia de medição, placa de obra com QR code e apresentação de projeto', 'painel do cliente: etapas, pagamentos, contratos e documentos num link', 'cronograma das etapas com prazo e parcela', 'acompanhamento de obra com fotos e relatório', 'custos e lucro de cada projeto', 'briefing online com modelos e fotos'],
    featured: true,
  },
}

export const PLAN_LIST = [PLANS.essencial, PLANS.completo, PLANS.estudio]
/** Para quem é cada plano (aparece na página de vendas, na assinatura e no pagamento). */
export const PLAN_PROFILE: Record<PlanId, string> = { essencial: 'freelancer começando', completo: 'freelancer profissional', estudio: 'escritório que atende cliente final' }
/** Indicação: quem indica ganha meses grátis quando a pessoa indicada assina; quem chega pelo link ganha desconto no 1º mês. */
export const REFERRAL = { months: 1, discount: 20 }
/** Preço de fundador: quem assina agora mantém o valor (aparece na página de vendas e na assinatura). */
export const FOUNDER_PRICE = true
/** Planos que qualquer pessoa assina sozinha (todos). */
export const OPEN_PLANS = () => PLAN_LIST.filter((p) => !p.inviteOnly)

/** A dona tem tudo — menos o chat com ela mesma (ela usa a caixa de entrada do painel). */
export const OWNER_FEATURES: Feature[] = ['assistenteIA', 'painelDona', 'modeloExclusivo', 'fonteExclusiva', 'propostaPdf', 'contratos', 'instagram', 'agendaCelular', 'identidade', 'briefing', 'cronograma', 'obra', 'lucro', 'portal', 'documentos']

/** O que a dona pode ligar/desligar em cada plano (painel → planos). */
export const PLAN_TOGGLES: [Feature, string][] = [
  ['propostaPdf', 'proposta e recibos em PDF'],
  ['identidade', 'logo, cores e fontes próprias'],
  ['contratos', 'contratos'],
  ['agendaCelular', 'agenda no celular'],
  ['instagram', 'planejamento do instagram'],
  ['briefing', 'briefing online (cliente final)'],
  ['cronograma', 'cronograma das etapas'],
  ['obra', 'acompanhamento de obra'],
  ['lucro', 'custos e lucro por projeto'],
  ['portal', 'painel do cliente'],
  ['documentos', 'documentos (guia de medição, placa de obra, apresentação)'],
]

/** Em que planos está uma função (lido do cadastro dos planos, que a dona edita no painel). */
export const plansWith = (f: Feature) => PLAN_LIST.filter((p) => p.features.includes(f))
/** Texto curto para a página de vendas: '' (todos os planos), "plano Estúdio", "a partir do Completo"… */
export function planLabel(f?: Feature) {
  if (!f) return ''
  const has = plansWith(f)
  if (!has.length || has.length === PLAN_LIST.length) return ''
  if (has.length === 1) return `plano ${has[0].name}`
  const first = PLAN_LIST.findIndex((p) => p.id === has[0].id)
  const fromHere = PLAN_LIST.slice(first)
  if (fromHere.length === has.length && fromHere.every((p, i) => p.id === has[i].id)) return `a partir do ${has[0].name}`
  return `planos ${has.map((p) => p.name).join(' e ')}`
}

/** Tabela de comparação da página de vendas (linha → um valor por plano, na ordem de PLAN_LIST). */
export type CompareRow = [string, ...(boolean | string)[]]
export function compareRows(): CompareRow[] {
  const all = (label: string): CompareRow => [label, ...PLAN_LIST.map(() => true)]
  const row = (label: string, f: Feature, yes: string | true = true): CompareRow => [label, ...PLAN_LIST.map((p) => (p.features.includes(f) ? yes : false))]
  return [
    all('clientes, demandas e quadro de prazos'),
    all('ficha do cliente final (família, imóvel)'),
    all('orçamentos com tabela de preços própria'),
    all('financeiro, parcelas e metas'),
    all('agenda do estúdio'),
    all('orçamento em texto pronto para o WhatsApp'),
    all('cores e fontes do sistema do seu jeito'),
    row('logo, cores e fontes do seu estúdio nos documentos', 'identidade'),
    row('proposta e recibos em PDF', 'propostaPdf', 'todos os modelos'),
    row('contratos com os dados do orçamento', 'contratos'),
    row('agenda sincronizada no celular', 'agendaCelular'),
    row('planejamento do instagram', 'instagram'),
    row('painel do cliente (etapas, pagamentos, contratos e documentos)', 'portal'),
    row('cronograma das etapas com prazo e parcela', 'cronograma'),
    row('acompanhamento de obra com fotos e relatório', 'obra'),
    row('custos e lucro de cada projeto', 'lucro'),
    row('briefing online com modelos e fotos', 'briefing'),
    row('guia de medição, placa de obra com QR e apresentação de projeto', 'documentos'),
    all('chat direto com o assistente online'),
  ]
}

export type SubStatus = 'trial' | 'ativa' | 'atrasada' | 'cancelada'
export const STATUS_LABEL: Record<SubStatus, string> = { trial: 'teste grátis', ativa: 'ativa', atrasada: 'pagamento atrasado', cancelada: 'cancelada' }

export const money0 = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** Novidade de 30/09/2026: a plataforma passou a atender também quem trabalha para cliente final.
 *  Todas as contas que já existiam ganham o Estúdio, e o teste grátis passa a ser do Estúdio. */
export const ESTUDIO_FOR_ACCOUNTS_BEFORE = '2026-10-01'
/** Data de criação para contas de prévia ("ver como cliente"): nunca cai na regra das contas antigas. */
export const previewCreatedAt = () => new Date(Math.max(Date.now(), Date.parse(`${ESTUDIO_FOR_ACCOUNTS_BEFORE}T12:00:00Z`))).toISOString()
export function effectivePlan(sub: { plan: PlanId; status: string; createdAt?: string } | null | undefined): PlanId {
  if (!sub) return 'essencial'
  // teste grátis: Estúdio (quem escolheu testar o Essencial vê o Essencial)
  if (sub.status === 'trial') return sub.plan === 'essencial' ? 'essencial' : 'estudio'
  if (sub.createdAt && sub.createdAt < ESTUDIO_FOR_ACCOUNTS_BEFORE) return 'estudio'
  return sub.plan
}
