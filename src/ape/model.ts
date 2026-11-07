/* planê.apê — orçamentos dos futuros moradores (por enquanto, só o San Levi).
   Aqui fica o que não depende de tela: nome, serviços, cálculo do "mais compensa" e as mensagens. */

export const APE = {
  name: 'planê.apê',
  condominio: 'San Levi',
  apes: '38 a 40 m²',
  dona: 'Laís',
  semestre: '9º', // semestre da Laís em Arquitetura e Urbanismo (aparece em projetos e reformas)
  doApe: 'apê 1204',
  meuApe: '40 m²', // o apê da Laís (exemplo padrão nos materiais)
  instagram: '@apzinho_1204',
  whatsapp: '5511969288192', // da Laís: grupo, loja e dúvidas
}

export type Nicho =
  | 'piso-vinilico' | 'piso-ceramico' | 'piso-laminado' | 'revestimentos' | 'marcenaria' | 'marmoraria' | 'box' | 'gesso' | 'eletrica' | 'hidraulica'
  | 'impermeabilizacao' | 'serralheria' | 'ar' | 'pintura' | 'cortinas' | 'telas' | 'vidros' | 'iluminacao' | 'moveis' | 'eletros' | 'mao-de-obra' | 'outros'

export const NICHOS: [Nicho, string, string][] = [
  ['piso-vinilico', 'Piso vinílico', 'floor'], ['piso-ceramico', 'Porcelanato e cerâmica', 'tile'], ['piso-laminado', 'Piso laminado', 'floor'],
  ['revestimentos', 'Revestimentos de parede', 'tile'], ['marcenaria', 'Marcenaria e planejados', 'wood'], ['marmoraria', 'Pedras e bancadas', 'stone'],
  ['box', 'Box de banheiro', 'shower'], ['gesso', 'Gesso, forro e sanca', 'ceiling'], ['eletrica', 'Elétrica', 'bolt'],
  ['hidraulica', 'Hidráulica', 'shower'], ['impermeabilizacao', 'Impermeabilização', 'shield'], ['serralheria', 'Serralheria', 'tool'],
  ['ar', 'Ar-condicionado', 'snow'], ['pintura', 'Pintura', 'brush'], ['cortinas', 'Cortinas e persianas', 'curtain'],
  ['telas', 'Telas de proteção', 'net'], ['vidros', 'Vidros e espelhos', 'glass'], ['iluminacao', 'Iluminação', 'sparkle'],
  ['moveis', 'Móveis soltos', 'sofa'], ['eletros', 'Eletrodomésticos', 'fridge'], ['mao-de-obra', 'Mão de obra geral', 'tool'], ['outros', 'Outros', 'box'],
]
const NMAP = Object.fromEntries(NICHOS.map((n) => [n[0], { l: n[1], i: n[2] }])) as Record<string, { l: string; i: string }>
export const nicho = (id?: string) => NMAP[id || 'outros'] || NMAP.outros
export const isNicho = (id: unknown): id is Nicho => typeof id === 'string' && !!NMAP[id]
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
  fase?: 'comprando' | 'comprei' // para quem ainda vai comprar o apê ou para quem já comprou
  arte?: string // desenho que representa o produto
  selo?: string // selo de destaque no cartão (ex.: "mais vendido")
  kitPct?: number // kits: % de desconto sobre a soma dos arquivos (o preço sai sozinho)
}

export interface Morador {
  id: string
  nome: string
  condominio?: string // 'San Levi' ou o nome que a pessoa digitou
  moraJunto?: boolean // confirmou que mora no mesmo apê de quem já tinha cadastro
  pessoas?: number | null // quantas pessoas vão morar (opcional)
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
export const LOJA_VERSAO = 7
/** Selos de destaque que dá para escolher no painel. */
export const SELOS = ['mais vendido', 'queridinho', 'mais procurado', 'melhor custo-benefício', 'novidade', 'essencial', 'últimas vagas']
/** Único desconto da loja além dos kits: Pix (a taxa do Pix é menor que a do cartão). Sem parcelamento. */
export const PIX_PCT = 5
/** Taxas do Asaas usadas para conferir a margem (confira no seu plano e ajuste no painel). */
export interface Taxas { pix: number; cartaoPct: number; cartaoFixo: number }
export const TAXAS: Taxas = { pix: 1.99, cartaoPct: 2.99, cartaoFixo: 0.49 }
/** Meses de plataforma que o kit completo dá de presente (no máximo 1). */
export const KIT_PLATAFORMA_MESES = 1
/** Bônus de todas as compras, liberado 7 dias depois do pagamento (não é vendido; não muda o direito de arrependimento). */
export const BONUS = { id: 'bonus', surpresa: 'bônus surpresa', pista: 'Um arquivo que não está à venda na loja, pensado para quem acabou de pegar as chaves. Ele chega fechado e só abre no 8º dia.', nome: 'Calendário de manutenção e garantias do 1º ano', desc: 'O que revisar em cada mês do primeiro ano na casa nova e até quando vale a garantia de cada item. Chega 7 dias depois da compra.', dias: 7 }
const arq = (p: Omit<Produto, 'cat' | 'ativo' | 'entrega'>): Produto => ({ cat: 'arquivos', ativo: true, entrega: NA_HORA, fase: 'comprei', ...p })
const kit = (p: Omit<Produto, 'cat' | 'ativo' | 'entrega' | 'preco' | 'itens'> & { itens?: string[] }): Produto => ({ cat: 'combos', ativo: true, entrega: NA_HORA, preco: '', itens: [], ...p })
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
  /* kits: o preço sai sozinho da soma dos arquivos menos o desconto do kit */
  kit({ id: 'kit-compra', nome: 'Kit vou comprar', tag: 'kit', arte: 'contrato', kitPct: 35, combo: ['compra', 'financiamento', 'planilha-compra', 'decorado'], amostras: [AM('m-kit-compra.jpg'), AM('m-compra.jpg'), AM('m-financiamento.jpg'), AM('m-planilha-compra.jpg')],
    desc: 'Para quem ainda vai comprar, na planta ou pronto: guia de compra, guia do financiamento e dos seguros, planilha de custos e checklist da visita.' }),
  kit({ id: 'kit-chaves', selo: 'mais procurado', nome: 'Kit chaves na mão', tag: 'kit', arte: 'vistoria', kitPct: 23, combo: ['checklist', 'entregas', 'mudanca'], amostras: [AM('m-kit-chaves.jpg'), AM('m-checklist.jpg'), AM('m-entregas.jpg'), AM('m-mudanca.jpg')],
    desc: 'Da vistoria à mudança: o checklist da vistoria, o de entregas da obra e a lista da mudança.' }),
  kit({ id: 'kit-obra', nome: 'Kit obra sem susto', tag: 'kit', arte: 'planilha', kitPct: 29, combo: ['planilha', 'guia', 'medidas'], amostras: [AM('m-kit-obra.jpg'), AM('m-planilha.jpg'), AM('m-guia.jpg'), AM('m-medidas.jpg')],
    desc: 'Para planejar, comparar orçamentos e comprar o que cabe: planilha de obra, guia de orçamentos e guia de medidas.' }),
  kit({ id: 'kit-completo', selo: 'melhor custo-benefício', nome: 'Kit completo', tag: 'mais completo', arte: 'casa', destaque: true, kitPct: 56, combo: ['compra', 'financiamento', 'planilha-compra', 'decorado', 'checklist', 'planilha', 'guia', 'medidas', 'entregas', 'enxoval', 'mudanca', 'planner'], amostras: [AM('m-kit-completo.jpg'), AM('m-compra.jpg'), AM('m-checklist.jpg'), AM('m-planilha.jpg'), AM('m-planner.jpg')],
    desc: 'Os 12 arquivos da loja, da compra à decoração, com o maior desconto.', itens: [`+ ${KIT_PLATAFORMA_MESES} mês de plataforma do apê de presente`] }),
  { id: 'plataforma', selo: 'novidade', cat: 'plataforma', nome: 'Plataforma do apê', tag: 'acesso por 1 ano', destaque: true, preco: 'R$ 79,00', unidade: 'por ano · pagamento único', formato: 'site: abre no celular e no computador, sem instalar nada', entrega: 'Pagou, o link de acesso aparece na página do pedido na hora.', amostras: [AM('m-plataforma.jpg')], arte: 'celular',
    desc: 'Um site para acompanhar a sua jornada do começo ao fim: gastos, parcelas, etapas da obra, vistoria com fotos e contatos, atualizados por você, num lugar só.',
    itens: ['Gastos por cômodo: quanto planejou, quanto já foi e quanto falta', 'Parcelas dos próximos meses, somadas sozinhas', 'Etapas da compra e da obra, com datas e o que já foi feito', 'Vistoria com fotos e resumo para imprimir', 'Contatos dos fornecedores com WhatsApp a um toque', 'Abre no celular e no computador, sem instalar nada', 'Pagamento único: 12 meses de acesso, sem mensalidade'], ativo: true },
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
export function conta(ids: string[], produtos: Produto[], forma: 'pix' | 'cartao' = 'pix', pixPct = PIX_PCT) {
  const map = new Map(produtos.filter((p) => p.ativo && noCarrinho(p)).map((p) => [p.id, p]))
  let uniq = [...new Set(ids)].filter((id) => map.has(id))
  const dentro = new Set(uniq.flatMap((id) => (map.get(id)!.cat === 'combos' ? map.get(id)!.combo || [] : [])))
  const repetidos = uniq.filter((id) => (map.get(id)!.cat || 'arquivos') === 'arquivos' && dentro.has(id))
  uniq = uniq.filter((id) => !repetidos.includes(id))
  const itens = uniq.map((id) => map.get(id)!)
  const subtotal = c2(itens.reduce((t, p) => t + reais(p.preco), 0))
  const pixDesconto = c2(subtotal * pixPct / 100)
  const totalPix = c2(subtotal - pixDesconto)
  const desconto = forma === 'pix' ? pixDesconto : 0
  // quanto os kits do carrinho economizam em relação aos arquivos separados (só para mostrar)
  const preco = new Map(produtos.map((p) => [p.id, reais(p.preco)]))
  const economiaKits = c2(itens.filter((p) => p.cat === 'combos').reduce((t, p) => t + (p.combo || []).reduce((s, id) => s + (preco.get(id) || 0), 0) - reais(p.preco), 0))
  return { itens, subtotal, desconto, pixDesconto, totalPix, total: c2(subtotal - desconto), repetidos, economiaKits, pixPct }
}

export const CTA_COPY: Record<string, [string, string, string]> = {
  checklist: ['Vistoria em dezembro', 'Não deixe passar nenhum defeito na vistoria', 'Uma lista cômodo por cômodo para conferir piso, paredes, esquadrias, louças e elétrica antes de receber as chaves.'],
  guia: ['Antes de fechar', 'O que precisa vir escrito em cada orçamento', 'As pegadinhas de cada serviço e uma tabela para comparar de verdade.'],
  entregas: ['Antes de pagar', 'Confira a entrega de cada fornecedor', 'Testes simples para fazer no dia e um termo de recebimento pronto.'],
  medidas: ['Antes de comprar', 'Compre só o que cabe', 'Medidas de móveis e passagens para a sua casa ou apê.'],
  planilha: ['Organização', 'Saiba quanto já gastou e quanto falta', 'Uma planilha pronta para controlar compras, parcelas e orçamentos do apê.'],
  plataforma: ['Plataforma do apê', 'Tudo do seu apê num lugar só', `Compras, obra, vistoria e contatos, no celular, como usamos no ${APE.doApe}.`],
  'kit-completo': ['Kit', 'Da compra à decoração, sem susto', 'Os 12 arquivos da loja com o maior desconto: guias, checklists, planilhas e planner.'],
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
  if (Array.isArray(raw2.arquivos)) o.arquivos = (raw2.arquivos as { nome?: string; tipo?: string }[]).map((a) => ({ nome: String(a?.nome ?? ''), tipo: String(a?.tipo ?? '') })).slice(0, 8)
  if (raw2.enviado === true) o.enviado = true
  if (raw2.tipo === 'tabela' || raw2.tipo === 'contato') o.tipo = raw2.tipo
  if (raw2.planta === 'canto' || raw2.planta === 'corredor') o.planta = raw2.planta
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
