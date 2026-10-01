import type { Feature } from './plans'
import type { ProposalStyle, Settings } from './types'

/* Identidade visual: cartela de fontes, paletas prontas e combinações de fontes.
   A The Seasons e a paleta "laís" são exclusivas da dona (identidade do negócio dela);
   os clientes usam as fontes abaixo, todas gratuitas para uso comercial (Google Fonts). */

// fontes embutidas no sistema (mesma origem: funcionam no app e no PDF)
import '@fontsource/playfair-display/latin-400.css'
import '@fontsource/playfair-display/latin-400-italic.css'
import '@fontsource/dm-serif-display/latin-400.css'
import '@fontsource/dm-serif-display/latin-400-italic.css'
import '@fontsource/fraunces/latin-400.css'
import '@fontsource/fraunces/latin-400-italic.css'
import '@fontsource/bodoni-moda/latin-400.css'
import '@fontsource/bodoni-moda/latin-400-italic.css'
import '@fontsource/lora/latin-400.css'
import '@fontsource/lora/latin-400-italic.css'
import '@fontsource/eb-garamond/latin-400.css'
import '@fontsource/eb-garamond/latin-400-italic.css'
import '@fontsource/libre-baskerville/latin-400.css'
import '@fontsource/libre-baskerville/latin-400-italic.css'
import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-600.css'
import '@fontsource/montserrat/latin-700.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/dm-sans/latin-400.css'
import '@fontsource/dm-sans/latin-500.css'
import '@fontsource/dm-sans/latin-600.css'
import '@fontsource/dm-sans/latin-700.css'
import '@fontsource/lato/latin-400.css'
import '@fontsource/lato/latin-700.css'
import '@fontsource/raleway/latin-400.css'
import '@fontsource/raleway/latin-500.css'
import '@fontsource/raleway/latin-600.css'
import '@fontsource/raleway/latin-700.css'
import '@fontsource/nunito-sans/latin-400.css'
import '@fontsource/nunito-sans/latin-600.css'
import '@fontsource/nunito-sans/latin-700.css'
import '@fontsource/work-sans/latin-400.css'
import '@fontsource/work-sans/latin-500.css'
import '@fontsource/work-sans/latin-600.css'
import '@fontsource/work-sans/latin-700.css'
import '@fontsource/jost/latin-400.css'
import '@fontsource/jost/latin-500.css'
import '@fontsource/jost/latin-600.css'
import '@fontsource/jost/latin-700.css'
import '@fontsource/manrope/latin-400.css'
import '@fontsource/manrope/latin-500.css'
import '@fontsource/manrope/latin-600.css'
import '@fontsource/manrope/latin-700.css'

type Has = (f: Feature) => boolean

/** Fonte exclusiva da dona. */
export const EXCLUSIVE_FONT = 'The Seasons'
/** Fonte enviada pelo próprio cliente (arquivo dele). */
export const OWN_FONT = 'Minha fonte'
/** Fonte do texto enviada pelo próprio cliente. */
export const OWN_BODY_FONT = 'Minha fonte (texto)'
/** Padrão dos clientes: serifada elegante em itálico, parecida com a The Seasons. */
export const CLIENT_DISPLAY = 'Playfair Display'

export const DISPLAY_FONTS: { name: string; mood: string }[] = [
  { name: 'Playfair Display', mood: 'elegante, alto contraste' },
  { name: 'Cormorant Garamond', mood: 'delicada, clássica' },
  { name: 'DM Serif Display', mood: 'marcante, moderna' },
  { name: 'Bodoni Moda', mood: 'sofisticada, de revista' },
  { name: 'Fraunces', mood: 'suave, orgânica' },
  { name: 'EB Garamond', mood: 'atemporal' },
  { name: 'Lora', mood: 'acolhedora' },
  { name: 'Libre Baskerville', mood: 'tradicional, séria' },
]

export const BODY_FONTS: { name: string; mood: string }[] = [
  { name: 'Poppins', mood: 'geométrica, amigável' },
  { name: 'Montserrat', mood: 'forte, arquitetônica' },
  { name: 'Inter', mood: 'neutra, muito legível' },
  { name: 'DM Sans', mood: 'limpa, moderna' },
  { name: 'Manrope', mood: 'contemporânea' },
  { name: 'Jost', mood: 'geométrica, leve' },
  { name: 'Work Sans', mood: 'direta' },
  { name: 'Raleway', mood: 'fina, elegante' },
  { name: 'Nunito Sans', mood: 'suave' },
  { name: 'Lato', mood: 'discreta' },
]

/** Combinações prontas (título + texto). */
export const FONT_PAIRS: { name: string; display: string; body: string }[] = [
  { name: 'elegante', display: 'Playfair Display', body: 'Poppins' },
  { name: 'delicada', display: 'Cormorant Garamond', body: 'Montserrat' },
  { name: 'moderna', display: 'DM Serif Display', body: 'DM Sans' },
  { name: 'revista', display: 'Bodoni Moda', body: 'Inter' },
  { name: 'orgânica', display: 'Fraunces', body: 'Nunito Sans' },
  { name: 'atemporal', display: 'EB Garamond', body: 'Lato' },
  { name: 'arquitetônica', display: 'Libre Baskerville', body: 'Jost' },
  { name: 'acolhedora', display: 'Lora', body: 'Work Sans' },
  { name: 'contemporânea', display: 'Playfair Display', body: 'Manrope' },
  { name: 'fina', display: 'Cormorant Garamond', body: 'Raleway' },
]

export interface Palette {
  name: string
  accent: string // cor principal (botões, faixa da proposta)
  accentSoft: string // cor de apoio
  accentInk: string // itálicos e rótulos
  background: string
  surface: string
  text: string
  owner?: boolean // exclusiva da dona
}

export const PALETTES: Palette[] = [
  { name: 'laís (site)', accent: '#3e4b57', accentSoft: '#d6b3ab', accentInk: '#a88a80', background: '#f5f1ee', surface: '#ffffff', text: '#3e4b57', owner: true },
  { name: 'areia & carvão', accent: '#2f2f2f', accentSoft: '#cdb89c', accentInk: '#9b8264', background: '#f6f2ec', surface: '#ffffff', text: '#2a2a2a' },
  { name: 'galeria', accent: '#111111', accentSoft: '#b5b5b5', accentInk: '#6f6f6f', background: '#fafafa', surface: '#ffffff', text: '#111111' },
  { name: 'terracota', accent: '#a4553a', accentSoft: '#e0bfa6', accentInk: '#b06a4f', background: '#f7f0ea', surface: '#fffdfb', text: '#2b211c' },
  { name: 'oliva', accent: '#4f5b3a', accentSoft: '#c9c0a0', accentInk: '#7b7a53', background: '#f3f2eb', surface: '#ffffff', text: '#1f2419' },
  { name: 'sálvia', accent: '#5f7563', accentSoft: '#c6d3c3', accentInk: '#7f9683', background: '#f2f5f1', surface: '#ffffff', text: '#243027' },
  { name: 'azul concreto', accent: '#2f4a6b', accentSoft: '#b3c0cd', accentInk: '#5d7896', background: '#eef1f4', surface: '#ffffff', text: '#1a2230' },
  { name: 'oceano', accent: '#1f5f6b', accentSoft: '#a9d0d3', accentInk: '#3f8a93', background: '#eef6f6', surface: '#ffffff', text: '#153238' },
  { name: 'rosé', accent: '#8a4b5a', accentSoft: '#e5c4c7', accentInk: '#b07683', background: '#f9f2f1', surface: '#ffffff', text: '#2a1d20' },
  { name: 'vinho', accent: '#6b2737', accentSoft: '#d9b3b6', accentInk: '#9a5563', background: '#f7f0ef', surface: '#ffffff', text: '#2a1418' },
  { name: 'lavanda', accent: '#5b5478', accentSoft: '#cfc8e3', accentInk: '#8479a6', background: '#f4f2f8', surface: '#ffffff', text: '#24203a' },
  { name: 'mostarda', accent: '#3d3a33', accentSoft: '#e3c16f', accentInk: '#b08a2e', background: '#f8f4e9', surface: '#ffffff', text: '#2d2a23' },
  { name: 'cacau', accent: '#5a3e32', accentSoft: '#d6bca8', accentInk: '#9a735e', background: '#f5efea', surface: '#fffcfa', text: '#2e211b' },
  { name: 'musgo', accent: '#2f3d2c', accentSoft: '#b9c2a4', accentInk: '#6b7a55', background: '#f1f2ec', surface: '#ffffff', text: '#1d261b' },
  { name: 'pedra', accent: '#55595c', accentSoft: '#cfcac3', accentInk: '#8b857c', background: '#f3f2f0', surface: '#ffffff', text: '#2b2d2f' },
  { name: 'linho', accent: '#6d6152', accentSoft: '#e4d8c6', accentInk: '#a08d72', background: '#faf7f1', surface: '#ffffff', text: '#3a3229' },
  { name: 'menta', accent: '#2f6b5a', accentSoft: '#bfe0d3', accentInk: '#4f9580', background: '#f0f7f4', surface: '#ffffff', text: '#18332b' },
  { name: 'noite', accent: '#23283a', accentSoft: '#c9a96e', accentInk: '#a8884f', background: '#f3f1ec', surface: '#ffffff', text: '#1b1f2c' },
  { name: 'coral', accent: '#c4604f', accentSoft: '#f4c9bd', accentInk: '#b0584a', background: '#fbf3f0', surface: '#ffffff', text: '#3a2420' },
]

const hex = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mixHex = (a: string, b: string, t: number) =>
  '#' +
  hex(a)
    .map((v, i) => Math.round(v + (hex(b)[i] - v) * t))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')

/** Cores da proposta a partir de uma paleta (faixa, rótulos, total, fundo e texto). */
export const paletteToProposal = (p: Pick<Palette, 'accent' | 'accentSoft' | 'accentInk' | 'background' | 'text'>): Pick<ProposalStyle, 'ink' | 'rose' | 'arch' | 'paper' | 'bar'> => ({
  bar: p.accent,
  ink: p.text,
  rose: p.accentInk,
  arch: mixHex(p.accentSoft, '#ffffff', 0.35),
  paper: mixHex(p.background, '#ffffff', 0.4),
})

export const fontAllowed = (name: string, has: Has) => name !== EXCLUSIVE_FONT || has('fonteExclusiva')

/** Visual que vale para esta conta: a The Seasons só aparece para a dona. */
export function effectiveSettings(s: Settings, has: Has): Settings {
  // identidade própria (cores e fontes) é do Completo; no Essencial fica o visual padrão da plataforma
  if (!has('identidade')) {
    const kit = PALETTES.find((p) => p.name === 'areia & carvão')!
    return { ...s, accent: kit.accent, accentSoft: kit.accentSoft, accentInk: kit.accentInk, background: kit.background, surface: kit.surface, text: kit.text, displayFont: CLIENT_DISPLAY, customFont: '', customBodyFont: '', bodyFont: 'Poppins' }
  }
  if (fontAllowed(s.displayFont, has)) return s
  return { ...s, displayFont: CLIENT_DISPLAY, customFont: '' }
}

/** Fonte dos títulos da proposta (a exclusiva vira a padrão dos clientes). */
export const proposalSerif = (serif: string, has: Has) => (fontAllowed(serif, has) ? serif : CLIENT_DISPLAY)
