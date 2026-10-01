import { CLOUD, publishPublicBlob, publishPublicFile, readPublicFile, removePublicFile, supabase } from './cloud'
import { readShortCode, shortCode } from './linkPack'
import { viewingAsClient } from './viewAs'
import { linkOf } from './components/Briefing'
import { payWhen, projectPaid, projectTotal, quoteTotal, statusInfo } from './utils'
import type { Has } from './proposalTemplates'
import { resolveTemplate } from './proposalTemplates'
import { usesExclusiveContract } from './components/ContractDoc'
import type { BriefingAnswers, BriefingQuestion, BriefingSection, Client, ClientPanel, ContractSignature, Data, PanelFile } from './types'
import type { SavedDoc } from './docTypes'
import { processesOf } from './processes'
import { allTemplates } from './briefingTemplates'

export type PanelDoc = SavedDoc & { stages?: string[]; tpl?: { name: string; sections: BriefingSection[]; questions: BriefingQuestion[] } }

/* Painel do cliente: uma página só dele, aberta pelo link que o profissional manda.
   Junta as demandas (etapas, prazos, pagamentos), contratos, briefings, propostas, documentos e arquivos.
   Fica num arquivo público da conta (nome impossível de adivinhar) e se atualiza sozinho. */

export interface PanelProject {
  id: string
  title: string
  status: string
  startDate?: string
  dueDate?: string
  deliveredDate?: string | null
  phases: { name: string; start?: string; due?: string; done?: boolean; note?: string }[]
  payments?: { description: string; amount: number; when: string; paid: boolean; paidDate?: string | null; due?: string }[]
  total?: number
  paid?: number
  filesLink?: string
  visits?: { date: string; title: string; notes: string; next?: string }[]
}

export interface PanelPayload {
  v: 1
  studio: string
  owner: string
  accent: string
  colors?: { accent: string; soft: string; ink: string; bg: string; surface: string; text: string } // paleta do profissional
  logo?: string
  phone?: string
  email?: string
  instagram?: string
  website?: string
  pix?: string // chave Pix (só quando os pagamentos aparecem)
  client: string // primeiro nome
  clientFull: string
  message?: string
  s: Record<string, unknown> // o que o desenho das folhas usa (contrato, documentos)
  projects: PanelProject[]
  contracts: { id: string; title: string; status: string; body: string; html?: string; signLink?: string; sign?: ContractSignature; exclusive: boolean }[]
  briefings: { id: string; title: string; answered: boolean; link?: string; answeredAt?: string; questions?: BriefingQuestion[]; sections?: BriefingSection[]; answers?: BriefingAnswers }[]
  quotes: { id: string; number: number; title: string; total: number; status: string; date: string; closedAt?: string; validityDays: number }[]
  docs: PanelDoc[]
  files: Omit<PanelFile, 'path'>[]
  links?: { label: string; url: string }[]
  updatedAt: string
}

const QUOTE_STATUS: Record<string, string> = { rascunho: 'em preparo', enviado: 'aguardando sua resposta', aprovado: 'aprovada', recusado: 'não fechada' }
const CONTRACT_STATUS: Record<string, string> = { rascunho: 'em preparo', enviado: 'para assinar', assinado: 'assinado' }

export function panelPayload(d: Data, client: Client, panel: ClientPanel, has: Has): PanelPayload {
  const st = d.settings
  const hidden = new Set(panel.hideProjects ?? [])
  const projects = d.projects
    .filter((p) => p.clientId === client.id && !hidden.has(p.id))
    .sort((a, b) => (b.startDate || b.createdAt).localeCompare(a.startDate || a.createdAt))
    .map<PanelProject>((p) => ({
      id: p.id,
      title: p.title,
      status: statusInfo(p.status).label,
      startDate: p.startDate || undefined,
      dueDate: p.dueDate || undefined,
      deliveredDate: p.deliveredDate,
      // cronograma; sem cronograma, as etapas de trabalho da demanda
      phases: p.phases?.length ? p.phases.map((x) => ({ name: x.name, start: x.start, due: x.due, done: x.done, note: x.note || undefined })) : p.tasks.map((t) => ({ name: t.text, done: t.done })),
      ...(panel.showPayments
        ? {
            payments: p.payments.map((x) => ({ description: x.description, amount: x.amount, when: payWhen(x) === 'conclusao' ? 'na conclusão' : 'no fechamento', paid: !!x.paidDate, paidDate: x.paidDate, due: x.dueDate || undefined })),
            total: projectTotal(p),
            paid: projectPaid(p),
          }
        : {}),
      ...(p.filesLink ? { filesLink: p.filesLink } : {}),
      ...(panel.showVisits ? { visits: (p.visits ?? []).map((v) => ({ date: v.date, title: v.title, notes: v.notes, next: v.next })).sort((a, b) => b.date.localeCompare(a.date)) } : {}),
    }))
  const shareC = new Set(panel.contracts ?? [])
  const contracts = (d.contracts ?? [])
    .filter((c) => c.clientId === client.id && shareC.has(c.id))
    .map((c) => ({ id: c.id, title: c.title, status: CONTRACT_STATUS[c.status] ?? c.status, body: c.body, ...(c.html ? { html: c.html } : {}), signLink: c.sign ? undefined : c.signLink, sign: c.sign, exclusive: usesExclusiveContract(has, c.body) }))
  const briefings = panel.showBriefings
    ? (d.briefings ?? [])
        .filter((b) => b.clientId === client.id)
        .map((b) => {
          const answered = b.status === 'respondido'
          // fotos anexadas ficam guardadas só para o profissional
          const answers = answered ? Object.fromEntries(Object.entries(b.answers ?? {}).filter(([k]) => b.questions.find((q) => q.id === k)?.kind !== 'photos')) : undefined
          return { id: b.id, title: b.title, answered, link: answered ? undefined : linkOf(b), answeredAt: b.answeredAt, ...(answered ? { questions: b.questions.map((q) => ({ ...q, images: undefined, optionImages: undefined })), sections: b.sections, answers } : {}) }
        })
    : []
  const quotes = panel.showQuotes
    ? d.quotes
        .filter((q) => q.clientId === client.id && q.status !== 'rascunho')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((q) => ({ id: q.id, number: q.number, title: q.title, total: q.closedValue || quoteTotal(q, st.urgencyFee), status: QUOTE_STATUS[q.status] ?? q.status, date: (q.sentAt || q.createdAt).slice(0, 10), closedAt: q.closedAt, validityDays: q.validityDays }))
    : []
  const shareD = new Set(panel.docs ?? [])
  const docs = (d.docs ?? [])
    .filter((x) => x.clientId === client.id && shareD.has(x.id))
    .map<PanelDoc>((x) => {
      if (x.kind === 'apresentacao') {
        const project = d.projects.find((p) => p.id === x.deck?.projectId)
        const stages = project?.phases?.length ? project.phases.map((y) => y.name) : processesOf(st)[0]?.steps.map((y) => y.name) ?? []
        const stage = x.deck?.stage ?? (project?.phases?.length ? Math.max(0, project.phases.findIndex((y) => !y.done)) : 2)
        return { ...x, deck: { ...x.deck, stage }, stages }
      }
      if (x.kind === 'briefing') {
        const t = allTemplates(st.briefingTemplates, st.hiddenBriefings)
        const tpl = t.find((y) => y.id === x.briefingTpl) ?? t[0]
        return tpl ? { ...x, tpl: { name: tpl.name, sections: tpl.sections, questions: tpl.questions } } : x
      }
      return x
    })
  const tpl = resolveTemplate(st.proposal, has)
  return {
    v: 1,
    studio: st.brandName || st.ownerName || '',
    owner: st.ownerName || '',
    accent: st.accent,
    colors: { accent: st.accent, soft: st.accentSoft, ink: st.accentInk, bg: st.background, surface: st.surface, text: st.text },
    logo: st.logo && st.logo.length < 250_000 ? st.logo : undefined,
    phone: st.phone || undefined,
    email: st.email || undefined,
    instagram: st.instagram || undefined,
    website: st.website || undefined,
    pix: panel.showPayments && st.pixKey ? st.pixKey : undefined,
    client: client.name.split(' ')[0] ?? '',
    clientFull: client.name,
    message: panel.message?.trim() || undefined,
    // o modelo da folha fica decidido aqui (com o plano de quem publica)
    s: { proposal: { ...st.proposal, template: tpl.id }, legalName: st.legalName, ownerName: st.ownerName, brandName: st.brandName, email: st.email, phone: st.phone, instagram: st.instagram, website: st.website, logo: st.logo, signature: st.signature, customFont: st.customFont },
    projects,
    contracts,
    briefings,
    quotes,
    docs,
    files: (panel.files ?? []).map(({ path: _p, ...f }) => f),
    links: (panel.links ?? []).filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim() || 'link do projeto', url: l.url.trim() })),
    updatedAt: new Date().toISOString(),
  }
}

const useCloud = () => CLOUD && !viewingAsClient()
const fileName = (token: string) => `painel-${token}.json`
const LOCAL = 'paineis-publicos'
const readLocal = (): Record<string, PanelPayload> => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) || '{}')
  } catch {
    return {}
  }
}

const base = () => `${location.origin}${location.pathname}`
/** Link do painel: curto (conta + painel) na nuvem; sem nuvem, só abre neste navegador (prévia). */
export const panelLink = (userId: string, token: string) => {
  const code = useCloud() ? shortCode(userId, token) : ''
  return `${base()}#/cliente/${code || token}`
}

export async function publishPanel(userId: string, token: string, payload: PanelPayload): Promise<boolean> {
  if (!useCloud()) {
    const all = readLocal()
    all[token] = payload
    try {
      localStorage.setItem(LOCAL, JSON.stringify(all))
    } catch {
      /* sem espaço */
    }
    return false
  }
  await publishPublicFile(userId, fileName(token), payload)
  return true
}

export async function unpublishPanel(userId: string, token: string) {
  if (!useCloud()) {
    const all = readLocal()
    delete all[token]
    localStorage.setItem(LOCAL, JSON.stringify(all))
    return
  }
  await removePublicFile(userId, fileName(token)).catch(() => undefined)
}

export async function loadPanel(raw: string): Promise<{ data: PanelPayload; userId?: string } | null> {
  const code = raw.includes('.') ? readShortCode(raw) : null
  if (code && CLOUD) {
    const file = await readPublicFile<PanelPayload>(code.userId, fileName(code.id))
    return file ? { data: file, userId: code.userId } : null
  }
  const local = readLocal()[raw]
  return local ? { data: local } : null
}

/** Envia um arquivo para o painel. Sem nuvem (prévia), só arquivos pequenos, guardados no próprio painel. */
export async function uploadPanelFile(userId: string, file: File): Promise<PanelFile> {
  const id = crypto.randomUUID()
  const at = new Date().toISOString()
  if (!useCloud()) {
    if (file.size > 1_500_000) throw new Error('grande')
    const url = await new Promise<string>((ok, bad) => {
      const r = new FileReader()
      r.onload = () => ok(String(r.result))
      r.onerror = () => bad(r.error)
      r.readAsDataURL(file)
    })
    return { id, name: file.name, url, size: file.size, type: file.type, at }
  }
  const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-80)
  const path = `arquivos/${id}-${safe}`
  const url = await publishPublicBlob(userId, path, file)
  return { id, name: file.name, url, path, size: file.size, type: file.type, at }
}

export async function removePanelFile(userId: string, f: PanelFile) {
  if (f.path && useCloud()) await supabase!.storage.from('agenda').remove([`${userId}/${f.path}`]).catch(() => undefined)
}
