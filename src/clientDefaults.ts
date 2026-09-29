import type { MessageTemplate, ServiceDef, WorkProfile } from './types'

/* Pontos de partida de quem assina a plataforma. São genéricos de propósito
   (os valores, textos e o jeito de trabalhar da Laís são só dela): cada
   freelancer ajusta tudo em Configurações. */

/** Formas de receber que já vêm na lista (editável em Configurações → pagamentos). */
export const DEFAULT_PAYMENT_METHODS = ['Pix', 'Transferência', 'Cartão de crédito', 'Boleto', 'Dinheiro']

export const CLIENT_PAYMENT_TERMS = 'Pix ou transferência — 50% na aprovação + 50% na entrega'
export const CLIENT_SCHEDULE = 'até 10 dias úteis após a aprovação e o pagamento da entrada.'

export const CLIENT_SERVICES: ServiceDef[] = [
  { id: 'hora', name: 'hora de trabalho', unit: 'hora', pricing: 'hora', price: 60, min: 0, hours: 1, tiers: [] },
  { id: 'render-vray', name: 'imagem 3d (render)', unit: 'imagem', pricing: 'pacote', price: 120, min: 0, hours: 4, tiers: [{ qty: 5, price: 550 }] },
  { id: 'modelagem', name: 'modelagem 3d', unit: 'm²', pricing: 'm2', price: 3, base: 150, min: 300, hours: 0.08, tiers: [] },
  { id: 'projeto-interiores', name: 'projeto de interiores', unit: 'm²', pricing: 'm2', price: 40, base: 0, min: 1500, hours: 0.5, tiers: [] },
  { id: 'executivo', name: 'desenho técnico / executivo', unit: 'm²', pricing: 'm2', price: 6, base: 400, min: 0, hours: 0.12, tiers: [] },
  { id: 'planta-hum', name: 'planta humanizada', unit: 'planta', pricing: 'unidade', price: 250, min: 0, hours: 4, tiers: [] },
  { id: 'prancha', name: 'prancha de apresentação', unit: 'prancha', pricing: 'unidade', price: 150, min: 0, hours: 3, tiers: [] },
  { id: 'slides', name: 'apresentação em slides', unit: 'slide', pricing: 'unidade', price: 30, min: 150, hours: 0.75, tiers: [] },
  { id: 'personalizado', name: 'serviço personalizado', unit: 'projeto', pricing: 'livre', price: 0, min: 0, hours: 0, tiers: [] },
]

/** Serviços de quem atende cliente final (arquitetura e interiores). Valores só de partida. */
export const ARCH_SERVICES: ServiceDef[] = [
  // consultoria e levantamento
  { id: 'arq-consultoria', group: 'consultoria e levantamento', name: 'consultoria / visita técnica', unit: 'hora', pricing: 'hora', price: 250, min: 0, hours: 1, tiers: [] },
  { id: 'arq-levantamento', group: 'consultoria e levantamento', name: 'levantamento e medição', unit: 'm²', pricing: 'm2', price: 5, base: 300, min: 400, hours: 0.05, tiers: [] },
  // projeto
  { id: 'arq-estudo', group: 'projeto', name: 'estudo preliminar (layout e conceito)', unit: 'm²', pricing: 'm2', price: 35, base: 0, min: 1500, hours: 0.3, tiers: [] },
  { id: 'arq-arquitetonico', group: 'projeto', name: 'projeto arquitetônico', unit: 'm²', pricing: 'm2', price: 60, base: 0, min: 6000, hours: 0.6, tiers: [], checklistTitle: 'etapas incluídas', checklist: ['estudo preliminar', 'anteprojeto', 'projeto executivo', 'detalhamentos'] },
  { id: 'arq-interiores', group: 'projeto', name: 'projeto de interiores', unit: 'm²', pricing: 'm2', price: 90, base: 0, min: 4000, hours: 0.8, tiers: [], checklistTitle: 'etapas incluídas', checklist: ['layout', 'marcenaria', 'iluminação', 'revestimentos', 'forro', 'detalhamentos'] },
  { id: 'arq-executivo', group: 'projeto', name: 'projeto executivo e detalhamento', unit: 'm²', pricing: 'm2', price: 40, base: 0, min: 2000, hours: 0.4, tiers: [] },
  {
    id: 'arq-completo',
    group: 'projeto',
    name: 'projeto completo (arquitetônico + complementares + aprovação)',
    unit: 'm²',
    pricing: 'm2',
    price: 110,
    base: 0,
    min: 12000,
    hours: 1,
    tiers: [],
    checklistTitle: 'o que está incluído',
    checklist: ['projeto arquitetônico', 'estrutural', 'elétrico', 'hidrossanitário', 'aprovação na prefeitura', 'acompanhamento de obra'],
  },
  // projetos complementares: marque quais entram; cada um soma o seu valor por m²
  {
    id: 'arq-complementares',
    group: 'projetos complementares',
    name: 'projetos complementares',
    unit: 'm²',
    pricing: 'm2',
    price: 0,
    base: 0,
    min: 1500,
    hours: 0.3,
    tiers: [],
    checklistTitle: 'quais projetos',
    checklist: ['estrutural', 'elétrico', 'hidrossanitário', 'climatização (ar-condicionado)', 'prevenção de incêndio (PPCI)', 'gás', 'SPDA (para-raios)', 'luminotécnico'],
    checklistPrices: { estrutural: 18, elétrico: 10, hidrossanitário: 10, 'climatização (ar-condicionado)': 8, 'prevenção de incêndio (PPCI)': 12, gás: 5, 'SPDA (para-raios)': 6, luminotécnico: 8 },
  },
  // regularização e aprovação
  { id: 'arq-regularizacao', group: 'regularização e aprovação', name: 'regularização de imóvel', unit: 'm²', pricing: 'm2', price: 25, base: 1500, min: 2500, hours: 0.2, tiers: [], checklistTitle: 'o que inclui', checklist: ['levantamento do existente', 'projeto de regularização', 'protocolo na prefeitura', 'acompanhamento até o habite-se', 'averbação no cartório'] },
  { id: 'arq-legal', group: 'regularização e aprovação', name: 'projeto legal (aprovação na prefeitura)', unit: 'projeto', pricing: 'unidade', price: 2500, min: 0, hours: 20, tiers: [] },
  { id: 'arq-art', group: 'regularização e aprovação', name: 'ART / RRT e taxas', unit: 'documento', pricing: 'unidade', price: 150, min: 0, hours: 1, tiers: [] },
  // obra e apresentação
  { id: 'arq-obra', group: 'obra', name: 'acompanhamento de obra', unit: 'visita', pricing: 'pacote', price: 350, min: 0, hours: 3, tiers: [{ qty: 8, price: 2400 }] },
  { id: 'arq-render', group: 'apresentação', name: 'imagens 3d do projeto', unit: 'imagem', pricing: 'pacote', price: 180, min: 0, hours: 4, tiers: [{ qty: 5, price: 800 }] },
  { id: 'personalizado', group: 'outros', name: 'serviço personalizado', unit: 'projeto', pricing: 'livre', price: 0, min: 0, hours: 0, tiers: [] },
]

/** Tabela inicial conforme o jeito de trabalhar. */
export const servicesFor = (profile?: WorkProfile): ServiceDef[] =>
  profile === 'final' ? ARCH_SERVICES : profile === 'ambos' ? [...ARCH_SERVICES.filter((x) => x.id !== 'personalizado'), ...CLIENT_SERVICES.map((x) => ({ ...x, group: x.id === 'personalizado' ? 'outros' : 'freelance (para escritórios)' }))] : CLIENT_SERVICES

export const WORK_PROFILES: { value: WorkProfile; label: string; hint: string }[] = [
  { value: 'freelancer', label: 'presto serviço para escritórios', hint: 'freelancer: modelagem, render, executivo, apresentação…' },
  { value: 'final', label: 'atendo cliente final', hint: 'arquiteto(a), designer ou escritório que projeta para a pessoa dona do imóvel' },
  { value: 'ambos', label: 'faço os dois', hint: 'cada cliente tem o tipo dele: cliente final ou escritório parceiro' },
]

export const CLIENT_MESSAGES: MessageTemplate[] = [
  { id: 'primeiro-contato', name: 'primeiro contato', text: 'Olá, {cliente}! Aqui é {meu_nome}, obrigado(a) pelo contato.\n\nMe conta um pouco do projeto: o que você precisa, o tamanho (metragem ou quantidade) e para quando. Assim já preparo o orçamento.' },
  { id: 'envio-orcamento', name: 'envio do orçamento', text: 'Olá, {cliente}! Segue a proposta {proposta} do projeto {projeto}, no valor de {valor}. Fico à disposição para qualquer dúvida ou ajuste.' },
  { id: 'retorno', name: 'cobrar resposta do orçamento', text: 'Olá, {cliente}, tudo bem? Passando para saber se conseguiu ver a proposta {proposta} ({projeto}). Se quiser ajustar algo, é só me falar.' },
  { id: 'aprovado', name: 'orçamento aprovado · pedir entrada', text: 'Que ótimo, {cliente}! Para começarmos, a entrada é de {valor_parcela} (pix: {pix}). Assim que confirmar, me envie os arquivos e as referências do projeto.' },
  { id: 'sinal-recebido', name: 'entrada recebida · início', text: 'Olá, {cliente}! Entrada recebida, obrigado(a). Já comecei o projeto {projeto} e a previsão de entrega é {prazo}.' },
  { id: 'previa', name: 'envio de prévia', text: 'Olá, {cliente}! Segue a prévia do projeto {projeto}. Dê uma olhada com calma e me diga se está tudo certo ou se prefere algum ajuste.' },
  { id: 'retorno-ajustes', name: 'cobrar retorno dos ajustes', text: 'Olá, {cliente}, tudo bem? Conseguiu ver os ajustes do projeto {projeto}? Fico no aguardo para seguirmos.' },
  { id: 'cobranca', name: 'lembrete de pagamento', text: 'Olá, {cliente}! Lembrete da parcela "{parcela}" do projeto {projeto}, de {valor_parcela}, com vencimento em {vencimento}. Pix: {pix}. Obrigado(a)!' },
  { id: 'cobranca-atraso', name: 'pagamento em atraso', text: 'Olá, {cliente}, tudo bem? A parcela "{parcela}" do projeto {projeto}, de {valor_parcela}, venceu em {vencimento}. Consegue verificar? Pix: {pix}.' },
  { id: 'entrega', name: 'entrega final', text: 'Olá, {cliente}! O projeto {projeto} está finalizado. Os arquivos estão aqui: {arquivos}\n\nFoi um prazer trabalhar com você!' },
  { id: 'depoimento', name: 'pedir depoimento / indicação', text: 'Olá, {cliente}! Espero que tenha gostado do resultado. Se puder deixar um depoimento rápido ou me indicar para alguém, me ajuda muito!' },
]
