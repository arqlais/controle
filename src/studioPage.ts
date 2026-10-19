import { CLOUD, publishPublicFile, readPublicFile, removePublicFile } from './cloud'
import { b64ToUuid, isUuid, uuidToB64 } from './linkPack'
import { viewingAsClient } from './viewAs'
import type { ServiceDef, Settings } from './types'

/* Página do profissional (link para a bio do Instagram): quem é, serviços, fotos e "pedir orçamento".
   Fica num arquivo público da conta (pagina.json). O pedido chega como aviso e vira rascunho de orçamento. */

export interface StudioPageCfg {
  on: boolean
  headline: string // frase de abertura (ex.: "imagens 3D e executivo para escritórios")
  bio: string
  services: string[] // ids dos serviços que aparecem (vazio = todos)
  showPrices: boolean // mostra "a partir de R$ …"
  photos: boolean // mostra as fotos do portfólio
}
export const DEFAULT_PAGE: StudioPageCfg = { on: false, headline: '', bio: '', services: [], showPrices: false, photos: true }

export interface PagePayload {
  studio: string
  owner: string
  headline: string
  bio: string
  city: string
  accent: string
  logo: string
  instagram: string
  whatsapp: string
  website: string
  services: { id: string; name: string; unit: string; from?: number; free?: boolean }[]
  photos: string[]
  updatedAt: string
}

const FILE = 'pagina.json'
const LOCAL = 'pagina-publica'
const useCloud = () => CLOUD && !viewingAsClient()

/** "a partir de": o menor valor por unidade (por m², por imagem, por hora…) que a tabela cobra. Livre: o mínimo. */
export function priceFrom(s: ServiceDef): number {
  if (s.pricing === 'livre') return s.min || 0
  if (s.pricing === 'pacote') return Math.round(Math.min(s.price || Infinity, ...(s.tiers ?? []).filter((t) => t.qty > 0).map((t) => t.price / t.qty)) || 0) || 0
  if (s.pricing === 'm2') return Math.min(s.price || Infinity, ...(s.areaTiers ?? []).map((t) => t.price || Infinity)) === Infinity ? 0 : Math.min(s.price || Infinity, ...(s.areaTiers ?? []).map((t) => t.price || Infinity))
  return s.price || 0
}

export function pagePayload(st: Settings, cfg: StudioPageCfg): PagePayload {
  const list = st.services.filter((s) => s.id !== 'personalizado' && s.name.trim() && (!cfg.services.length || cfg.services.includes(s.id)))
  return {
    studio: (st.brandName || st.ownerName || '').replace(/\.$/, ''),
    owner: st.ownerName || '',
    headline: cfg.headline.trim(),
    bio: cfg.bio.trim(),
    city: st.city || '',
    accent: st.accent || '#a88a80',
    logo: st.logo && st.logo.length < 400_000 ? st.logo : '',
    instagram: (st.instagram || '').replace(/^@/, ''),
    whatsapp: (st.phone || '').replace(/\D/g, ''),
    website: st.website || '',
    services: list.map((s) => ({ id: s.id, name: s.name, unit: s.unit, ...(cfg.showPrices && priceFrom(s) > 0 ? { from: priceFrom(s) } : {}), ...(s.pricing === 'livre' ? { free: true } : {}) })),
    photos: cfg.photos ? (st.portfolio ?? []).filter(Boolean).slice(0, 6) : [],
    updatedAt: new Date().toISOString(),
  }
}

/** Endereço da página (a conta em 22 letras). Sem nuvem (prévia): abre só neste navegador. */
export const pageLink = (userId: string) => `${location.origin}${location.pathname}#/pagina/${useCloud() && isUuid(userId) ? uuidToB64(userId) : 'previa'}`

export async function publishPage(userId: string, payload: PagePayload) {
  if (!useCloud()) {
    try {
      localStorage.setItem(LOCAL, JSON.stringify(payload))
    } catch {
      /* sem espaço */
    }
    return
  }
  await publishPublicFile(userId, FILE, payload)
}

export async function unpublishPage(userId: string) {
  if (!useCloud()) {
    try {
      localStorage.removeItem(LOCAL)
    } catch {
      /* ok */
    }
    return
  }
  await removePublicFile(userId, FILE)
}

export async function loadPage(code: string): Promise<{ data: PagePayload; userId: string } | null> {
  if (code === 'previa' || !CLOUD) {
    try {
      const d = JSON.parse(localStorage.getItem(LOCAL) || 'null') as PagePayload | null
      return d ? { data: d, userId: '' } : null
    } catch {
      return null
    }
  }
  let userId = ''
  try {
    userId = b64ToUuid(code)
  } catch {
    return null
  }
  if (!isUuid(userId)) return null
  const data = await readPublicFile<PagePayload>(userId, FILE)
  return data ? { data, userId } : null
}

/** O que vem junto no pedido (vai no campo "code" do aviso, como texto). */
export interface PageRequest {
  phone: string
  services: string[]
  area?: number
  city?: string
}
