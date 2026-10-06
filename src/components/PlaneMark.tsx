import { useId, useSyncExternalStore } from 'react'

/* Símbolo do Planê: o P em laço, desenhado num traço só.
   Formatos: quadrado e círculo cortados (o traço passa da borda), quadrado e círculo com o
   laço inteiro dentro, ou só o traço. Cada lugar do site tem o seu: a dona troca no painel
   (página de vendas → logotipo), inclusive por uma imagem própria. */

export const LACO = 'M48.5 60.5C62 61 76 55 85 44C94 33 96 18 88 9C80 1 66 1 54 7C40 14 28 30 21 45C14 60 13 78 19 90C23 98 30 99 35 93C42 85 46 72 44 61C42 50 35 44 27 44C19 44 11 46 5 51'

export const MARK = { noite: '#2f3a45', azul: '#3e4b57', rose: '#a88a80', rosa: '#d6b3ab', blush: '#f4e8e5', papel: '#f5f1ee', branco: '#ffffff' }

export type MarkVariant = 'quadrado' | 'circulo' | 'quadrado-inteiro' | 'circulo-inteiro' | 'solto'

export const MARK_VARIANTS: { id: MarkVariant; label: string }[] = [
  { id: 'quadrado', label: 'quadrado cortado' },
  { id: 'circulo', label: 'círculo cortado' },
  { id: 'quadrado-inteiro', label: 'quadrado' },
  { id: 'circulo-inteiro', label: 'círculo' },
  { id: 'solto', label: 'sem fundo' },
]

/* posição do traço em cada formato (o desenho original ocupa -4..104) */
const CUT = 'translate(-7 -5) scale(1.0093) translate(4 4)'
const INSIDE = 'translate(50 51) scale(0.8) translate(-50 -50)'
const FIT: Record<MarkVariant, string> = { solto: 'translate(4 4) scale(0.926)', quadrado: CUT, circulo: CUT, 'quadrado-inteiro': INSIDE, 'circulo-inteiro': INSIDE }
const isSquare = (v: MarkVariant) => v === 'quadrado' || v === 'quadrado-inteiro'
const isCut = (v: MarkVariant) => v === 'quadrado' || v === 'circulo'

/** O símbolo em SVG puro (favicon, ícones, e-mail). */
export function markSvg(v: MarkVariant, bg: string, line: string, stroke = 6) {
  const shape = v === 'solto' ? '' : isSquare(v) ? `<rect width="100" height="100" rx="24" fill="${bg}"/>` : `<circle cx="50" cy="50" r="50" fill="${bg}"/>`
  const clip = isSquare(v) ? '<rect x="0.6" y="0.6" width="98.8" height="98.8" rx="23.4"/>' : '<circle cx="50" cy="50" r="49.4"/>'
  const path = `<path d="${LACO}" fill="none" stroke="${line}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
  const cut = isCut(v)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${cut ? `<defs><clipPath id="c">${clip}</clipPath></defs>` : ''}${shape}<g${cut ? ' clip-path="url(#c)"' : ''}><g transform="${FIT[v]}">${path}</g></g></svg>`
}

/** Símbolo para a interface. */
export function PlaneMark({ variant = 'quadrado', size = 28, bg = MARK.azul, line = MARK.papel, stroke = 6, className = '' }: { variant?: MarkVariant; size?: number; bg?: string; line?: string; stroke?: number; className?: string }) {
  const id = `pm${useId().replace(/:/g, '')}`
  const cut = isCut(variant)
  return (
    <svg className={`plane-mark ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {cut && (
        <defs>
          <clipPath id={id}>{isSquare(variant) ? <rect x="0.6" y="0.6" width="98.8" height="98.8" rx="23.4" /> : <circle cx="50" cy="50" r="49.4" />}</clipPath>
        </defs>
      )}
      {variant !== 'solto' && (isSquare(variant) ? <rect width="100" height="100" rx="24" fill={bg} /> : <circle cx="50" cy="50" r="50" fill={bg} />)}
      <g clipPath={cut ? `url(#${id})` : undefined}>
        <g transform={FIT[variant]}>
          <path className="plane-mark-line" d={LACO} fill="none" stroke={line} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
        </g>
      </g>
    </svg>
  )
}

/* ---------------- logotipo de cada lugar (editável pela dona) ---------------- */

export type MarkPlace = 'icone' | 'menu' | 'topo' | 'rodape' | 'entrar' | 'carregando'
export interface MarkSpec {
  variant: MarkVariant
  bg: string
  line: string
  image?: string // imagem própria (data URL) no lugar do símbolo
}
export const MARK_PLACES: { id: MarkPlace; label: string; hint: string }[] = [
  { id: 'icone', label: 'aba do navegador', hint: 'ícone ao lado do nome da aba' },
  { id: 'menu', label: 'menu do sistema', hint: 'no alto do menu lateral' },
  { id: 'topo', label: 'topo da página de vendas', hint: 'ao lado do nome, no alto' },
  { id: 'rodape', label: 'rodapé da página de vendas', hint: 'no fim da página' },
  { id: 'entrar', label: 'entrar e cadastro', hint: 'sobre o fundo azul' },
  { id: 'carregando', label: 'carregando', hint: 'enquanto o sistema abre' },
]
export const DEFAULT_MARKS: Record<MarkPlace, MarkSpec> = {
  icone: { variant: 'quadrado', bg: MARK.azul, line: MARK.papel },
  menu: { variant: 'quadrado', bg: MARK.azul, line: MARK.papel },
  topo: { variant: 'circulo-inteiro', bg: MARK.rosa, line: MARK.azul },
  rodape: { variant: 'circulo-inteiro', bg: MARK.blush, line: MARK.azul },
  entrar: { variant: 'solto', bg: MARK.rosa, line: MARK.rosa },
  carregando: { variant: 'quadrado', bg: MARK.azul, line: MARK.papel },
}

let marks: Record<MarkPlace, MarkSpec> = DEFAULT_MARKS
const listeners = new Set<() => void>()
/** Troca os logotipos (vindos do painel). Lugar sem escolha fica com o padrão. */
export function setBrandMarks(m?: Partial<Record<MarkPlace, MarkSpec>> | null) {
  marks = { ...DEFAULT_MARKS, ...(m ?? {}) }
  listeners.forEach((f) => f())
}
const subscribe = (f: () => void) => (listeners.add(f), () => void listeners.delete(f))

/** Ícone da aba (imagem própria ou o símbolo desenhado). */
export function markIconUrl(s: MarkSpec) {
  return s.image || `data:image/svg+xml,${encodeURIComponent(markSvg(s.variant, s.bg, s.line, 8))}`
}

/** Símbolo como a dona escolheu para este lugar. `spec` mostra uma escolha ainda não salva (prévia do painel). */
export function BrandMark({ place, size, stroke, className = '', spec }: { place: MarkPlace; size: number; stroke?: number; className?: string; spec?: MarkSpec }) {
  const live = useSyncExternalStore(subscribe, () => marks[place])
  const s = spec ?? live
  if (s.image) return <img className={`plane-mark plane-mark-img ${className}`} src={s.image} width={size} height={size} alt="" />
  // traço mais grosso quando o símbolo é pequeno, para não sumir
  const sw = stroke ?? (size <= 28 ? 9 : size <= 40 ? 8 : size <= 56 ? 7 : 6)
  return <PlaneMark variant={s.variant} bg={s.bg} line={s.line} size={size} stroke={sw} className={className} />
}
