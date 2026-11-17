import type { AccessInfo } from './platform'
import type { Settings } from './types'
import { RDL_LOGO } from './rdlLogo'
import type { ServiceDef } from './types'

/* Sistema da RDL Engenharia: área restrita, separada da planê.
   Mesmo endereço (useplane.com.br/rdl), mas outra identidade e outros dados: tudo fica na tabela
   rdl_workspace (uma linha só, que a Laís e o Rogério dividem) e os arquivos públicos (contratos para
   assinar, propostas) na pasta da RDL. Só entram as contas liberadas no Supabase (função rdl_acesso). */

/** Chave fixa da RDL: no lugar do id da usuária, é com ela que o sistema lê e grava os dados. */
export const RDL_ID = '7d1e0000-0000-4000-8000-00000000d1d1'

const KEY = 'modo-rdl'
const read = (s: Storage) => {
  try {
    return s.getItem(KEY)
  } catch {
    return null
  }
}

/** Esta aba está no sistema da RDL? (a aba manda; sem escolha na aba, vale a do aparelho) */
export function rdlMode(): boolean {
  if (typeof window === 'undefined') return false
  const tab = read(sessionStorage)
  if (tab === '1') return true
  if (tab === '0') return false
  return read(localStorage) === '1'
}

/** Abre o sistema da RDL nesta aba (botão da Laís na planê). */
export function enterRdl() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* ok */
  }
  location.hash = '#/inicio'
  location.reload()
}

/** Volta para a planê nesta aba (e tira a RDL como padrão deste aparelho). */
export function exitRdl() {
  try {
    sessionStorage.setItem(KEY, '0')
    localStorage.removeItem(KEY)
  } catch {
    /* ok */
  }
  location.hash = '#/inicio'
  location.reload()
}

/** Acesso dentro da RDL: tudo do plano mais completo, sem nada da plataforma (assinatura, chat, novidades). */
export const RDL_ACCESS: AccessInfo = {
  role: 'cliente',
  legacy: true,
  sub: {
    userId: RDL_ID,
    email: 'roger.rdl76@yahoo.com.br',
    name: 'Rogério Francisco Vieira',
    studio: 'RDL Engenharia',
    plan: 'estudio',
    status: 'ativa',
    trialEnds: '2099-12-31T00:00:00.000Z',
    blocked: false,
    canceledAt: null,
    createdAt: '2026-11-16T00:00:00.000Z',
    lastSeen: new Date().toISOString(),
    requestedPlan: null,
    requestedAt: null,
    requestedCycle: null,
    testMode: false,
  },
}

/** Identidade da RDL: azul-marinho e laranja do logo, Poppins, dados da empresa. */
export const RDL_SETTINGS: Partial<Settings> = {
  brandName: 'RDL Engenharia',
  tagline: 'engenharia e representações',
  ownerName: 'Rogério Francisco Vieira',
  legalName: 'RDL Engenharia e Representações',
  email: 'roger.rdl76@yahoo.com.br',
  phone: '(11) 9 7520-8296',
  document: '48.624.017/0001-46',
  city: 'Santo André',
  instagram: '',
  website: '',
  logo: RDL_LOGO,
  accent: '#012c60',
  accentSoft: '#ffd2a8',
  accentInk: '#e8710a',
  background: '#f4f6fa',
  surface: '#ffffff',
  text: '#0f1b2d',
  displayFont: 'Poppins',
  bodyFont: 'Poppins',
  workProfile: 'final',
  quoteStart: 100,
}

/** Quem entrou na RDL: a dona (Laís, que pode voltar para a planê) ou o Rogério. */
let role: 'dona' | 'membro' | null = null
export const setRdlRole = (r: typeof role) => {
  role = r
}
export const rdlRole = () => role

/** Página pública (contrato, proposta, painel) feita pela RDL: sem "feito com planê" no rodapé. */
export const isRdlBrand = (studio?: string, owner?: string) => owner === RDL_ID || /^RDL\b/i.test((studio || '').trim())

/** Serviços da RDL que já vêm na tabela de preços (o resto é a tabela de quem atende cliente final). */
export const RDL_SERVICES: ServiceDef[] = [
  { id: 'eng-vistoria', group: 'vistoria e laudos', name: 'vistoria de entrega de chaves (laudo + ART)', unit: 'apartamento', pricing: 'unidade', price: 297, min: 0, hours: 3, tiers: [], askText: 'O que entra na vistoria?', checklistTitle: 'o que inclui', checklist: ['análise da planta e do memorial', 'vistoria presencial de até 2 horas', 'laudo técnico com fotos', 'ART da vistoria'] },
  { id: 'eng-revistoria', group: 'vistoria e laudos', name: 'revistoria (conferir os reparos)', unit: 'visita', pricing: 'unidade', price: 150, min: 0, hours: 1.5, tiers: [] },
]

/** Páginas da RDL (sistema e reserva da vistoria): ícone e nome da aba da RDL, não os da planê. */
export const rdlTab = () => typeof window !== 'undefined' && (rdlMode() || /^#\/?vistoria/.test(location.hash))
export function setRdlFavicon(title?: string) {
  const href = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}rdl/icon.png`
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="shortcut icon"]').forEach((l) => ((l.href = href), l.removeAttribute('type')))
  if (!document.querySelector('link[rel="icon"]')) {
    const l = document.createElement('link')
    l.rel = 'icon'
    l.href = href
    document.head.appendChild(l)
  }
  if (title) document.title = title
}
