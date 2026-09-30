import { CLOUD, supabase } from './cloud'
import { viewingAsClient } from './viewAs'
import type { VisitPhoto } from './types'

/* Plano Estúdio: fotos da obra e página de acompanhamento do cliente.
   Na nuvem, as fotos ficam numa pasta só da conta (ninguém mais vê); a página do cliente
   é uma cópia resumida do projeto, lida pelo código do link. Na prévia, tudo fica neste navegador. */

const useCloud = () => CLOUD && !viewingAsClient()
const BUCKET = 'obra'

/** Diminui a foto (lado maior até 1600 px, JPEG) para caber bem e abrir rápido no celular. */
export async function compressImage(file: File, max = 1600, quality = 0.78): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k)
    c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('imagem'))), 'image/jpeg', quality))
  } finally {
    URL.revokeObjectURL(url)
  }
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })

/** Guarda uma foto de obra e devolve como ela fica registrada na visita. */
export async function savePhoto(userId: string, projectId: string, file: File): Promise<VisitPhoto> {
  const id = crypto.randomUUID()
  if (!useCloud()) {
    // prévia: imagem menor, guardada junto com os dados deste navegador
    return { id, data: await blobToDataUrl(await compressImage(file, 900, 0.7)) }
  }
  const blob = await compressImage(file)
  const path = `${userId}/${projectId}/${id}.jpg`
  const { error } = await supabase!.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return { id, path }
}

export async function deletePhoto(ph: VisitPhoto) {
  if (ph.path && useCloud()) await supabase!.storage.from(BUCKET).remove([ph.path])
}

/** Endereços para mostrar as fotos (válidos por algumas horas). */
const cache = new Map<string, { url: string; until: number }>()
export async function photoUrls(photos: VisitPhoto[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const need: string[] = []
  for (const ph of photos) {
    if (ph.data) out[ph.id] = ph.data
    else if (ph.path) {
      const c = cache.get(ph.path)
      if (c && c.until > Date.now()) out[ph.id] = c.url
      else need.push(ph.path)
    }
  }
  if (need.length && CLOUD) {
    const { data } = await supabase!.storage.from(BUCKET).createSignedUrls(need, 6 * 3600)
    for (const r of data ?? []) {
      if (!r.signedUrl || !r.path) continue
      cache.set(r.path, { url: r.signedUrl, until: Date.now() + 5 * 3600_000 })
      const ph = photos.find((x) => x.path === r.path)
      if (ph) out[ph.id] = r.signedUrl
    }
  }
  return out
}

/* ---------------- página de acompanhamento do cliente ---------------- */

export interface PortalPayload {
  studio: string
  owner: string
  accent: string
  logo?: string
  phone?: string
  client: string
  title: string
  status: string
  startDate?: string
  dueDate?: string
  deliveredDate?: string | null
  message?: string
  phases: { name: string; start?: string; due?: string; done?: boolean }[]
  payments?: { description: string; amount: number; when: string; paid: boolean; paidDate?: string | null }[]
  total?: number
  paid?: number
  filesLink?: string
  visits?: { date: string; title: string; notes: string; next?: string; photos: number }[]
  updatedAt: string
}

const LOCAL = 'portais-publicos'
const readLocal = (): Record<string, PortalPayload> => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL) || '{}')
  } catch {
    return {}
  }
}

/** Link do cliente. A cópia compacta (sem logo) faz a página abrir mesmo se a nuvem falhar. */
export const portalLink = (token: string, packed?: string) => `${location.origin}${location.pathname}#/acompanhar/${token}${packed ? `/${packed}` : ''}`
export const packPortal = async (p: PortalPayload) => (await import('./linkPack')).pack({ ...p, logo: undefined })

export async function publishPortal(token: string, payload: PortalPayload) {
  if (!useCloud()) {
    const all = readLocal()
    all[token] = payload
    try {
      localStorage.setItem(LOCAL, JSON.stringify(all))
    } catch {
      /* sem espaço */
    }
    return
  }
  const { error } = await supabase!.from('portal_links').upsert({ id: token, payload, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function unpublishPortal(token: string) {
  if (!useCloud()) {
    const all = readLocal()
    delete all[token]
    localStorage.setItem(LOCAL, JSON.stringify(all))
    return
  }
  await supabase!.from('portal_links').delete().eq('id', token)
}

export async function loadPortal(token: string, packed?: string): Promise<PortalPayload | null> {
  // nuvem (sempre a versão mais nova) → este navegador ("ver como cliente" e prévia) → cópia do link
  if (CLOUD) {
    try {
      const { data, error } = await supabase!.rpc('portal_publico', { p_id: token })
      if (!error && data) return data as PortalPayload
    } catch {
      /* tenta os outros jeitos */
    }
  }
  const local = readLocal()[token]
  if (local) return local
  const { unpack } = await import('./linkPack')
  return unpack<PortalPayload>(packed)
}
