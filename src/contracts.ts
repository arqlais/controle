import type { Client, Contract, FullAddress, ContractSettings, ContractTemplate, Quote, Settings } from './types'
import { CLIENT_CONTRACTS, FINAL_CONTRACT, LAIS_CONTRACTS } from './contractTemplates'
import { dayLabel } from './processes'
import { porExtenso } from './components/Docs'
import { PAYMENT_TERMS } from './store'
import { addressText, contractantName, qualification, signersOf } from './contractData'
import { cleanDetail, docKind, formatPhone, money, optionTotal, payerOf, quoteDeal, quoteNumber, shownOptions, showDoc, today, BOTH } from './utils'

/* Contratos: modelos com {variáveis} que o sistema preenche com os dados do
   orçamento, do cliente e do perfil do estúdio. São MODELOS de referência:
   cada profissional deve revisar com um advogado antes de usar. */

export const CONTRACT_VARS: [string, string][] = [
  ['contratante', 'nome ou razão social do cliente'],
  ['doc_contratante', 'CPF/CNPJ do cliente'],
  ['endereco_contratante', 'endereço do cliente'],
  ['email_contratante', 'e-mail do cliente'],
  ['telefone_contratante', 'telefone do cliente'],
  ['qualificacao_contratante', 'qualificação completa do cliente (empresa, CNPJ, sede e quem representa)'],
  ['representante', 'quem assina pelo cliente'],
  ['endereco_obra', 'endereço do imóvel do projeto (cliente final)'],
  ['contratada', 'seu nome completo'],
  ['doc_contratada', 'seu CPF/CNPJ'],
  ['endereco_contratada', 'seu endereço'],
  ['email_contratada', 'seu e-mail'],
  ['telefone_contratada', 'seu telefone'],
  ['projeto', 'nome do projeto'],
  ['servicos', 'lista de serviços do orçamento'],
  ['escopo', 'escopo completo do orçamento aprovado (serviços, quantidades, o que inclui, área e observações)'],
  ['observacoes', 'observações do orçamento'],
  ['valor', 'valor total'],
  ['valor_extenso', 'valor por extenso'],
  ['pagamento', 'forma de pagamento'],
  ['prazo', 'prazo de entrega (texto)'],
  ['prazo_dias', 'prazo em dias úteis (número)'],
  ['quantidade', 'quantidade de imagens/itens'],
  ['entrada', 'entrada (50% do valor)'],
  ['saldo', 'saldo (50% do valor)'],
  ['foro', 'cidade do foro'],
  ['etapas', 'etapas do projeto com o que inclui (cliente final)'],
  ['cronograma', 'prazo de cada etapa (cliente final)'],
  ['prazo_total', 'soma dos prazos das etapas'],
  ['pagamento_etapas', '% e valor de cada etapa (cliente final)'],
  ['revisoes', 'rodadas de ajuste incluídas'],
  ['arquivos', 'formatos entregues'],
  ['orcamento', 'número do orçamento'],
  ['cidade', 'sua cidade'],
  ['data', 'data de hoje, por extenso'],
]

/** Modelos padrão: a dona tem o dela (exclusivo); cada freelancer começa com os modelos da plataforma. */
export const DEFAULT_CONTRACTS = CLIENT_CONTRACTS
export const defaultTemplates = (owner: boolean) => (owner ? LAIS_CONTRACTS : CLIENT_CONTRACTS)
export const defaultContractSettings = (owner = false): ContractSettings => ({ templates: defaultTemplates(owner) })
/** Modelos em uso nesta conta (os editados por ela ou os padrões do perfil). */
export const contractSettings = (s: Settings, owner: boolean): ContractSettings => {
  const cs = s.contracts
  if (!cs?.templates?.length) return { ...(cs ?? {}), templates: defaultTemplates(owner) }
  // modelos novos entram também para quem já editou os seus (menos os que a pessoa apagou)
  const missing = defaultTemplates(owner).filter((d) => !cs.templates.some((t) => t.id === d.id) && !(cs.hidden ?? []).includes(d.id))
  return missing.length ? { ...cs, templates: [...cs.templates, ...missing] } : cs
}

/** Modelo sugerido pelo serviço do orçamento (renderização, modelagem, executivo, por hora). */
export function suggestTemplate(templates: ContractTemplate[], q?: Quote) {
  // cliente final: o modelo do tipo de projeto do orçamento (interiores, arquitetônico, consultoria, obra…)
  if (q?.audience === 'final') {
    const txt = [q.processId, q.title, ...q.items.map((i) => `${i.service} ${i.title}`), ...(q.steps ?? []).map((x) => x.name)].join(' ').toLowerCase()
    const byId = (id: string) => templates.find((x) => x.id === id)
    const pick =
      (/consult/.test(txt) && byId('cf-consultoria')) ||
      (/regulariz|legal|aprova[cç][aã]o|habite/.test(txt) && byId('cf-regularizacao')) ||
      (/complementar|estrutural|el[eé]tric|hidr/.test(txt) && !/interior|arquitet/.test(txt) && byId('cf-complementares')) ||
      (/acompanhamento de obra|gest[aã]o de obra/.test(txt) && !/projeto/.test(txt) && byId('cf-obra')) ||
      (/arquitet|constru|reforma|casa|resid[eê]ncia/.test(txt) && byId('cf-arquitetonico')) ||
      (/interior|decora|marcenaria|ambiente/.test(txt) && byId('cf-interiores')) ||
      byId(FINAL_CONTRACT.id) ||
      templates.find((x) => /cliente final|etapas/i.test(x.name))
    if (pick) return pick
  }
  const text = (q ? [q.title, ...q.items.map((i) => `${i.service} ${i.title}`), ...q.options.flatMap((o) => o.items.map((i) => `${i.service} ${i.title}`))].join(' ') : '').toLowerCase()
  const want = /render|imagem|visualiza/.test(text) ? /render|visualiza/ : /modelag/.test(text) ? /modelag/ : /execut|detalh|planta/.test(text) ? /execut|detalh|apoio/ : /hora/.test(text) ? /hora/ : null
  return (want && templates.find((t) => want.test(t.name.toLowerCase()))) || templates[0]
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]} de ${y}`
}

/** Serviços do orçamento em linhas (na opção escolhida, quando há opções). */
const itemsOf = (q: Quote) => {
  const opts = shownOptions(q)
  return q.mode === 'opcoes' ? (q.chosenOption === BOTH ? opts.flatMap((o) => o.items) : (opts.find((o) => o.id === q.chosenOption) ?? opts[0])?.items ?? []) : q.items
}
/** Serviços do orçamento, um por linha: nome, quantidade × valor unitário e o que está incluso. */
function servicesText(q: Quote) {
  const lines = itemsOf(q)
    .filter((i) => i.title.trim() || i.price > 0)
    .map((i) => {
      const det = cleanDetail(i.detail)
      const inc = i.description
        .split(/\n+|;\s*/)
        .map((x) => x.replace(/^[-•–·*]\s*/, '').trim())
        .filter(Boolean)
      const unit = i.quantity > 1 && i.price > 0 && !i.joined ? ` — ${i.quantity} × ${money(Math.round((i.price / i.quantity) * 100) / 100)} = ${money(i.price)}` : i.price > 0 && !i.joined ? ` — ${money(i.price)}` : i.joined ? ' (valor incluído no item anterior)' : ''
      return [`• ${i.title || 'serviço'}${det ? ` (${det})` : ''}${unit}`, ...inc.map((x) => `   – ${x}`)].join('\n')
    })
  return lines.join('\n') || '[descreva os serviços]'
}

/** Escopo completo do orçamento aprovado: serviços, área, observações e o que mudou no fechamento. */
function scopeText(q: Quote) {
  const opt = q.mode === 'opcoes' && q.chosenOption !== BOTH ? shownOptions(q).find((o) => o.id === q.chosenOption) : undefined
  const extra = [
    q.area ? `Área de referência: ${q.areaApprox ? 'aprox. ' : ''}${q.area.toLocaleString('pt-BR')} m²${q.floors && q.floors > 1 ? `, ${q.floors} pavimentos` : ''}.` : '',
    opt?.note?.trim() ? `Observação da opção escolhida: ${opt.note.trim()}` : '',
    q.notes?.trim() ? `Observações do orçamento: ${q.notes.trim().replace(/\n+/g, ' ')}` : '',
    q.closedNote?.trim() ? `Ajustes combinados no fechamento: ${q.closedNote.trim()}` : '',
  ].filter(Boolean)
  return [servicesText(q), ...extra].join('\n')
}

const blank = (label: string) => `[${label}]`

/** Quantidade de imagens (ou de itens) do orçamento, para "___ imagens renderizadas". */
function quantityOf(q: Quote) {
  const items = itemsOf(q)
  const images = items.filter((i) => /render|imagem|ia\b/i.test(`${i.service} ${i.title}`))
  const n = (images.length ? images : items).reduce((acc, i) => acc + (i.quantity || 0), 0)
  return n ? String(n) : blank('quantidade')
}

/** Variáveis do contrato já no padrão: nomes com maiúscula certa, e-mail minúsculo, telefone (11) 99999-9999. */
export function contractVars(s: Settings, q?: Quote, client?: Client): Record<string, string> {
  const v = rawVars(s, q, client)
  for (const k of ['contratante', 'contratada', 'representante']) if (v[k] && !isBlank(v[k])) v[k] = fixText(v[k])
  for (const k of ['endereco_contratante', 'endereco_contratada', 'endereco_obra']) if (v[k] && !isBlank(v[k])) v[k] = fixText(v[k])
  for (const k of ['email_contratante', 'email_contratada']) if (v[k] && !isBlank(v[k])) v[k] = v[k].trim().toLowerCase()
  for (const k of ['telefone_contratante', 'telefone_contratada']) if (v[k] && !isBlank(v[k])) v[k] = contractPhone(v[k])
  return v
}
const isBlank = (x: string) => /^\[[^\]\n]{3,40}\]$/.test(x.trim())

/** Telefone do Brasil sem o +55: (11) 96928-8192. Outro país fica como está, só arrumado. */
export function contractPhone(x: string) {
  let d = x.replace(/\D/g, '')
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2)
  if (d.length === 10 || d.length === 11) return formatPhone(d)
  return formatPhone(x)
}

const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'com', 'a', 'o', 'à'])
const UPPER = new Set(['LTDA', 'ME', 'EPP', 'EIRELI', 'MEI', 'SA', 'S.A.', 'S/A', 'SS', 'CPF', 'CNPJ', 'RG', 'CEP', 'UF', 'SP', 'RJ', 'MG', 'RS', 'SC', 'PR', 'BA', 'PE', 'CE', 'GO', 'DF', 'ES', 'MT', 'MS', 'PA', 'AM', 'MA', 'PB', 'RN', 'AL', 'SE', 'PI', 'TO', 'RO', 'AC', 'AP', 'RR', 'SSP', 'II', 'III', 'IV'])
/** Palavra toda em MAIÚSCULA ou toda minúscula vira "Nome Próprio" (siglas e e-mails ficam como estão). */
export function fixText(x: string) {
  return x.replace(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'/]*(?:@\S+)?/g, (w, i: number, all: string) => {
    if (w.includes('@')) return w.toLowerCase()
    const bare = w.replace(/[.,]$/, '')
    if (UPPER.has(bare.toUpperCase()) && (bare === bare.toUpperCase() || bare.length <= 2) && !SMALL.has(bare.toLowerCase())) return w.toUpperCase()
    const upper = w === w.toUpperCase()
    const lower = w === w.toLowerCase()
    if (!upper && !lower) return w // escrito à mão com maiúsculas misturadas: respeita
    const low = w.toLowerCase()
    const prev = all.slice(0, i).trimEnd()
    const startOf = !prev || /[.:;(\n]$/.test(prev)
    if (SMALL.has(low) && !startOf) return low
    return low.charAt(0).toUpperCase() + low.slice(1)
  })
}

function rawVars(s: Settings, q?: Quote, client?: Client): Record<string, string> {
  const payer = payerOf(client)
  const addr = (a?: string, n?: string, city?: string) => [a, n, city].filter((x) => x?.trim()).join(', ')
  const total = q ? (q.mode === 'opcoes' && q.chosenOption !== BOTH && !q.closedValue ? optionTotal(shownOptions(q).find((o) => o.id === q.chosenOption) ?? shownOptions(q)[0] ?? { items: [], discount: 0 }) : quoteDeal(q, s.urgencyFee)) : 0
  const steps = (q?.steps ?? []).filter((x) => x.name.trim())
  const timed = steps.filter((x) => x.days > 0)
  const paidSteps = steps.filter((x) => x.percent > 0)
  const days = timed.reduce((n, x) => n + x.days, 0)
  const partOf = (pct: number) => (total ? ` (${money(Math.round(total * pct) / 100)})` : '')
  const stepsVars = {
    etapas: steps.length ? steps.map((x, i) => `${i + 1}. ${x.name}${x.description ? ` — ${x.description}` : ''}${x.items.length ? `\n   Inclui: ${x.items.join('; ')}.` : ''}`).join('\n') : blank('etapas do projeto'),
    cronograma: timed.length ? timed.map((x) => `• ${x.name}: ${dayLabel(x)}`).join('\n') : blank('prazo de cada etapa'),
    prazo_total: days ? `${days} dias` : q?.deadlineDays ? `${q.deadlineDays} dias úteis` : blank('prazo total'),
    pagamento_etapas: paidSteps.length ? paidSteps.map((x, i) => `• ${x.percent}%${partOf(x.percent)} ${i === 0 ? 'na assinatura deste contrato' : `na entrega da etapa "${x.name}"`}`).join('\n') : blank('pagamento por etapa'),
  }
  const first = paidSteps[0]?.percent
  return {
    ...stepsVars,
    contratante: client ? payer.name : blank('nome do cliente'),
    doc_contratante: payer.doc ? `${docKind(payer.doc) || 'CPF/CNPJ'} ${showDoc(payer.doc)}` : blank('CPF/CNPJ do cliente'),
    endereco_contratante: addr(client?.address, client?.addressNumber, client?.city) || blank('endereço do cliente'),
    contratada: s.legalName || s.ownerName || blank('seu nome completo'),
    doc_contratada: s.document ? `${docKind(s.document) || 'CPF/CNPJ'} ${showDoc(s.document)}` : blank('seu CPF/CNPJ'),
    endereco_contratada: addr(s.address, s.addressNumber, s.city) || blank('seu endereço'),
    projeto: q?.title || blank('projeto'),
    servicos: q ? servicesText(q) : blank('serviços'),
    escopo: q ? scopeText(q) : blank('escopo do orçamento'),
    observacoes: q ? [q.notes?.trim(), q.closedNote?.trim()].filter(Boolean).join(' ') || 'nenhuma' : blank('observações'),
    valor: total ? money(total) : blank('valor'),
    valor_extenso: total ? porExtenso(total) : blank('valor por extenso'),
    pagamento: q?.paymentTerms.trim() || s.defaultPaymentTerms || PAYMENT_TERMS,
    prazo: days ? `${days} dias (somando as etapas)` : q?.deadlineDays ? `${q.deadlineDays} dias úteis` : blank('prazo'),
    revisoes: q ? String(q.revisions) : String(s.defaultRevisions),
    arquivos: q?.files || s.proposal.files,
    orcamento: q ? quoteNumber(q) : blank('nº do orçamento'),
    cidade: s.city || blank('cidade'),
    data: longDate(today()),
    email_contratante: client?.email || blank('e-mail do cliente'),
    telefone_contratante: client?.phone || blank('telefone do cliente'),
    email_contratada: s.email || blank('seu e-mail'),
    telefone_contratada: s.phone || blank('seu telefone'),
    prazo_dias: days ? String(days) : q?.deadlineDays ? String(q.deadlineDays) : blank('prazo em dias'),
    quantidade: q ? quantityOf(q) : blank('quantidade'),
    entrada: total ? money(Math.round((total * (first ?? 50)) / 100 * 100) / 100) : blank('entrada'),
    saldo: total ? money(total - Math.round((total * (first ?? 50)) / 100 * 100) / 100) : blank('saldo'),
    foro: (s.city || '').replace(/\s*-\s*/, '/') || blank('cidade/UF do foro'),
    qualificacao_contratante: client ? payer.name : blank('qualificação do cliente'),
    representante: client?.name || blank('quem assina pelo cliente'),
    endereco_obra: blank('endereço do imóvel'),
    // dados completos que o cliente mandou (ou que você corrigiu): valem por cima do cadastro
    ...(client?.contractData ? fromData(client.contractData) : {}),
  }
}

/** Dados do formulário no padrão do contrato (nomes, e-mails, telefones e endereços). */
function cleanData(d: NonNullable<Client['contractData']>): NonNullable<Client['contractData']> {
  const addr = (a?: FullAddress): FullAddress | undefined => (a ? { ...a, street: fixText(a.street || ''), complement: fixText(a.complement || ''), district: fixText(a.district || ''), city: fixText(a.city || ''), uf: (a.uf || '').toUpperCase() } : a)
  const person = <P extends (typeof d)['person']>(p: P): P => ({ ...p, name: fixText(p.name || ''), email: (p.email || '').trim().toLowerCase(), phone: p.phone ? contractPhone(p.phone) : p.phone, nationality: (p.nationality || '').toLowerCase(), civilState: (p.civilState || '').toLowerCase(), profession: (p.profession || '').toLowerCase(), address: addr(p.address)! })
  return {
    ...d,
    contractName: d.contractName ? fixText(d.contractName) : d.contractName,
    person: person(d.person),
    partners: (d.partners ?? []).map(person),
    company: { ...d.company, legalName: fixText(d.company.legalName || ''), tradeName: fixText(d.company.tradeName || ''), email: (d.company.email || '').trim().toLowerCase(), phone: d.company.phone ? contractPhone(d.company.phone) : d.company.phone, address: addr(d.company.address)! },
    property: d.property ? addr(d.property) : d.property,
  }
}

/** Variáveis do contratante a partir dos dados para contrato (o que estiver vazio fica de fora). */
function fromData(d: NonNullable<Client['contractData']>): Record<string, string> {
  d = cleanData(d)
  const out: Record<string, string> = {}
  const put = (k: string, v?: string) => {
    if (v && v.trim()) out[k] = v.trim()
  }
  const company = d.signAs === 'empresa'
  put('contratante', contractantName(d))
  put('doc_contratante', company ? (d.company.cnpj ? `CNPJ ${d.company.cnpj}` : '') : d.person.cpf ? `CPF ${d.person.cpf}` : '')
  put('endereco_contratante', addressText(company ? d.company.address : d.person.address))
  put('email_contratante', company ? d.company.email || d.person.email : d.person.email)
  put('telefone_contratante', company ? d.company.phone || d.person.phone : d.person.phone)
  put('qualificacao_contratante', qualification(d))
  put('representante', signersOf(d).map((p) => p.name).join(' e '))
  put('endereco_obra', addressText(d.property))
  return out
}

/** Dados que mudaram depois que o contrato foi criado (o cliente mandou o formulário, você corrigiu o cadastro
 *  ou o seu perfil): troca no texto o valor antigo pelo novo, sem mexer no que foi escrito à mão.
 *  Contrato assinado nunca muda. Devolve null quando não há nada a trocar. */
export function syncContract(c: Contract, s: Settings, q?: Quote, client?: Client, opts: { before?: Record<string, string> } = {}): Pick<Contract, 'body' | 'html' | 'vars'> | null {
  if (c.sign) return null
  const manual = new Set(c.manualKeys ?? [])
  const now = contractVars(s, q, client)
  // contratos antigos não guardaram os valores: o cadastro sem o formulário é o que foi usado
  const before = opts.before ?? c.vars ?? { ...contractVars(s, q, client ? { ...client, contractData: undefined } : client), ...(q ? { servicos: legacyServices(q) } : {}) }
  const blankOf = (v: string) => /^\[[^\]\n]{3,60}\]$/.test(v)
  let body = c.body
  let html = c.html
  const swap = (txt: string, from: string, to: string) => txt.split(from).join(to)
  const swapHtml = (txt: string, from: string, to: string) => txt.split(esc(from)).join(esc(to)).split(from).join(to)
  for (const k of SYNC_KEYS) {
    if (manual.has(k)) continue // mudado à mão no "revisar antes de enviar": fica como ela deixou
    const a = before[k]
    const b = now[k]
    if (!a || !b || a === b || blankOf(b)) continue
    if (!blankOf(a) && a.length < 4) continue // valor curto demais para trocar com segurança
    body = swap(body, a, b)
    if (html) html = swapHtml(html, a, b)
  }
  // modelo sem a lista do orçamento: o escopo aprovado entra na cláusula do objeto
  if (q && !html && !blankOf(now.escopo) && !body.includes(now.servicos) && !body.includes(now.escopo)) body = insertScope(body, now.escopo, now.orcamento)
  const vars = { ...now }
  for (const k of manual) if (c.vars?.[k] !== undefined) vars[k] = c.vars[k]
  if (body === c.body && html === c.html && JSON.stringify(c.vars) === JSON.stringify(vars)) return null
  return { body, html, vars }
}

/** Como a lista de serviços saía antes (para trocar pela nova nos rascunhos antigos). */
function legacyServices(q: Quote) {
  const lines = itemsOf(q).filter((i) => i.title.trim() || i.price > 0).map((i) => `• ${i.title || 'serviço'}${cleanDetail(i.detail) ? ` (${cleanDetail(i.detail)})` : ''}${i.description.trim() ? ` — ${i.description.trim().replace(/\n+/g, '; ')}` : ''}`)
  return lines.join('\n') || '• [descreva os serviços]'
}

/** Põe o escopo do orçamento no fim da cláusula 1 (antes da cláusula 2), com a numeração seguinte. */
export function insertScope(body: string, scope: string, orc = '') {
  const m = /^(CL[ÁA]USULA\s+2\b|2\.\s|2\s*[–-]\s)/im.exec(body)
  const at = m ? m.index : body.length
  const head = body.slice(0, at)
  const nums = [...head.matchAll(/^1\.(\d+)\s/gm)].map((x) => Number(x[1]))
  const n = nums.length ? Math.max(...nums) + 1 : 2
  const orcTxt = orc && !/^\[/.test(orc) ? ` nº ${orc}` : ''
  const block = `1.${n} Escopo contratado, conforme o orçamento${orcTxt} aprovado pela CONTRATANTE (o que não estiver listado é serviço extra, orçado à parte):\n${scope}\n\n`
  return head.replace(/\n*$/, '\n') + block + body.slice(at)
}
const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const SYNC_KEYS = ['qualificacao_contratante', 'contratante', 'doc_contratante', 'endereco_contratante', 'email_contratante', 'telefone_contratante', 'representante', 'endereco_obra', 'contratada', 'doc_contratada', 'endereco_contratada', 'email_contratada', 'telefone_contratada', 'escopo', 'servicos', 'observacoes', 'etapas', 'cronograma', 'pagamento_etapas', 'pagamento', 'valor', 'valor_extenso', 'entrada', 'saldo', 'prazo', 'prazo_total', 'prazo_dias', 'projeto', 'orcamento', 'arquivos', 'revisoes', 'quantidade']

/** Pontos para revisar antes de enviar: trocar aqui troca no texto inteiro do contrato. */
export const REVIEW_GROUPS: { id: string; label: string; icon: string }[] = [
  { id: 'partes', label: 'quem contrata', icon: 'user' },
  { id: 'escopo', label: 'escopo', icon: 'layers' },
  { id: 'valores', label: 'valores e pagamento', icon: 'wallet' },
  { id: 'prazos', label: 'prazos', icon: 'calendar' },
  { id: 'geral', label: 'geral', icon: 'file' },
]
export const REVIEW_FIELDS: { key: string; label: string; icon: string; group: string; long?: boolean }[] = [
  { key: 'contratante', label: 'nome no contrato', icon: 'user', group: 'partes' },
  { key: 'doc_contratante', label: 'CPF / CNPJ', icon: 'file', group: 'partes' },
  { key: 'representante', label: 'quem assina', icon: 'pen', group: 'partes' },
  { key: 'email_contratante', label: 'e-mail', icon: 'mail', group: 'partes' },
  { key: 'telefone_contratante', label: 'telefone', icon: 'phone', group: 'partes' },
  { key: 'endereco_contratante', label: 'endereço', icon: 'home', group: 'partes', long: true },
  { key: 'qualificacao_contratante', label: 'qualificação completa', icon: 'users', group: 'partes', long: true },
  { key: 'projeto', label: 'projeto', icon: 'folder', group: 'escopo' },
  { key: 'endereco_obra', label: 'endereço do imóvel', icon: 'home', group: 'escopo', long: true },
  { key: 'servicos', label: 'serviços incluídos', icon: 'list', group: 'escopo', long: true },
  { key: 'quantidade', label: 'quantidade', icon: 'grid', group: 'escopo' },
  { key: 'revisoes', label: 'revisões incluídas', icon: 'undo', group: 'escopo' },
  { key: 'arquivos', label: 'arquivos entregues', icon: 'download', group: 'escopo', long: true },
  { key: 'etapas', label: 'etapas', icon: 'layers', group: 'escopo', long: true },
  { key: 'valor', label: 'valor total', icon: 'wallet', group: 'valores' },
  { key: 'entrada', label: 'entrada', icon: 'check', group: 'valores' },
  { key: 'saldo', label: 'saldo', icon: 'clock', group: 'valores' },
  { key: 'pagamento', label: 'forma de pagamento', icon: 'wallet', group: 'valores', long: true },
  { key: 'pagamento_etapas', label: 'pagamento por etapa', icon: 'list', group: 'valores', long: true },
  { key: 'prazo', label: 'prazo', icon: 'calendar', group: 'prazos' },
  { key: 'prazo_total', label: 'prazo total', icon: 'calendar', group: 'prazos' },
  { key: 'prazo_dias', label: 'prazo em dias', icon: 'clock', group: 'prazos' },
  { key: 'cronograma', label: 'cronograma', icon: 'calendar', group: 'prazos', long: true },
  { key: 'foro', label: 'foro', icon: 'flag', group: 'geral' },
  { key: 'cidade', label: 'cidade', icon: 'compass', group: 'geral' },
  { key: 'data', label: 'data', icon: 'calendar', group: 'geral' },
]

/** Troca um valor no texto (e no desenho do Word) e devolve o contrato novo; o valor por extenso acompanha. */
export function reviseContract(c: Contract, vars: Record<string, string>, key: string, value: string): Pick<Contract, 'body' | 'html' | 'vars' | 'manualKeys'> {
  const pairs: [string, string][] = [[vars[key] ?? '', value]]
  if (key === 'valor') {
    const n = Number(value.replace(/[^\d,]/g, '').replace(',', '.'))
    if (n > 0 && vars.valor_extenso) pairs.push([vars.valor_extenso, porExtenso(n)])
  }
  let body = c.body
  let html = c.html
  const next = { ...vars }
  for (const [a, b] of pairs) {
    if (!a || a === b) continue
    body = body.split(a).join(b)
    if (html) html = html.split(esc(a)).join(esc(b)).split(a).join(b)
  }
  next[key] = value
  if (key === 'valor' && pairs[1]) next.valor_extenso = pairs[1][1]
  const manualKeys = [...new Set([...(c.manualKeys ?? []), key, ...(key === 'valor' ? ['valor_extenso'] : [])])]
  return { body, html, vars: next, manualKeys }
}

/** Troca {variáveis}; as que não existem ficam como estão (para a pessoa ver e completar). */
export const fillContract = (body: string, vars: Record<string, string>) => body.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
