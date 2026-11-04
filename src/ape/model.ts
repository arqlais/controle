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

export interface Produto {
  id: string
  nome: string
  desc: string
  preco: string
  tag: string
  ativo: boolean
}

export interface Morador {
  id: string
  nome: string
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
const quem = (m: Morador | null) => (m ? `${m.nome} (Torre ${m.torre}, apê ${m.ap})` : 'um morador')
export const msgFornecedor = (o: Orcamento, m: Morador | null) =>
  `Olá! Sou ${quem(m)}, do condomínio ${APE.condominio} (${APE.construtora}). Vi o orçamento de ${o.servico || nicho(o.nicho).l} da ${o.fornecedor} na página de orçamentos dos moradores e queria conversar.` +
  (num(o.grupo_pct) ? ' Tenho interesse também na condição de compra em grupo.' : '')
export const msgGrupo = (o: Orcamento, m: Morador | null) => `Oi, ${APE.dona}! Sou ${quem(m)}. Quero entrar na compra em grupo de ${o.servico || nicho(o.nicho).l} da ${o.fornecedor} 🙌`
export const msgProduto = (p: Produto, m: Morador | null) =>
  `Oi, ${APE.dona}! Sou ${quem(m)}, morador do ${APE.condominio}. Tenho interesse em: ${p.nome} 😊` + (m ? `\nTelefone: ${fmtTel(m.tel)}` : '')
export const msgAnexo = (m: Morador | null, fornecedor: string) =>
  `Oi, ${APE.dona}! Sou ${quem(m)}. Mandei o orçamento${fornecedor ? ` da ${fornecedor}` : ''} pela página e vou anexar o arquivo aqui 📎`

/* ===== produtos e exemplos ===== */
export const PRODUTOS: Produto[] = [
  { id: 'checklist', nome: 'Checklist de vistoria MRV', desc: `O que conferir no dia da vistoria, cômodo por cômodo, com espaço para anotar e fotografar problemas. Feito em cima do memorial do ${APE.condominio}.`, preco: '', tag: 'Para a vistoria', ativo: true },
  { id: 'planilha', nome: 'Planilha de obra e compras', desc: 'Controle do que comprar, quanto custou, parcelas e quanto falta, organizado por cômodo e categoria.', preco: '', tag: 'Organização', ativo: true },
  { id: 'plataforma', nome: 'Plataforma do apê · acesso anual', desc: `A mesma plataforma que usamos no ${APE.doApe}: compras, obra, vistoria, contatos e projeto num lugar só, no celular.`, preco: '', tag: '12 meses de acesso', ativo: true },
  { id: 'projeto', nome: 'Projeto do seu apê', desc: `Planta com layout, imagens 3D e detalhamento para marcenaria e elétrica, nas medidas da ${APE.construtora}. ART com engenheiro como adicional.`, preco: '', tag: 'Sob medida', ativo: true },
]
export const CTA_COPY: Record<string, [string, string, string]> = {
  checklist: ['Vistoria em dezembro', 'Não deixe passar nenhum defeito na vistoria', 'Uma lista cômodo por cômodo para conferir piso, paredes, esquadrias, louças e elétrica antes de receber as chaves.'],
  projeto: ['Antes de fechar', 'Feche marcenaria e elétrica com o projeto na mão', 'Com a planta e as medidas certas, você pede orçamentos iguais e compara de verdade.'],
  planilha: ['Organização', 'Saiba quanto já gastou e quanto falta', 'Uma planilha pronta para controlar compras, parcelas e orçamentos do apê.'],
  plataforma: ['Plataforma do apê', 'Tudo do seu apê num lugar só', `Compras, obra, vistoria e contatos, no celular, como usamos no ${APE.doApe}.`],
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
