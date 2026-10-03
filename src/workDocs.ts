import type { PhotoPos } from './docTypes'

/* Documentos de obra: memorial descritivo, lista de compras, custos, diário, relatório de visita, ata e ordem de serviço.
   Todos usam a mesma base: uma lista de itens (com grupo, quantidade, valor, link, foto…) e um dos 4 layouts.
   Cada tipo só mostra os campos que fazem sentido para ele. */

export type WorkKind = 'memorial' | 'compras' | 'custos' | 'diario' | 'visita' | 'ata' | 'os'
export type WorkLayout = 'tabela' | 'lista' | 'cartoes' | 'fichas'

export interface WorkItem {
  id: string
  group?: string // ambiente, categoria, etapa…
  title: string
  desc?: string // marca/modelo, explicação, decisão…
  qty?: number
  unit?: string
  price?: number // valor unitário (compras, OS) ou valor (custos)
  link?: string
  photo?: string
  photoPos?: PhotoPos
  who?: string // responsável, fornecedor, equipe
  date?: string // prazo ou dia
  done?: boolean // comprado, pago, conferido, feito
}

export interface WorkDoc {
  kind: WorkKind
  title: string
  date: string
  layout: WorkLayout
  projectId?: string
  place?: string // endereço da obra
  people?: string // participantes (ata), equipe (diário)
  intro?: string
  notes?: string // observações / próximos passos
  items: WorkItem[]
}

export type WorkField = 'group' | 'desc' | 'qty' | 'price' | 'link' | 'photo' | 'who' | 'date' | 'done'

export interface WorkKindInfo {
  label: string
  text: string
  icon: string
  layout: WorkLayout // layout que já vem escolhido
  fields: WorkField[]
  groupLabel: string
  groups: string[] // grupos sugeridos
  titleLabel: string
  descLabel: string
  whoLabel?: string
  dateLabel?: string
  doneLabel?: string
  priceLabel?: string
  total?: boolean // soma os valores
  people?: string // rótulo do campo "participantes / equipe"
  starter: Omit<WorkItem, 'id'>[]
}

export const WORK_KINDS: Record<WorkKind, WorkKindInfo> = {
  memorial: {
    label: 'memorial descritivo',
    text: 'acabamentos, louças e metais, mobiliário e equipamentos, ambiente por ambiente',
    icon: 'layers',
    layout: 'cartoes',
    fields: ['group', 'desc', 'qty', 'link', 'photo'],
    groupLabel: 'ambiente ou categoria',
    groups: ['acabamentos', 'louças e metais', 'mobiliário', 'equipamentos', 'iluminação'],
    titleLabel: 'item',
    descLabel: 'marca, modelo, cor e acabamento',
    starter: [
      { group: 'acabamentos', title: 'porcelanato do piso', desc: '90×90 cm, acetinado, cor areia', qty: 32, unit: 'm²' },
      { group: 'louças e metais', title: 'cuba de apoio', desc: 'branca, 40 cm', qty: 1, unit: 'un' },
      { group: 'mobiliário', title: 'sofá', desc: '3 lugares, tecido linho cru', qty: 1, unit: 'un' },
    ],
  },
  compras: {
    label: 'lista de compras',
    text: 'o que comprar, onde, quanto e o que já foi comprado',
    icon: 'wallet',
    layout: 'tabela',
    fields: ['group', 'desc', 'qty', 'price', 'link', 'photo', 'who', 'done'],
    groupLabel: 'ambiente ou loja',
    groups: ['sala', 'cozinha', 'quarto', 'banheiro'],
    titleLabel: 'produto',
    descLabel: 'detalhes (medida, cor, modelo)',
    whoLabel: 'loja',
    doneLabel: 'comprado',
    priceLabel: 'valor unitário',
    total: true,
    starter: [
      { group: 'sala', title: 'tapete', desc: '2,00 × 2,50 m, bege', qty: 1, unit: 'un', price: 890 },
      { group: 'cozinha', title: 'banquetas', desc: 'altura 65 cm', qty: 3, unit: 'un', price: 320 },
    ],
  },
  custos: {
    label: 'custos de obra',
    text: 'quanto a obra está custando, por etapa, e o que já foi pago',
    icon: 'trend',
    layout: 'tabela',
    fields: ['group', 'desc', 'price', 'who', 'date', 'done'],
    groupLabel: 'etapa ou categoria',
    groups: ['demolição', 'alvenaria', 'elétrica', 'hidráulica', 'gesso', 'pintura', 'marcenaria', 'mão de obra'],
    titleLabel: 'gasto',
    descLabel: 'detalhes',
    whoLabel: 'fornecedor',
    dateLabel: 'data',
    doneLabel: 'pago',
    priceLabel: 'valor',
    total: true,
    starter: [
      { group: 'demolição', title: 'retirada de revestimentos', price: 1800, who: 'equipe de obra' },
      { group: 'elétrica', title: 'material elétrico', price: 950, who: 'loja' },
    ],
  },
  diario: {
    label: 'diário de obra',
    text: 'o que aconteceu em cada dia, com fotos e quem estava na obra',
    icon: 'calendar',
    layout: 'fichas',
    fields: ['desc', 'photo', 'who', 'date'],
    groupLabel: '',
    groups: [],
    titleLabel: 'o que foi feito',
    descLabel: 'detalhes, clima, ocorrências',
    whoLabel: 'equipe',
    dateLabel: 'dia',
    people: 'equipe da obra',
    starter: [{ title: 'início da demolição', desc: 'retirada do piso da sala e da cozinha', who: 'pedreiro + ajudante' }],
  },
  visita: {
    label: 'relatório de visita',
    text: 'checklist do que foi conferido na obra, com fotos e pendências',
    icon: 'hardhat',
    layout: 'lista',
    fields: ['group', 'desc', 'photo', 'done'],
    groupLabel: 'ambiente',
    groups: ['sala', 'cozinha', 'banheiro', 'quarto', 'área externa'],
    titleLabel: 'item conferido',
    descLabel: 'observação',
    doneLabel: 'ok',
    people: 'presentes',
    starter: [
      { group: 'cozinha', title: 'pontos elétricos conforme projeto', done: true },
      { group: 'banheiro', title: 'caimento do piso do box', desc: 'ajustar antes do rejunte' },
    ],
  },
  ata: {
    label: 'ata de reunião',
    text: 'o que foi conversado, decidido e quem faz o quê até quando',
    icon: 'edit',
    layout: 'lista',
    fields: ['desc', 'who', 'date', 'done'],
    groupLabel: '',
    groups: [],
    titleLabel: 'assunto ou decisão',
    descLabel: 'o que ficou combinado',
    whoLabel: 'responsável',
    dateLabel: 'prazo',
    doneLabel: 'feito',
    people: 'participantes',
    starter: [{ title: 'escolha do revestimento da cozinha', desc: 'cliente aprovou a opção 2', who: 'cliente', date: '' }],
  },
  os: {
    label: 'ordem de serviço',
    text: 'o serviço que o fornecedor vai fazer: itens, prazos e valores',
    icon: 'briefcase',
    layout: 'tabela',
    fields: ['desc', 'qty', 'price', 'who', 'date', 'done', 'photo'],
    groupLabel: '',
    groups: [],
    titleLabel: 'serviço',
    descLabel: 'como deve ser feito',
    whoLabel: 'quem faz',
    dateLabel: 'prazo',
    doneLabel: 'feito',
    priceLabel: 'valor',
    total: true,
    people: 'fornecedor / prestador',
    starter: [{ title: 'instalação das luminárias', desc: 'conforme projeto luminotécnico', qty: 12, unit: 'un', price: 45 }],
  },
}

export const WORK_ORDER: WorkKind[] = ['memorial', 'compras', 'custos', 'diario', 'visita', 'ata', 'os']

export const WORK_LAYOUTS: { id: WorkLayout; label: string; text: string; icon: string }[] = [
  { id: 'tabela', label: 'tabela', text: 'linhas e colunas, com totais', icon: 'grid' },
  { id: 'lista', label: 'lista', text: 'compacta, item embaixo de item', icon: 'list' },
  { id: 'cartoes', label: 'cartões', text: 'foto em destaque, dois por linha', icon: 'image' },
  { id: 'fichas', label: 'fichas', text: 'um item por bloco, foto grande', icon: 'layers' },
]

export const has = (k: WorkKind, f: WorkField) => WORK_KINDS[k].fields.includes(f)

/** Valor total de um item (quantidade × valor; custos não têm quantidade). */
export const itemTotal = (k: WorkKind, i: WorkItem) => (i.price ?? 0) * (has(k, 'qty') ? i.qty ?? 1 : 1)
export const workTotal = (d: WorkDoc) => d.items.reduce((s, i) => s + itemTotal(d.kind, i), 0)
export const workDone = (d: WorkDoc) => d.items.filter((i) => i.done).reduce((s, i) => s + itemTotal(d.kind, i), 0)

/** Itens agrupados na ordem em que os grupos aparecem pela primeira vez. */
export function groupItems(items: WorkItem[]) {
  const out: { group: string; items: WorkItem[] }[] = []
  for (const i of items) {
    const g = i.group?.trim() ?? ''
    const box = out.find((x) => x.group === g)
    if (box) box.items.push(i)
    else out.push({ group: g, items: [i] })
  }
  return out
}

export function newWorkDoc(kind: WorkKind, today: string, uid: () => string): WorkDoc {
  const k = WORK_KINDS[kind]
  return { kind, title: k.label, date: today, layout: k.layout, items: k.starter.map((x) => ({ ...x, id: uid(), ...(kind === 'diario' ? { date: today } : {}) })) }
}
