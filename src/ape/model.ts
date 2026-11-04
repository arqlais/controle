/* planê.apê — orçamentos dos futuros moradores (por enquanto, só o San Levi).
   Aqui fica o que não depende de tela: nome, serviços, cálculo do "mais compensa" e as mensagens. */

export const APE = {
  name: 'planê.apê',
  condominio: 'San Levi',
  construtora: 'MRV',
  apes: '38 a 40 m²',
  dona: 'Laís',
  doApe: 'apê 1204',
  instagram: '@apzinho_1204',
  whatsapp: '5511969288192', // da Laís: grupo, loja e dúvidas
}

export type Nicho =
  | 'piso-vinilico' | 'piso-ceramico' | 'piso-laminado' | 'marcenaria' | 'marmoraria' | 'box' | 'gesso' | 'eletrica' | 'ar'
  | 'pintura' | 'cortinas' | 'telas' | 'vidros' | 'moveis' | 'eletros' | 'mao-de-obra' | 'outros'

export const NICHOS: [Nicho, string, string][] = [
  ['piso-vinilico', 'Piso vinílico', 'floor'], ['piso-ceramico', 'Porcelanato e cerâmica', 'tile'], ['piso-laminado', 'Piso laminado', 'floor'],
  ['marcenaria', 'Marcenaria e planejados', 'wood'], ['marmoraria', 'Marmoraria e bancadas', 'stone'], ['box', 'Box de banheiro', 'shower'],
  ['gesso', 'Gesso, forro e sanca', 'ceiling'], ['eletrica', 'Elétrica e iluminação', 'bolt'], ['ar', 'Ar-condicionado', 'snow'],
  ['pintura', 'Pintura', 'brush'], ['cortinas', 'Cortinas e persianas', 'curtain'], ['telas', 'Telas de proteção', 'net'],
  ['vidros', 'Vidros e espelhos', 'glass'], ['moveis', 'Móveis soltos', 'sofa'], ['eletros', 'Eletrodomésticos', 'fridge'],
  ['mao-de-obra', 'Mão de obra geral', 'tool'], ['outros', 'Outros', 'box'],
]
const NMAP = Object.fromEntries(NICHOS.map((n) => [n[0], { l: n[1], i: n[2] }])) as Record<string, { l: string; i: string }>
export const nicho = (id?: string) => NMAP[id || 'outros'] || NMAP.outros
export const isNicho = (id: unknown): id is Nicho => typeof id === 'string' && !!NMAP[id]
/** Produto da loja sugerido no meio da lista, conforme o serviço. */
export const CTA_BY: Partial<Record<Nicho, string>> = { marcenaria: 'projeto', marmoraria: 'projeto', eletrica: 'projeto', gesso: 'projeto', ar: 'projeto' }

export interface Orcamento {
  id: string
  criado: string
  exemplo?: boolean
  oculto?: boolean
  nicho: Nicho
  fornecedor: string
  servico: string
  resumo: string
  contato: string
  whatsapp: string
  instagram?: string
  valor_total: number | null
  valor_avista: number | null
  desconto_avista_pct: number | null
  parcelas_max: number | null
  valor_parcela: number | null
  juros: boolean | null
  grupo_pct: number | null
  grupo_min: number | null
  grupo_desc: string
  area_m2: number | null
  inclui: string[]
  nao_inclui: string[]
  alertas: string[]
  prazo: string
  garantia: string
  validade: string
  pagamento: string
  completude: number | null
  interessados: number | null // quem entrou no grupo por fora (WhatsApp); soma com os da página
}

export type Categoria = 'arquivos' | 'combos' | 'plataforma' | 'projeto'
export const CATEGORIAS: [Categoria, string, string, string][] = [
  ['arquivos', 'arquivos úteis', 'file', 'Materiais prontos para baixar, imprimir ou usar no celular. Quanto mais você leva, maior o desconto.'],
  ['combos', 'kits', 'gift', 'Os arquivos juntos, com o melhor preço. Para chegar na vistoria, na obra e na mudança sem susto.'],
  ['plataforma', 'plataforma do apê', 'phone', 'Um app no celular para controlar gastos, parcelas, obra e vistoria do seu apê, num lugar só.'],
  ['projeto', 'projeto do seu apê', 'ruler', 'Projeto de interiores feito por uma estudante de arquitetura no último ano, nas medidas do seu apê, com preço acessível.'],
]
export interface Produto {
  id: string
  nome: string
  desc: string
  preco: string
  tag: string
  ativo: boolean
  cat?: Categoria
  preco_de?: string // preço "de", riscado
  unidade?: string // ex.: "por ano"
  itens?: string[] // o que vem
  formato?: string // ex.: "PDF · 9 páginas"
  entrega?: string // como recebe
  amostras?: string[] // imagens (pasta public/ape/amostras)
  combo?: string[] // ids dos produtos que o combo junta
  destaque?: boolean
  numeros?: string[] // o que tem dentro, em números (ex.: "9 páginas")
  fase?: 'comprando' | 'comprei' // para quem ainda vai comprar o apê ou para quem já comprou
  arte?: string // desenho que representa o produto
}

export interface Morador {
  id: string
  nome: string
  condominio?: string // 'San Levi' ou o nome que a pessoa digitou
  torre: string
  ap: string
  tel: string
  criado?: string
}

export interface Arquivo {
  path: string
  nome: string
  tipo: string
}

export interface Envio {
  id: string
  morador: Morador | null
  nicho: string
  fornecedor: string
  texto: string
  arquivos: Arquivo[]
  status: 'novo' | 'publicado' | 'descartado'
  orcamento?: string
  criado: string
}

export interface Interesse {
  orcamento: string
  morador: Morador | null
  criado: string
}

/* ===== números ===== */
export const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  let s = String(v).replace(/[^\d,.-]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}
export const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '')
export const waNum = (s: unknown) => {
  let d = digits(s)
  if (!d) return ''
  if (d.length <= 11) d = '55' + d
  return d
}
export const wa = (n: string, text: string) => `https://wa.me/${n}?text=${encodeURIComponent(text)}`
export const brl = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 1000 ? 0 : 2 })
export const pct = (v: number) => (Math.round(v * 10) / 10).toLocaleString('pt-BR') + '%'
export const dmy = (iso?: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m ? `${d}/${m}/${y}` : iso
}
export const fmtTel = (s: unknown) => {
  const d = digits(s).replace(/^55(?=\d{10,11}$)/, '')
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : String(s ?? '')
}
export const firstName = (n: string) => String(n || '').trim().split(/\s+/)[0] || ''
export const newId = () => 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/* ===== cálculo ===== */
export type Validade = 'sem' | 'vencido' | 'vence' | 'ok'
export interface Calc {
  total: number | null
  avista: number | null
  dp: number
  parcelas: number | null
  parcela: number | null
  parcTotal: number | null
  grupo: number | null
  gp: number
  area: number | null
  m2: number | null
  st: Validade
  dias: number | null
}
const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
export function calc(q: Orcamento): Calc {
  const total = num(q.valor_total)
  let dp = num(q.desconto_avista_pct)
  let avista = num(q.valor_avista)
  if (avista == null && total != null) avista = dp ? total * (1 - dp / 100) : total
  if (!dp && total && avista && avista < total) dp = (1 - avista / total) * 100
  const parcelas = num(q.parcelas_max)
  let parcela = num(q.valor_parcela)
  if (parcela == null && parcelas && total) parcela = total / parcelas
  const parcTotal = parcelas && parcela ? parcelas * parcela : null
  const gp = num(q.grupo_pct)
  const grupo = gp && avista ? avista * (1 - gp / 100) : null
  const area = num(q.area_m2)
  const m2 = area && avista ? avista / area : null
  let st: Validade = 'sem'
  let dias: number | null = null
  if (q.validade) {
    const v = new Date(q.validade + 'T00:00:00')
    if (!isNaN(+v)) {
      dias = Math.round((+v - +today()) / 864e5)
      st = dias < 0 ? 'vencido' : dias <= 7 ? 'vence' : 'ok'
    }
  }
  return { total, avista, dp: dp || 0, parcelas, parcela, parcTotal, grupo, gp: gp || 0, area, m2, st, dias }
}

export type Selo = { label: string; tone: 'azul' | 'rosa' | 'terra'; icon: string }
export interface Item {
  o: Orcamento
  c: Calc
  key: number | null
  score: number
  badges: Selo[]
  top: boolean
}
export interface Analise {
  items: Item[]
  basis: 'm2' | 'total'
  top: Item | null
}

/** Nota = 70% preço relativo + 20% completude + 10% validade. Compara por m² quando metade ou mais tem área. */
export function analyze(list: Orcamento[]): Analise {
  const items: Item[] = list.map((o) => ({ o, c: calc(o), key: null, score: 0, badges: [], top: false }))
  const withArea = items.filter((x) => x.c.m2).length
  const basis = withArea >= 2 && withArea >= Math.ceil(items.length / 2) ? 'm2' : 'total'
  for (const x of items) x.key = basis === 'm2' ? x.c.m2 : x.c.avista
  const keys = items.map((x) => x.key).filter((v): v is number => v != null && v > 0)
  const min = keys.length ? Math.min(...keys) : null
  for (const x of items) {
    const ratio = x.key && min ? min / x.key : 0
    x.score = ratio * 0.7 + ((num(x.o.completude) || 3) / 5) * 0.2 + (x.c.st === 'vencido' ? -0.15 : 0.1)
  }
  const pick = (arr: Item[], f: (x: Item) => number | null, better: (a: number, b: number) => boolean) =>
    arr.reduce<Item | null>((b, x) => {
      const v = f(x)
      return v == null ? b : !b || better(v, f(b) as number) ? x : b
    }, null)
  const live = items.filter((x) => x.c.st !== 'vencido')
  const pool = live.length ? live : items
  const cheap = pick(pool, (x) => x.key, (a, b) => a < b)
  const parc = pick(pool.filter((x) => (x.c.parcelas || 0) >= 2), (x) => x.c.parcTotal, (a, b) => a < b)
  const desc = pick(pool.filter((x) => x.c.dp > 0), (x) => x.c.dp, (a, b) => a > b)
  const grp = pick(pool.filter((x) => x.c.gp > 0), (x) => x.c.gp, (a, b) => a > b)
  const top = items.length > 1 ? pick(pool, (x) => x.score, (a, b) => a > b) : null
  const many = items.length > 1
  for (const x of items) {
    if (many && x === cheap) x.badges.push({ label: 'Menor preço à vista', tone: 'azul', icon: 'tag' })
    if (many && x === parc) x.badges.push({ label: 'Melhor parcelado', tone: 'azul', icon: 'clock' })
    if (many && x === desc) x.badges.push({ label: 'Maior desconto à vista', tone: 'terra', icon: 'tag' })
    if (x === grp) x.badges.push({ label: 'Desconto em grupo', tone: 'rosa', icon: 'users' })
    x.top = x === top
  }
  return { items, basis, top }
}

export function whyTop(x: Item, a: Analise): string[] {
  const r: string[] = []
  if (x.badges.some((b) => b.label === 'Menor preço à vista')) r.push(a.basis === 'm2' ? 'Menor preço por m² à vista' : 'Menor preço à vista entre os orçamentos')
  else if (x.key) {
    const k = a.items.map((y) => y.key).filter((v): v is number => !!v)
    const mn = Math.min(...k)
    if (x.key > mn) r.push(`Só ${pct((x.key / mn - 1) * 100)} acima do mais barato, mas mais completo`)
  }
  if ((x.o.inclui || []).some((s) => /instala|m[aã]o de obra|montagem/i.test(s))) r.push('Já inclui instalação ou mão de obra')
  if ((x.c.parcelas || 0) >= 2 && x.o.juros === false) r.push(`Parcela em até ${x.c.parcelas}x sem juros`)
  if (x.c.gp) r.push(`Mais ${pct(x.c.gp)} de desconto fechando em grupo`)
  if (x.o.garantia) r.push(`Garantia: ${x.o.garantia}`)
  return r.slice(0, 4)
}

export type Sort = 'compensa' | 'avista' | 'parcelado' | 'desconto' | 'grupo' | 'recente'
export const SORTS: Record<Sort, [string, (a: Item, b: Item) => number]> = {
  compensa: ['Mais compensa', (a, b) => b.score - a.score],
  avista: ['Menor preço à vista', (a, b) => (a.key ?? 1e12) - (b.key ?? 1e12)],
  parcelado: ['Melhor parcelado', (a, b) => (a.c.parcTotal ?? 1e12) - (b.c.parcTotal ?? 1e12) || (b.c.parcelas || 0) - (a.c.parcelas || 0)],
  desconto: ['Maior desconto à vista', (a, b) => b.c.dp - a.c.dp],
  grupo: ['Desconto em grupo', (a, b) => b.c.gp - a.c.gp],
  recente: ['Mais recentes', (a, b) => String(b.o.criado).localeCompare(String(a.o.criado))],
}

/* ===== mensagens de WhatsApp (emojis só aqui, nas conversas) ===== */
export const ehSanLevi = (m: Morador | null) => !!m && (!m.condominio || m.condominio === APE.condominio)
/** "Maria (San Levi, Torre 2, apê 304)" ou "Maria (Residencial X)". */
export const ondeMora = (m: Morador | null) =>
  !m ? '' : ehSanLevi(m) ? [APE.condominio, m.torre && `Torre ${m.torre}`, m.ap && `apê ${m.ap}`].filter(Boolean).join(', ') : m.condominio || ''
const quem = (m: Morador | null) => (m ? `${m.nome}${ondeMora(m) ? ` (${ondeMora(m)})` : ''}` : 'uma pessoa que está montando o apê')
export const msgFornecedor = (o: Orcamento, m: Morador | null) =>
  `Olá! Sou ${quem(m)}. Vi o orçamento de ${o.servico || nicho(o.nicho).l} da ${o.fornecedor} na página ${APE.name} e queria conversar.` +
  (num(o.grupo_pct) ? ' Tenho interesse também na condição de compra em grupo.' : '')
export const msgGrupo = (o: Orcamento, m: Morador | null) => `Oi, ${APE.dona}! Sou ${quem(m)}. Quero entrar na compra em grupo de ${o.servico || nicho(o.nicho).l} da ${o.fornecedor} 🙌`
export const msgProduto = (p: Produto, m: Morador | null) =>
  `Oi, ${APE.dona}! Sou ${quem(m)}. Tenho interesse em: ${p.nome}${p.preco ? ` (${p.preco}${p.unidade ? ` ${p.unidade}` : ''})` : ''} 😊` + (m ? `\nTelefone: ${fmtTel(m.tel)}` : '')
export const msgAnexo = (m: Morador | null, fornecedor: string) =>
  `Oi, ${APE.dona}! Sou ${quem(m)}. Mandei o orçamento${fornecedor ? ` da ${fornecedor}` : ''} pela página e vou anexar o arquivo aqui 📎`

/* ===== produtos e exemplos ===== */
const AM = (f: string) => `ape/amostras/${f}`
const NA_HORA = 'Pagou no Pix ou no cartão, o botão de baixar aparece na hora. O link também fica guardado para baixar de novo.'
export const LOJA_VERSAO = 4
/** Quanto mais arquivos avulsos no carrinho, maior o desconto: [a partir de N itens, % de desconto]. */
export const DESCONTOS: [number, number][] = [[2, 10], [3, 15], [4, 20], [6, 25]]
const arq = (p: Omit<Produto, 'cat' | 'ativo' | 'entrega'>): Produto => ({ cat: 'arquivos', ativo: true, entrega: NA_HORA, fase: 'comprei', ...p })
export const PRODUTOS: Produto[] = [
  arq({ id: 'checklist', arte: 'vistoria', nome: 'Checklist de vistoria MRV', tag: 'para a vistoria', destaque: true, preco: 'R$ 19,90', formato: 'PDF · imprimir ou usar no celular', amostras: [AM('m-checklist.jpg')], numeros: ['9 páginas', '+90 itens', '7 cômodos', 'resumo para a MRV'],
    desc: 'Tudo o que conferir no dia da vistoria, cômodo por cômodo, para a construtora corrigir antes de você receber as chaves.',
    itens: ['O que levar e o que combinar antes', 'Itens para porta, sala, cozinha, área de serviço, banheiro, quartos e apê inteiro', 'Testes simples de vazamento, caimento de piso e tomadas', 'Tabela para anotar as medidas do seu apê', 'O que fazer com os problemas depois', 'Resumo pronto para entregar à construtora'] }),
  arq({ id: 'planilha', arte: 'planilha', nome: 'Planilha de obra e compras', tag: 'organização', destaque: true, preco: 'R$ 24,90', formato: 'Excel · abre no Google Planilhas', amostras: [AM('m-planilha.jpg')], numeros: ['6 abas', '27 itens prontos', 'contas automáticas'],
    desc: 'Quanto você planejou, quanto já gastou e quanto falta, por cômodo, com as parcelas mês a mês.',
    itens: ['Resumo automático por cômodo e no total', 'Lista de compras com itens típicos de apê compacto e valores de referência', 'Comparador de orçamentos que mostra o mais barato', 'Parcelas dos próximos 12 meses somadas sozinhas', 'Cronograma da obra na ordem certa, da vistoria à mudança'] }),
  arq({ id: 'guia', arte: 'orcamento', nome: 'Guia de orçamentos', tag: 'antes de fechar', preco: 'R$ 14,90', formato: 'PDF', amostras: [AM('m-guia.jpg')], numeros: ['8 páginas', '9 serviços', '3 mensagens prontas'],
    desc: 'O que pedir em cada orçamento, as pegadinhas mais comuns e como comparar de verdade.',
    itens: ['Piso, marcenaria, marmoraria, box, gesso, elétrica, ar, pintura, telas e cortinas', 'O que precisa vir escrito em cada orçamento', 'A pegadinha mais comum de cada serviço', 'Tabela para comparar até 3 orçamentos', 'Mensagens prontas para pedir orçamento e desconto em grupo'] }),
  arq({ id: 'medidas', arte: 'medidas', nome: 'Guia de medidas do apê', tag: 'novo', preco: 'R$ 16,90', formato: 'PDF', amostras: [AM('m-medidas.jpg')], numeros: ['6 páginas', '+25 móveis', 'tabela "cabe?"'],
    desc: 'As medidas dos móveis e dos espaços de passagem para comprar o que cabe de verdade num apê compacto.',
    itens: ['Passagens mínimas entre móveis, portas e gavetas', 'Sala e jantar: sofá, rack, mesa e distância da TV', 'Cozinha e área de serviço: bancada, geladeira, máquina', 'Quartos e banheiro: camas, guarda-roupa, box', 'O teste da fita crepe e a tabela "cabe no meu apê?"'] }),
  arq({ id: 'enxoval', arte: 'enxoval', nome: 'Planilha do enxoval', tag: 'novo', preco: 'R$ 14,90', formato: 'Excel · abre no Google Planilhas', amostras: [AM('m-enxoval.jpg')], numeros: ['+50 itens', '3 prioridades', 'quanto falta'],
    desc: 'Tudo o que comprar para morar, com preço de referência, prioridade e quanto falta por cômodo.',
    itens: ['Lista pronta da cozinha, área de serviço, banheiro, quartos e sala', 'Prioridade: essencial, logo e pode esperar', 'Resumo automático por cômodo e por prioridade', 'Espaço para onde comprar e quanto pagou'] }),
  arq({ id: 'entregas', arte: 'entregas', nome: 'Checklist de entregas da obra', tag: 'novo', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-entregas.jpg')], numeros: ['4 páginas', '6 serviços', 'termo de recebimento'],
    desc: 'O que conferir quando cada fornecedor terminar, antes de pagar a última parcela.',
    itens: ['Marcenaria, piso, bancadas, box, gesso e pintura, elétrica e ar', 'Testes simples para fazer no dia da entrega', 'O que combinar antes de fechar', 'Termo de recebimento para assinar com o fornecedor'] }),
  arq({ id: 'mudanca', arte: 'mudanca', nome: 'Lista da mudança e enxoval', tag: 'para a mudança', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-mudanca.jpg')], numeros: ['5 páginas', 'semana a semana', 'caixa do 1º dia'],
    desc: 'O enxoval cômodo por cômodo e a mudança semana a semana, para nada ficar para trás.',
    itens: ['Enxoval da cozinha, área de serviço, banheiro, quartos e sala', 'Passo a passo: 30 dias, 15 dias, 7 dias, o dia e depois', 'Contas para ligar e endereço para trocar', 'A caixa do primeiro dia'] }),
  arq({ id: 'planner', arte: 'decoracao', nome: 'Planner de decoração', tag: 'novo', preco: 'R$ 17,90', formato: 'PDF · imprimir ou usar no tablet', amostras: [AM('m-planner.jpg')], numeros: ['5 páginas', '4 paletas', 'moodboard'],
    desc: 'Do estilo à lista de compras: defina a cara do apê, escolha a paleta e compre na ordem certa.',
    itens: ['Teste rápido para descobrir o seu estilo', 'Paletas prontas para apê compacto', 'Moodboard para cada cômodo', 'Ideias para parecer maior, guardar mais e gastar menos', 'Lista de decoração na ordem de compra que economiza'] }),
  arq({ id: 'compra', arte: 'contrato', fase: 'comprando', nome: 'Guia de compra do apê na planta', tag: 'antes de assinar', destaque: true, preco: 'R$ 19,90', formato: 'PDF', amostras: [AM('m-compra.jpg')], numeros: ['6 páginas', '8 etapas', '12 perguntas prontas'],
    desc: 'Do stand às chaves: as etapas, os custos que ninguém conta, o que perguntar ao corretor e o que olhar no contrato.',
    itens: ['As 8 etapas da compra na planta, uma por uma', 'Custos escondidos: ITBI, cartório, juros de obra, INCC, condomínio', '12 perguntas para fazer ao corretor', 'Prazo de entrega, correção das parcelas e distrato explicados', 'Financiamento em 5 passos'] }),
  arq({ id: 'planilha-compra', arte: 'calculo', fase: 'comprando', nome: 'Planilha de custos da compra', tag: 'simulação', preco: 'R$ 19,90', formato: 'Excel · abre no Google Planilhas', amostras: [AM('m-planilha-compra.jpg')], numeros: ['3 abas', 'Price e SAC', 'custos extras'],
    desc: 'Quanto o apê custa de verdade: entrada, parcelas corrigidas, financiamento, juros de obra, ITBI e cartório, tudo somado.',
    itens: ['Simulação do financiamento (Price e SAC)', 'Parcelas com a construtora corrigidas pelo INCC, mês a mês', 'Juros de obra estimados', 'ITBI, cartório e tarifas do banco', 'Quanto da sua renda a parcela usa', 'Comparador de até 3 imóveis com preço por m²'] }),
  arq({ id: 'decorado', arte: 'decorado', fase: 'comprando', nome: 'Checklist do decorado e documentos', tag: 'na visita ao stand', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-decorado.jpg')], numeros: ['4 páginas', 'comparar 3 opções', 'documentos'],
    desc: 'O que olhar no decorado e na planta, como comparar empreendimentos e todos os documentos para o financiamento.',
    itens: ['O que observar no apê e no prédio na visita', 'O que é do decorado e não vem no apê', 'Tabela para comparar 3 empreendimentos', 'Lista de documentos para o financiamento'] }),
  { id: 'kit-compra', cat: 'combos', nome: 'Kit vou comprar meu apê', tag: 'kit', arte: 'contrato', preco: 'R$ 34,90', combo: ['compra', 'planilha-compra', 'decorado'], entrega: NA_HORA, amostras: [AM('m-compra.jpg'), AM('m-planilha-compra.jpg'), AM('m-decorado.jpg')],
    desc: 'Para quem ainda vai comprar: guia de compra na planta, planilha de custos e checklist do decorado.', itens: [], ativo: true },
  { id: 'kit-chaves', cat: 'combos', nome: 'Kit chaves na mão', tag: 'kit', arte: 'vistoria', preco: 'R$ 34,90', combo: ['checklist', 'entregas', 'mudanca'], entrega: NA_HORA, amostras: [AM('m-checklist.jpg'), AM('m-entregas.jpg'), AM('m-mudanca.jpg')],
    desc: 'Da vistoria à mudança: o checklist da vistoria, o de entregas da obra e a lista da mudança.', itens: [], ativo: true },
  { id: 'kit-obra', cat: 'combos', nome: 'Kit obra sem susto', tag: 'kit', arte: 'planilha', preco: 'R$ 39,90', combo: ['planilha', 'guia', 'medidas'], entrega: NA_HORA, amostras: [AM('m-planilha.jpg'), AM('m-guia.jpg'), AM('m-medidas.jpg')],
    desc: 'Para planejar, comparar orçamentos e comprar o que cabe: planilha de obra, guia de orçamentos e guia de medidas.', itens: [], ativo: true },
  { id: 'kit-completo', cat: 'combos', nome: 'Kit apê completo', tag: 'mais vendido', arte: 'casa', destaque: true, preco: 'R$ 79,90', combo: ['compra', 'planilha-compra', 'decorado', 'checklist', 'planilha', 'guia', 'medidas', 'enxoval', 'entregas', 'mudanca', 'planner'], entrega: NA_HORA, amostras: [AM('m-compra.jpg'), AM('m-checklist.jpg'), AM('m-planilha.jpg'), AM('m-planner.jpg')],
    desc: 'Os 11 arquivos da loja, da compra à decoração, por menos da metade do preço.', itens: ['+ 3 meses grátis da plataforma do apê'], ativo: true },
  { id: 'plataforma', cat: 'plataforma', nome: 'Plataforma do apê', tag: 'no celular', preco: 'R$ 79', unidade: 'por ano', preco_de: 'R$ 9,90 por mês', formato: 'app no navegador do celular · funciona no computador também', entrega: 'Você chama no WhatsApp e recebe o acesso em até 24 horas.', amostras: [AM('m-plataforma.jpg')], arte: 'celular',
    desc: 'Gastos, parcelas, obra, vistoria e contatos do seu apê num lugar só, no celular.',
    itens: ['Quanto já foi gasto e quanto falta, por cômodo', 'Parcelas dos próximos meses', 'Obra passo a passo, com datas e o que já foi feito', 'Vistoria com fotos e resumo para a construtora', 'Contatos dos fornecedores com WhatsApp a um toque', 'Funciona no celular, sem instalar nada'], ativo: true },
  { id: 'layout', cat: 'projeto', nome: 'Projeto de layout', tag: 'planta com móveis', preco: 'R$ 390', formato: 'planta em PDF + lista de compras', entrega: 'Entrega em até 10 dias depois da conversa inicial.', amostras: [AM('m-layout.jpg')], arte: 'planta',
    desc: 'A planta do seu apê com os móveis no lugar e as medidas certas, para pedir orçamentos iguais e comprar sem errar.',
    itens: ['Conversa para entender a sua rotina', 'Planta de layout com móveis e medidas', '1 rodada de ajustes', 'Lista de compras com medidas de cada móvel', 'Sugestão de pontos de tomada e iluminação'], ativo: true },
  { id: 'projeto', cat: 'projeto', nome: 'Projeto completo com 3D', tag: 'mais completo', destaque: true, preco: 'R$ 1.290', preco_de: 'R$ 1.590', formato: 'planta, imagens 3D e detalhamento em PDF', entrega: 'Entrega em até 25 dias, em etapas: layout, 3D e detalhamento.', amostras: [AM('m-projeto.jpg'), AM('m-layout.jpg')], arte: 'projeto3d',
    desc: 'Layout, imagens 3D e detalhamento para a marcenaria, nas medidas do seu apê. Projeto de interiores feito por uma estudante de arquitetura no último ano.',
    itens: ['Tudo do projeto de layout', 'Imagens 3D da sala e da cozinha', 'Detalhamento da marcenaria para o marceneiro orçar', 'Sugestão de pontos de tomada e iluminação, para o eletricista executar', 'Lista de materiais e acabamentos', '2 rodadas de ajustes', 'Quando a obra pedir ART, um profissional habilitado assina à parte'], ativo: true },
]

/** Parcelas sem juros no cartão (mesma regra da função de pagamento). */
export const parcelasMax = (total: number) => (total >= 60 ? 3 : total >= 30 ? 2 : 1)
/** Pode ir para o carrinho (arquivos e kits); plataforma e projeto são combinados no WhatsApp. */
export const noCarrinho = (p: Produto) => (p.cat || 'arquivos') === 'arquivos' || p.cat === 'combos'
export const reais = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const c2 = (n: number) => Math.round(n * 100) / 100
/** A mesma conta da função de pagamento: kit tem preço fixo; arquivos avulsos ganham desconto pela quantidade
 *  (e um arquivo que já está num kit do carrinho sai, para não pagar duas vezes). */
export function conta(ids: string[], produtos: Produto[], tiers: [number, number][] = DESCONTOS) {
  const map = new Map(produtos.filter((p) => p.ativo && noCarrinho(p)).map((p) => [p.id, p]))
  let uniq = [...new Set(ids)].filter((id) => map.has(id))
  const dentro = new Set(uniq.flatMap((id) => (map.get(id)!.cat === 'combos' ? map.get(id)!.combo || [] : [])))
  const repetidos = uniq.filter((id) => map.get(id)!.cat !== 'combos' && dentro.has(id))
  uniq = uniq.filter((id) => !repetidos.includes(id))
  const itens = uniq.map((id) => map.get(id)!)
  const avulsos = itens.filter((p) => p.cat !== 'combos')
  const pct = tiers.reduce((b, [k, v]) => (avulsos.length >= k ? Math.max(b, v) : b), 0)
  const prox = tiers.find(([k]) => k > avulsos.length) || null
  const subtotal = c2(itens.reduce((t, p) => t + reais(p.preco), 0))
  const desconto = c2(avulsos.reduce((t, p) => t + reais(p.preco), 0) * pct / 100)
  return { itens, avulsos: avulsos.length, pct, prox, subtotal, desconto, total: c2(subtotal - desconto), repetidos }
}

export const CTA_COPY: Record<string, [string, string, string]> = {
  checklist: ['Vistoria em dezembro', 'Não deixe passar nenhum defeito na vistoria', 'Uma lista cômodo por cômodo para conferir piso, paredes, esquadrias, louças e elétrica antes de receber as chaves.'],
  projeto: ['Antes de fechar', 'Feche marcenaria e elétrica com o projeto na mão', 'Com a planta e as medidas certas, você pede orçamentos iguais e compara de verdade.'],
  planilha: ['Organização', 'Saiba quanto já gastou e quanto falta', 'Uma planilha pronta para controlar compras, parcelas e orçamentos do apê.'],
  plataforma: ['Plataforma do apê', 'Tudo do seu apê num lugar só', `Compras, obra, vistoria e contatos, no celular, como usamos no ${APE.doApe}.`],
  'kit-completo': ['Kit', 'Da compra à decoração, sem susto', 'Os 11 arquivos da loja por menos da metade do preço: guias, checklists, planilhas e planner.'],
}

const base = (o: Partial<Orcamento>): Orcamento => ({
  id: newId(), criado: new Date().toISOString(), nicho: 'outros', fornecedor: '', servico: '', resumo: '', contato: '', whatsapp: '', instagram: '',
  valor_total: null, valor_avista: null, desconto_avista_pct: null, parcelas_max: null, valor_parcela: null, juros: null,
  grupo_pct: null, grupo_min: null, grupo_desc: '', area_m2: null, inclui: [], nao_inclui: [], alertas: [],
  prazo: '', garantia: '', validade: '', pagamento: '', completude: null, interessados: 0, ...o,
})
export const blankOrcamento = (o: Partial<Orcamento> = {}) => base(o)

export const EXEMPLOS: Orcamento[] = [
  base({ id: 'ex1', exemplo: true, criado: '2026-11-04T15:00:00.000Z', nicho: 'piso-vinilico', fornecedor: 'Vinil Prime (exemplo)', servico: 'Piso vinílico colado 2 mm em sala, circulação e 2 quartos', resumo: 'Piso vinílico com instalação e rodapé para 30 m²; à vista sai R$ 3.780.', valor_total: 4200, valor_avista: 3780, desconto_avista_pct: 10, parcelas_max: 10, valor_parcela: 420, juros: false, grupo_pct: 8, grupo_min: 10, grupo_desc: '8% a mais fechando 10 apês', area_m2: 30, inclui: ['Piso vinílico 2 mm colado', 'Mão de obra de instalação', 'Rodapé de 7 cm'], nao_inclui: ['Regularização do contrapiso, se precisar', 'Retirada de entulho'], alertas: [`Confirme se o contrapiso da ${APE.construtora} está nivelado o bastante para piso colado`], prazo: '3 dias', garantia: '1 ano na instalação', validade: '2026-12-15', pagamento: 'Pix com 10% ou 10x sem juros no cartão', completude: 4, interessados: 6 }),
  base({ id: 'ex2', exemplo: true, criado: '2026-11-04T15:00:00.000Z', nicho: 'piso-vinilico', fornecedor: 'Casa do Piso (exemplo)', servico: 'Piso vinílico click 4 mm, só material', resumo: 'Mais barato no papel, mas é só o material: a instalação é por fora.', valor_total: 3600, valor_avista: 3420, desconto_avista_pct: 5, parcelas_max: 12, valor_parcela: 300, juros: false, area_m2: 30, inclui: ['Piso vinílico click 4 mm', 'Manta acústica'], nao_inclui: ['Mão de obra', 'Rodapé'], alertas: ['Preço só do material: some a instalação antes de comparar'], prazo: 'Entrega em 7 dias', validade: '2026-11-20', pagamento: '5% no Pix ou 12x sem juros', completude: 3 }),
  base({ id: 'ex3', exemplo: true, criado: '2026-11-04T15:00:00.000Z', nicho: 'marcenaria', fornecedor: 'Marcenaria Bela (exemplo)', servico: 'Cozinha planejada e painel de TV em MDF', resumo: 'Cozinha completa e painel da sala; à vista R$ 16.650.', valor_total: 18500, valor_avista: 16650, desconto_avista_pct: 10, parcelas_max: 12, valor_parcela: 1541.67, juros: false, grupo_pct: 5, grupo_min: 5, grupo_desc: '5% para 5 apês ou mais', inclui: ['Armários aéreos e inferiores da cozinha', 'Painel de TV com nicho', 'Ferragens com amortecedor'], nao_inclui: ['Pedra da pia', 'Eletros'], alertas: ['Orçamento vencido: peça atualização antes de fechar'], prazo: '30 dias após medição', garantia: '5 anos', validade: '2026-11-01', pagamento: '10% à vista ou 12x sem juros', completude: 4, interessados: 2 }),
]

/* ===== leitura com IA ===== */
export const FIELDS: [keyof Orcamento, string, 'text' | 'nicho' | 'area' | 'num' | 'bool' | 'date' | 'lines'][] = [
  ['fornecedor', 'Fornecedor', 'text'], ['nicho', 'Serviço', 'nicho'], ['servico', 'O que é', 'text'], ['resumo', 'Resumo simples', 'area'],
  ['contato', 'Contato', 'text'], ['whatsapp', 'WhatsApp do fornecedor', 'text'], ['instagram', 'Instagram', 'text'],
  ['valor_total', 'Valor cheio (R$)', 'num'], ['valor_avista', 'Valor à vista (R$)', 'num'], ['desconto_avista_pct', 'Desconto à vista (%)', 'num'],
  ['parcelas_max', 'Parcelas (máx.)', 'num'], ['valor_parcela', 'Valor da parcela (R$)', 'num'], ['juros', 'Parcelado com juros?', 'bool'],
  ['grupo_pct', 'Desconto em grupo (%)', 'num'], ['grupo_min', 'Mínimo de apês', 'num'], ['interessados', 'Apês interessados por fora', 'num'], ['grupo_desc', 'Condição do grupo', 'text'],
  ['area_m2', 'Área orçada (m²)', 'num'], ['validade', 'Válido até', 'date'], ['prazo', 'Prazo', 'text'], ['garantia', 'Garantia', 'text'], ['pagamento', 'Pagamento', 'text'],
  ['completude', 'Quão completo (1 a 5)', 'num'],
  ['inclui', 'Inclui (um por linha)', 'lines'], ['nao_inclui', 'Não inclui (um por linha)', 'lines'], ['alertas', 'Antes de fechar, confira (um por linha)', 'lines'],
]

/** Limpa o que veio da IA (ou de um JSON antigo) para o formato do orçamento. */
export function cleanOrcamento(raw: Record<string, unknown>, keep: Partial<Orcamento> = {}): Orcamento {
  const o = base(keep)
  const out = o as unknown as Record<string, unknown>
  for (const [k, , t] of FIELDS) {
    const v = raw[k]
    if (v === undefined) continue
    out[k] = t === 'lines' ? (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : []) : t === 'num' ? num(v) : t === 'bool' ? (v === true ? true : v === false ? false : null) : v == null ? '' : String(v)
  }
  if (!isNicho(o.nicho)) o.nicho = 'outros'
  return o
}

export function aiPrompt(txt: string) {
  const hoje = new Date().toISOString().slice(0, 10)
  return `Você organiza orçamentos de reforma para moradores de um condomínio da ${APE.construtora} (apês de ${APE.apes}, entregues com contrapiso na sala e quartos; cozinha, área de serviço e banheiro já com cerâmica). Hoje é ${hoje}.
Leia o orçamento (texto e/ou imagens) e responda SÓ com um objeto JSON neste formato:
{"fornecedor": "nome da empresa ou profissional", "nicho": um destes ids: ${NICHOS.map((n) => n[0]).join(', ')}, "servico": "o que está sendo orçado, curto", "resumo": "1 frase simples para leigo: o que é e o preço que importa", "contato": "nome do vendedor ou vazio", "whatsapp": "só dígitos com DDD ou vazio", "instagram": "", "valor_total": número ou null (preço cheio ou a prazo), "valor_avista": número ou null, "desconto_avista_pct": número ou null, "parcelas_max": número ou null, "valor_parcela": número ou null, "juros": true, false ou null, "grupo_pct": desconto % extra para compra em grupo/condomínio ou null, "grupo_min": mínimo de apês para esse desconto ou null, "grupo_desc": "condição do grupo em texto curto ou vazio", "area_m2": área orçada em m² (piso, gesso, pintura) ou null, "inclui": ["itens curtos"], "nao_inclui": ["itens curtos, inclusive o que costuma ser necessário e não aparece no orçamento"], "alertas": ["pegadinhas que o morador deve conferir"], "prazo": "", "garantia": "", "validade": "AAAA-MM-DD ou vazio (se disser válido por N dias, conte a partir da data do orçamento)", "pagamento": "formas de pagamento em texto curto", "completude": 1 a 5 (quão completo e claro é o orçamento)}
Regras: valores em reais como número (1234.5), sem R$. Não invente nada: o que não estiver escrito fica null ou vazio. Se houver opções ou ambientes separados, use o valor do pacote completo do apê e cite as opções em "alertas". Ignore nomes e telefones de moradores que estejam no meio da conversa: o contato é só do fornecedor. Português, frases curtas. Sem emojis.
ORÇAMENTO:
"""
${txt || '(ver anexos)'}
"""`
}

/** Pega o primeiro objeto JSON de uma resposta (a IA às vezes embrulha em ```json). */
export function parseJsonReply(text: string): Record<string, unknown> | null {
  const m = /\{[\s\S]*\}/.exec(text.replace(/```(?:json)?/gi, ''))
  if (!m) return null
  try {
    const v = JSON.parse(m[0])
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}
