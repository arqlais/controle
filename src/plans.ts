/* ============================================================
   Plataforma: nome, preços, planos e o que cada plano libera.
   TUDO que é "comercial" fica aqui — trocar nome ou preço é só neste arquivo.
   ============================================================ */

/** Nome e textos da plataforma (PROVISÓRIOS: troque quando decidir). */
export const PLATFORM = {
  name: 'traço', // nome provisório
  provisional: true, // mostra o aviso "nome provisório" na prévia e no painel
  tagline: 'o sistema do seu estúdio',
  owner: 'Laís', // quem responde no chat
  ownerRole: 'arquiteta e criadora do sistema',
  whatsapp: '', // opcional: número para "falar no WhatsApp" na página de vendas
}

/** Dias de teste grátis. */
export const TRIAL_DAYS = 14

/** Tudo o que um plano pode ligar ou desligar. */
export type Feature =
  | 'assistenteIA' // chat com IA (só a dona: gasta créditos dela)
  | 'chatDona' // chat de suporte com a dona
  | 'painelDona' // painel da plataforma (assinantes, vendas, conversas)
  | 'modeloExclusivo' // modelo de proposta da Laís ("Proposta #001")
  | 'modelosExtras' // todos os modelos de proposta (o Essencial tem 2)
  | 'contratos' // contratos a partir do orçamento
  | 'instagram' // planejamento do instagram
  | 'agendaCelular' // agenda sincronizada no celular

export type PlanId = 'essencial' | 'completo'

export interface Plan {
  id: PlanId
  name: string
  price: number // R$ por mês (PROVISÓRIO)
  pitch: string // frase curta no cartão do plano
  features: Feature[]
  highlights: string[] // o que aparece na lista do cartão
  featured?: boolean // cartão em destaque
}

/** O que todos os planos têm (não depende de feature flag). */
export const BASE_FEATURES = [
  'clientes, demandas e prazos com urgência automática',
  'orçamentos com a sua tabela de preços',
  'proposta em PDF (ou só o resumo no WhatsApp)',
  'financeiro: parcelas, recibos, despesas e metas',
  'agenda com prazos, pagamentos e compromissos',
  'funciona no celular, tablet e computador',
  'chat com a Laís para tirar dúvidas',
]

export const PLANS: Record<PlanId, Plan> = {
  essencial: {
    id: 'essencial',
    name: 'Essencial',
    price: 39,
    pitch: 'para organizar clientes, orçamentos e o financeiro',
    features: ['chatDona'],
    highlights: [...BASE_FEATURES, '2 modelos de proposta'],
  },
  completo: {
    id: 'completo',
    name: 'Completo',
    price: 69,
    pitch: 'tudo do Essencial + contratos e ferramentas extras',
    features: ['chatDona', 'modelosExtras', 'contratos', 'instagram', 'agendaCelular'],
    highlights: ['tudo do Essencial', 'todos os modelos de proposta', 'contratos que puxam os dados do orçamento', 'agenda sincronizada no celular', 'planejamento do instagram'],
    featured: true,
  },
}

export const PLAN_LIST = [PLANS.essencial, PLANS.completo]

/** A dona tem tudo — menos o chat com ela mesma (ela usa a caixa de entrada do painel). */
export const OWNER_FEATURES: Feature[] = ['assistenteIA', 'painelDona', 'modeloExclusivo', 'modelosExtras', 'contratos', 'instagram', 'agendaCelular']

/** Tabela de comparação da página de vendas (linha → [essencial, completo]). */
export const COMPARE: [string, boolean | string, boolean | string][] = [
  ['clientes, demandas e quadro de prazos', true, true],
  ['orçamentos com tabela de preços própria', true, true],
  ['financeiro, recibos e metas', true, true],
  ['agenda do estúdio', true, true],
  ['modelos de proposta em PDF', '2 modelos', 'todos'],
  ['contratos com os dados do orçamento', false, true],
  ['agenda sincronizada no celular', false, true],
  ['planejamento do instagram', false, true],
  ['chat com a Laís', true, true],
]

export type SubStatus = 'trial' | 'ativa' | 'atrasada' | 'cancelada'
export const STATUS_LABEL: Record<SubStatus, string> = { trial: 'teste grátis', ativa: 'ativa', atrasada: 'pagamento atrasado', cancelada: 'cancelada' }

export const money0 = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
