import { CLOUD, publishPublicBlob, supabase } from './cloud'
import { viewingAsClient } from './viewAs'
import type { Project, ReviewScene, ReviewVersion } from './types'
import { uid } from './utils'

/* Imagens para aprovação: o profissional envia as versões de cada cena na demanda,
   o cliente vê na página dele, marca pontos com comentário e aprova (ou pede ajustes).
   A resposta volta pelo mesmo caminho dos recados (função "avisos") e entra sozinha na demanda. */

const useCloud = () => CLOUD && !viewingAsClient()

/** Reduz a imagem (até 2400 px no lado maior, JPEG): carrega rápido no celular do cliente e ainda mostra detalhe. */
async function prep(file: File, max: number): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => bad(new Error('imagem'))
      i.src = url
    })
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * k))
    const h = Math.max(1, Math.round(img.naturalHeight * k))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    g.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('imagem'))), 'image/jpeg', 0.86))
    return { blob, w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Nova versão de uma cena. Sem nuvem (prévia), a imagem fica menor e guardada nos próprios dados. */
export async function uploadReviewVersion(userId: string, file: File, n: number): Promise<ReviewVersion> {
  const id = uid()
  const at = new Date().toISOString()
  if (!useCloud()) {
    const { blob, w, h } = await prep(file, 1400)
    const url = await new Promise<string>((ok, bad) => {
      const r = new FileReader()
      r.onload = () => ok(String(r.result))
      r.onerror = () => bad(r.error)
      r.readAsDataURL(blob)
    })
    return { id, n, url, w, h, at }
  }
  const { blob, w, h } = await prep(file, 2400)
  const path = `revisao/${id}.jpg`
  const url = await publishPublicBlob(userId, path, blob)
  return { id, n, url, path, w, h, at }
}

export async function removeReviewVersion(userId: string, v: ReviewVersion) {
  if (v.path && useCloud()) await supabase!.storage.from('agenda').remove([`${userId}/${v.path}`]).catch(() => undefined)
}

export const lastVersion = (s: ReviewScene) => s.versions[s.versions.length - 1]

export const REVIEW_STATUS: Record<ReviewScene['status'], string> = { enviada: 'aguardando o cliente', ajustes: 'ajustes pedidos', aprovada: 'aprovada' }

/** O que o cliente manda de volta (vai no campo "code" do aviso). */
export interface ReviewFeedback {
  p: string // demanda
  s: string // cena
  v: number // versão que ele viu
  ok: boolean // aprovou
  pins: { x: number; y: number; text: string }[]
  note?: string
}

/** Aplica a resposta do cliente na demanda. Pedir ajustes conta uma revisão (uma vez por versão). */
export function applyReview(p: Project, fb: ReviewFeedback, at: string, name?: string): { next: Project; scene?: ReviewScene } {
  const scenes = p.review ?? []
  const scene = scenes.find((x) => x.id === fb.s)
  const ver = scene?.versions.find((x) => x.n === fb.v)
  if (!scene || !ver) return { next: p }
  const pins = fb.pins
    .filter((x) => x.text.trim())
    .slice(0, 30)
    .map((x) => ({ id: uid(), x: Math.min(1, Math.max(0, x.x)), y: Math.min(1, Math.max(0, x.y)), text: x.text.trim().slice(0, 500), at }))
  const count = !fb.ok && !ver.counted
  const nextVer: ReviewVersion = { ...ver, pins: [...(ver.pins ?? []), ...pins], ...(fb.note?.trim() ? { note: fb.note.trim().slice(0, 1000) } : {}), ...(count ? { counted: true } : {}) }
  const isLast = lastVersion(scene).n === fb.v
  const nextScene: ReviewScene = {
    ...scene,
    versions: scene.versions.map((x) => (x.id === ver.id ? nextVer : x)),
    // resposta sobre uma versão antiga não muda a situação da cena
    ...(isLast ? (fb.ok ? { status: 'aprovada' as const, approvedAt: at, approvedVersion: fb.v, ...(name ? { by: name } : {}) } : { status: 'ajustes' as const }) : {}),
  }
  return {
    next: { ...p, review: scenes.map((x) => (x.id === scene.id ? nextScene : x)), ...(count ? { revisionsUsed: (p.revisionsUsed ?? 0) + 1 } : {}) },
    scene: nextScene,
  }
}

/** O que vai para a página do cliente (sem caminhos internos). */
export function reviewForPanel(p: Project) {
  const list = (p.review ?? []).filter((s) => s.versions.length)
  if (!list.length) return undefined
  return list.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    approvedVersion: s.approvedVersion,
    versions: s.versions.map((v) => ({ n: v.n, url: v.url, w: v.w, h: v.h, at: v.at, pins: (v.pins ?? []).map((x) => ({ x: x.x, y: x.y, text: x.text, done: !!x.done })), note: v.note })),
  }))
}
export type PanelReview = NonNullable<ReturnType<typeof reviewForPanel>>
