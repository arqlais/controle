import { CATALOGO_BELEZA } from './catalogo-beleza'

/* planê.apê — orçamentos dos futuros moradores (por enquanto, só o San Levi).
   Aqui fica o que não depende de tela: nome, serviços, cálculo do "mais compensa" e as mensagens. */

export const APE = {
  name: 'planê.apê',
  condominio: 'San Levi',
  apes: '38 a 40 m²',
  dona: 'Laís',
  semestre: '9º', // semestre da Laís em Arquitetura e Urbanismo (aparece em projetos e reformas)
  doApe: 'apê 1204',
  torre: '2', // o apê da Laís no San Levi: torre 2, apê 1204 (planta de corredor)
  moradores: 'Laís e Igor',
  meuApe: '40 m²', // o apê da Laís (exemplo padrão nos materiais)
  instagram: '@plane.ape',
  whatsapp: '5511969288192', // da Laís: grupo, loja e dúvidas
}

export type Nicho =
  | 'piso-vinilico' | 'piso-ceramico' | 'piso-laminado' | 'revestimentos' | 'marcenaria' | 'marmoraria' | 'box' | 'gesso' | 'eletrica' | 'hidraulica' | 'aquecedor' | 'vistoria'
  | 'impermeabilizacao' | 'serralheria' | 'ar' | 'pintura' | 'cortinas' | 'telas' | 'vidros' | 'iluminacao' | 'moveis' | 'eletros' | 'mao-de-obra' | 'outros'
  | `x:${string}` // pasta criada sozinha quando o orçamento não cabe em nenhuma das de cima

export const NICHOS: [Nicho, string, string][] = [
  // na ordem da obra: primeiro a vistoria, depois o que fica dentro de parede e teto, os acabamentos e, por último, o que entra pronto
  ['vistoria', 'Vistoria de entrega', 'check'], ['mao-de-obra', 'Mão de obra geral', 'tool'], ['impermeabilizacao', 'Impermeabilização', 'shield'],
  ['hidraulica', 'Hidráulica', 'shower'], ['eletrica', 'Elétrica', 'bolt'], ['ar', 'Ar-condicionado', 'snow'], ['aquecedor', 'Aquecedor', 'bolt'],
  ['gesso', 'Gesso, forro e sanca', 'ceiling'], ['piso-ceramico', 'Porcelanato e cerâmica', 'tile'], ['revestimentos', 'Revestimentos de parede', 'tile'],
  ['marmoraria', 'Pedras e bancadas', 'stone'], ['pintura', 'Pintura', 'brush'], ['piso-vinilico', 'Piso vinílico', 'floor'], ['piso-laminado', 'Piso laminado', 'floor'],
  ['marcenaria', 'Marcenaria e planejados', 'wood'], ['box', 'Box de banheiro', 'shower'], ['vidros', 'Vidros e espelhos', 'glass'], ['serralheria', 'Serralheria', 'tool'],
  ['telas', 'Telas de proteção', 'net'], ['iluminacao', 'Iluminação', 'sparkle'], ['cortinas', 'Cortinas e persianas', 'curtain'],
  ['moveis', 'Móveis soltos', 'sofa'], ['eletros', 'Eletrodomésticos', 'fridge'], ['outros', 'Outros', 'box'],
]
const NMAP = Object.fromEntries(NICHOS.map((n) => [n[0], { l: n[1], i: n[2] }])) as Record<string, { l: string; i: string }>
const capi1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
export const ehNichoNovo = (id?: string): id is `x:${string}` => !!id && /^x:.{2,40}$/.test(id)
/** Pasta nova a partir de um nome ("aquecedores" → x:Aquecedores). */
export const nichoNovo = (nome: string): Nicho => `x:${capi1(nome.trim().replace(/\s+/g, ' ').slice(0, 40))}` as Nicho
export const nicho = (id?: string) => (ehNichoNovo(id) ? { l: capi1(id.slice(2)), i: 'box' } : NMAP[id || 'outros'] || NMAP.outros)
export const isNicho = (id: unknown): id is Nicho => typeof id === 'string' && (!!NMAP[id] || ehNichoNovo(id))
/** As pastas para escolher: as fixas, mais as criadas sozinhas que já existem. */
export const opcoesNicho = (extras: (string | undefined)[] = []): [string, string][] => [...NICHOS.map((n) => [n[0], n[1]] as [string, string]), ...[...new Set(extras.filter(ehNichoNovo))].map((id) => [id, nicho(id).l] as [string, string])]
/** Produto da loja sugerido no meio da lista, conforme o serviço. */
export const CTA_BY: Partial<Record<Nicho, string>> = { marcenaria: 'guia', marmoraria: 'guia', eletrica: 'entregas', hidraulica: 'entregas', gesso: 'guia', ar: 'guia', 'piso-vinilico': 'guia', 'piso-ceramico': 'guia', 'piso-laminado': 'guia', moveis: 'medidas' }

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
  grupo_por?: string // quem registrou a condição (torre e apê)
  grupo_ate?: string // até quando vale a condição negociada para o grupo (AAAA-MM-DD)
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
  itens?: ItemOrc[] // itens do orçamento, como vieram (para comparar escopo e quantidades)
  materiais?: string[] // marcas, linhas, espessuras, acabamentos
  email?: string
  telefone?: string
  cnpj?: string
  endereco?: string
  arquivos?: { nome: string; tipo: string }[]
  lendo?: boolean // anexado agora: a leitura dos valores ainda vai acontecer
  nicho_auto?: boolean // a pasta foi deduzida (a leitura pode trocar)
  forn_auto?: boolean // o nome do fornecedor foi um palpite (a leitura completa pode trocar)
  texto_original?: string // orçamento que veio como mensagem: o texto como foi colado (aparece na ficha)
  enviado?: boolean // mandado por um morador (vai direto para a comparação)
  tipo?: TipoEnvio // orçamento (padrão), tabela de preços ou só o contato do fornecedor
  planta?: Planta // San Levi: planta de canto (finais 01, 02, 11, 12) ou de corredor (03 a 10)
  acabamento?: string // corrigido pela dona; se vazio, é deduzido do texto
  ap?: string // apê de quem mandou (só o número, para saber a planta; o nome não aparece)
}
export type Planta = 'canto' | 'corredor' | ''
export type TipoEnvio = 'orcamento' | 'tabela' | 'contato'
export const ehOrcamento = (o: Orcamento) => !o.tipo || o.tipo === 'orcamento'
/** San Levi: 12 apês por andar; finais 01, 02, 11 e 12 são a planta de canto, 03 a 10 a de corredor. */
export function plantaDoAp(ap: string | undefined | null): Planta {
  const d = String(ap ?? '').replace(/\D/g, '')
  if (d.length < 3) return ''
  const f = Number(d.slice(-2))
  if (!f || f > 12) return ''
  return [1, 2, 11, 12].includes(f) ? 'canto' : 'corredor'
}
/** Medidas que só aparecem numa das plantas (planta do pavimento tipo, em cm). Cozinha e banheiro são iguais nas duas. */
const MEDIDAS_PLANTA: Record<'canto' | 'corredor', number[]> = { canto: [435, 264, 221, 511, 699], corredor: [533, 314, 501, 346, 187, 847] }
/** Tenta descobrir a planta pelas medidas escritas no orçamento (ex.: "5,33 m", "533 cm"). Vazio se não der para saber. */
export function plantaPelaMedida(texto: string): Planta {
  const nums = new Set<number>()
  for (const m of String(texto).matchAll(/(\d{1,2})[,.](\d{2})(?!\d)|(?<![\d,.])(\d{3})(?![\d,.])/g)) nums.add(m[3] ? Number(m[3]) : Number(m[1]) * 100 + Number(m[2]))
  const conta = (l: number[]) => l.filter((n) => nums.has(n) || nums.has(n - 1) || nums.has(n + 1)).length
  const a = conta(MEDIDAS_PLANTA.canto), b = conta(MEDIDAS_PLANTA.corredor)
  return a > b ? 'canto' : b > a ? 'corredor' : ''
}
/** Planta do orçamento: a marcada por quem mandou ou pela dona; senão, a provável pelas medidas. */
export function plantaDe(o: Orcamento): { p: Planta; provavel: boolean } {
  if (o.planta) return { p: o.planta, provavel: false }
  const t = [o.servico, o.resumo, ...(o.itens || []).map((i) => i.descricao), ...o.inclui].join(' ')
  const p = plantaPelaMedida(t)
  return { p, provavel: !!p }
}
export const PLANTA_ROT: Record<string, string> = { canto: 'planta de canto', corredor: 'planta de corredor', '': 'planta não informada' }
/** Acabamento do orçamento (quartzo, granito, porcelanato…), para comparar igual com igual dentro de cada serviço. */
export function acabamentoDe(o: Orcamento): string {
  if (o.acabamento?.trim()) return o.acabamento.trim().toLowerCase()
  const t = [o.materiais?.[0], o.servico.split(' · ').slice(1).join(' '), o.servico].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const fam: [RegExp, string][] = [[/quartzo/, 'quartzo'], [/granito/, 'granito'], [/marmore/, 'mármore'], [/ultracompact|lamina|dekton|sinterizad/, 'ultracompacto'], [/porcelanato/, 'porcelanato'], [/ceramic/, 'cerâmica'], [/vinilic/, 'vinílico'], [/laminad/, 'laminado'], [/mdf/, 'MDF'], [/drywall|gesso/, 'gesso'], [/temperado/, 'vidro temperado']]
  return fam.find(([re]) => re.test(t))?.[1] || ''
}
export interface ItemOrc { descricao: string; qtd: number | null; unidade: string; valor: number | null }

export type Categoria = 'arquivos' | 'combos' | 'plataforma' | 'projeto'
export const CATEGORIAS: [Categoria, string, string, string][] = [
  ['arquivos', 'arquivos e planilhas', 'file', 'Cada arquivo resolve uma tarefa: baixa, usa e pronto. Para imprimir, usar no celular ou no computador.'],
  ['combos', 'kits', 'gift', 'Arquivos da mesma etapa juntos, com desconto já no preço.'],
  ['plataforma', 'plataforma do apê', 'phone', 'Um site para acompanhar a jornada inteira, com os seus dados, por 12 meses.'],
  ['projeto', 'projetos e reformas', 'ruler', 'Serviço feito sob orçamento, separado da loja.'],
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
  fase?: 'comprando' | 'comprei' | 'escolhas' // para quem ainda vai comprar o apê ou para quem já comprou
  arte?: string // desenho que representa o produto
  selo?: string // selo de destaque no cartão (ex.: "mais vendido")
  kitPct?: number // kits: % de desconto sobre a soma dos arquivos (o preço sai sozinho)
  frente?: Frente // vitrine onde aparece: vazio = planê.apê (a loja do apê)
  nicho?: string // dentro da vitrine: beleza, freelancer, arquitetura…
  sub?: string // dentro do nicho: sobrancelha e cílios, unhas, cabelo, estética, maquiagem e noivas… ('todos' = serve para todos)
  uso?: 'digital' | 'imprimir' | 'ambos' // para mandar, para imprimir ou os dois
  tipo?: string // divulgação, fichas, cuidados, atendimento, gestão, contratos, kits
}
/** As três frentes da planê. A loja do apê é a "apzinho"; arquivos e arq usam o mesmo checkout. */
export type Frente = 'apzinho' | 'arquivos' | 'arq'
export const frenteDe = (p: Pick<Produto, 'frente'>): Frente => p.frente || 'apzinho'

export interface Morador {
  id: string
  nome: string
  condominio?: string // 'San Levi' ou o nome que a pessoa digitou
  moraJunto?: boolean // confirmou que mora no mesmo apê de quem já tinha cadastro
  pessoas?: number | null // quantas pessoas vão morar (opcional)
  familia?: ({ tipo: string; nome?: string; papel?: string } | string)[] // quem vai morar, com símbolos e nomes
  aprovado?: boolean // San Levi: digitou o código do condomínio ou a Laís aprovou
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
  // preço por m² só faz sentido em serviço cobrado por área (piso, gesso, pintura...): vistoria de 40 m² não vira "R$ 7/m²"
  const area = /^(piso|revestimentos|gesso|impermeabilizacao|pintura|telas|vidros)/.test(String(q.nicho || '')) ? num(q.area_m2) : null
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
export const LOJA_VERSAO = 11
/** O que cada versão da loja muda nos produtos que a dona já salvou (o resto do que ela editou continua). */
export const MIGRA_LOJA: Record<number, { novos: string[]; troca: Record<string, (keyof Produto)[]> }> = {
  8: { novos: ['pedras', 'pisos', 'marcenaria', 'banheiro', 'cozinha', 'iluminacao', 'eletrica', 'tintas', 'gesso', 'ar', 'cortinas', 'seguranca', 'kit-escolhas'], troca: { plataforma: ['preco', 'unidade'], 'kit-completo': ['combo', 'kitPct', 'desc', 'amostras'] } },
  9: { novos: ['beleza-fim-de-ano', 'beleza-precos', 'beleza-anamnese', 'beleza-termo', 'beleza-vale', 'beleza-caixa', 'free-proposta', 'free-contrato', 'free-briefing', 'free-preco-hora', 'arq-proposta', 'arq-contrato', 'arq-briefing', 'arq-levantamento', 'arq-honorarios', 'arq-manual', 'kit-arq-primeiro'], troca: {} },
  10: { novos: ['kit-beleza'], troca: {} },
  11: { novos: CATALOGO_BELEZA.map((p) => p.id), troca: {} },
}
/** Juros ao mês do cartão parcelado (o painel muda). Parcela mínima: R$ 5. */
export const JUROS_PCT = 2.99
export const PARCELAS_MAX = 12
/** Parcelas do cartão: 1x sem juros; de 2x a 12x com juros compostos (tabela Price). Mesma conta no servidor. */
export function parcelas(total: number, jurosPct = JUROS_PCT): { n: number; parcela: number; total: number; juros: boolean }[] {
  const out = [{ n: 1, parcela: c2(total), total: c2(total), juros: false }]
  const i = jurosPct / 100
  for (let n = 2; n <= PARCELAS_MAX; n++) {
    const parcela = i > 0 ? c2((total * i) / (1 - Math.pow(1 + i, -n))) : c2(total / n)
    if (parcela < 5) break
    out.push({ n, parcela, total: c2(parcela * n), juros: i > 0 })
  }
  return out
}
/** Selos de destaque que dá para escolher no painel. */
export const SELOS = ['mais vendido', 'queridinho', 'mais procurado', 'melhor custo-benefício', 'novidade', 'essencial', 'últimas vagas']
/** Único desconto da loja além dos kits: Pix (a taxa do Pix é menor que a do cartão). Sem parcelamento. */
/** Quantos apês interessados para a dona levar a lista ao fornecedor e negociar (quando o fornecedor não disse o mínimo). */
export const GRUPO_META = 5
export const PIX_PCT = 5
/** Taxas do Asaas usadas para conferir a margem (confira no seu plano e ajuste no painel). */
export interface Taxas { pix: number; cartaoPct: number; cartaoFixo: number }
export const TAXAS: Taxas = { pix: 1.99, cartaoPct: 2.99, cartaoFixo: 0.49 }
/** Meses de plataforma que o kit completo dá de presente (no máximo 1). */
export const KIT_PLATAFORMA_MESES = 1
/** Bônus de todas as compras, liberado 7 dias depois do pagamento (não é vendido; não muda o direito de arrependimento). */
export const BONUS = { id: 'bonus', surpresa: 'bônus surpresa', pista: 'Um arquivo exclusivo, que não tem à venda, de presente uma semana depois da compra.', nome: 'Calendário de manutenção e garantias do 1º ano', desc: 'O que revisar em cada mês do primeiro ano na casa nova e até quando vale a garantia de cada item. Chega 7 dias depois da compra.', dias: 7 }
const arq = (p: Omit<Produto, 'cat' | 'ativo' | 'entrega'> & { ativo?: boolean }): Produto => ({ cat: 'arquivos', ativo: true, entrega: NA_HORA, fase: 'comprei', ...p })
const kit = (p: Omit<Produto, 'cat' | 'ativo' | 'entrega' | 'preco' | 'itens'> & { itens?: string[]; ativo?: boolean }): Produto => ({ cat: 'combos', ativo: true, entrega: NA_HORA, preco: '', itens: [], ...p })
export const PRODUTOS: Produto[] = [
  /* vai comprar */
  arq({ id: 'compra', selo: 'mais vendido', arte: 'contrato', fase: 'comprando', nome: 'Guia de compra do imóvel', tag: 'na planta ou pronto', destaque: true, preco: 'R$ 19,90', formato: 'PDF', amostras: [AM('m-compra.jpg')], numeros: ['8 páginas', 'na planta e pronto', '12 perguntas prontas'],
    desc: 'Do primeiro contato às chaves, para imóvel na planta ou pronto: as etapas, os custos que ninguém conta, o que perguntar e o que conferir antes de assinar.',
    itens: ['As etapas da compra na planta e do imóvel pronto, lado a lado', 'Custos além do preço: ITBI, cartório, juros de obra, correção, condomínio', '12 perguntas para fazer ao corretor ou ao vendedor', 'Documentos do imóvel e do vendedor para conferir no pronto', 'Prazo de entrega, correção das parcelas e distrato, no caso da planta'] }),
  arq({ id: 'financiamento', arte: 'calculo', fase: 'comprando', nome: 'Guia do financiamento e dos seguros', tag: 'novo', destaque: true, preco: 'R$ 16,90', formato: 'PDF', amostras: [AM('m-financiamento.jpg')], numeros: ['7 páginas', 'MCMV e outros', 'seguros explicados'],
    desc: 'Minha Casa Minha Vida, SBPE e consórcio sem complicação; quais seguros são obrigatórios, quais são opcionais e como não pagar por adicionais que você não pediu.',
    itens: ['Perfis de financiamento: MCMV, SBPE (poupança) e outros, com prós e cuidados', 'Seguros obrigatórios (morte e invalidez, danos ao imóvel) e o que é opcional', 'Como reconhecer venda casada e o que diz o Código de Defesa do Consumidor', 'Quando dá para cancelar um adicional e pedir o dinheiro de volta', 'Passo a passo para comparar propostas de bancos'] }),
  arq({ id: 'planilha-compra', arte: 'calculo', fase: 'comprando', nome: 'Planilha de custos da compra', tag: 'simulação', preco: 'R$ 19,90', formato: 'Excel · abre no Google Planilhas · 4 cores (azul, rosa, roxa e verde)', amostras: [AM('m-planilha-compra.jpg')], numeros: ['6 abas', 'Price e SAC', 'planta ou pronto', '4 cores'],
    desc: 'Quanto o imóvel custa de verdade, na planta ou pronto: entrada, parcelas corrigidas, financiamento, juros de obra, ITBI e cartório, tudo somado.',
    itens: ['Escolha: na planta ou pronto; MCMV, SBPE ou outro', 'Simulação do financiamento (Price e SAC), com seguros estimados', 'Parcelas com a construtora corrigidas mês a mês (na planta)', 'ITBI, cartório e tarifas do banco', 'Quanto da sua renda a parcela usa', 'Comparador de até 3 imóveis com preço por m²'] }),
  arq({ id: 'decorado', arte: 'decorado', fase: 'comprando', nome: 'Checklist da visita e documentos', tag: 'na visita', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-decorado.jpg')], numeros: ['6 páginas', 'comparar 3 opções', 'documentos'],
    desc: 'O que olhar na visita ao decorado ou ao imóvel pronto, como comparar opções e todos os documentos para o financiamento.',
    itens: ['O que observar no imóvel, no prédio e no bairro', 'O que é do decorado e não vem no apê', 'Pontos de atenção num imóvel pronto ou usado', 'Tabela para comparar 3 opções', 'Lista de documentos para o financiamento'] }),
  /* já comprou */
  arq({ id: 'checklist', selo: 'mais vendido', arte: 'vistoria', nome: 'Checklist de vistoria', tag: 'para a vistoria', destaque: true, preco: 'R$ 19,90', formato: 'PDF · imprimir ou usar no celular', amostras: [AM('m-checklist.jpg')], numeros: ['10 páginas', '+90 itens', '7 cômodos', 'resumo para a construtora'],
    desc: 'Tudo o que conferir na vistoria do imóvel novo, cômodo por cômodo, para a construtora ou o vendedor corrigir antes de você receber as chaves.',
    itens: ['O que levar e o que combinar antes', 'Itens para porta, sala, cozinha, área de serviço, banheiro, quartos e imóvel inteiro', 'Testes simples de vazamento, caimento de piso e tomadas', 'Tabela para anotar as medidas', 'O que fazer com os problemas depois', 'Resumo pronto para entregar à construtora'] }),
  arq({ id: 'planilha', selo: 'queridinho', arte: 'planilha', nome: 'Planilha de obra e compras', tag: 'organização', destaque: true, preco: 'R$ 24,90', formato: 'Excel · abre no Google Planilhas · 4 cores (azul, rosa, roxa e verde)', amostras: [AM('m-planilha.jpg')], numeros: ['6 abas', '27 itens prontos', 'contas automáticas', '4 cores'],
    desc: 'Quanto você planejou, quanto já gastou e quanto falta, por cômodo, com as parcelas mês a mês.',
    itens: ['Resumo automático por cômodo e no total', 'Lista de compras com itens típicos e valores de referência (troque pelos seus)', 'Comparador de orçamentos que mostra o mais barato', 'Parcelas dos próximos 12 meses somadas sozinhas', 'Cronograma da obra na ordem certa, da vistoria à mudança'] }),
  arq({ id: 'guia', arte: 'orcamento', nome: 'Guia de orçamentos', tag: 'antes de fechar', preco: 'R$ 14,90', formato: 'PDF', amostras: [AM('m-guia.jpg')], numeros: ['10 páginas', '12 serviços', '3 mensagens prontas'],
    desc: 'O que pedir em cada orçamento, as pegadinhas mais comuns e como comparar de verdade.',
    itens: ['Pisos e revestimentos, marcenaria, pedras, box, gesso, elétrica, hidráulica, serralheria, ar, pintura, telas e cortinas', 'O que precisa vir escrito em cada orçamento', 'A pegadinha mais comum de cada serviço', 'Tabela para comparar até 3 orçamentos', 'Mensagens prontas para pedir orçamento e desconto em grupo'] }),
  arq({ id: 'medidas', arte: 'medidas', nome: 'Guia de medidas', tag: 'antes de comprar móveis', preco: 'R$ 16,90', formato: 'PDF', amostras: [AM('m-medidas.jpg')], numeros: ['7 páginas', '+25 móveis', 'tabela "cabe?"'],
    desc: 'As medidas dos móveis e dos espaços de passagem para comprar o que cabe de verdade na sua casa ou apê.',
    itens: ['Passagens mínimas entre móveis, portas e gavetas', 'Sala e jantar: sofá, rack, mesa e distância da TV', 'Cozinha e área de serviço: bancada, geladeira, máquina', 'Quartos e banheiro: camas, guarda-roupa, box', 'O teste da fita crepe e a tabela "cabe aqui?"'] }),
  arq({ id: 'entregas', arte: 'entregas', nome: 'Checklist de entregas da obra', tag: 'antes de pagar', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-entregas.jpg')], numeros: ['6 páginas', '8 serviços', 'termo de recebimento'],
    desc: 'O que conferir quando cada fornecedor terminar, antes de pagar a última parcela.',
    itens: ['Marcenaria, pisos, pedras, box, gesso e pintura, elétrica, hidráulica e ar', 'Testes simples para fazer no dia da entrega', 'O que combinar antes de fechar', 'Termo de recebimento para assinar com o fornecedor'] }),
  arq({ id: 'enxoval', arte: 'enxoval', nome: 'Planilha do enxoval', tag: 'para morar', preco: 'R$ 14,90', formato: 'Excel · abre no Google Planilhas · 4 cores (azul, rosa, roxa e verde)', amostras: [AM('m-enxoval.jpg')], numeros: ['+50 itens', '3 prioridades', 'quanto falta', '4 cores'],
    desc: 'Tudo o que comprar para morar, com preço de referência, prioridade e quanto falta por cômodo.',
    itens: ['Lista pronta da cozinha, área de serviço, banheiro, quartos e sala', 'Prioridade: essencial, logo e pode esperar', 'Resumo automático por cômodo e por prioridade', 'Espaço para onde comprar e quanto pagou'] }),
  arq({ id: 'mudanca', arte: 'mudanca', nome: 'Lista da mudança', tag: 'para a mudança', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-mudanca.jpg')], numeros: ['6 páginas', 'semana a semana', 'caixa do 1º dia'],
    desc: 'A mudança semana a semana e o enxoval cômodo por cômodo, para nada ficar para trás.',
    itens: ['Passo a passo: 30 dias, 15 dias, 7 dias, o dia e depois', 'Enxoval da cozinha, área de serviço, banheiro, quartos e sala', 'Contas para ligar e endereço para trocar', 'A caixa do primeiro dia'] }),
  arq({ id: 'planner', arte: 'decoracao', nome: 'Planner de decoração', tag: 'decoração', preco: 'R$ 17,90', formato: 'PDF · imprimir ou usar no tablet', amostras: [AM('m-planner.jpg')], numeros: ['6 páginas', '4 paletas', 'moodboard'],
    desc: 'Do estilo à lista de compras: defina a cara da casa, escolha a paleta e compre na ordem certa.',
    itens: ['Teste rápido para descobrir o seu estilo', 'Paletas prontas para espaços pequenos e grandes', 'Moodboard para cada cômodo', 'Ideias para parecer maior, guardar mais e gastar menos', 'Lista de decoração na ordem de compra que economiza'] }),
  /* escolhas da obra: acabamentos, materiais e instalações */
  arq({ id: 'pedras', selo: 'mais procurado', arte: 'orcamento', fase: 'escolhas', nome: 'Guia das pedras para bancada', tag: 'antes da marmoraria', destaque: true, preco: 'R$ 16,90', formato: 'PDF', amostras: [AM('m-pedras.jpg')], numeros: ['8 páginas', '9 materiais', 'prós e contras'],
    desc: 'Granito, quartzo, mármore, ultracompacto, porcelanato e outros: como cada um aguenta calor, mancha e risco, quanto custa e onde vale usar.',
    itens: ['Comparativo rápido de 9 materiais (calor, mancha, risco e preço)', 'Prós, contras e faixa de preço de cada pedra', 'Teste de mancha para fazer na amostra', 'Saia, frontão, bordas e tipos de cuba explicados', 'O que pedir no orçamento da marmoraria'] }),
  arq({ id: 'pisos', arte: 'medidas', fase: 'escolhas', nome: 'Guia de pisos e revestimentos', tag: 'antes de escolher o piso', preco: 'R$ 16,90', formato: 'PDF', amostras: [AM('m-pisos.jpg')], numeros: ['7 páginas', '8 tipos de piso', 'qual piso em cada cômodo'],
    desc: 'Porcelanato, cerâmica, vinílico, laminado, madeira e cimento: prós e contras, qual vai em cada cômodo e quanto comprar sem faltar nem sobrar.',
    itens: ['Comparativo de conforto, água, durabilidade e preço', 'Qual piso usar (e evitar) em cada cômodo', 'Vinílico colado x click, porcelanato polido x acetinado', 'Cálculo da quantidade com a sobra certa e rejunte', 'Regras de barulho do prédio (manta acústica)'] }),
  arq({ id: 'marcenaria', selo: 'essencial', arte: 'planilha', fase: 'escolhas', nome: 'Guia da marcenaria planejada', tag: 'antes do projeto', destaque: true, preco: 'R$ 16,90', formato: 'PDF', amostras: [AM('m-marcenaria.jpg')], numeros: ['8 páginas', 'MDF, BP e laca', 'checklist do projeto'],
    desc: 'MDF ou MDP, BP ou laca, corrediça comum ou oculta: o que significa, onde vale gastar e como conferir o projeto antes de fechar.',
    itens: ['Planejado de loja, modulado ou marceneiro: prós e contras', 'Materiais e espessuras (MDF, MDP, RU, compensado)', 'Acabamentos: BP, laca, lâmina, alto brilho', 'Ferragens que valem a pena e medidas de referência', 'Checklist do projeto e do orçamento'] }),
  arq({ id: 'banheiro', arte: 'entregas', fase: 'escolhas', nome: 'Guia de louças, metais e box', tag: 'para o banheiro', preco: 'R$ 14,90', formato: 'PDF', amostras: [AM('m-banheiro.jpg')], numeros: ['6 páginas', 'cuba + torneira certas', 'box de vidro'],
    desc: 'Vaso, cuba, torneira, chuveiro e box: os tipos, o que combina com o quê, os erros de altura e de compatibilidade mais comuns e quanto custa.',
    itens: ['Vaso com caixa acoplada x caixa embutida', 'Qual torneira combina com cada tipo de cuba', 'Chuveiro elétrico, a gás ou central', 'Modelos de box de vidro temperado e cuidados', 'Detalhes que fazem diferença e erros comuns'] }),
  arq({ id: 'cozinha', arte: 'medidas', fase: 'escolhas', nome: 'Guia da cozinha e dos eletros', tag: 'para a cozinha', preco: 'R$ 14,90', formato: 'PDF', amostras: [AM('m-cozinha.jpg')], numeros: ['7 páginas', 'gás ou indução', 'medidas dos eletros'],
    desc: 'Cooktop a gás ou indução, coifa ou depurador, forno, geladeira, lava-louças e cuba: o que escolher e o que a cozinha precisa ter de instalação.',
    itens: ['Cooktop a gás, indução ou elétrico: prós e contras', 'Coifa x depurador, forno de embutir e air fryer', 'Medidas e folgas de geladeira, lava-louças e máquina', 'Tipos de cuba e torneira', 'Tomadas da cozinha: onde, altura e 10 ou 20 A'] }),
  arq({ id: 'iluminacao', arte: 'decoracao', fase: 'escolhas', nome: 'Guia de iluminação', tag: 'para cada cômodo', preco: 'R$ 14,90', formato: 'PDF', amostras: [AM('m-iluminacao.jpg')], numeros: ['6 páginas', 'luz quente ou fria', 'trilho sem gesso'],
    desc: 'Luz amarela ou branca, quantas lâmpadas, spot, trilho ou fita de LED: cada cômodo bem iluminado e aconchegante, sem gesso em tudo.',
    itens: ['Temperatura de cor certa para cada cômodo', 'Quanta luz cada cômodo precisa (lúmens por m²)', 'Trilho, spot, plafon, pendente e fita de LED', 'Plano de luz cômodo por cômodo', 'Interruptor paralelo, dimmer e lâmpadas inteligentes'] }),
  arq({ id: 'eletrica', arte: 'calculo', fase: 'escolhas', nome: 'Guia de tomadas e elétrica', tag: 'antes de morar', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-eletrica.jpg')], numeros: ['5 páginas', 'tomadas por cômodo', '10 ou 20 A'],
    desc: 'Quantas tomadas pôr em cada cômodo, em que altura, quando usar 10 ou 20 A e como saber se o quadro aguenta ar-condicionado e indução.',
    itens: ['Tomadas por cômodo: o mínimo e o confortável', 'Alturas de referência de cada ponto', '10 A, 20 A e o que precisa de circuito próprio', 'Como conferir se o quadro aguenta', 'Internet, TV e extras que valem a pena'] }),
  arq({ id: 'tintas', arte: 'decoracao', fase: 'escolhas', nome: 'Guia de tintas e paredes', tag: 'antes de pintar', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-tintas.jpg')], numeros: ['6 páginas', 'cálculo de latas', 'cores que ampliam'],
    desc: 'Qual tinta e acabamento usar em cada parede, quantas latas comprar, cores que ampliam o apê e alternativas como papel de parede e ripado.',
    itens: ['Tipos de tinta e onde usar cada um', 'Fosco, acetinado ou semibrilho', 'Cálculo de latas com exemplo', 'Cores e truques para o apê parecer maior', 'Preparação da parede, papel de parede e ripado'] }),
  arq({ id: 'gesso', arte: 'projeto3d', fase: 'escolhas', nome: 'Guia de gesso, forro e sancas', tag: 'antes da pintura', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-gesso.jpg')], numeros: ['5 páginas', 'sanca e cortineiro', 'ordem da obra'],
    desc: 'Forro, sanca aberta ou fechada, cortineiro, tabica e drywall: o que cada um resolve, quanto do pé-direito você perde e como pedir o orçamento.',
    itens: ['Forro de drywall, de placas e de PVC', 'Sancas, cortineiro, tabica e negativo, com medidas', 'Paredes de drywall e reforços para TV e armários', 'Ordem certa da obra', 'O que pedir no orçamento do gesseiro'] }),
  arq({ id: 'ar', arte: 'calculo', fase: 'escolhas', nome: 'Guia do ar-condicionado', tag: 'antes de comprar o ar', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-ar.jpg')], numeros: ['6 páginas', 'cálculo de BTUs', 'inverter x comum'],
    desc: 'Quantos BTUs para cada cômodo, inverter ou convencional, split ou multi-split, o que o prédio precisa ter e como não perder a garantia.',
    itens: ['Tabela de BTUs por cômodo, com e sem sol', 'Inverter x convencional: quando compensa', 'Split, multi-split, janela e portátil', 'Infraestrutura e regras do condomínio', 'Uso econômico e manutenção'] }),
  arq({ id: 'cortinas', arte: 'decoracao', fase: 'escolhas', nome: 'Guia de cortinas e persianas', tag: 'para as janelas', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-cortinas.jpg')], numeros: ['6 páginas', 'blackout e tela solar', 'como medir'],
    desc: 'Tecido ou persiana, blackout ou tela solar, trilho ou varão: o que usar em cada cômodo e como medir certo para não errar no orçamento.',
    itens: ['Blackout, dimout, tela solar e voil', 'Cortina de tecido, rolô, double vision e romana', 'Como medir dentro e fora do vão', 'Trilho, varão ou cortineiro', 'Sugestões cômodo por cômodo'] }),
  arq({ id: 'seguranca', arte: 'vistoria', fase: 'escolhas', nome: 'Guia de segurança e proteção do apê', tag: 'para morar tranquilo', preco: 'R$ 12,90', formato: 'PDF', amostras: [AM('m-seguranca.jpg')], numeros: ['6 páginas', 'telas e fechaduras', 'seguro residencial'],
    desc: 'Telas de proteção, fechadura digital, sensores de vazamento, cuidados com gás e elétrica, crianças e pets, e o seguro residencial que vale a pena.',
    itens: ['Telas de proteção: o que exigir da empresa', 'Fechadura digital e campainha com vídeo', 'Prevenção de vazamento, gás, incêndio e choque', 'Cuidados com crianças e pets', 'Seguro residencial: coberturas que importam'] }),
  /* kits: o preço sai sozinho da soma dos arquivos menos o desconto do kit */
  kit({ id: 'kit-compra', nome: 'Kit vou comprar', tag: 'kit', arte: 'contrato', kitPct: 35, combo: ['compra', 'financiamento', 'planilha-compra', 'decorado'], amostras: [AM('m-kit-compra.jpg'), AM('m-compra.jpg'), AM('m-financiamento.jpg'), AM('m-planilha-compra.jpg')],
    desc: 'Para quem ainda vai comprar, na planta ou pronto: guia de compra, guia do financiamento e dos seguros, planilha de custos e checklist da visita.' }),
  kit({ id: 'kit-chaves', selo: 'mais procurado', nome: 'Kit chaves na mão', tag: 'kit', arte: 'vistoria', kitPct: 23, combo: ['checklist', 'entregas', 'mudanca'], amostras: [AM('m-kit-chaves.jpg'), AM('m-checklist.jpg'), AM('m-entregas.jpg'), AM('m-mudanca.jpg')],
    desc: 'Da vistoria à mudança: o checklist da vistoria, o de entregas da obra e a lista da mudança.' }),
  kit({ id: 'kit-obra', nome: 'Kit obra sem susto', tag: 'kit', arte: 'planilha', kitPct: 29, combo: ['planilha', 'guia', 'medidas'], amostras: [AM('m-kit-obra.jpg'), AM('m-planilha.jpg'), AM('m-guia.jpg'), AM('m-medidas.jpg')],
    desc: 'Para planejar, comparar orçamentos e comprar o que cabe: planilha de obra, guia de orçamentos e guia de medidas.' }),
  kit({ id: 'kit-escolhas', selo: 'novidade', nome: 'Kit escolhas da obra', tag: 'kit', arte: 'orcamento', kitPct: 45, combo: ['pedras', 'pisos', 'marcenaria', 'banheiro', 'cozinha', 'iluminacao', 'eletrica', 'tintas', 'gesso', 'ar', 'cortinas', 'seguranca'], amostras: [AM('m-kit-escolhas.jpg'), AM('m-pedras.jpg'), AM('m-pisos.jpg'), AM('m-marcenaria.jpg'), AM('m-cozinha.jpg')],
    desc: 'Os 12 guias de acabamentos e instalações: pedras, pisos, marcenaria, banheiro, cozinha, iluminação, tomadas, tintas, gesso, ar, cortinas e segurança.' }),
  kit({ id: 'kit-completo', selo: 'melhor custo-benefício', nome: 'Kit completo', tag: 'mais completo', arte: 'casa', destaque: true, kitPct: 63, combo: ['compra', 'financiamento', 'planilha-compra', 'decorado', 'checklist', 'planilha', 'guia', 'medidas', 'entregas', 'enxoval', 'mudanca', 'planner', 'pedras', 'pisos', 'marcenaria', 'banheiro', 'cozinha', 'iluminacao', 'eletrica', 'tintas', 'gesso', 'ar', 'cortinas', 'seguranca'], amostras: [AM('m-kit-completo.jpg'), AM('m-compra.jpg'), AM('m-checklist.jpg'), AM('m-pedras.jpg'), AM('m-planilha.jpg'), AM('m-planner.jpg')],
    desc: 'Os 24 arquivos da loja, da compra à decoração, com todos os guias de acabamentos e o maior desconto.', itens: [`+ ${KIT_PLATAFORMA_MESES} mês de plataforma do apê de presente`] }),
  { id: 'plataforma', selo: 'novidade', cat: 'plataforma', nome: 'Plataforma do apê', tag: 'acesso por 1 ano', destaque: true, preco: 'R$ 89,90', unidade: '12 meses de acesso', formato: 'site: abre no celular e no computador, sem instalar nada', entrega: 'Pagou, o link de acesso aparece na página do pedido na hora.', amostras: [AM('m-plataforma.jpg')], arte: 'celular',
    desc: 'Um site para acompanhar a sua jornada do começo ao fim: gastos, parcelas, etapas da obra, vistoria com fotos e contatos, atualizados por você, num lugar só.',
    itens: ['Gastos por cômodo: quanto planejou, quanto já foi e quanto falta', 'Parcelas dos próximos meses, somadas sozinhas', 'Etapas da compra e da obra, com datas e o que já foi feito', 'Vistoria com fotos e resumo para imprimir', 'Contatos dos fornecedores com WhatsApp a um toque', 'Abre no celular e no computador, sem instalar nada', 'Pagamento único: 12 meses de acesso, sem mensalidade'], ativo: true },

  /* ===== planê.arquivos (vitrine /arquivos) e planê.arq (vitrine /arq): o produto que ainda não tem arquivo fica "em breve" (ativo: false) ===== */
  arq({ id: 'beleza-fim-de-ano', sub: 'todos', uso: 'digital', tipo: 'divulgação', frente: 'arquivos', nicho: 'beleza', selo: 'novidade', arte: 'calendario', fase: undefined, nome: 'Kit avisos de fim de ano', tag: 'para a sua cliente', destaque: true, preco: 'R$ 19,90', formato: 'PowerPoint (abre no Canva e no Google Slides) + Word e PDF', amostras: [AM('m2-beleza-fim-de-ano.webp'), AM('p-beleza-fim-de-ano-2.webp'), AM('p-beleza-fim-de-ano-3.webp')], numeros: ['6 artes', 'stories e feed', '7 mensagens prontas'],
    desc: 'Avisos prontos para mandar às clientes: agenda de fim de ano, últimos horários, recesso e data de volta, com as mensagens para o WhatsApp.',
    itens: ['6 artes editáveis para stories e para o feed: agenda aberta, últimos horários, horários especiais, recesso, volta e boas festas', '7 mensagens prontas para o WhatsApp, inclusive aviso de reajuste', 'Passo a passo para editar no Canva e postar no dia certo'] }),
  arq({ id: 'beleza-precos', sub: 'todos', uso: 'ambos', tipo: 'divulgação', frente: 'arquivos', nicho: 'beleza', arte: 'orcamento', fase: undefined, nome: 'Tabela de preços editável', tag: 'editável', preco: 'R$ 14,90', formato: 'PowerPoint (abre no Canva e no Google Slides) + PDF', amostras: [AM('m2-beleza-precos.webp'), AM('p-beleza-precos-1.webp')], numeros: ['feed e stories', 'PDF para o balcão'],
    desc: 'Tabela de serviços e valores para o feed, os stories e o WhatsApp. Troque os serviços, os preços e as cores no Canva.',
    itens: ['Versão para o feed (1080 x 1350)', 'Versão para os stories (1080 x 1920)', 'PDF para imprimir e deixar no balcão', 'Três grupos de serviços, fáceis de trocar'] }),
  arq({ id: 'beleza-anamnese', sub: 'todos', uso: 'imprimir', tipo: 'fichas', frente: 'arquivos', nicho: 'beleza', selo: 'essencial', arte: 'vistoria', fase: undefined, nome: 'Fichas de anamnese', tag: 'atendimento', preco: 'R$ 19,90', formato: 'Word (abre no Google Docs) + PDF para imprimir', amostras: [AM('m2-beleza-anamnese.webp'), AM('p-beleza-anamnese-2.webp'), AM('p-beleza-anamnese-3.webp')], numeros: ['3 fichas', 'saúde sim/não', 'registro de atendimentos'],
    desc: 'Fichas de anamnese para sobrancelha e cílios, unhas e estética: preencher no celular ou imprimir.',
    itens: ['Ficha de sobrancelha e cílios', 'Ficha de unhas', 'Ficha de estética facial e corporal', 'Perguntas de saúde com sim e não', 'Autorização de fotos e tabela para registrar cada atendimento'] }),
  arq({ id: 'beleza-termo', sub: 'todos', uso: 'ambos', tipo: 'fichas', frente: 'arquivos', nicho: 'beleza', arte: 'contrato', fase: undefined, nome: 'Termo de consentimento e uso de imagem', tag: 'segurança', preco: 'R$ 12,90', formato: 'Word (abre no Google Docs) + PDF', amostras: [AM('m2-beleza-termo.webp'), AM('p-beleza-termo-2.webp'), AM('p-beleza-termo-3.webp')], numeros: ['consentimento', 'uso de imagem', 'LGPD'],
    desc: 'Termo de consentimento do procedimento e autorização para postar fotos do resultado.',
    itens: ['Termo de consentimento para procedimento estético', 'Autorização de uso de imagem com opções (com ou sem rosto)', 'Texto de proteção de dados (LGPD)'] }),
  arq({ id: 'beleza-vale', sub: 'todos', uso: 'imprimir', tipo: 'atendimento', frente: 'arquivos', nicho: 'beleza', arte: 'presente', fase: undefined, nome: 'Vale-presente e cartão fidelidade', tag: 'editável', preco: 'R$ 12,90', formato: 'PowerPoint (abre no Canva) + PDF para imprimir', amostras: [AM('m2-beleza-vale.webp'), AM('p-beleza-vale-1.webp'), AM('p-beleza-vale-4.webp')], numeros: ['frente e verso', '8 por folha A4'],
    desc: 'Vale-presente para as datas comemorativas e cartão fidelidade com 10 selos, prontos para imprimir.',
    itens: ['Vale-presente (frente e verso)', 'Cartão fidelidade com 10 selos (frente e verso)', 'Tamanho de cartão de visita (85 x 55 mm)', 'PDF com 8 cartões por folha'] }),
  arq({ id: 'beleza-caixa', sub: 'todos', uso: 'digital', tipo: 'gestão', amostras: [AM('m2-beleza-caixa.webp')], frente: 'arquivos', nicho: 'beleza', arte: 'planilha', fase: undefined, nome: 'Planilha de agenda e caixa', tag: 'organização', preco: 'R$ 17,90', formato: 'Excel · abre no Google Planilhas', numeros: ['agenda do mês', 'entradas e saídas', 'contas automáticas'],
    desc: 'Agenda do mês, quanto entrou, quanto saiu e quanto sobrou, com as contas automáticas.',
    itens: ['Lista de serviços e preços que preenche a agenda sozinha', 'Agenda com forma de pagamento e "já pagou?"', 'Saídas por categoria', 'Resumo: entrou, a receber, saiu, sobrou e ticket médio'] }),
  kit({ id: 'kit-beleza', sub: 'todos', uso: 'ambos', tipo: 'kits', frente: 'arquivos', nicho: 'beleza', selo: 'melhor custo-benefício', amostras: [AM('m2-kit-beleza.webp')], nome: 'Kit atendimento completo', tag: 'kit', arte: 'presente', kitPct: 30, combo: ['beleza-anamnese', 'beleza-termo', 'beleza-precos', 'beleza-vale'],
    desc: 'Fichas de anamnese, termo de consentimento, tabela de preços e vale-presente com fidelidade, com desconto.' }),
  arq({ id: 'free-proposta', sub: 'freelancer', uso: 'digital', tipo: 'contratos', frente: 'arquivos', nicho: 'freelancer', arte: 'orcamento', fase: undefined, nome: 'Modelo de proposta', tag: 'freelancer', preco: 'R$ 19,90', formato: 'Word (abre no Google Docs) + PDF', amostras: [AM('m2-free-proposta.webp'), AM('p-free-proposta-2.webp'), AM('p-free-proposta-3.webp')], numeros: ['escopo', 'prazo', 'forma de pagamento'],
    desc: 'Proposta de serviço clara e bonita: o que entra, o que não entra, prazo, valor e forma de pagamento.',
    itens: ['O que está e o que não está incluído', 'Etapas e prazos', 'Investimento e forma de pagamento', 'Próximos passos e aceite'] }),
  arq({ id: 'free-contrato', sub: 'freelancer', uso: 'ambos', tipo: 'contratos', frente: 'arquivos', nicho: 'freelancer', arte: 'contrato', fase: undefined, nome: 'Modelo de contrato de prestação de serviço', tag: 'freelancer', preco: 'R$ 24,90', formato: 'Word (abre no Google Docs) + PDF', amostras: [AM('m2-free-contrato.webp'), AM('p-free-contrato-2.webp'), AM('p-free-contrato-3.webp')], numeros: ['12 cláusulas', 'revisões e prazos', 'direitos de uso'],
    desc: 'Contrato com as cláusulas que mais evitam problema: revisões, prazos, pagamento, atraso, direitos de uso e cancelamento.',
    itens: ['Objeto, escopo e o que não está incluído', 'Prazos, pagamento e multa por atraso', 'Rodadas de revisão', 'Direitos de uso e portfólio', 'Cancelamento, LGPD e foro'] }),
  arq({ id: 'free-briefing', sub: 'freelancer', uso: 'digital', tipo: 'fichas', frente: 'arquivos', nicho: 'freelancer', arte: 'decorado', fase: undefined, nome: 'Briefing para o cliente preencher', tag: 'freelancer', preco: 'R$ 12,90', formato: 'Word (abre no Google Docs) + PDF', amostras: [AM('m2-free-briefing.webp'), AM('p-free-briefing-2.webp'), AM('p-free-briefing-3.webp')], numeros: ['6 seções', 'perguntas prontas'],
    desc: 'As perguntas certas antes de começar, para o cliente responder sozinho.',
    itens: ['Negócio e público', 'Objetivo do projeto', 'Gosto, referências e o que não quer', 'Prazos, investimento e materiais'] }),
  arq({ id: 'free-preco-hora', sub: 'freelancer', uso: 'digital', tipo: 'gestão', amostras: [AM('m2-free-preco-hora.webp')], frente: 'arquivos', nicho: 'freelancer', arte: 'calculo', fase: undefined, nome: 'Calculadora de preço por hora', tag: 'freelancer', preco: 'R$ 16,90', formato: 'Excel · abre no Google Planilhas', numeros: ['custos do mês', 'preço mínimo', 'preço do projeto'],
    desc: 'Quanto cobrar por hora e por projeto a partir dos seus custos e de quanto quer ganhar.',
    itens: ['Custos do mês, impostos e reserva', 'Horas realmente pagas', 'Preço mínimo por hora', 'Preço de um projeto por etapa, com margem'] }),

  arq({ id: 'arq-proposta', sub: 'arquitetura', uso: 'digital', tipo: 'contratos', frente: 'arq', nicho: 'arquitetura', arte: 'orcamento', fase: undefined, nome: 'Proposta de projeto de interiores', tag: 'modelo', preco: 'R$ 24,90', formato: 'Word (abre no Google Docs) + PDF', amostras: [AM('m2-arq-proposta.webp'), AM('p-arq-proposta-2.webp'), AM('p-arq-proposta-3.webp')], numeros: ['5 etapas', 'o que não está incluído', 'honorários'],
    desc: 'Proposta com ambientes, etapas, entregas, prazos, honorários e forma de pagamento, pronta para personalizar.',
    itens: ['Ambientes e áreas', 'Etapas, entregas e prazos', 'O que não está incluído', 'Honorários, acompanhamento opcional e forma de pagamento', 'Próximos passos e aceite'] }),
  arq({ id: 'arq-contrato', sub: 'arquitetura', uso: 'ambos', tipo: 'contratos', frente: 'arq', nicho: 'arquitetura', arte: 'contrato', fase: undefined, nome: 'Contrato de projeto de interiores', tag: 'modelo', preco: 'R$ 29,90', formato: 'Word (abre no Google Docs) + PDF', amostras: [AM('m2-arq-contrato.webp'), AM('p-arq-contrato-2.webp'), AM('p-arq-contrato-3.webp')], numeros: ['14 cláusulas', 'revisões e visitas', 'direitos autorais'],
    desc: 'Contrato com etapas, revisões, visitas, acompanhamento de obra, RRT e direitos autorais. Revise com um advogado antes de usar.',
    itens: ['Etapas e aprovações por escrito', 'Honorários e atraso', 'Revisões, visitas e acompanhamento de obra', 'Responsabilidade técnica e direitos autorais', 'Rescisão, LGPD e foro'] }),
  arq({ id: 'arq-briefing', sub: 'arquitetura', uso: 'ambos', tipo: 'fichas', frente: 'arq', nicho: 'arquitetura', arte: 'decorado', fase: undefined, nome: 'Briefing residencial', tag: 'modelo', preco: 'R$ 14,90', formato: 'Word (abre no Google Docs) + PDF', amostras: [AM('m2-arq-briefing.webp'), AM('p-arq-briefing-2.webp'), AM('p-arq-briefing-3.webp')], numeros: ['família e rotina', 'cômodo por cômodo'],
    desc: 'Rotina, gostos e necessidades da família, cômodo por cômodo, para o cliente preencher.',
    itens: ['O imóvel e quem mora', 'Gosto e referências', 'Perguntas de cada cômodo', 'Obra, orçamento e prioridades'] }),
  arq({ id: 'arq-levantamento', sub: 'arquitetura', uso: 'imprimir', tipo: 'fichas', frente: 'arq', nicho: 'arquitetura', arte: 'medidas', fase: undefined, nome: 'Checklist de levantamento', tag: 'na visita', preco: 'R$ 12,90', formato: 'PDF para imprimir ou usar no tablet + Word', amostras: [AM('m2-arq-levantamento.webp'), AM('p-arq-levantamento-1.webp'), AM('p-arq-levantamento-2.webp')], numeros: ['+40 itens', 'elétrica e hidráulica', 'fotos'],
    desc: 'O que medir, fotografar e perguntar na primeira visita, para não precisar voltar.',
    itens: ['O que levar', 'Medidas, elétrica, hidráulica e gás', 'Acabamentos e problemas existentes', 'Lista de fotos e regras do condomínio', 'Tabela de anotações por ambiente'] }),
  arq({ id: 'arq-honorarios', sub: 'arquitetura', uso: 'digital', tipo: 'gestão', amostras: [AM('m2-arq-honorarios.webp')], frente: 'arq', nicho: 'arquitetura', arte: 'calculo', fase: undefined, nome: 'Calculadora de honorários', tag: 'planilha', preco: 'R$ 19,90', formato: 'Excel · abre no Google Planilhas', numeros: ['por m²', 'por hora', '% da obra'],
    desc: 'Compare o valor do projeto por m², por hora e por porcentagem da obra, com os seus custos.',
    itens: ['Valor da sua hora a partir dos custos', 'Por m², com valor por tipo de ambiente', 'Por hora, etapa por etapa', 'Comparação dos três métodos e valor sugerido'] }),
  arq({ id: 'arq-manual', sub: 'arquitetura', uso: 'digital', tipo: 'atendimento', frente: 'arq', nicho: 'arquitetura', arte: 'casa', fase: undefined, nome: 'Manual do cliente', tag: 'editável', preco: 'R$ 19,90', formato: 'PowerPoint (abre no Canva) + PDF', amostras: [AM('m2-arq-manual.webp'), AM('p-arq-manual-2.webp'), AM('p-arq-manual-3.webp')], numeros: ['8 páginas', 'etapas', 'combinados'],
    desc: 'Para mandar ao cliente no começo: como funciona cada etapa, a obra, os combinados e o contato.',
    itens: ['Boas-vindas', 'O que acontece em cada etapa', 'Durante a obra', 'Como a gente conversa', 'Editável com a sua marca'] }),
  kit({ id: 'kit-arq-primeiro', sub: 'arquitetura', uso: 'ambos', tipo: 'kits', frente: 'arq', nicho: 'arquitetura', selo: 'melhor custo-benefício', nome: 'Kit primeiro cliente', tag: 'kit', arte: 'contrato', kitPct: 30, combo: ['arq-proposta', 'arq-contrato', 'arq-briefing', 'arq-manual'], amostras: [AM('m2-kit-arq-primeiro.webp')],
    desc: 'Proposta, contrato, briefing e manual do cliente, com desconto.' }),
  ...CATALOGO_BELEZA,
]

/** Pode ir para o carrinho (arquivos, kits e a plataforma). */
export const noCarrinho = (p: Produto) => (p.cat || 'arquivos') === 'arquivos' || p.cat === 'combos' || p.cat === 'plataforma'
export const reais = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const c2 = (n: number) => Math.round(n * 100) / 100
export const fmtPreco = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')
/** Preço do kit: soma dos arquivos menos o desconto do kit, arredondado PARA BAIXO até terminar em ,90. */
export function precoKit(soma: number, pct: number) {
  const bruto = soma * (1 - pct / 100)
  const v = Math.floor(bruto - 0.9 + 1e-9) + 0.9
  return c2(Math.max(0.9, v))
}
/** Preenche o preço dos kits a partir dos arquivos (sempre a mesma conta no site, no painel e no servidor). */
export function comPrecos(produtos: Produto[]): Produto[] {
  const preco = new Map(produtos.filter((p) => (p.cat || 'arquivos') === 'arquivos').map((p) => [p.id, reais(p.preco)]))
  return produtos.map((p) => {
    if (p.cat !== 'combos' || !p.kitPct) return p
    const soma = (p.combo || []).reduce((t, id) => t + (preco.get(id) || 0), 0)
    return { ...p, preco: fmtPreco(precoKit(soma, p.kitPct)) }
  })
}
/** Quanto sobra de uma venda depois da taxa do Asaas. */
export function liquido(total: number, forma: 'pix' | 'cartao', t: Taxas = TAXAS) {
  return c2(forma === 'pix' ? total - t.pix : total - total * t.cartaoPct / 100 - t.cartaoFixo)
}
/** A mesma conta da função de pagamento: kit tem preço fixo (já com desconto), arquivo avulso paga o preço da etiqueta,
 *  e o Pix ganha PIX_PCT% sobre o total. Um arquivo que já está num kit do carrinho sai, para não pagar duas vezes. */
/** Cupom de desconto (painel → produtos e preços). Vale para as frentes listadas (vazio = todas) até a data. */
export interface Cupom { codigo: string; pct: number; ate?: string; frentes?: Frente[]; ativo?: boolean }
/** Cupom de lançamento das vitrines novas (o painel troca ou desliga). */
export const CUPONS_PADRAO: Cupom[] = [{ codigo: 'LANCAMENTO', pct: 15, ate: '2026-12-31', frentes: ['arquivos', 'arq'], ativo: true }]
export const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
/** Acha um cupom válido (ativo, dentro da data). A mesma regra roda no servidor. */
export function acharCupom(cupons: Cupom[] | undefined, codigo: string, hoje = hojeISO()): Cupom | null {
  const c = (cupons || []).find((x) => x.ativo !== false && x.codigo.trim().toUpperCase() === codigo.trim().toUpperCase())
  if (!c || !(c.pct > 0) || c.pct > 50) return null
  return c.ate && hoje > c.ate ? null : c
}
/** Cupom válido hoje para uma frente (para mostrar o aviso na vitrine). */
export const cupomDaFrente = (cupons: Cupom[] | undefined, f: Frente) => (cupons || []).find((c) => acharCupom(cupons, c.codigo) && (!c.frentes?.length || c.frentes.includes(f))) || null

export function conta(ids: string[], produtos: Produto[], forma: 'pix' | 'cartao' = 'pix', pixPct = PIX_PCT, cupom: Cupom | null = null) {
  const map = new Map(produtos.filter((p) => p.ativo && noCarrinho(p)).map((p) => [p.id, p]))
  let uniq = [...new Set(ids)].filter((id) => map.has(id))
  const dentro = new Set(uniq.flatMap((id) => (map.get(id)!.cat === 'combos' ? map.get(id)!.combo || [] : [])))
  const repetidos = uniq.filter((id) => (map.get(id)!.cat || 'arquivos') === 'arquivos' && dentro.has(id))
  uniq = uniq.filter((id) => !repetidos.includes(id))
  const itens = uniq.map((id) => map.get(id)!)
  const subtotal = c2(itens.reduce((t, p) => t + reais(p.preco), 0))
  // cupom: só nos itens das frentes dele; o desconto do Pix vem depois, sobre o que sobrou
  const elegiveis = cupom ? itens.filter((p) => !cupom.frentes?.length || cupom.frentes.includes(frenteDe(p))) : []
  const cupomDesc = cupom ? c2(elegiveis.reduce((t, p) => t + reais(p.preco), 0) * cupom.pct / 100) : 0
  const base = c2(subtotal - cupomDesc)
  const pixDesconto = c2(base * pixPct / 100)
  const totalPix = c2(base - pixDesconto)
  const desconto = forma === 'pix' ? pixDesconto : 0
  // quanto os kits do carrinho economizam em relação aos arquivos separados (só para mostrar)
  const preco = new Map(produtos.map((p) => [p.id, reais(p.preco)]))
  const economiaKits = c2(itens.filter((p) => p.cat === 'combos').reduce((t, p) => t + (p.combo || []).reduce((s, id) => s + (preco.get(id) || 0), 0) - reais(p.preco), 0))
  return { itens, subtotal, cupomDesc, base, desconto, pixDesconto, totalPix, total: c2(base - desconto), repetidos, economiaKits, pixPct }
}

export const CTA_COPY: Record<string, [string, string, string]> = {
  checklist: ['Vistoria em dezembro', 'Não deixe passar nenhum defeito na vistoria', 'Uma lista cômodo por cômodo para conferir piso, paredes, esquadrias, louças e elétrica antes de receber as chaves.'],
  guia: ['Antes de fechar', 'O que precisa vir escrito em cada orçamento', 'As pegadinhas de cada serviço e uma tabela para comparar de verdade.'],
  entregas: ['Antes de pagar', 'Confira a entrega de cada fornecedor', 'Testes simples para fazer no dia e um termo de recebimento pronto.'],
  medidas: ['Antes de comprar', 'Compre só o que cabe', 'Medidas de móveis e passagens para a sua casa ou apê.'],
  planilha: ['Organização', 'Saiba quanto já gastou e quanto falta', 'Uma planilha pronta para controlar compras, parcelas e orçamentos do apê.'],
  plataforma: ['Plataforma do apê', 'Tudo do seu apê num lugar só', `Compras, obra, vistoria e contatos, no celular, como usamos no ${APE.doApe}.`],
  'kit-completo': ['Kit', 'Da compra à decoração, sem susto', 'Todos os arquivos da loja com o maior desconto: guias, checklists, planilhas, guias de acabamentos e planner.'],
}

const base = (o: Partial<Orcamento>): Orcamento => ({
  id: newId(), criado: new Date().toISOString(), nicho: 'outros', fornecedor: '', servico: '', resumo: '', contato: '', whatsapp: '', instagram: '',
  valor_total: null, valor_avista: null, desconto_avista_pct: null, parcelas_max: null, valor_parcela: null, juros: null,
  grupo_pct: null, grupo_min: null, grupo_desc: '', area_m2: null, inclui: [], nao_inclui: [], alertas: [],
  prazo: '', garantia: '', validade: '', pagamento: '', completude: null, interessados: 0, ...o,
})
export const blankOrcamento = (o: Partial<Orcamento> = {}) => base(o)

export const EXEMPLOS: Orcamento[] = [
  base({ id: 'ex1', exemplo: true, criado: '2026-11-04T15:00:00.000Z', nicho: 'piso-vinilico', fornecedor: 'Vinil Prime (exemplo)', servico: 'Piso vinílico colado 2 mm em sala, circulação e 2 quartos', resumo: 'Piso vinílico com instalação e rodapé para 30 m²; à vista sai R$ 3.780.', valor_total: 4200, valor_avista: 3780, desconto_avista_pct: 10, parcelas_max: 10, valor_parcela: 420, juros: false, grupo_pct: 8, grupo_min: 10, grupo_desc: '8% a mais fechando 10 apês', area_m2: 30, inclui: ['Piso vinílico 2 mm colado', 'Mão de obra de instalação', 'Rodapé de 7 cm'], nao_inclui: ['Regularização do contrapiso, se precisar', 'Retirada de entulho'], alertas: ['Confirme se o contrapiso entregue está nivelado o bastante para piso colado'], prazo: '3 dias', garantia: '1 ano na instalação', validade: '2026-12-15', pagamento: 'Pix com 10% ou 10x sem juros no cartão', completude: 4, interessados: 6 }),
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

/** Nome de fornecedor bem escrito: sem emoji, cada palavra com a primeira maiúscula ("MARMORARIA DERICK" → "Marmoraria Derick"),
 *  "e/de/da/do" minúsculos, siglas curtas mantidas (RDL) quando o resto não está todo em maiúsculas. */
const MINUSC = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'em', 'a', 'o', 'para', 'com', 'du', 'di'])
const FORMAS: Record<string, string> = { ltda: 'Ltda', me: 'ME', mei: 'MEI', eireli: 'Eireli', 's/a': 'S/A', sa: 'S/A' }
export function nomeBonito(t: string): string {
  const v = String(t || '').replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3]/gu, ' ').replace(/[*_~`]+/g, '').replace(/\s+/g, ' ').trim().replace(/^[\s·•|,;:!.\-–]+|[\s·•|,;:!\-–]+$/g, '')
  const letras = v.replace(/[^A-Za-zÀ-ú]/g, '')
  const tudoMaius = letras.length > 0 && letras === letras.toUpperCase()
  return v.split(' ').map((w, i) => {
    const low = w.toLowerCase()
    const so = low.replace(/[^a-zà-ú/]/g, '')
    if (FORMAS[so]) return w.replace(new RegExp(so.replace('/', '\\/'), 'i'), FORMAS[so])
    const l = w.replace(/[^A-Za-zÀ-ú]/g, '')
    if (!tudoMaius && l.length >= 2 && l.length <= 4 && l === l.toUpperCase()) return w // sigla: RDL, MRV
    if (i > 0 && MINUSC.has(low)) return low
    return low.replace(/[a-zà-ú]/, (c) => c.toUpperCase())
  }).join(' ').slice(0, 80)
}
/** "Orçamento", "Proposta" etc. não dizem o serviço: fica vazio para o título usar o nome da pasta. */
export const servicoGenerico = (s: string) => /^(or[cç]amento|proposta|cota[cç][aã]o|pedido)s?(\s+(de\s+)?(servi[cç]os?|comercial|t[eé]cnic[ao]))?(\s*(n[º°o.]?|#)\s*\d+)?\.?$/i.test(String(s || '').trim())

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
  const raw2 = raw as Record<string, unknown>
  if (Array.isArray(raw2.itens))
    o.itens = (raw2.itens as Record<string, unknown>[])
      .filter((i) => i && typeof i === 'object' && String(i.descricao ?? '').trim())
      .slice(0, 60)
      .map((i) => ({ descricao: String(i.descricao).trim().slice(0, 160), qtd: num(i.qtd), unidade: String(i.unidade ?? '').slice(0, 12), valor: num(i.valor) }))
  if (Array.isArray(raw2.materiais)) o.materiais = raw2.materiais.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 20)
  for (const k of ['email', 'telefone', 'cnpj', 'endereco'] as const) if (raw2[k] != null && String(raw2[k]).trim()) o[k] = String(raw2[k]).trim().slice(0, 160)
  if (/^(n[aã]o sei|desconhecid[oa]|sem nome|n\/?a|-+)$/i.test(String(o.fornecedor || '').trim())) o.fornecedor = ''
  o.fornecedor = nomeBonito(o.fornecedor)
  if (servicoGenerico(o.servico)) o.servico = ''
  if (Array.isArray(raw2.arquivos)) o.arquivos = (raw2.arquivos as { nome?: string; tipo?: string }[]).map((a) => ({ nome: String(a?.nome ?? ''), tipo: String(a?.tipo ?? '') })).slice(0, 8)
  if (raw2.enviado === true) o.enviado = true
  if (raw2.lendo === true) o.lendo = true
  if (raw2.nicho_auto === true) o.nicho_auto = true
  if (raw2.forn_auto === true) o.forn_auto = true
  if (typeof raw2.texto_original === 'string' && raw2.texto_original.trim()) o.texto_original = raw2.texto_original.trim().slice(0, 6000)
  if (raw2.tipo === 'tabela' || raw2.tipo === 'contato') o.tipo = raw2.tipo
  if (raw2.planta === 'canto' || raw2.planta === 'corredor') o.planta = raw2.planta
  if (typeof raw2.grupo_por === 'string') o.grupo_por = raw2.grupo_por.slice(0, 30)
  if (typeof raw2.grupo_ate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw2.grupo_ate)) o.grupo_ate = raw2.grupo_ate
  if (typeof raw2.acabamento === 'string' && raw2.acabamento.trim()) o.acabamento = raw2.acabamento.trim().slice(0, 40)
  if (!o.whatsapp && o.telefone && digits(o.telefone).length === 11) o.whatsapp = digits(o.telefone)
  return o
}

export function aiPrompt(txt: string) {
  const hoje = new Date().toISOString().slice(0, 10)
  return `Você organiza orçamentos de reforma para moradores de um condomínio novo (apês de ${APE.apes}, entregues com contrapiso na sala e quartos; cozinha, área de serviço e banheiro já com cerâmica). Hoje é ${hoje}.
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
