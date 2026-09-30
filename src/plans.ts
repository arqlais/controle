/* ============================================================
   Plataforma: nome, preços, planos e o que cada plano libera.
   TUDO que é "comercial" fica aqui — trocar nome ou preço é só neste arquivo.
   ============================================================ */

/** Nome e textos da plataforma (PROVISÓRIOS: troque quando decidir). */
export const PLATFORM = {
  name: 'traço', // nome provisório
  provisional: false, // mostra o aviso "nome provisório" na prévia e no painel
  tagline: 'gestão leve para quem vive de projeto',
  owner: 'Laís', // só aparece para você (painel, prévia)
  // como os clientes chamam quem responde o chat (troque por 'CEO', 'desenvolvedora'…)
  support: 'assistente online',
  supportWith: 'o assistente online', // "conversar com o assistente online"
  whatsapp: '', // opcional: número para "falar no WhatsApp" na página de vendas
}

/** Assinatura anual: 12 meses com um desconto leve. */
export let ANNUAL_DISCOUNT = 10 // % de desconto no plano anual (a dona muda no painel → planos)
export const setAnnualDiscount = (n: number) => {
  ANNUAL_DISCOUNT = n
}
export const annualPrice = (monthly: number) => Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT / 100) * 100) / 100

/** Dias de teste grátis (a dona pode mudar no painel → planos). */
export let TRIAL_DAYS = 7
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
    highlights: ['tudo do Essencial', 'sua identidade visual: logo, cores e fontes', 'proposta em PDF com modelos prontos e a sua identidade', 'recibos em PDF', 'contratos que puxam os dados do orçamento', 'agenda sincronizada no celular', 'planejamento do instagram'],
    featured: true,
  },
  estudio: {
    id: 'estudio',
    name: 'Estúdio',
    price: 89.9,
    pitch: 'tudo do Completo + briefing online e recursos para escritório',
    features: ['chatDona', 'propostaPdf', 'contratos', 'instagram', 'agendaCelular', 'identidade', 'briefing', 'cronograma', 'obra', 'lucro', 'portal', 'documentos'],
    highlights: ['tudo do Completo', 'guia de medição, placa de obra com QR code e apresentação de projeto', 'página do projeto para o cliente acompanhar', 'cronograma das etapas com prazo e parcela', 'acompanhamento de obra com fotos e relatório', 'custos e lucro de cada projeto', 'briefing online com modelos e fotos'],
    inviteOnly: true,
  },
}

export const PLAN_LIST = [PLANS.essencial, PLANS.completo, PLANS.estudio]
/** Planos que qualquer pessoa assina sozinha (o Estúdio é sob convite). */
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
  ['portal', 'página do projeto para o cliente'],
  ['documentos', 'documentos (guia de medição, placa de obra, apresentação)'],
]

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
    row('logo, cores e fontes do seu estúdio', 'identidade'),
    row('proposta e recibos em PDF', 'propostaPdf', 'todos os modelos'),
    row('contratos com os dados do orçamento', 'contratos'),
    row('agenda sincronizada no celular', 'agendaCelular'),
    row('planejamento do instagram', 'instagram'),
    row('página do projeto para o cliente acompanhar', 'portal'),
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
