import type { Client, ContractSettings, ContractTemplate, Quote, Settings } from './types'
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
  ['contratada', 'seu nome completo'],
  ['doc_contratada', 'seu CPF/CNPJ'],
  ['endereco_contratada', 'seu endereço'],
  ['projeto', 'nome do projeto'],
  ['servicos', 'lista de serviços do orçamento'],
  ['valor', 'valor total'],
  ['valor_extenso', 'valor por extenso'],
  ['pagamento', 'forma de pagamento'],
  ['prazo', 'prazo de entrega'],
  ['revisoes', 'rodadas de ajuste incluídas'],
  ['arquivos', 'formatos entregues'],
  ['orcamento', 'número do orçamento'],
  ['cidade', 'sua cidade'],
  ['data', 'data de hoje, por extenso'],
]

const CLAUSULAS_BASE = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS

CONTRATANTE: {contratante}, {doc_contratante}, com endereço em {endereco_contratante}.
CONTRATADA: {contratada}, {doc_contratada}, com endereço em {endereco_contratada}.

As partes acima identificadas têm entre si justo e contratado o seguinte:

CLÁUSULA 1 — DO OBJETO
O presente contrato tem por objeto a prestação dos serviços abaixo, referentes ao projeto "{projeto}", conforme o orçamento {orcamento}:
{servicos}

CLÁUSULA 2 — DO VALOR E DA FORMA DE PAGAMENTO
Pelos serviços, a CONTRATANTE pagará à CONTRATADA o valor total de {valor} ({valor_extenso}), da seguinte forma: {pagamento}.

CLÁUSULA 3 — DO PRAZO
Os serviços serão entregues em {prazo}, contados a partir do recebimento de todas as informações necessárias e do pagamento da entrada. Atrasos no envio de informações ou aprovações pela CONTRATANTE prorrogam o prazo pelo mesmo período.

CLÁUSULA 4 — DOS AJUSTES
Estão incluídas {revisoes} rodada(s) de ajuste. Alterações além dessas, ou mudanças de escopo depois da aprovação, serão orçadas à parte.

CLÁUSULA 5 — DA ENTREGA
Os arquivos serão entregues em: {arquivos}.

CLÁUSULA 6 — DO DIREITO DE USO
A CONTRATADA poderá divulgar as imagens produzidas em seu portfólio e redes sociais, salvo pedido de sigilo feito por escrito pela CONTRATANTE.

CLÁUSULA 7 — DA RESCISÃO
Em caso de desistência depois do início dos trabalhos, os valores já pagos correspondem ao trabalho realizado até a data e não serão devolvidos.

CLÁUSULA 8 — DO FORO
Fica eleito o foro da comarca de {cidade} para dirimir quaisquer dúvidas sobre este contrato.

E, por estarem de acordo, as partes assinam o presente contrato.

{cidade}, {data}.`

export const DEFAULT_CONTRACTS: ContractTemplate[] = [
  { id: 'servicos', name: 'prestação de serviços (completo)', body: CLAUSULAS_BASE },
  {
    id: 'projeto',
    name: 'projeto de arquitetura / interiores',
    body: CLAUSULAS_BASE.replace(
      'CLÁUSULA 6 — DO DIREITO DE USO',
      `CLÁUSULA 6 — DAS ETAPAS
O projeto será desenvolvido em etapas (estudo preliminar, anteprojeto e projeto executivo), e cada etapa depende da aprovação da anterior pela CONTRATANTE. Visitas técnicas e acompanhamento de obra não estão incluídos, salvo se descritos no objeto.

CLÁUSULA 6-A — DO DIREITO DE USO`,
    ),
  },
  {
    id: 'simples',
    name: 'acordo simples (1 página)',
    body: `ACORDO DE PRESTAÇÃO DE SERVIÇOS

Eu, {contratada} ({doc_contratada}), e {contratante} ({doc_contratante}) combinamos o seguinte, conforme o orçamento {orcamento}:

• serviços: {servicos}
• valor total: {valor} ({valor_extenso})
• pagamento: {pagamento}
• prazo: {prazo}
• ajustes incluídos: {revisoes}
• entrega: {arquivos}

Alterações fora do combinado são orçadas à parte. Em caso de desistência depois do início, os valores pagos correspondem ao trabalho já feito.

{cidade}, {data}.`,
  },
]

export const defaultContractSettings = (): ContractSettings => ({ templates: DEFAULT_CONTRACTS })

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
  }
}

/** Troca {variáveis}; as que não existem ficam como estão (para a pessoa ver e completar). */
export const fillContract = (body: string, vars: Record<string, string>) => body.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m))
