import type { Client, ContractSettings, ContractTemplate, Quote, Settings } from './types'
import { CLIENT_CONTRACTS, LAIS_CONTRACTS } from './contractTemplates'
import { porExtenso } from './components/Docs'
import { PAYMENT_TERMS } from './store'
import { cleanDetail, docKind, money, optionTotal, payerOf, quoteDeal, quoteNumber, shownOptions, showDoc, today, BOTH } from './utils'

/* Contratos: modelos com {variáveis} que o sistema preenche com os dados do
   orçamento, do cliente e do perfil do estúdio. São MODELOS de referência:
   cada profissional deve revisar com um advogado antes de usar. */

export const CONTRACT_VARS: [string, string][] = [
  ['contratante', 'nome ou razão social do cliente'],
  ['doc_contratante', 'CPF/CNPJ do cliente'],
  ['endereco_contratante', 'endereço do cliente'],
  ['email_contratante', 'e-mail do cliente'],
  ['telefone_contratante', 'telefone do cliente'],
  ['contratada', 'seu nome completo'],
  ['doc_contratada', 'seu CPF/CNPJ'],
  ['endereco_contratada', 'seu endereço'],
  ['email_contratada', 'seu e-mail'],
  ['telefone_contratada', 'seu telefone'],
  ['projeto', 'nome do projeto'],
  ['servicos', 'lista de serviços do orçamento'],
  ['valor', 'valor total'],
  ['valor_extenso', 'valor por extenso'],
  ['pagamento', 'forma de pagamento'],
  ['prazo', 'prazo de entrega (texto)'],
  ['prazo_dias', 'prazo em dias úteis (número)'],
  ['quantidade', 'quantidade de imagens/itens'],
  ['entrada', 'entrada (50% do valor)'],
  ['saldo', 'saldo (50% do valor)'],
  ['foro', 'cidade do foro'],
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
  return cs?.templates?.length ? cs : { ...(cs ?? {}), templates: defaultTemplates(owner) }
}

/** Modelo sugerido pelo serviço do orçamento (renderização, modelagem, executivo, por hora). */
export function suggestTemplate(templates: ContractTemplate[], q?: Quote) {
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
function servicesText(q: Quote) {
  const opts = shownOptions(q)
  const items = q.mode === 'opcoes' ? (q.chosenOption === BOTH ? opts.flatMap((o) => o.items) : (opts.find((o) => o.id === q.chosenOption) ?? opts[0])?.items ?? []) : q.items
  const lines = items.filter((i) => i.title.trim() || i.price > 0).map((i) => `• ${i.title || 'serviço'}${cleanDetail(i.detail) ? ` (${cleanDetail(i.detail)})` : ''}${i.description.trim() ? ` — ${i.description.trim().replace(/\n+/g, '; ')}` : ''}`)
  return lines.join('\n') || '• [descreva os serviços]'
}

const blank = (label: string) => `[${label}]`

/** Quantidade de imagens (ou de itens) do orçamento, para "___ imagens renderizadas". */
function quantityOf(q: Quote) {
  const opts = shownOptions(q)
  const items = q.mode === 'opcoes' ? (q.chosenOption === BOTH ? opts.flatMap((o) => o.items) : (opts.find((o) => o.id === q.chosenOption) ?? opts[0])?.items ?? []) : q.items
  const images = items.filter((i) => /render|imagem|ia\b/i.test(`${i.service} ${i.title}`))
  const n = (images.length ? images : items).reduce((acc, i) => acc + (i.quantity || 0), 0)
  return n ? String(n) : blank('quantidade')
}

export function contractVars(s: Settings, q?: Quote, client?: Client): Record<string, string> {
  const payer = payerOf(client)
  const addr = (a?: string, n?: string, city?: string) => [a, n, city].filter((x) => x?.trim()).join(', ')
  const total = q ? (q.mode === 'opcoes' && q.chosenOption !== BOTH && !q.closedValue ? optionTotal(shownOptions(q).find((o) => o.id === q.chosenOption) ?? shownOptions(q)[0] ?? { items: [], discount: 0 }) : quoteDeal(q, s.urgencyFee)) : 0
  return {
    contratante: client ? payer.name : blank('nome do cliente'),
    doc_contratante: payer.doc ? `${docKind(payer.doc) || 'CPF/CNPJ'} ${showDoc(payer.doc)}` : blank('CPF/CNPJ do cliente'),
    endereco_contratante: addr(client?.address, client?.addressNumber, client?.city) || blank('endereço do cliente'),
    contratada: s.legalName || s.ownerName || blank('seu nome completo'),
    doc_contratada: s.document ? `${docKind(s.document) || 'CPF/CNPJ'} ${showDoc(s.document)}` : blank('seu CPF/CNPJ'),
    endereco_contratada: addr(s.address, s.addressNumber, s.city) || blank('seu endereço'),
    projeto: q?.title || blank('projeto'),
    servicos: q ? servicesText(q) : blank('serviços'),
    valor: total ? money(total) : blank('valor'),
    valor_extenso: total ? porExtenso(total) : blank('valor por extenso'),
    pagamento: q?.paymentTerms.trim() || s.defaultPaymentTerms || PAYMENT_TERMS,
    prazo: q?.deadlineDays ? `${q.deadlineDays} dias úteis` : blank('prazo'),
    revisoes: q ? String(q.revisions) : String(s.defaultRevisions),
    arquivos: q?.files || s.proposal.files,
    orcamento: q ? quoteNumber(q) : blank('nº do orçamento'),
    cidade: s.city || blank('cidade'),
    data: longDate(today()),
    email_contratante: client?.email || blank('e-mail do cliente'),
    telefone_contratante: client?.phone || blank('telefone do cliente'),
    email_contratada: s.email || blank('seu e-mail'),
    telefone_contratada: s.phone || blank('seu telefone'),
    prazo_dias: q?.deadlineDays ? String(q.deadlineDays) : blank('prazo'),
    quantidade: q ? quantityOf(q) : blank('quantidade'),
    entrada: total ? money(Math.round((total / 2) * 100) / 100) : blank('entrada'),
    saldo: total ? money(total - Math.round((total / 2) * 100) / 100) : blank('saldo'),
    foro: (s.city || '').replace(/\s*-\s*/, '/') || blank('cidade/UF do foro'),
  }
}

/** Troca {variáveis}; as que não existem ficam como estão (para a pessoa ver e completar). */
export const fillContract = (body: string, vars: Record<string, string>) => body.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
