import { CLOUD, publishPublicFile, readPublicFile, removePublicFile, supabase } from './cloud'
import { viewingAsClient } from './viewAs'
import type { BriefingAnswers, BriefingQuestion, BriefingSection } from './types'

/* Briefing online: o arquiteto gera um link, o cliente final responde sem precisar de conta.
   Na nuvem, o link fica numa tabela própria (briefing_links): quem responde só consegue ler
   aquele briefing e mandar as respostas uma vez. Na prévia, tudo fica neste navegador. */

export interface BriefingPayload {
  title: string
  clientName: string
  studio: string
  owner: string
  accent: string
  logo?: string
  intro: string
  questions: BriefingQuestion[]
  sections?: BriefingSection[]
  phone?: string // WhatsApp de quem mandou (plano B: as respostas vão por mensagem)
  email?: string
}
export interface PublicBriefing {
  payload: BriefingPayload
  answered: boolean
  /** de onde veio: nuvem, este navegador ou a cópia dentro do link (sem nuvem: respostas vão pelo WhatsApp) */
  source: 'cloud' | 'file' | 'local' | 'link'
}

const LOCAL = 'briefings-publicos'
type LocalRow = { payload: BriefingPayload; answers?: BriefingAnswers; answeredAt?: string }
const readLocal = (): Record<string, LocalRow> => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) || '{}')
  } catch {
    return {}
  }
}
const writeLocal = (v: Record<string, LocalRow>) => {
  try {
    localStorage.setItem(LOCAL, JSON.stringify(v))
  } catch {
    /* sem espaço */
  }
}
// "ver como cliente" da dona e a prévia: nada vai para a nuvem
const useCloud = () => CLOUD && !viewingAsClient()

/** Link que vai para o cliente (com a cópia compacta, quando houver: abre mesmo sem a nuvem). */
export const briefingLink = (id: string, packed?: string) => `${location.origin}${location.pathname}#/briefing/${id}${packed ? `/${packed}` : ''}`

/** Cópia que vai dentro do link: sem imagens enviadas (pesadas); as ilustrações prontas continuam. */
export function linkCopy(p: BriefingPayload): BriefingPayload {
  const light = (src: string) => !src.startsWith('data:')
  return {
    ...p,
    logo: undefined,
    questions: p.questions.map((q) => ({
      ...q,
      images: q.images?.filter(light),
      optionImages: q.optionImages ? Object.fromEntries(Object.entries(q.optionImages).filter(([, v]) => light(v))) : undefined,
    })),
  }
}
export const packBriefing = async (p: BriefingPayload) => {
  const { pack } = await import('./linkPack')
  return pack(linkCopy(p))
}

/** Publica o briefing: na tabela (respostas voltam sozinhas) e como arquivo público (link curto).
 *  Devolve o que deu certo; só falha se nenhum dos dois funcionou. */
export async function publishBriefing(id: string, payload: BriefingPayload, userId?: string): Promise<{ table: boolean; file: boolean }> {
  if (!useCloud()) {
    const all = readLocal()
    all[id] = { ...all[id], payload }
    writeLocal(all)
    return { table: true, file: false }
  }
  const [t, f] = await Promise.allSettled([
    supabase!
      .from('briefing_links')
      .upsert({ id, payload })
      .then(({ error }) => {
        if (error) throw error
      }),
    userId ? publishPublicFile(userId, `briefing-${id}.json`, payload) : Promise.reject(new Error('sem conta')),
  ])
  const out = { table: t.status === 'fulfilled', file: f.status === 'fulfilled' }
  if (!out.table && !out.file) throw new Error('nuvem')
  return out
}

/** Link curto: /#/b/<conta.briefing> (o conteúdo fica no arquivo público). */
export const briefingShortLink = (code: string) => `${location.origin}${location.pathname}#/b/${code}`

/** Respostas que chegaram (só dos briefings desta conta). */
export async function fetchAnswers(ids: string[]): Promise<Record<string, { answers: BriefingAnswers; answeredAt: string }>> {
  if (!ids.length) return {}
  if (!useCloud()) {
    const all = readLocal()
    return Object.fromEntries(ids.filter((id) => all[id]?.answeredAt).map((id) => [id, { answers: all[id].answers ?? {}, answeredAt: all[id].answeredAt! }]))
  }
  const { data, error } = await supabase!.from('briefing_links').select('id, answers, answered_at').in('id', ids).not('answered_at', 'is', null)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [String(r.id), { answers: (r.answers ?? {}) as BriefingAnswers, answeredAt: String(r.answered_at) }]))
}

export async function deleteBriefingLink(id: string, userId?: string) {
  if (userId && useCloud()) void removePublicFile(userId, `briefing-${id}.json`).catch(() => undefined)
  if (!useCloud()) {
    const all = readLocal()
    delete all[id]
    writeLocal(all)
    return
  }
  await supabase!.from('briefing_links').delete().eq('id', id)
}

/** Página pública: lê o briefing pelo código do link. Ordem: nuvem → este navegador → cópia do link. */
export async function loadPublicBriefing(id: string, packed?: string, userId?: string): Promise<PublicBriefing | null> {
  if (CLOUD) {
    try {
      const { data, error } = await supabase!.rpc('briefing_publico', { p_id: id })
      if (!error && data) {
        const d = data as { payload: BriefingPayload; respondido: boolean }
        return { payload: d.payload, answered: d.respondido, source: 'cloud' }
      }
    } catch {
      /* sem nuvem: tenta os outros jeitos */
    }
  }
  if (CLOUD && userId) {
    const file = await readPublicFile<BriefingPayload>(userId, `briefing-${id}.json`)
    if (file) return { payload: file, answered: false, source: 'file' }
  }
  const row = readLocal()[id]
  if (row) return { payload: row.payload, answered: !!row.answeredAt, source: 'local' }
  const { unpack } = await import('./linkPack')
  const copy = await unpack<BriefingPayload>(packed)
  return copy ? { payload: copy, answered: false, source: 'link' } : null
}

/** Manda as respostas. `false` = não salvou (a página oferece mandar pelo WhatsApp). */
export async function sendPublicAnswers(id: string, answers: BriefingAnswers, source: PublicBriefing['source']) {
  if (source === 'local') {
    const all = readLocal()
    if (!all[id] || all[id].answeredAt) return false
    all[id] = { ...all[id], answers, answeredAt: new Date().toISOString() }
    writeLocal(all)
    return true
  }
  if ((source !== 'cloud' && source !== 'file') || !CLOUD) return false
  try {
    const { data, error } = await supabase!.rpc('responder_briefing', { p_id: id, p_answers: answers })
    if (error || !data) return false
  } catch {
    return false
  }
  // avisa quem mandou o briefing (por e-mail); se falhar, as respostas já estão salvas
  void supabase!.functions.invoke('avisos', { body: { tipo: 'briefing', id } }).catch(() => undefined)
  return true
}

/* ---------------- fotos que o cliente anexa no briefing ---------------- */

const ATT = 'briefing-anexos'
const toDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })

/** Guarda uma foto enviada pelo cliente (diminuída) e devolve como ela fica na resposta. */
export async function uploadAttachment(briefingId: string, file: File, cloud = CLOUD): Promise<string> {
  const { compressImage } = await import('./studioApi')
  if (!cloud) return toDataUrl(await compressImage(file, 900, 0.7))
  const blob = await compressImage(file)
  const path = `${briefingId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase!.storage.from(ATT).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

/** Endereços para ver as fotos anexadas (só quem mandou o briefing consegue). */
export async function attachmentUrls(values: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const paths = values.filter((v) => !v.startsWith('data:'))
  values.filter((v) => v.startsWith('data:')).forEach((v) => (out[v] = v))
  if (paths.length && CLOUD) {
    const { data } = await supabase!.storage.from(ATT).createSignedUrls(paths, 6 * 3600)
    for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl
  }
  return out
}

/** Imagem de referência do arquiteto (vai junto com as perguntas, pequena). */
export async function referenceImage(file: File): Promise<string> {
  const { compressImage } = await import('./studioApi')
  return toDataUrl(await compressImage(file, 800, 0.72))
}
