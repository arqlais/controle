import { PLATFORM } from './plans'
import { CLIENT_MESSAGES, CLIENT_PAYMENT_TERMS, CLIENT_SCHEDULE, CLIENT_SERVICES, DEFAULT_PAYMENT_METHODS, servicesFor } from './clientDefaults'
import { ARTIFACT } from './env'
import { CLOUD, fetchRemote, publishAgenda, pushRemote } from './cloud'
import { buildICS } from './ics'
import { CLIENT_DISPLAY, PALETTES } from './brand'
import { toast } from './components/dialog'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Data, WorkProfile, MessageTemplate, Project, ProposalStyle, ServiceDef, Settings, SocialPost } from './types'
import { CLIENT_CONTRACTS } from './contractTemplates'
import { DEFAULT_TASKS, addDays, payWhen, splitPayments, titleCase, today, uid } from './utils'

const KEY = 'lais3d-controle-v1'

// Preços da tabela do site (render V-Ray e IA). Os por m² são ponto de partida — ajuste em Configurações.
export const DEFAULT_SERVICES: ServiceDef[] = [
  { id: 'render-vray', name: 'renderização V-Ray', unit: 'imagem', pricing: 'pacote', price: 80, min: 0, hours: 4, tiers: [ { qty: 5, price: 370 }, { qty: 10, price: 710 }, { qty: 15, price: 975 } ] },
  { id: 'render-ia', name: 'renderização por IA', unit: 'imagem', pricing: 'pacote', price: 50, min: 0, hours: 1.5, tiers: [ { qty: 5, price: 240 }, { qty: 10, price: 460 }, { qty: 15, price: 630 } ] },
  { id: 'modelagem', name: 'modelagem 3d', unit: 'm²', pricing: 'm2', price: 2.7, base: 100, min: 250, hours: 0.08, tiers: [] },
  { id: 'detalhamento', name: 'detalhamento', unit: 'm²', pricing: 'm2', price: 1, base: 520, min: 0, hours: 0.1, tiers: [] },
  { id: 'executivo', name: 'executivo', unit: 'm²', pricing: 'm2', price: 5, base: 620, min: 0, hours: 0.12, tiers: [] },
  { id: 'pranchas', name: 'prancha', unit: 'prancha', pricing: 'unidade', price: 200, min: 0, hours: 3, tiers: [] },
  { id: 'mapas', name: 'mapa urbano', unit: 'mapa', pricing: 'unidade', price: 150, min: 0, hours: 2.5, tiers: [] },
  { id: 'diagramas', name: 'diagramas', unit: 'diagrama', pricing: 'unidade', price: 80, min: 0, hours: 1, tiers: [] },
  { id: 'diagramacao', name: 'diagramação', unit: 'prancha', pricing: 'unidade', price: 120, min: 0, hours: 2, tiers: [] },
  { id: 'planta-hum', name: 'planta humanizada', unit: 'planta', pricing: 'unidade', price: 300, min: 0, hours: 4, tiers: [] },
  { id: 'slides', name: 'apresentação em slides', unit: 'slide', pricing: 'unidade', price: 30, min: 150, hours: 0.75, tiers: [] },
  { id: 'personalizado', name: 'serviço personalizado', unit: 'projeto', pricing: 'livre', price: 0, min: 0, hours: 0, tiers: [] },
]

/** Listas que o cliente escolhe (quais plantas / quais detalhamentos) — editáveis em Configurações → preços. */
type ChecklistDefaults = Pick<ServiceDef, 'checklistTitle' | 'checklist' | 'checklistPrices' | 'customRate'>
const list = (title: string, items: [string, number][], customRate: number): ChecklistDefaults => ({
  checklistTitle: title,
  checklist: items.map(([n]) => n),
  checklistPrices: Object.fromEntries(items),
  customRate,
})
/** Listas que o cliente escolhe (quais plantas / quais detalhamentos), com o valor de cada uma por m².
    São pontos de partida: ajuste nomes e valores em Configurações → preços. */
export const DEFAULT_CHECKLISTS: Record<string, ChecklistDefaults> = {
  // calibrado pelos orçamentos reais (ex.: executivo completo 57 m² = R$ 990; 34 m² = R$ 820):
  // valor base do projeto + soma das plantas × m² × complexidade
  executivo: list(
    'plantas executivas',
    [
      ['planta de layout (mobiliário)', 0.6],
      ['planta de demolição', 0.4],
      ['planta de construção', 0.5],
      ['planta elétrica', 0.5],
      ['planta de iluminação', 0.5],
      ['planta de forro', 0.4],
      ['planta hidráulica', 0.5],
      ['planta de ar-condicionado', 0.3],
      ['paginação de piso/revestimentos', 0.5],
      ['planta de acabamentos', 0.4],
      ['planta de cobertura', 0.4],
      ['planta de situação/implantação', 0.3],
      ['cortes', 0.5],
      ['elevações', 0.5],
      ['fachadas', 0.4],
      ['quadro de esquadrias', 0.3],
    ],
    0.4,
  ),
  detalhamento: list(
    'detalhamentos (caso precise)',
    [
      ['marcenaria', 0.3],
      ['marmoraria (pedras)', 0.25],
      ['serralheria', 0.2],
      ['vidraçaria', 0.15],
      ['banheiros (áreas molhadas)', 0.25],
      ['cozinha', 0.25],
      ['forro e sancas', 0.15],
      ['painéis e revestimentos', 0.15],
      ['escadas e guarda-corpos', 0.25],
      ['portas e esquadrias', 0.2],
      ['paisagismo', 0.15],
    ],
    0.2,
  ),
}
/** Valor base de cada projeto (antes do m²), pelos orçamentos reais. */
export const DEFAULT_BASE: Record<string, number> = { executivo: 620, detalhamento: 520 }
/** R$/m² quando nenhuma planta é marcada (projeto completo típico). */
const NO_LIST_RATE: Record<string, number> = { executivo: 5, detalhamento: 1 }
/** Valores da versão anterior (estimados, acima do que é cobrado): quem ainda está com eles recebe os novos. */
const PRICES_V1: Record<string, Record<string, number>> = {
  executivo: { 'planta de layout (mobiliário)': 1.5, 'planta de demolição': 1, 'planta de construção': 1.5, 'planta elétrica': 1.5, 'planta de iluminação': 1.5, 'planta de forro': 1.2, 'planta hidráulica': 1.2, 'planta de ar-condicionado': 0.8, 'paginação de piso/revestimentos': 1.2, 'planta de acabamentos': 1, 'planta de cobertura': 0.8, 'planta de situação/implantação': 0.6, cortes: 1.2, elevações: 1.2, fachadas: 1, 'quadro de esquadrias': 0.6 },
  detalhamento: { marcenaria: 4, 'marmoraria (pedras)': 2.5, serralheria: 2, vidraçaria: 1.5, 'banheiros (áreas molhadas)': 2.5, cozinha: 2.5, 'forro e sancas': 1.5, 'painéis e revestimentos': 1.5, 'escadas e guarda-corpos': 2, 'portas e esquadrias': 1.5, paisagismo: 1.5 },
}
/** Como cada serviço é entregue (vai no PDF em "formatos de arquivos entregues"). */
/** Observações prontas por serviço (tiradas das propostas reais): aparecem como sugestão no orçamento. */
export const DEFAULT_NOTE_HINTS: Record<string, string[]> = {
  modelagem: [
    'a modelagem parte fielmente de uma planta baixa definida (dwg), com o conceito já definido pelo cliente.',
    'necessário planta baixa em dwg com medidas reais.',
    'necessário envio de referências e conceito.',
    'não inclui: desenvolvimento de conceito, alterações de layout ou de projeto, renderizações.',
  ],
  'render-vray': [
    'necessário modelagem 3d completa e definida (arquivo sketchup).',
    'desenvolvimento com base no arquivo sketchup e informações fornecidas.',
    'necessário envio de referências de materiais, iluminação e ângulos.',
    'não inclui: modelagem 3d ou alterações de projeto.',
  ],
  'render-ia': [
    'necessário modelagem 3d completa e definida (arquivo sketchup).',
    'desenvolvimento com base no arquivo sketchup e informações fornecidas.',
    'necessário envio de referências de materiais e estilo.',
    'não inclui: modelagem 3d ou alterações de projeto.',
  ],
  executivo: [
    'desenvolvimento a partir da planta baixa definida e referências fornecidas.',
    'necessário planta baixa com medidas reais (dwg ou pdf).',
    'arquivo precisa vir pronto para desenvolvimento do executivo.',
    'não inclui: alterações de layout, modelagem 3d, revisões decorrentes de mudanças no projeto após o início dos serviços.',
  ],
  detalhamento: [
    'detalhamento com base na modelagem e planta baixa já definidas.',
    'necessário planta baixa com medidas reais.',
    'não inclui: alterações de projeto ou modelagem 3d.',
  ],
}
/** Vale para qualquer serviço. */
export const GENERAL_NOTE_HINTS = [
  'orçamento baseado no material fornecido. alterações ou complementações de projeto após o início dos trabalhos poderão gerar revisão de prazo e orçamento.',
]

export const DEFAULT_DELIVERY: Record<string, Pick<ServiceDef, 'delivery' | 'deliveryOpen'>> = {
  'render-vray': { delivery: 'imagens em PNG/JPG em alta resolução', deliveryOpen: '' },
  'render-ia': { delivery: 'imagens em PNG/JPG em alta resolução', deliveryOpen: '' },
  modelagem: { delivery: 'arquivo aberto em SketchUp 2026', deliveryOpen: '' },
  detalhamento: { delivery: 'PDF fechado, pronto para execução', deliveryOpen: 'PDF pronto para execução + arquivo aberto (editável) do layout' },
  executivo: { delivery: 'PDF fechado, pronto para execução', deliveryOpen: 'PDF pronto para execução + arquivo aberto (editável) do layout' },
  pranchas: { delivery: 'PDF em alta resolução', deliveryOpen: '' },
  diagramacao: { delivery: 'PDF em alta resolução', deliveryOpen: '' },
  mapas: { delivery: 'PNG/JPG em alta resolução', deliveryOpen: '' },
  diagramas: { delivery: 'PNG/JPG em alta resolução', deliveryOpen: '' },
  'planta-hum': { delivery: 'PNG/JPG em alta resolução', deliveryOpen: '' },
  slides: { delivery: 'apresentação em PDF', deliveryOpen: 'PDF + arquivo aberto (editável) da apresentação' },
}

/** Primeira versão das listas (sem valores): quem ainda está com ela recebe a lista completa. */
const OLD_CHECKLISTS: Record<string, string[]> = {
  executivo: ['planta de layout (mobiliário)', 'planta de demolição', 'planta de construção', 'planta elétrica', 'planta de iluminação', 'planta de forro', 'planta hidráulica', 'paginação de piso/revestimentos', 'cortes', 'elevações'],
  detalhamento: ['marcenaria', 'marmoraria (pedras)', 'serralheria'],
}

/** Preços calibrados pelos orçamentos reais de julho em diante. Só troca valores que ainda
    estão no padrão antigo (o que foi ajustado à mão fica como está). */
function recalibrate(x: ServiceDef): ServiceDef {
  const tiers = (t: ServiceDef['tiers']) => t.map((y) => `${y.qty}:${y.price}`).join('|')
  if (x.id === 'modelagem' && x.price === 6 && x.min === 350 && x.base === undefined) return { ...x, price: 2.7, base: 100, min: 250 }
  // imagens seguem a tabela padrão do site (a recalibração tinha baixado a IA por engano)
  if (x.id === 'render-ia' && x.price === 49 && tiers(x.tiers) === '5:175|10:350|15:630') return { ...x, price: 50, tiers: [ { qty: 5, price: 240 }, { qty: 10, price: 460 }, { qty: 15, price: 630 } ] }
  if (x.id === 'executivo' && x.base === 570) return { ...x, base: 620 }
  if (x.id === 'detalhamento' && x.base === 480) return { ...x, base: 520 }
  return x
}

/** Nomes antigos (com maiúscula / plural) → nomes atuais, sem perder os preços já ajustados. */
/** Serviço de slides entrou depois: aparece uma vez só (se ela apagar, não volta). */
function addSlides(done: boolean | undefined, list: ServiceDef[]): ServiceDef[] {
  if (done || list.some((x) => x.id === 'slides')) return list
  const slides = DEFAULT_SERVICES.find((x) => x.id === 'slides')!
  const at = list.findIndex((x) => x.id === 'personalizado')
  const item = { ...slides, ...DEFAULT_DELIVERY.slides }
  return at < 0 ? [...list, item] : [...list.slice(0, at), item, ...list.slice(at)]
}

function migrateServices(list: ServiceDef[]): ServiceDef[] {
  const renamed: Record<string, string> = {
    'render-vray': 'renderização V-Ray', 'render-ia': 'renderização por IA', modelagem: 'modelagem 3d', detalhamento: 'detalhamento',
    executivo: 'executivo', pranchas: 'prancha', mapas: 'mapa urbano', 'planta-hum': 'planta humanizada', personalizado: 'serviço personalizado',
  }
  const old = new Set(['Renderização V-Ray', 'Renderização I.A', 'Modelagem 3D', 'Detalhamento', 'Projeto executivo', 'Mapas urbanos', 'Pranchas e monografia', 'Planta humanizada', 'Serviço personalizado'])
  const out = list.map((x) => (renamed[x.id] && old.has(x.name) ? { ...x, name: renamed[x.id] } : x))
  for (const d of DEFAULT_SERVICES) if (!out.some((x) => x.id === d.id) && ['diagramas', 'diagramacao', 'planta-hum'].includes(d.id)) out.splice(out.length - 1, 0, d)
  return out.map((w) => {
    const y = recalibrate(w)
    const y2 = y.noteHints === undefined && DEFAULT_NOTE_HINTS[y.id] ? { ...y, noteHints: DEFAULT_NOTE_HINTS[y.id] } : y
    const z = y2.delivery === undefined && DEFAULT_DELIVERY[y2.id] ? { ...y2, ...DEFAULT_DELIVERY[y2.id] } : y2
    // pavimentos a mais encarecem: executivo, detalhamento e modelagem (imagem é preço por imagem; ajustável por serviço)
    const x = z.perFloor === undefined ? { ...z, perFloor: ['executivo', 'detalhamento', 'modelagem'].includes(z.id) } : z
    const d = DEFAULT_CHECKLISTS[x.id]
    if (!d) return x
    const untouched = x.checklist === undefined || (!x.checklistPrices && x.checklist.join('|') === OLD_CHECKLISTS[x.id]?.join('|'))
    const rebase = x.base === undefined ? { base: DEFAULT_BASE[x.id], min: 0, price: NO_LIST_RATE[x.id] ?? x.price } : {}
    if (untouched) return { ...x, ...d, checklistTitle: x.checklistTitle || d.checklistTitle, ...rebase }
    // valores da primeira estimativa (acima do real) → valores calibrados pelos orçamentos
    const v1 = PRICES_V1[x.id]
    const isV1 = v1 && x.checklistPrices && Object.entries(x.checklistPrices).every(([k, v]) => v1[k] === undefined || v1[k] === v)
    if (isV1 && x.base === undefined)
      return {
        ...x,
        ...rebase,
        customRate: d.customRate,
        checklistPrices: Object.fromEntries(Object.entries(x.checklistPrices!).map(([k, v]) => [k, d.checklistPrices?.[k] ?? (v1[k] !== undefined ? d.customRate ?? v : v)])),
      }
    // lista já editada: só completa os valores que faltam
    return x.checklistPrices ? x : { ...x, checklistPrices: Object.fromEntries((x.checklist ?? []).map((c) => [c, d.checklistPrices?.[c] ?? d.customRate ?? 0])), customRate: x.customRate ?? d.customRate }
  })
}

/** Mensagens padrão — editáveis em Configurações. {variáveis} são preenchidas com os dados do caso.
 *  No jeito dela: tudo em minúsculas, leve e acolhedor; *negrito* e _itálico_ do WhatsApp nas palavras-chave. */
export const DEFAULT_MESSAGES: MessageTemplate[] = [
  { id: 'apresentacao', name: 'apresentação · prospectar escritório', text: 'oii, tudo bem? ✨\n\nmeu nome é {meu_nome}, atuo como freelancer para arquitetos e designers que buscam ganhar tempo terceirizando suas demandas!\n\ntrabalho com *_detalhamento, executivo, modelagem 3d e renders (vray ou ia, ia tem um ótimo custo benefício e um resultado incrível)_*, sempre com bastante cuidado nos detalhes e pensando em facilitar a execução na obra.\n\nse em algum momento você precisar de apoio para a demanda do escritório, vou amar conversar 💗\n\n_posso te enviar meu portfólio?_' },
  { id: 'parceria', name: 'parceria · portfólio', text: 'estou à disposição para parcerias. será um prazer trabalhar juntas!\n\nofereço serviços de *detalhamento, executivo, modelagem e renderização*\n(vray ou ia, _ia tem ótimo custo benefício com resultados incríveis_, no site você consegue comparar print x ia) ✨\n\nsite portfólio:\n{site}\n\ninstagram:\n{instagram}' },
  { id: 'primeiro-contato', name: 'primeiro contato', text: 'oii, {cliente}, tudo bem? ✨ aqui é a {meu_nome}, obrigada pelo contato 💗\n\nme conta um pouquinho do projeto: o que você precisa (*renders, modelagem, detalhamento ou executivo*), quantas imagens ou a metragem, e para quando precisa? assim já te passo um orçamento certinho ☺️' },
  { id: 'envio-orcamento', name: 'envio do orçamento (pdf)', text: 'oii, {cliente}! te encaminhei o pdf com a proposta, _é negociável_ ☺️ fico à disposição caso queira ajustar ou conversar sobre' },
  { id: 'retorno', name: 'cobrar resposta do orçamento', text: 'oii, {cliente}, tudo bem? ✨ passando para saber se conseguiu ver a proposta {proposta} ({projeto}). se quiser ajustar alguma coisa é só me falar, fico à disposição ☺️' },
  { id: 'aprovado', name: 'orçamento aprovado · pedir sinal', text: 'que ótimo, {cliente}! fico muito feliz 💗\n\npara darmos início, o sinal é de *{valor_parcela}* via pix (chave: {pix}). assim que confirmar, me envia por favor os arquivos do projeto (dwg/skp) e as referências ✨' },
  { id: 'sinal-recebido', name: 'sinal recebido · início', text: 'oii, {cliente}! sinal recebido, obrigada 💗 já comecei o projeto {projeto} e a previsão de entrega é *{prazo}*. qualquer novidade te aviso por aqui ✨' },
  { id: 'retorno-ajustes', name: 'cobrar retorno dos ajustes', text: 'oii, {cliente}, tudo bem? ✨ passando para saber se já conseguiu ver os ajustes do projeto {projeto}. fico no aguardo do seu retorno para seguirmos ☺️' },
  { id: 'retorno-aprovacao', name: 'cobrar aprovação do projeto', text: 'oii, {cliente}, tudo bem? ✨ passando para saber se conseguiu ver o projeto {projeto} e se está tudo de acordo. fico no aguardo para seguirmos ☺️' },
  { id: 'previa', name: 'envio de prévia para aprovação', text: 'oii, {cliente}! segue a prévia do projeto {projeto} ✨ dá uma olhada com calma e me diz se está tudo de acordo ou se prefere algum ajuste ☺️' },
  { id: 'cobranca', name: 'lembrete de pagamento', text: 'oii, {cliente}, tudo bem? ✨ passando para lembrar da parcela "{parcela}" do projeto {projeto}, de *{valor_parcela}*, com vencimento em {vencimento}. chave pix: {pix}\n\nobrigada 💗' },
  { id: 'cobranca-atraso', name: 'pagamento em atraso', text: 'oii, {cliente}, tudo bem? a parcela "{parcela}" do projeto {projeto}, de *{valor_parcela}*, venceu em {vencimento}. consegue verificar pra mim? chave pix: {pix}\n\nqualquer coisa me avisa, obrigada 💗' },
  { id: 'entrega', name: 'entrega final', text: 'oii, {cliente}! projeto {projeto} finalizado 🎉 os arquivos finais estão aqui: {arquivos}\n\nfoi um prazer trabalhar com você 💗 se puder, me conta o que achou do resultado ✨' },
  { id: 'depoimento', name: 'pedir depoimento / indicação', text: 'oii, {cliente}! espero que o projeto tenha ficado do jeitinho que você queria ✨ se puder deixar um depoimento rápido ou me indicar para alguém, me ajuda muito 💗' },
]

// textos padrão antigos: quem não editou recebe os novos (as editadas ficam como ela deixou)
const OLD_MESSAGE_TEXTS: Record<string, string> = Object.fromEntries(
  ([
    ['primeiro-contato', 'Oi, {cliente}! Tudo bem? Aqui é a {meu_nome}. Obrigada pelo contato! Me conta um pouquinho do projeto: o que você precisa (renders, modelagem, detalhamento…), quantas imagens ou a metragem, e para quando você precisa? Assim já te passo um orçamento certinho.'],
    ['envio-orcamento', 'Oi, {cliente}! Segue a proposta {proposta} do projeto {projeto}, no valor de {valor}. Qualquer dúvida ou ajuste é só me chamar!'],
    ['retorno', 'Oi, {cliente}! Tudo bem? Passando para saber se conseguiu ver a proposta {proposta} ({projeto}). Qualquer ajuste é só me falar. 😊'],
    ['aprovado', 'Que ótimo, {cliente}! Fico muito feliz 🤍 Para darmos início, o sinal é de {valor_parcela} via pix (chave: {pix}). Assim que confirmar, me envia por favor os arquivos do projeto (DWG/SKP) e as referências.'],
    ['sinal-recebido', 'Oi, {cliente}! Sinal recebido, obrigada! Já comecei o projeto {projeto} e a previsão de entrega é {prazo}. Qualquer novidade te aviso por aqui.'],
    ['previa', 'Oi, {cliente}! Segue a prévia do projeto {projeto}. Dá uma olhada com calma e me diz se está tudo de acordo ou se prefere algum ajuste. 😊'],
    ['cobranca', 'Oi, {cliente}! Tudo bem? Passando para lembrar da parcela "{parcela}" do projeto {projeto}, de {valor_parcela}, com vencimento em {vencimento}. Chave pix: {pix}. Obrigada!'],
    ['cobranca-atraso', 'Oi, {cliente}! Tudo bem? A parcela "{parcela}" do projeto {projeto}, de {valor_parcela}, venceu em {vencimento}. Consegue verificar para mim? Chave pix: {pix}. Obrigada!'],
    ['entrega', 'Oi, {cliente}! Projeto {projeto} finalizado 🎉 Os arquivos finais estão aqui: {arquivos}. Foi um prazer trabalhar com você! Se puder, me conta o que achou do resultado.'],
    ['depoimento', 'Oi, {cliente}! Espero que o projeto tenha ficado do jeitinho que você queria. Se puder deixar um depoimento rápido ou me indicar para alguém, me ajuda muito! 🤍'],
  ] as [string, string][]),
)

// mensagens novas que entraram depois (uma vez só: se ela apagar, não volta)
const LATER_MESSAGES = ['retorno-ajustes', 'retorno-aprovacao']
function addNewMessages(list: MessageTemplate[]): MessageTemplate[] {
  const seen = new Set(list.map((m) => m.id))
  const add = DEFAULT_MESSAGES.filter((m) => LATER_MESSAGES.includes(m.id) && !seen.has(m.id))
  return add.length ? [...list, ...add] : list
}

export function migrateMessages(list: MessageTemplate[] | undefined): MessageTemplate[] {
  if (!list?.length) return DEFAULT_MESSAGES
  const fresh = new Map(DEFAULT_MESSAGES.map((m) => [m.id, m]))
  const kept = list.map((m) => (OLD_MESSAGE_TEXTS[m.id] === m.text && fresh.has(m.id) ? { ...fresh.get(m.id)! } : m))
  const missing = DEFAULT_MESSAGES.filter((m) => ['apresentacao', 'parceria', 'retorno-ajustes', 'retorno-aprovacao'].includes(m.id) && !kept.some((k) => k.id === m.id))
  return [...missing, ...kept]
}

export const PAYMENT_TERMS = 'Pix — 50% de entrada + 50% na aprovação final | Crédito — 100%'

/** Sinal pago em demanda "aguardando sinal" → passa para "em execução". */
function autoStatus(raw: Project, prev?: Project): Project {
  // parcelas "na conclusão" acompanham o prazo combinado da demanda (sem prazo = sem data)
  const p = { ...raw, payments: raw.payments.map((x) => (!x.paidDate && payWhen(x) === 'conclusao' ? { ...x, on: 'conclusao' as const, dueDate: raw.dueDate || '' } : x)) }
  // só no momento em que o sinal PASSA a ser pago: "em alinhamento" vira "em execução".
  // Depois disso a fase é livre (dá para voltar para "em alinhamento" quando quiser).
  const signalJustPaid = !!p.payments[0]?.paidDate && !(prev?.payments.find((x) => x.id === p.payments[0].id)?.paidDate)
  if (p.status !== 'briefing' || !signalJustPaid || (prev && prev.status !== 'briefing')) return p
  return { ...p, status: 'producao', tasks: p.tasks.map((t) => (/sinal/i.test(t.text) ? { ...t, done: true } : t)) }
}

// Modelo "Proposta #001" (Canva): faixa grafite, The Seasons no título, quadro de serviços e faixa rosé do total.
export const DEFAULT_PROPOSAL: ProposalStyle = {
  version: 2,
  eyebrow: 'proposta de',
  title: 'orçamento',
  serif: 'The Seasons',
  ink: '#2a4352',
  rose: '#af8c86',
  arch: '#e7d5cf',
  paper: '#f7f5f1',
  bar: '#4a5d6b',
  files: 'PDF e arquivo editável do layout.',
  schedule: 'serão definidos conforme a necessidade do cliente.',
  showArch: true,
}

/** Perfil da Laís: usado só na prévia (Artifact) e para completar dados antigos dela.
 *  Conta nova de outra pessoa começa com o perfil em branco (DEFAULT_SETTINGS). */
export const LAIS_PROFILE = {
  brandName: 'laís',
  tagline: 'renderização · modelagem · detalhamento',
  ownerName: 'Laís',
  legalName: 'Laís Amaral Vieira',
  email: 'arq.laisav@gmail.com',
  phone: '+55 11 96928-8192',
  instagram: '@lais_3d',
  website: 'lais3d.com.br',
  pixKey: '11951233515',
}

export const DEFAULT_SETTINGS: Settings = {
  brandName: 'meu estúdio',
  tagline: '',
  ownerName: '',
  email: '',
  phone: '',
  instagram: '',
  website: '',
  document: '',
  pixKey: '',
  calendarToken: '',
  city: '',
  logo: '',
  customFont: '',
  themeVersion: 2,
  accent: '#3e4b57',
  accentSoft: '#d6b3ab',
  accentInk: '#a88a80',
  background: '#f5f1ee',
  surface: '#ffffff',
  text: '#3e4b57',
  displayFont: 'The Seasons',
  bodyFont: 'Poppins',
  radius: 18,
  uppercaseLabels: false,
  dark: false,
  monthlyGoal: 6000,
  studentDiscount: 40,
  complexity: { simples: 1, media: 1.3, alta: 1.6 },
  legalName: '',
  proposal: DEFAULT_PROPOSAL,
  meiLimit: 0,
  hourlyTarget: 60,
  urgencyFee: 30,
  openFileFee: 30,
  floorFee: 50,
  defaultRevisions: 1,
  revisionsV1: true,
  imagesV1: true,
  slidesV1: true,
  defaultPaymentTerms: PAYMENT_TERMS,
  services: migrateServices(DEFAULT_SERVICES),
  customColumns: [],
  navOrder: [],
  messages: DEFAULT_MESSAGES,
  messagesV2: true,
  messagesV3: true,
}

export function emptyData(): Data {
  return { version: 1, clients: [], projects: [], expenses: [], events: [], quotes: [], posts: [], contracts: [], briefings: [], settings: DEFAULT_SETTINGS }
}

const cacheKey = (userId?: string) => (userId ? `${KEY}:${userId}` : KEY)

/** Escolhas do cadastro (nome, estúdio, começar com exemplo), guardadas até a primeira entrada. */
export const SIGNUP_KEY = 'cadastro-inicio'
/** Padrões de uma conta nova de cliente: visual próprio (a fonte e a paleta da Laís são exclusivas dela)
 *  e serviços, mensagens e pagamento genéricos. */
export function clientSettings(settings: Settings): Settings {
  const kit = PALETTES.find((p) => p.name === 'areia & carvão')!
  return {
    ...settings,
    accent: kit.accent,
    accentSoft: kit.accentSoft,
    accentInk: kit.accentInk,
    background: kit.background,
    surface: kit.surface,
    text: kit.text,
    displayFont: CLIENT_DISPLAY,
    customFont: '',
    services: CLIENT_SERVICES,
    messages: CLIENT_MESSAGES,
    messagesV2: true,
    messagesV3: true,
    defaultPaymentTerms: CLIENT_PAYMENT_TERMS,
    paymentMethods: DEFAULT_PAYMENT_METHODS,
    proposal: { ...settings.proposal, schedule: CLIENT_SCHEDULE },
  }
}

function firstRunData(settings: Settings): Data {
  let info: { name?: string; studio?: string; demo?: boolean; profile?: WorkProfile } = {}
  try {
    info = JSON.parse(localStorage.getItem(SIGNUP_KEY) || '{}')
    localStorage.removeItem(SIGNUP_KEY)
  } catch {
    /* ok */
  }
  const st: Settings = {
    ...clientSettings(settings),
    ...(info.studio ? { brandName: info.studio } : {}),
    ...(info.name ? { ownerName: info.name } : {}),
    ...(info.profile ? { workProfile: info.profile, services: servicesFor(info.profile) } : {}),
  }
  return info.demo ? demoData(st) : { ...emptyData(), settings: st }
}

export const hasLocalAccount = (userId: string) => {
  try {
    return !!localStorage.getItem(cacheKey(userId))
  } catch {
    return false
  }
}

/** Prévia: a conta de cliente criada no cadastro começa com o que foi escolhido lá. */
export function seedPreviewAccount(userId: string) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(firstRunData(DEFAULT_SETTINGS)))
  } catch {
    /* ok */
  }
}

function load(userId?: string): Data {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return ARTIFACT ? demoData({ ...DEFAULT_SETTINGS, ...LAIS_PROFILE }) : emptyData()
    return normalize(JSON.parse(raw))
  } catch {
    return ARTIFACT ? demoData({ ...DEFAULT_SETTINGS, ...LAIS_PROFILE }) : emptyData()
  }
}

/** Garante que dados antigos/importados tenham todos os campos. */
/** Tira o que foi apagado (em qualquer aparelho) de todas as listas. */
function dropDeleted(d: Data): Data {
  if (!d.deleted?.length) return d
  const gone = new Set(d.deleted)
  const keep = <T extends { id: string }>(l: T[] | undefined) => (l ?? []).filter((x) => !gone.has(x.id))
  return { ...d, clients: keep(d.clients), projects: keep(d.projects), quotes: keep(d.quotes), expenses: keep(d.expenses), events: keep(d.events), posts: keep(d.posts), contracts: keep(d.contracts), briefings: keep(d.briefings) }
}
/** Junta o que foi apagado aqui com o que veio da nuvem (vale o apagado dos dois lados). */
export function withDeleted(remote: Partial<Data>, local?: Partial<Data>): Partial<Data> {
  const all = [...new Set([...(remote.deleted ?? []), ...(local?.deleted ?? [])])].slice(-1500)
  return all.length ? { ...remote, deleted: all } : remote
}

export function normalize(d: Partial<Data>): Data {
  return dropDeleted({ ...normalizeBase(d), deleted: d.deleted?.length ? d.deleted : undefined })
}

function normalizeBase(d: Partial<Data>): Data {
  const base = emptyData()
  return {
    version: 1,
    demo: d.demo,
    clients: (d.clients ?? []).map((c) => ({ ...c, name: titleCase(c.name), type: (c.type as string) === 'incorporadora' ? 'construtora' : c.type, history: c.history ?? [] })),
    projects: (d.projects ?? []).map((p) => ({
      ...p,
      timerStart: p.timerStart ?? null,
      payments: p.payments ?? [],
      extras: p.extras ?? [],
      tasks: p.tasks ?? [],
      timeLogs: p.timeLogs ?? [],
    })),
    expenses: d.expenses ?? [],
    events: d.events ?? [],
    posts: d.posts ?? [],
    contracts: d.contracts ?? [],
    briefings: d.briefings ?? [],
    quotes: (d.quotes ?? []).map((q) => ({
      ...q,
      sentAt: q.sentAt ?? (q.status === 'rascunho' ? '' : q.createdAt),
      mode: q.mode ?? 'escopo',
      pdf: q.pdf ?? true,
      area: q.area ?? 0,
      clientLabel: q.clientLabel ?? '',
      schedule: q.schedule ?? DEFAULT_PROPOSAL.schedule,
      paymentTerms: !q.paymentTerms || /^50% (no aceite|de entrada|de sinal)/.test(q.paymentTerms) ? PAYMENT_TERMS : q.paymentTerms,
      options: (q.options ?? []).map((o) =>
        o.items
          ? o
          : {
              ...o,
              // opção antiga (lista de textos + valor único) vira serviços
              items: (o.included ?? []).filter(Boolean).map((t, i) => ({
                id: uid(),
                service: '',
                title: t,
                detail: '',
                description: '',
                quantity: 1,
                complexity: 'media' as const,
                price: i === 0 ? o.price ?? 0 : 0,
                auto: false,
              })),
              note: o.summary ?? '',
              discount: 0,
              discountNote: '',
            },
      ),
      chosenOption: q.chosenOption ?? '',
      discountNote: q.discountNote ?? '',
      files: q.files ?? DEFAULT_PROPOSAL.files,
      items: q.items.map((i) => {
        const old = i as typeof i & { unitPrice?: number }
        return i.price !== undefined
          ? i
          : { ...i, title: '', detail: '', complexity: 'media' as const, price: (old.quantity ?? 1) * (old.unitPrice ?? 0), auto: false }
      }),
    })),
    settings: migrateSettings(
      {
        ...base.settings,
        ...(d.settings ?? {}),
        // modelo novo da proposta substitui o anterior (version < 2)
        proposal: (d.settings?.proposal?.version ?? 0) >= 2 ? { ...DEFAULT_PROPOSAL, ...d.settings!.proposal } : DEFAULT_PROPOSAL,
        email: d.settings?.email ?? '',
        // antes desta versão o teto do MEI vinha ligado por padrão; ela trabalha como pessoa física
        meiLimit: d.settings?.proposal ? (d.settings.meiLimit ?? 0) : 0,
        // pagamento padrão do modelo (textos antigos são trocados)
        defaultPaymentTerms: !d.settings?.defaultPaymentTerms || /^50% (no aceite|de entrada|de sinal)/.test(d.settings.defaultPaymentTerms) ? PAYMENT_TERMS : d.settings.defaultPaymentTerms,
        phone: d.settings?.phone ?? '',
        instagram: d.settings?.instagram ?? '',
        website: d.settings?.website ?? '',
        // padrão de rodadas de ajuste passou a ser 1 (uma vez só; depois vale o que ela escolher)
        defaultRevisions: d.settings?.revisionsV1 ? d.settings.defaultRevisions : 1,
        revisionsV1: true,
        complexity: { ...base.settings.complexity, ...(d.settings?.complexity ?? {}) },
        services: addSlides(d.settings?.slidesV1, (!d.settings?.services || d.settings.services.some((x) => !x.pricing) ? migrateServices(DEFAULT_SERVICES) : migrateServices(d.settings.services.map((x) => ({ ...x, tiers: x.tiers ?? [], min: x.min ?? 0 })))).map((x) =>
          // imagens não encarecem por pavimento (uma vez só; depois vale o que ela marcar)
          !d.settings?.imagesV1 && (x.id === 'render-vray' || x.id === 'render-ia') ? { ...x, perFloor: false } : x,
        )),
        imagesV1: true,
        slidesV1: true,
        // mensagens no jeito dela (uma vez só; as que ela editou ficam como estão)
        messages: !d.settings?.messagesV2 ? migrateMessages(d.settings?.messages) : d.settings.messagesV3 ? (d.settings.messages ?? DEFAULT_MESSAGES) : addNewMessages(d.settings.messages ?? DEFAULT_MESSAGES),
        messagesV2: true,
        messagesV3: true,
      },
      d.settings,
    ),
  }
}

/** Dados salvos com a identidade antiga recebem as cores e fontes do site. */
function migrateSettings(s: Settings, saved?: Partial<Settings>): Settings {
  if ((saved?.themeVersion ?? 0) >= 2) return s
  const v = DEFAULT_SETTINGS
  return {
    ...s,
    themeVersion: 2,
    brandName: !saved?.brandName || saved.brandName === 'Lais 3D' ? v.brandName : s.brandName,
    tagline: !saved?.tagline || saved.tagline === 'Visualização arquitetônica' ? v.tagline : s.tagline,
    ownerName: !saved?.ownerName || saved.ownerName === 'Lais' ? v.ownerName : s.ownerName,
    accent: v.accent,
    accentSoft: v.accentSoft,
    accentInk: v.accentInk,
    background: v.background,
    surface: v.surface,
    text: v.text,
    displayFont: v.displayFont,
    bodyFont: v.bodyFont,
    radius: v.radius,
    uppercaseLabels: v.uppercaseLabels,
  }
}

type Collection = 'clients' | 'projects' | 'expenses' | 'events' | 'quotes' | 'posts' | 'contracts' | 'briefings'
type Item<C extends Collection> = NonNullable<Data[C]>[number]

export type SyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'offline'

interface Store {
  data: Data
  upsert: <C extends Collection>(c: C, item: Item<C>) => void
  remove: (c: Collection, id: string) => void
  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (d: Data) => void
  lastSaved: Date | null
  sync: SyncStatus
  userEmail: string
  userId: string
  agenda: AgendaStatus // publicação da agenda do celular
  publishAgendaNow: () => Promise<boolean>
  isSample: boolean // mostrando o exemplo (não salva)
  showSample: (on: boolean) => void
}

export interface AgendaStatus {
  state: 'idle' | 'ok' | 'erro'
  at?: Date
  error?: string
}

// só republica quando o conteúdo da agenda muda (a hora de geração não conta)
const agendaSignature = (ics: string) => ics.replace(/^DTSTAMP:.*$/gm, '')

const Ctx = createContext<Store | null>(null)

const hasContent = (d: Data) => !d.demo && (d.clients.length > 0 || d.projects.length > 0 || d.quotes.length > 0 || d.expenses.length > 0)

/** Com `userId`, os dados vivem na nuvem; o navegador guarda só uma cópia de trabalho. */
export function StoreProvider({ children, userId, userEmail = '', preview = false }: { children: ReactNode; userId?: string; userEmail?: string; preview?: boolean }) {
  // preview: "ver como cliente" da dona — conta nova de cliente só em memória (nada é salvo)
  const cloud = CLOUD && !!userId && !preview
  const [data, setData] = useState<Data>(() => (preview ? { ...emptyData(), settings: { ...clientSettings(DEFAULT_SETTINGS), brandName: 'estúdio exemplo', ownerName: 'Ana' } } : load(userId)))
  const [agenda, setAgenda] = useState<AgendaStatus>({ state: 'idle' })
  const agendaSent = useRef('')
  const publishAgendaFor = useCallback(
    async (d: Data, force = false) => {
      if (!cloud || !userId) return false
      const token = d.settings.calendarToken
      const ics = token ? buildICS(d, `${(d.settings.brandName || 'meu estúdio').replace(/\.$/, '')} · agenda`) : ''
      const sig = `${token}|${agendaSignature(ics)}`
      if (!force && sig === agendaSent.current) return true
      try {
        await publishAgenda(userId, token, ics)
        agendaSent.current = sig
        setAgenda({ state: 'ok', at: new Date() })
        return true
      } catch (e) {
        setAgenda({ state: 'erro', error: e instanceof Error ? e.message : String(e) })
        return false
      }
    },
    [cloud, userId],
  )
  // modo exemplo: dados fictícios só em memória — nada é salvo nem enviado para a nuvem
  const [sample, setSample] = useState<Data | null>(null)
  const sampleOn = useRef(false)
  sampleOn.current = !!sample
  const setActive = useCallback((fn: (d: Data) => Data) => (sampleOn.current ? setSample((d) => (d ? fn(d) : d)) : setData(fn)), [])
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [sync, setSync] = useState<SyncStatus>(cloud ? 'loading' : 'local')
  const first = useRef(true)
  const fromRemote = useRef(false) // mudança veio da nuvem: não reenviar
  const remoteAt = useRef<string>('') // updated_at da última versão conhecida da nuvem
  const pending = useRef(false)

  // 1) ao entrar: busca a versão da nuvem antes de qualquer envio
  useEffect(() => {
    if (!cloud) return
    let alive = true
    ;(async () => {
      try {
        const remote = await fetchRemote(userId!)
        if (!alive) return
        if (remote) {
          remoteAt.current = remote.updatedAt
          // apagados neste aparelho enquanto estava sem internet continuam apagados
          const merged = withDeleted(remote.data, load(userId))
          fromRemote.current = (merged.deleted?.length ?? 0) === (remote.data.deleted?.length ?? 0)
          const d = normalize(merged)
          setData(d)
          // ao entrar, garante que a agenda do celular está em dia (ex.: se a última publicação falhou)
          if (d.settings.calendarToken) void publishAgendaFor(d)
        } else {
          // primeira vez: sobe o que já existia neste navegador (se for real)
          const local = load(userId)
          const legacy = load()
          const fresh = firstRunData(local.settings)
          const start = hasContent(local) ? local : hasContent(legacy) ? legacy : fresh
          remoteAt.current = await pushRemote(userId!, start)
          fromRemote.current = true
          setData(start)
        }
        setSync('saved')
        setLastSaved(new Date())
      } catch {
        if (alive) setSync('offline')
      }
    })()
    return () => {
      alive = false
    }
  }, [cloud, userId])

  // 2) a cada mudança: cópia local na hora, nuvem logo em seguida
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (preview) {
      setLastSaved(new Date())
      return
    }
    try {
      localStorage.setItem(cacheKey(userId), JSON.stringify(data))
    } catch {
      if (!cloud) toast('Não foi possível salvar neste navegador. Faça um backup em Configurações.')
    }
    if (!cloud) {
      setLastSaved(new Date())
      return
    }
    if (fromRemote.current) {
      fromRemote.current = false
      return
    }
    if (sync === 'loading') return
    pending.current = true
    setSync('saving')
    const t = setTimeout(async () => {
      try {
        remoteAt.current = await pushRemote(userId!, data)
        pending.current = false
        setSync('saved')
        setLastSaved(new Date())
        if (data.settings.calendarToken || agendaSent.current) void publishAgendaFor(data)
      } catch {
        setSync('offline')
      }
    }, 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // 3) ao voltar para a aba / reconectar: pega alterações feitas em outro aparelho
  useEffect(() => {
    if (!cloud) return
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        if (pending.current) {
          // havia algo não enviado (ex.: sem internet): reenvia
          remoteAt.current = await pushRemote(userId!, dataRef.current)
          pending.current = false
          setSync('saved')
          setLastSaved(new Date())
          return
        }
        const remote = await fetchRemote(userId!)
        if (remote && remote.updatedAt > remoteAt.current) {
          remoteAt.current = remote.updatedAt
          // outro aparelho salvou por cima com uma versão antiga: o que foi apagado aqui continua apagado (e a nuvem é corrigida)
          const merged = withDeleted(remote.data, dataRef.current)
          fromRemote.current = (merged.deleted?.length ?? 0) === (remote.data.deleted?.length ?? 0)
          setData(normalize(merged))
        }
        setSync('saved')
      } catch {
        setSync('offline')
      }
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    const iv = setInterval(refresh, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      clearInterval(iv)
    }
  }, [cloud, userId])

  const dataRef = useRef(data)
  dataRef.current = data

  const upsert = useCallback(<C extends Collection>(c: C, raw: Item<C>) => {
    setActive((d) => {
      const list = (d[c] ?? []) as Item<C>[]
      const prev = list.find((x) => x.id === raw.id)
      const item = (c === 'projects' ? autoStatus(raw as Project, prev as Project | undefined) : raw) as Item<C>
      const exists = list.some((x) => x.id === item.id)
      const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
      return { ...d, [c]: next }
    })
  }, [])

  const remove = useCallback((c: Collection, id: string) => {
    if (sampleOn.current) toast('Você está vendo o exemplo: nada é apagado de verdade. Toque no olho (“exemplo”) para voltar aos seus dados.')
    setActive((d) => {
      // guarda o id apagado: se outro aparelho aberto salvar a versão antiga, o item não volta
      const next: Data = { ...d, [c]: ((d[c] ?? []) as { id: string }[]).filter((x) => x.id !== id), deleted: [...(d.deleted ?? []), id].slice(-1500) }
      // limpeza em cascata
      if (c === 'clients') {
        const pids = new Set(d.projects.filter((p) => p.clientId === id).map((p) => p.id))
        next.deleted = [...(next.deleted ?? []), ...pids, ...d.quotes.filter((q) => q.clientId === id).map((q) => q.id)].slice(-1500)
        next.projects = d.projects.filter((p) => p.clientId !== id)
        next.quotes = d.quotes.filter((q) => q.clientId !== id)
        next.briefings = (d.briefings ?? []).filter((b) => b.clientId !== id)
        next.events = d.events.map((e) => (pids.has(e.projectId) ? { ...e, projectId: '' } : e))
      }
      if (c === 'projects') {
        next.events = d.events.map((e) => (e.projectId === id ? { ...e, projectId: '' } : e))
        next.quotes = d.quotes.map((q) => (q.projectId === id ? { ...q, projectId: '', projectRemoved: true } : q))
      }
      return next
    })
  }, [])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setActive((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

  const replaceAll = useCallback((d: Data) => setActive(() => normalize(d)), [setActive])

  const view = sample ?? data
  const showSample = useCallback(
    (on: boolean) => setSample(on ? { ...demoData(data.settings), demo: false } : null),
    [data.settings],
  )
  const publishAgendaNow = useCallback(() => publishAgendaFor(dataRef.current, true), [publishAgendaFor])
  const value = useMemo(
    () => ({ data: view, upsert, remove, setSettings, replaceAll, lastSaved, sync, userEmail, userId: userId ?? '', agenda, publishAgendaNow, isSample: !!sample, showSample }),
    [view, upsert, remove, setSettings, replaceAll, lastSaved, sync, userEmail, userId, agenda, publishAgendaNow, sample, showSample],
  )
  // tela de entrada: sempre com a marca da plataforma (o estúdio de quem usa aparece depois, dentro do sistema)
  if (sync === 'loading') return <div className="loading-screen"><span className="brand-name">{PLATFORM.name}<i>.</i></span><p className="muted small">carregando seus dados…</p></div>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider ausente')
  return s
}

/* ---------- dados de exemplo ---------- */

/** Os dados de exemplo ainda estão no sistema (mesmo com o aviso oculto)? */
export const hasDemoData = (d: Data) => d.clients.some((c) => c.name === 'Mariana Costa' && c.company === 'Costa Arquitetura')

export function demoData(settings: Settings): Data {
  const t = today()
  const c = (name: string, company: string, type: Data['clients'][number]['type'], city: string, origin: string) => ({
    id: uid(),
    name,
    company,
    type,
    email: `${name.split(' ')[0].toLowerCase()}@exemplo.com`,
    phone: '(31) 99999-0000',
    instagram: `@${name.split(' ')[0].toLowerCase()}.arq`,
    city,
    document: '',
    origin,
    notes: '',
    favorite: false,
    archived: false,
    history: [] as { id: string; date: string; text: string }[],
    createdAt: addDays(t, -120),
  })
  const clients = [
    c('Mariana Costa', 'Costa Arquitetura', 'escritorio', 'Belo Horizonte', 'Indicação'),
    c('Rafael Lima', 'Lima Interiores', 'designer', 'Nova Lima', 'Instagram'),
    c('Construtora Horizonte', 'Horizonte Engenharia', 'construtora', 'Contagem', 'Site'),
    c('Beatriz Souza', '', 'arquiteto', 'Belo Horizonte', 'Indicação'),
    c('Pedro Alves', 'UFMG', 'estudante', 'Belo Horizonte', 'Faculdade'),
  ]
  clients[0].favorite = true
  clients[0].history = [
    { id: uid(), date: addDays(t, -30), text: 'Prefere receber prévias em baixa resolução pelo WhatsApp antes do render final.' },
    { id: uid(), date: addDays(t, -6), text: 'Fechou o living e a cozinha do Savassi; pediu mais uma vista da bancada.' },
  ]
  const [mari, rafa, horiz, bia, pedro] = clients

  const mk = (
    client: string,
    title: string,
    service: string,
    quantity: number,
    value: number,
    status: Data['projects'][number]['status'],
    priority: Data['projects'][number]['priority'],
    startOffset: number,
    dueOffset: number,
    mode: Parameters<typeof splitPayments>[1],
    paidCount: number,
  ) => {
    const start = addDays(t, startOffset)
    const due = addDays(t, dueOffset)
    const payments = splitPayments(value, mode, start, due).map((p, i) => (i < paidCount ? { ...p, paidDate: p.dueDate } : p))
    return {
      id: uid(),
      clientId: client,
      title,
      service,
      quantity,
      description: '',
      status,
      priority,
      startDate: start,
      dueDate: due,
      deliveredDate: status === 'entregue' ? due : null,
      value,
      discount: 0,
      payments,
      revisionsIncluded: 2,
      revisionsUsed: status === 'revisao' ? 1 : 0,
      estimatedHours: quantity * 6,
      timeLogs: status === 'briefing' ? [] : [{ id: uid(), date: start, hours: quantity * 3, note: 'Modelagem e setup de luz' }],
      tasks: DEFAULT_TASKS.map((text, i) => ({
        id: uid(),
        text,
        // quantas etapas já foram feitas em cada status
        done: i < (({ briefing: 0, producao: 2, revisao: 4, aguardando: 4, entregue: 6, pausado: 1, cancelado: 0 } as Record<string, number>)[status] ?? 0),
      })),
      filesLink: '',
      timerStart: null,
      notes: '',
      createdAt: start,
    }
  }

  const projects = [
    mk(mari.id, 'Apartamento Savassi — living e cozinha', 'render-vray', 4, 1800, 'producao', 'alta', -6, 3, '50-50', 1),
    mk(rafa.id, 'Suíte master — Casa Vila da Serra', 'render-vray', 3, 1350, 'revisao', 'media', -12, 1, '50-50', 1),
    mk(horiz.id, 'Edifício Aurora — fachada e áreas comuns', 'render-vray', 6, 3300, 'briefing', 'media', 2, 20, '50-50', 0),
    mk(bia.id, 'Planta humanizada — Casa Pampulha', 'planta-hum', 2, 600, 'aguardando', 'baixa', -9, -1, 'avista', 1),
    mk(mari.id, 'Loja Lourdes — fachada', 'render-vray', 2, 1100, 'entregue', 'media', -40, -25, '50-50', 2),
    mk(horiz.id, 'Decorado — apartamento 2 quartos', 'render-vray', 5, 2250, 'entregue', 'alta', -70, -50, '50-50', 1),
    mk(pedro.id, 'Renders para TCC — biblioteca', 'render-ia', 2, 600, 'producao', 'baixa', -3, 9, '50-50', 1),
    mk(rafa.id, 'Home office — Buritis', 'render-vray', 2, 900, 'entregue', 'media', -100, -85, 'avista', 1),
  ]

  const expenses = [
    { id: uid(), description: 'D5 Render Pro', category: 'software' as const, amount: 190, date: addDays(t, -150), recurring: true, notes: '' },
    { id: uid(), description: 'SketchUp Pro', category: 'software' as const, amount: 170, date: addDays(t, -150), recurring: true, notes: '' },
    { id: uid(), description: 'Carnê-leão (IR)', category: 'impostos' as const, amount: 120, date: addDays(t, -150), recurring: true, notes: '' },
    { id: uid(), description: 'Biblioteca de modelos 3D', category: 'cursos' as const, amount: 120, date: addDays(t, -10), recurring: false, notes: '' },
    { id: uid(), description: 'Anúncio Instagram', category: 'marketing' as const, amount: 80, date: addDays(t, -4), recurring: false, notes: '' },
  ]

  const events = [
    { id: uid(), title: 'Call de briefing — Edifício Aurora', date: addDays(t, 1), time: '10:00', type: 'reuniao' as const, projectId: projects[2].id, notes: '', done: false },
    { id: uid(), title: 'Orientação TCC', date: addDays(t, 2), time: '14:00', type: 'faculdade' as const, projectId: '', notes: '', done: false },
    { id: uid(), title: 'Entrega prévia living', date: addDays(t, 1), time: '18:00', type: 'entrega' as const, projectId: projects[0].id, notes: '', done: false },
    { id: uid(), title: 'Prova — Urbanismo', date: addDays(t, 6), time: '19:00', type: 'faculdade' as const, projectId: '', notes: '', done: false },
  ]

  const quotes = [
    {
      id: uid(),
      number: 1,
      clientId: bia.id,
      title: 'Renders — Casa Pampulha',
      mode: 'escopo' as const,
      pdf: true,
      area: 0,
      clientLabel: '',
      options: [],
      chosenOption: '',
      discountNote: '',
      files: 'PDF e arquivo editável do layout.',
      schedule: DEFAULT_PROPOSAL.schedule,
      items: [
        { id: uid(), service: 'render-vray', title: 'renderização V-Ray', detail: '5 imagens', description: 'living, jantar, cozinha e 2 vistas da fachada', quantity: 5, complexity: 'media' as const, price: 370, auto: true },
        { id: uid(), service: 'modelagem', title: 'modelagem 3d', detail: '', description: 'modelagem completa a partir do DWG, com mobiliário', quantity: 140, complexity: 'media' as const, price: 1092, auto: true },
      ],
      discount: 62,
      urgency: false,
      deadlineDays: 10,
      validityDays: 15,
      revisions: 2,
      paymentTerms: settings.defaultPaymentTerms,
      notes: '',
      status: 'enviado' as const,
      sentAt: addDays(t, -5),
      createdAt: addDays(t, -5),
      projectId: '',
    },
  ]

  // instagram: algumas postagens do mês (exemplo)
  const post = (days: number, time: string, format: SocialPost['format'], pillar: string, title: string, status: SocialPost['status']): SocialPost => ({
    id: uid(),
    date: addDays(t, days),
    time,
    format,
    pillar,
    title,
    hook: title,
    script: '',
    caption: '',
    art: '',
    cta: 'orçamento pelo link da bio',
    hashtags: '#arquitetura #render3d #designdeinteriores',
    status,
  })
  const posts: SocialPost[] = [
    post(-6, '12:00', 'carrossel', 'dicas', 'como escolher a iluminação da sala', 'postado'),
    post(-2, '19:00', 'reels', 'portfolio', 'antes × depois: Casa Pampulha', 'postado'),
    post(1, '12:00', 'post', 'processo', 'como é contratar um projeto comigo', 'pronto'),
    post(3, '19:00', 'reels', 'portfolio', 'tour pelo living do Apartamento Savassi', 'produzindo'),
    post(6, '12:00', 'carrossel', 'dicas', '5 erros comuns na planta do apartamento', 'ideia'),
  ]
  // contrato de exemplo, já preenchido com os dados do orçamento enviado
  const q0 = quotes[0]
  const vars: Record<string, string> = {
    contratante: bia.name,
    doc_contratante: 'CPF 123.456.789-09',
    endereco_contratante: 'Rua das Flores, 120, Belo Horizonte',
    email_contratante: bia.email,
    telefone_contratante: bia.phone,
    contratada: settings.legalName || settings.ownerName || 'Ana Ribeiro',
    doc_contratada: 'CPF 987.654.321-00',
    endereco_contratada: 'Av. Afonso Pena, 1000, Belo Horizonte',
    email_contratada: settings.email || 'ana@exemplo.com',
    telefone_contratada: settings.phone || '(31) 99999-0000',
    projeto: q0.title,
    servicos: '• renderização V-Ray (5 imagens)\n• modelagem 3d',
    valor: 'R$ 1.400,00',
    valor_extenso: 'mil e quatrocentos reais',
    pagamento: settings.defaultPaymentTerms,
    prazo: '10 dias úteis',
    prazo_dias: '10',
    quantidade: '5',
    entrada: 'R$ 700,00',
    saldo: 'R$ 700,00',
    foro: 'Belo Horizonte/MG',
    revisoes: '2',
    arquivos: q0.files,
    orcamento: '#001',
    cidade: 'Belo Horizonte - MG',
    data: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
  }
  const tpl = CLIENT_CONTRACTS[0]
  const contracts = [{ id: uid(), title: `Contrato — ${q0.title}`, quoteId: q0.id, clientId: bia.id, templateId: tpl.id, body: tpl.body.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m), status: 'enviado' as const, createdAt: addDays(t, -3) }]

  return { version: 1, demo: true, clients, projects, expenses, events, quotes, posts, contracts, settings }
}
