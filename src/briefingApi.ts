import { CLOUD, supabase } from './cloud'
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
}
export interface PublicBriefing {
  payload: BriefingPayload
  answered: boolean
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

/** Link que vai para o cliente. */
export const briefingLink = (id: string) => `${location.origin}${location.pathname}#/briefing/${id}`

export async function publishBriefing(id: string, payload: BriefingPayload) {
  if (!useCloud()) {
    const all = readLocal()
    all[id] = { ...all[id], payload }
    writeLocal(all)
    return
  }
  const { error } = await supabase!.from('briefing_links').upsert({ id, payload })
  if (error) throw error
}

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

export async function deleteBriefingLink(id: string) {
  if (!useCloud()) {
    const all = readLocal()
    delete all[id]
    writeLocal(all)
    return
  }
  await supabase!.from('briefing_links').delete().eq('id', id)
}

/** Página pública: lê o briefing pelo código do link. */
export async function loadPublicBriefing(id: string): Promise<PublicBriefing | null> {
  if (!CLOUD) {
    const row = readLocal()[id]
    return row ? { payload: row.payload, answered: !!row.answeredAt } : null
  }
  const { data, error } = await supabase!.rpc('briefing_publico', { p_id: id })
  if (error || !data) return null
  const d = data as { payload: BriefingPayload; respondido: boolean }
  return { payload: d.payload, answered: d.respondido }
}

export async function sendPublicAnswers(id: string, answers: BriefingAnswers) {
  if (!CLOUD) {
    const all = readLocal()
    if (!all[id] || all[id].answeredAt) return false
    all[id] = { ...all[id], answers, answeredAt: new Date().toISOString() }
    writeLocal(all)
    return true
  }
  const { data, error } = await supabase!.rpc('responder_briefing', { p_id: id, p_answers: answers })
  if (error) throw error
  // avisa quem mandou o briefing (por e-mail); se falhar, as respostas já estão salvas
  void supabase!.functions.invoke('avisos', { body: { tipo: 'briefing', id } }).catch(() => undefined)
  return !!data
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
export async function uploadAttachment(briefingId: string, file: File): Promise<string> {
  const { compressImage } = await import('./studioApi')
  if (!CLOUD) return toDataUrl(await compressImage(file, 900, 0.7))
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
