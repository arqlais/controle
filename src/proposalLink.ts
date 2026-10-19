import { CLOUD, publishPublicFile, readPublicFile, removePublicFile } from './cloud'
import { readShortCode, shortCode } from './linkPack'
import { viewingAsClient } from './viewAs'
import { BOTH, allLabel, comboTotal, isCombo, optionTotal, quoteNumber, quoteTotal, shownOptions } from './utils'
import type { Client, Quote, QuoteApproval, Settings } from './types'
import type { Has } from './proposalTemplates'
import { resolveTemplate } from './proposalTemplates'
import { isSlides } from './components/Docs'

/* Link da proposta: a cliente abre (sem conta), vê a proposta, escolhe a opção e aprova.
   Fica num arquivo público da conta (nome impossível de adivinhar), atualizado quando o orçamento muda.
   A aprovação volta pela função "avisos" (como os recados do painel) e aparece na central de avisos. */

export interface ProposalChoice {
  id: string
  label: string // "opção 1 · interiores completo"
  total: number
}

export interface ProposalPayload {
  v: 1
  token: string
  studio: string
  owner: string
  accent: string
  logo?: string
  phone?: string
  client: string // primeiro nome
  clientFull: string
  number: string
  title: string
  total: number
  validUntil?: string
  s: Partial<Settings> // o que o desenho da proposta usa
  quote: Quote
  slides: boolean
  choices: ProposalChoice[] // vazio = valor único
  open: boolean // ainda dá para aprovar (enviada, sem resposta)
  approval?: QuoteApproval
  updatedAt: string
}

const addDays = (iso: string, n: number) => {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Opções que a cliente pode escolher (com "as duas juntas" quando há desconto do combo). */
export function proposalChoices(q: Quote): ProposalChoice[] {
  if (q.mode !== 'opcoes') return []
  const opts = shownOptions(q)
  const word = q.combo ? 'proposta' : 'opção'
  const list = opts.map((o, i) => ({ id: o.id, label: `${word} ${i + 1}${o.name ? ` · ${o.name}` : ''}`, total: optionTotal(o) }))
  if (isCombo(q)) list.push({ id: BOTH, label: `${allLabel(q)} juntas`, total: comboTotal(q) })
  return list
}

export function proposalPayload(st: Settings, client: Client | undefined, q: Quote, has: Has): ProposalPayload {
  const slides = isSlides(q)
  const tpl = resolveTemplate(st.proposal, has)
  // dados internos não vão para a página pública
  const { table: _t, closedNote: _c, projectId: _p, clientApproval: _a, ...rest } = q
  const quote = { ...rest, projectId: '' } as Quote
  return {
    v: 1,
    token: q.shareToken ?? '',
    studio: st.brandName || st.ownerName || '',
    owner: st.ownerName || '',
    accent: st.accent,
    logo: st.logo && st.logo.length < 250_000 ? st.logo : undefined,
    phone: st.phone || undefined,
    client: client?.name.split(' ')[0] ?? '',
    clientFull: client?.name ?? '',
    number: quoteNumber(q),
    title: q.title,
    total: quoteTotal(q, st.urgencyFee),
    validUntil: q.validityDays && q.sentAt ? addDays(q.sentAt, q.validityDays) : undefined,
    s: {
      proposal: { ...st.proposal, template: tpl.id },
      legalName: st.legalName,
      ownerName: st.ownerName,
      brandName: st.brandName,
      email: st.email,
      phone: st.phone,
      instagram: st.instagram,
      website: st.website,
      logo: st.logo,
      signature: st.signature,
      customFont: st.customFont,
      services: st.services,
      urgencyFee: st.urgencyFee,
      ...(slides ? { about: st.about, portfolio: st.portfolio, portfolioPos: st.portfolioPos } : {}),
    },
    quote,
    slides,
    choices: proposalChoices(q),
    open: q.status === 'enviado' && !q.clientApproval,
    approval: q.clientApproval,
    updatedAt: new Date().toISOString(),
  }
}

const useCloud = () => CLOUD && !viewingAsClient()
const fileName = (token: string) => `proposta-${token}.json`
const LOCAL = 'propostas-publicas'
const readLocal = (): Record<string, ProposalPayload> => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) || '{}')
  } catch {
    return {}
  }
}

const base = () => `${location.origin}${location.pathname}`
/** Link curto (conta + proposta) na nuvem; sem nuvem, só abre neste navegador (prévia). */
export const proposalLink = (userId: string, token: string) => {
  const code = useCloud() ? shortCode(userId, token) : ''
  return `${base()}#/proposta/${code || token}`
}

export async function publishProposal(userId: string, payload: ProposalPayload): Promise<boolean> {
  if (!useCloud()) {
    const all = readLocal()
    all[payload.token] = payload
    try {
      localStorage.setItem(LOCAL, JSON.stringify(all))
    } catch {
      /* sem espaço */
    }
    return false
  }
  await publishPublicFile(userId, fileName(payload.token), payload)
  return true
}

/** Tira o link do ar: quem tiver o endereço passa a ver "proposta indisponível". */
export async function unpublishProposal(userId: string, token: string) {
  if (!useCloud()) {
    const all = readLocal()
    delete all[token]
    try {
      localStorage.setItem(LOCAL, JSON.stringify(all))
    } catch {
      /* ok */
    }
    return
  }
  await removePublicFile(userId, fileName(token))
}

export async function loadProposal(raw: string): Promise<{ data: ProposalPayload; userId?: string } | null> {
  const code = raw.includes('.') ? readShortCode(raw) : null
  if (code && CLOUD) {
    const file = await readPublicFile<ProposalPayload>(code.userId, fileName(code.id))
    return file ? { data: file, userId: code.userId } : null
  }
  const local = readLocal()[raw]
  return local ? { data: local } : null
}
